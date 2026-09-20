import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import generateAIResponse, {streamAIResponse} from "../service/openRouter.js";
import {estimateTokens} from "../service/contextBuilder.js";
import {settleTokens, refundTokens} from "../service/quotaService.js";
import {maybeSummarize} from "../service/summaryService.js";
import {prepareTurn, reserveForTurn, saveTurn, getMaxReplyTokens} from "../service/chatService.js";
import "dotenv/config";
//getMessage, sendMessage

export const getMessage = async(req, res) => {
    try{
        const {chatId} = req.params;

        const chat = await Chat.findOne({
            _id : chatId,
            userId : req.user._id
        });

        if(!chat){
            return res.status(404).json({
                message : "Chat Not Found"
            });
        }

        const messages = await Message.find({
            chatId : chatId
        }).sort({createdAt : 1, _id : 1});

        res.status(200).json({
            message : "Your all messages are here",
            msg : messages
        });


    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal server error"
        })
    }
}

export const sendMessage = async(req, res) => {
  // tokens reserved from the user's quota, given back if the request fails before they are settled
  let reservedTokens = 0;

  try {
    const { chatId } = req.params;
    const { content, model } = req.body;

    // 1-4. Validate, find the chat, rebuild the context (throws 400/404 errors)
    const turn = await prepareTurn({user: req.user, chatId, content, model});

    // 5. Reserve tokens in one atomic step (throws 429 when the user is out of budget)
    reservedTokens = await reserveForTurn(req.user, turn.promptTokenEstimate);

    // 6. Get the AI reply (the model is fixed when the chat is created)
    const {aiReply, usage, modelUsed} = await generateAIResponse({
      model: turn.chatModel,
      messages: turn.messages,
      maxTokens: getMaxReplyTokens()
    });

    // 7. Replace the reservation with the real cost (fall back to our estimate if the provider sent no usage)
    const actualTokens = usage.totalTokens || (turn.promptTokenEstimate + estimateTokens(aiReply));
    const updatedUsage = await settleTokens(req.user._id, reservedTokens, actualTokens);
    reservedTokens = 0;

    // 8. Save the chat (if new) and both messages, only after the AI answered
    const {chat, userMessage, assistantMessage} = await saveTurn({
      user: req.user,
      chat: turn.chat,
      chatModel: turn.chatModel,
      text: turn.text,
      sentAt: turn.sentAt,
      aiReply,
      usage,
      modelUsed
    });

    // 9. Send response
    res.status(201).json({
      message: "Message sent successfully",
      chatId: chat._id,
      userMessage,
      assistantMessage,
      usage,
      quota: updatedUsage
    });

    // 10. Fold old messages into the summary in the background (the user already has the reply)
    maybeSummarize(chat._id, req.user._id);

  }
    catch(err){
        // the AI failed or something broke before settling, so the user must not pay for the reservation
        if(reservedTokens > 0){
            await refundTokens(req.user._id, reservedTokens);
        }

        if(err.status){
            return res.status(err.status).set(err.headers || {}).json({
                message : err.message,
                ...err.extra
            });
        }

        console.log(err);
        res.status(500).json({
            message : "Internal server error"
        })
    }
}

// Server-Sent Events: one normal HTTP response that stays open and the server writes small text events into it.
// Each event looks like "event: token\ndata: {...}\n\n". (SSE is one-way, server -> browser, which is all a
// chat reply needs; WebSocket would be two-way and needs more setup.)
const sendEvent = async (res, event, data)=>{
    if(res.destroyed || res.writableEnded){
        return;
    }

    const canWriteMore = res.write("event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n");

    // Backpressure: the socket buffer is full (slow client), wait until it drains before writing more.
    // "close" is also awaited, otherwise a client that vanished would keep us waiting forever.
    if(!canWriteMore && !res.destroyed){
        await new Promise((resolve)=>{
            res.once("drain", resolve);
            res.once("close", resolve);
        });
    }
}

export const streamMessage = async(req, res) => {
  let reservedTokens = 0;
  let heartbeat = null;
  const abortController = new AbortController();

  // The browser pressed stop or closed the tab before we finished: tell the AI provider to stop writing too,
  // otherwise it keeps generating (and spending tokens) for nobody. "close" also fires after a normal
  // res.end(), that is why writableEnded is checked.
  res.on("close", ()=>{
    if(!res.writableEnded){
      abortController.abort();
    }
  });

  try {
    const { chatId } = req.params;
    const { content, model } = req.body;

    // 1-5. Same checks as sendMessage. Errors here are still normal JSON errors, the stream has not started.
    const turn = await prepareTurn({user: req.user, chatId, content, model});
    reservedTokens = await reserveForTurn(req.user, turn.promptTokenEstimate);

    // 6. From here on the response is an event stream
    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();

    // a comment line (starts with ":") is ignored by browsers, it only keeps proxies from closing an idle connection
    heartbeat = setInterval(()=>{
      if(!res.destroyed && !res.writableEnded){
        res.write(": ping\n\n");
      }
    }, 15000);

    await sendEvent(res, "start", {});

    const result = await streamAIResponse({
      model: turn.chatModel,
      messages: turn.messages,
      maxTokens: getMaxReplyTokens(),
      signal: abortController.signal,
      onThinking: ()=> sendEvent(res, "thinking", {}),
      onToken: (text)=> sendEvent(res, "token", {text})
    });

    // 7. Stopped before a single word arrived: nothing to save, the reservation is refunded below
    if(!result.aiReply){
      await refundTokens(req.user._id, reservedTokens);
      reservedTokens = 0;
      res.end();
      return;
    }

    // A stopped reply has no usage numbers from the provider, so its cost is estimated
    const usage = result.usage || {
      promptTokens: turn.promptTokenEstimate,
      completionTokens: estimateTokens(result.aiReply),
      totalTokens: turn.promptTokenEstimate + estimateTokens(result.aiReply)
    };

    const updatedUsage = await settleTokens(req.user._id, reservedTokens, usage.totalTokens);
    reservedTokens = 0;

    // 8. Save what we have (a partial reply is saved too and marked interrupted)
    const {chat, userMessage, assistantMessage} = await saveTurn({
      user: req.user,
      chat: turn.chat,
      chatModel: turn.chatModel,
      text: turn.text,
      sentAt: turn.sentAt,
      aiReply: result.aiReply,
      usage,
      modelUsed: result.modelUsed,
      interrupted: result.interrupted
    });

    // 9. Final event carries the saved records, the client swaps its temporary text for them
    await sendEvent(res, "done", {
      chatId: chat._id,
      userMessage,
      assistantMessage,
      usage,
      quota: updatedUsage
    });
    res.end();

    // 10. Fold old messages into the summary in the background
    maybeSummarize(chat._id, req.user._id);

  }
    catch(err){
        if(reservedTokens > 0){
            await refundTokens(req.user._id, reservedTokens);
        }

        if(!err.status){
            console.log(err);
        }

        // once the stream started we can no longer change the status code, so the error travels as an event
        if(res.headersSent){
            await sendEvent(res, "error", {
                message : err.status ? err.message : "Internal server error"
            });
            return res.end();
        }

        if(err.status){
            return res.status(err.status).set(err.headers || {}).json({
                message : err.message,
                ...err.extra
            });
        }

        res.status(500).json({
            message : "Internal server error"
        })
    }
    finally{
        clearInterval(heartbeat);
    }
}
