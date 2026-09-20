import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import generateAIResponse from "./openRouter.js";
import {getFoldCount, buildSummaryMessages, estimateTokens} from "./contextBuilder.js";
import {reserveTokens, settleTokens, refundTokens} from "./quotaService.js";

// A long chat cannot be sent to the AI in full, so old messages are folded into a short "rolling summary"
// and only the newest messages are sent word for word. This runs AFTER the reply was sent
// (nobody waits for it) and its cost is charged to the same token quota as normal messages.

const SUMMARY_MAX_TOKENS = 800;

const getTrigger = ()=> Number(process.env.SUMMARY_TRIGGER) || 16;
const getKeepRecent = ()=> Number(process.env.SUMMARY_KEEP_RECENT) || 6;

// stops one server from summarizing the same chat twice at the same time
const inProgress = new Set();

export const maybeSummarize = async (chatId, userId)=>{
    const key = String(chatId);

    if(inProgress.has(key)){
        return false;
    }
    inProgress.add(key);

    let reserved = 0;

    try{
        const chat = await Chat.findById(chatId);

        if(!chat){
            return false;
        }

        const foldCount = getFoldCount({
            messageCount : chat.messageCount,
            summarizedTill : chat.summarizedTillMessageNumber,
            trigger : getTrigger(),
            keepRecent : getKeepRecent()
        });

        if(foldCount <= 0){
            return false;
        }

        // messages are numbered by their position, summarizedTillMessageNumber says how many are already folded
        const toFold = await Message.find({chatId})
        .sort({createdAt : 1, _id : 1})
        .skip(chat.summarizedTillMessageNumber)
        .limit(foldCount)
        .select("role content")
        .lean();

        if(toFold.length === 0){
            return false;
        }

        const messages = buildSummaryMessages(chat.summary, toFold);
        const promptEstimate = messages.reduce((sum, message)=> sum + estimateTokens(message.content), 0);
        const estimate = promptEstimate + SUMMARY_MAX_TOKENS;

        // no quota left: skip for now, the next message will try again
        if(!await reserveTokens(userId, estimate)){
            return false;
        }
        reserved = estimate;

        const {aiReply, usage} = await generateAIResponse({
            model : process.env.DEFAULT_AI_MODEL,
            messages,
            maxTokens : SUMMARY_MAX_TOKENS
        });

        await settleTokens(userId, reserved, usage.totalTokens || estimate);
        reserved = 0;

        // Optimistic concurrency: the filter only matches if nobody moved summarizedTillMessageNumber
        // while we were waiting for the AI. If someone did, our result is stale and is thrown away.
        const result = await Chat.updateOne(
            {_id : chatId, summarizedTillMessageNumber : chat.summarizedTillMessageNumber},
            {$set : {
                summary : aiReply.trim(),
                summaryUpdatedAt : new Date(),
                summarizedTillMessageNumber : chat.summarizedTillMessageNumber + toFold.length
            }}
        );

        return result.modifiedCount === 1;
    }
    catch(err){
        // summarizing is a background job, its failure must never break the chat
        console.log("Summary failed for chat " + key + ": " + err.message);
        return false;
    }
    finally{
        if(reserved > 0){
            await refundTokens(userId, reserved);
        }
        inProgress.delete(key);
    }
}
