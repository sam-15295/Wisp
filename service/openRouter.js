import openRouter from "../config/openRouter.js";

// errors worth trying again: rate limit (429), timeouts and provider side failures
const RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];

const isRetryable = (err)=>{
    return !err.statusCode || RETRYABLE_STATUS.includes(err.statusCode);
}

const generateAIResponse = async ({model, messages, maxTokens})=>{
    // free models are often overloaded or return an empty reply,
    // so the second attempt goes to the default (router) model
    const attempts = [model, process.env.DEFAULT_AI_MODEL];

    for(const attemptModel of attempts){
        try{
            const completion = await openRouter.chat.send({
                chatRequest : {
                    model : attemptModel,
                    messages,
                    maxTokens
                }
            });

            const aiReply = completion.choices[0]?.message?.content;

            // a reasoning model can spend every token on thinking and return no text
            if(!aiReply){
                continue;
            }

            const promptTokens = completion.usage?.promptTokens || 0;
            const completionTokens = completion.usage?.completionTokens || 0;

            return {
                aiReply,
                modelUsed : completion.model || attemptModel,
                usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens
                }
            }
        }
        catch(err){
            if(!isRetryable(err)){
                throw err;
            }
            console.log("AI attempt failed on " + attemptModel + ": " + (err.statusCode || err.message));
        }
    }

    const error = new Error("The AI service is busy right now, please try again in a moment");
    error.status = 503;
    throw error;
}

export default generateAIResponse;
