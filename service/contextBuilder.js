// An LLM is stateless: it remembers nothing between requests.
// So for every request we rebuild the conversation and must fit it inside a token budget.
// Everything in this file is a pure function (no database, no network) so it is easy to test.

export const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant. Keep answers clear and concise.";

// each chat message also costs a few tokens for its role/formatting
const MESSAGE_OVERHEAD_TOKENS = 4;

// rough rule of thumb for English text: 1 token is about 4 characters
export const estimateTokens = (text)=>{
    return Math.ceil((text || "").length / 4);
}

const messageTokens = (message)=>{
    return estimateTokens(message.content) + MESSAGE_OVERHEAD_TOKENS;
}

// history = oldest -> newest and it already ends with the new user message
// returns the messages to send, an estimate of the prompt size and how many old messages were left out
export const buildContext = ({systemPrompt = DEFAULT_SYSTEM_PROMPT, summary = "", history, maxContextTokens})=>{
    const fixed = [{role : "system", content : systemPrompt}];

    if(summary){
        fixed.push({
            role : "system",
            content : "Summary of the earlier part of this conversation:\n" + summary
        });
    }

    let used = fixed.reduce((sum, message)=> sum + messageTokens(message), 0);
    const kept = [];

    // walk from the newest message backwards and stop when the budget is full
    for(let i = history.length - 1; i >= 0; i--){
        const cost = messageTokens(history[i]);
        const isNewest = i === history.length - 1;

        // the newest message is the question being asked, it is never dropped
        if(!isNewest && used + cost > maxContextTokens){
            break;
        }
        kept.unshift({role : history[i].role, content : history[i].content});
        used += cost;
    }

    // some models reject a conversation that starts with an assistant message
    while(kept.length > 1 && kept[0].role !== "user"){
        used -= messageTokens(kept[0]);
        kept.shift();
    }

    return {
        messages : [...fixed, ...kept],
        promptTokenEstimate : used,
        droppedCount : history.length - kept.length
    };
}

// How many of the oldest unsummarized messages should be folded into the summary right now?
// Nothing is folded until more than `trigger` messages are waiting, then everything except
// the `keepRecent` newest messages is folded (recent messages stay word for word).
export const getFoldCount = ({messageCount, summarizedTill, trigger, keepRecent})=>{
    const unsummarized = messageCount - summarizedTill;

    if(unsummarized <= trigger){
        return 0;
    }
    return unsummarized - keepRecent;
}

const MAX_CHARS_PER_MESSAGE_IN_SUMMARY = 1200;

// The prompt that asks the AI to merge the old summary and the messages being folded into one new summary.
export const buildSummaryMessages = (previousSummary, messages)=>{
    const transcript = messages
    .map((message)=> message.role.toUpperCase() + ": " + message.content.slice(0, MAX_CHARS_PER_MESSAGE_IN_SUMMARY))
    .join("\n");

    return [
        {
            role : "system",
            content : "You compress conversations into a short memory. Write one concise summary (under 150 words) " +
            "that keeps names, facts, decisions, the user's preferences and unresolved questions. Output only the summary."
        },
        {
            role : "user",
            content : "Previous summary:\n" + (previousSummary || "(none)") + "\n\nNew messages:\n" + transcript
        }
    ];
}
