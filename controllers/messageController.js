import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import generateAIResponse from "../service/openRouter.js";
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
