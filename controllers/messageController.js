import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import generateAIResponse from "../service/openRouter.js";
import {buildContext, estimateTokens} from "../service/contextBuilder.js";
import {reserveTokens, settleTokens, refundTokens, getUsage} from "../service/quotaService.js";
import {isModelAllowed} from "../config/models.js";
import "dotenv/config";
//getMessage, sendMessage

const MAX_MESSAGE_LENGTH = 4000;

// how many recent messages are read from the database for one request
const HISTORY_FETCH_LIMIT = 40;

// env values are read when a request comes in, not when the file loads
const getMaxContextTokens = ()=> Number(process.env.MAX_CONTEXT_TOKENS) || 3000;
const getMaxReplyTokens = ()=> Number(process.env.MAX_REPLY_TOKENS) || 1500;

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
    const sentAt = new Date();

    // 1. Validate message content
    if (typeof content !== "string" || content.trim() === "") {
      return res.status(400).json({
        message: "Message content is required"
      });
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        message: "Message is too long (max " + MAX_MESSAGE_LENGTH + " characters)"
      });
    }

    const text = content.trim();
    let chat = null;
    let chatModel = model;
    let history = [];

    // 2. Existing chat case (chatId format is already checked by router.param)
    if (chatId) {
      chat = await Chat.findOne({
        _id: chatId,
        userId: req.user._id
      });

      if (!chat) {
        return res.status(404).json({
          message: "Chat not found"
        });
      }

      chatModel = chat.model;

      const recent = await Message.find({chatId: chat._id})
      .sort({createdAt: -1, _id: -1})
      .limit(HISTORY_FETCH_LIMIT)
      .select("role content")
      .lean();

      history = recent.reverse();
    }

    // 3. New chat case (the chat itself is only created after the AI answers, so a failure leaves nothing behind)
    else {
      if (!model) {
        return res.status(400).json({
          message: "Model is required for new chat"
        });
      }

      if (!isModelAllowed(model)) {
        return res.status(400).json({
          message: "This model is not allowed"
        });
      }
    }

    // 4. Rebuild the context: the AI remembers nothing, so we send the recent history every time
    history.push({role: "user", content: text});

    const {messages, promptTokenEstimate} = buildContext({
      systemPrompt: process.env.SYSTEM_PROMPT || undefined,
      summary: chat ? chat.summary : "",
      history,
      maxContextTokens: getMaxContextTokens()
    });

    // 5. Reserve tokens (worst case = prompt + the longest reply allowed) in one atomic step
    const toReserve = promptTokenEstimate + getMaxReplyTokens();
    const quota = await reserveTokens(req.user._id, toReserve);

    if (!quota) {
      const current = await getUsage(req.user._id);
      const retryAfter = Math.max(1, Math.ceil((new Date(current.resetAt) - Date.now()) / 1000));
      res.set("Retry-After", String(retryAfter));

      return res.status(429).json({
        message: "Token limit reached, try again after your window resets",
        tokenLimit: current.tokenLimit,
        resetAt: current.resetAt
      });
    }
    reservedTokens = toReserve;

    // 6. Get the AI reply (the model is fixed when the chat is created)
    const {aiReply, usage, modelUsed} = await generateAIResponse({
      model: chatModel,
      messages,
      maxTokens: getMaxReplyTokens()
    });

    // 7. Replace the reservation with the real cost (fall back to our estimate if the provider sent no usage)
    const actualTokens = usage.totalTokens || (promptTokenEstimate + estimateTokens(aiReply));
    const updatedUsage = await settleTokens(req.user._id, reservedTokens, actualTokens);
    reservedTokens = 0;

    // 8. Save the chat (if new) and both messages, only after the AI answered
    if (!chat) {
      chat = await Chat.create({
        userId: req.user._id,
        model: chatModel,
        topic: text.slice(0, 40)
      });
    }

    const userMessage = await Message.create({
      chatId: chat._id,
      role: "user",
      content: text,
      tokens: estimateTokens(text),
      userId: req.user._id,
      createdAt: sentAt
    });

    const assistantMessage = await Message.create({
      chatId: chat._id,
      role: "assistant",
      content: aiReply,
      tokens: usage.completionTokens,
      usage,
      model: modelUsed,
      userId: req.user._id
    });

    // 9. Update chat metadata with atomic $inc (two tabs sending at once cannot overwrite each other)
    const chatUpdate = {
      $inc: {
        messageCount: 2,
        "usage.promptTokens": usage.promptTokens,
        "usage.completionTokens": usage.completionTokens,
        "usage.totalTokens": usage.totalTokens
      }
    };

    // If topic is still default (chat made through createChat), update it from first message
    if (chat.topic === "New Chat") {
      chatUpdate.$set = {topic: text.slice(0, 40)};
    }

    await Chat.updateOne({_id: chat._id}, chatUpdate);

    // 10. Send response
    res.status(201).json({
      message: "Message sent successfully",
      chatId: chat._id,
      userMessage,
      assistantMessage,
      usage,
      quota: updatedUsage
    });

  }
    catch(err){
        // the AI failed or something broke before settling, so the user must not pay for the reservation
        if(reservedTokens > 0){
            await refundTokens(req.user._id, reservedTokens);
        }

        if(err.status){
            return res.status(err.status).json({
                message : err.message
            });
        }

        console.log(err);
        res.status(500).json({
            message : "Internal server error"
        })
    }
}
