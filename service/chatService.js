import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import {buildContext, estimateTokens} from "./contextBuilder.js";
import {reserveTokens, getUsage} from "./quotaService.js";
import {isModelAllowed} from "../config/models.js";
import "dotenv/config";

// The steps that "send a message" and "stream a message" have in common live here,
// so the two controllers only differ in HOW the AI reply is delivered.

const MAX_MESSAGE_LENGTH = 4000;

// how many recent messages are read from the database for one request
const HISTORY_FETCH_LIMIT = 40;

// env values are read when a request comes in, not when the file loads
export const getMaxContextTokens = ()=> Number(process.env.MAX_CONTEXT_TOKENS) || 3000;
export const getMaxReplyTokens = ()=> Number(process.env.MAX_REPLY_TOKENS) || 1500;

// an error that already knows which HTTP status the client should get
export const httpError = (status, message, extra = {}, headers = {})=>{
    const error = new Error(message);
    error.status = status;
    error.extra = extra;
    error.headers = headers;
    return error;
}

// Validate the request, find the chat and rebuild the context the AI will see.
// Nothing is written to the database here.
export const prepareTurn = async ({user, chatId, content, model})=>{
    // 1. Validate message content
    if(typeof content !== "string" || content.trim() === ""){
        throw httpError(400, "Message content is required");
    }

    if(content.length > MAX_MESSAGE_LENGTH){
        throw httpError(400, "Message is too long (max " + MAX_MESSAGE_LENGTH + " characters)");
    }

    const text = content.trim();
    let chat = null;
    let chatModel = model;
    let history = [];

    // 2. Existing chat case (chatId format is already checked by router.param)
    if(chatId){
        chat = await Chat.findOne({
            _id : chatId,
            userId : user._id
        });

        if(!chat){
            throw httpError(404, "Chat not found");
        }

        chatModel = chat.model;

        // Messages before summarizedTillMessageNumber live inside chat.summary, so they are skipped here.
        // The second value only matters if summarizing keeps failing and unsummarized messages pile up.
        const skip = Math.max(chat.summarizedTillMessageNumber, chat.messageCount - HISTORY_FETCH_LIMIT);

        history = await Message.find({chatId : chat._id})
        .sort({createdAt : 1, _id : 1})
        .skip(skip)
        .select("role content")
        .lean();
    }

    // 3. New chat case (the chat itself is only created after the AI answers, so a failure leaves nothing behind)
    else{
        if(!model){
            throw httpError(400, "Model is required for new chat");
        }

        if(!isModelAllowed(model)){
            throw httpError(400, "This model is not allowed");
        }
    }

    // 4. Rebuild the context: the AI remembers nothing, so we send the recent history every time
    history.push({role : "user", content : text});

    const {messages, promptTokenEstimate} = buildContext({
        systemPrompt : process.env.SYSTEM_PROMPT || undefined,
        summary : chat ? chat.summary : "",
        history,
        maxContextTokens : getMaxContextTokens()
    });

    return {text, chat, chatModel, messages, promptTokenEstimate, sentAt : new Date()};
}

// 5. Reserve tokens (worst case = prompt + the longest reply allowed) in one atomic step.
// Returns how many tokens were reserved, or throws a 429 if the user has no budget left.
export const reserveForTurn = async (user, promptTokenEstimate)=>{
    const toReserve = promptTokenEstimate + getMaxReplyTokens();
    const quota = await reserveTokens(user._id, toReserve);

    if(!quota){
        const current = await getUsage(user._id);
        const retryAfter = Math.max(1, Math.ceil((new Date(current.resetAt) - Date.now()) / 1000));

        throw httpError(
            429,
            "Token limit reached, try again after your window resets",
            {tokenLimit : current.tokenLimit, resetAt : current.resetAt},
            {"Retry-After" : String(retryAfter)}
        );
    }

    return toReserve;
}

// Save the chat (if new) and both messages, only after the AI answered.
// `interrupted` is true when the user stopped the reply half way and only a part of it exists.
export const saveTurn = async ({user, chat, chatModel, text, sentAt, aiReply, usage, modelUsed, interrupted = false})=>{
    if(!chat){
        chat = await Chat.create({
            userId : user._id,
            model : chatModel,
            topic : text.slice(0, 40)
        });
    }

    const userMessage = await Message.create({
        chatId : chat._id,
        role : "user",
        content : text,
        tokens : estimateTokens(text),
        userId : user._id,
        createdAt : sentAt
    });

    const assistantMessage = await Message.create({
        chatId : chat._id,
        role : "assistant",
        content : aiReply,
        tokens : usage.completionTokens,
        usage,
        model : modelUsed,
        interrupted,
        userId : user._id
    });

    // Update chat metadata with atomic $inc (two tabs sending at once cannot overwrite each other)
    const chatUpdate = {
        $inc : {
            messageCount : 2,
            "usage.promptTokens" : usage.promptTokens,
            "usage.completionTokens" : usage.completionTokens,
            "usage.totalTokens" : usage.totalTokens
        }
    };

    // If topic is still default (chat made through createChat), update it from first message
    if(chat.topic === "New Chat"){
        chatUpdate.$set = {topic : text.slice(0, 40)};
    }

    await Chat.updateOne({_id : chat._id}, chatUpdate);

    return {chat, userMessage, assistantMessage};
}
