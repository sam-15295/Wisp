import User from "../model/userSchema.js";

// A user has a token budget per time window. The cost of a request is only known AFTER the AI answers,
// but checking "used < limit" first and adding later is a race: parallel requests all pass the check.
// So we RESERVE an estimate atomically first, then SETTLE (fix the difference) or REFUND on failure.

const getWindowMs = ()=> (Number(process.env.TOKEN_WINDOW_HOURS) || 5) * 60 * 60 * 1000;

// A new window starts lazily, when the user's next request finds the old one expired.
// The filter makes it atomic: if two requests try at once, only one of them matches and resets.
export const resetWindowIfExpired = async (userId)=>{
    const now = new Date();

    await User.updateOne(
        {_id : userId, "usage.resetAt" : {$lte : now}},
        {$set : {
            "usage.tokenUsed" : 0,
            "usage.resetAt" : new Date(now.getTime() + getWindowMs())
        }}
    );
}

// The condition and the increment happen in ONE database operation, so there is no gap
// between "check" and "update". Returns null when the reservation would go over the limit.
export const reserveTokens = async (userId, amount)=>{
    await resetWindowIfExpired(userId);

    const user = await User.findOneAndUpdate(
        {
            _id : userId,
            $expr : {$lte : [{$add : ["$usage.tokenUsed", amount]}, "$usage.tokenLimit"]}
        },
        {$inc : {"usage.tokenUsed" : amount}},
        {returnDocument : "after"}
    );

    return user ? user.usage : null;
}

// Replace the reserved estimate with the real cost.
// An update pipeline is used so the counter can be clamped at 0 (a window reset may have happened meanwhile).
export const settleTokens = async (userId, reserved, actual)=>{
    const user = await User.findOneAndUpdate(
        {_id : userId},
        [{$set : {
            "usage.tokenUsed" : {$max : [0, {$add : ["$usage.tokenUsed", actual - reserved]}]},
            "usage.totalTokenUsed" : {$add : ["$usage.totalTokenUsed", actual]}
        }}],
        {returnDocument : "after", updatePipeline : true}
    );

    return user ? user.usage : null;
}

// The AI call failed, nothing was consumed, give the whole reservation back.
export const refundTokens = async (userId, reserved)=>{
    await User.updateOne(
        {_id : userId},
        [{$set : {
            "usage.tokenUsed" : {$max : [0, {$subtract : ["$usage.tokenUsed", reserved]}]}
        }}],
        {updatePipeline : true}
    );
}

// Usage numbers for the UI. Resets an expired window first so the meter never shows stale data.
export const getUsage = async (userId)=>{
    await resetWindowIfExpired(userId);

    const user = await User.findById(userId).select("usage").lean();
    return user ? user.usage : null;
}
