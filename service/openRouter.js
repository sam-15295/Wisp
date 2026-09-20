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

// Same job as generateAIResponse, but the reply is delivered piece by piece while the AI is still writing.
// onToken gets every piece of text, onThinking is called once if the model starts "reasoning" first
// (free reasoning models can think for a minute before the first word, the UI must not look frozen).
// Both callbacks are awaited, so a slow browser slows down reading from the AI (backpressure).
export const streamAIResponse = async ({model, messages, maxTokens, signal, onThinking, onToken})=>{
    const attempts = [model, process.env.DEFAULT_AI_MODEL];

    for(const attemptModel of attempts){
        let text = "";
        let modelUsed = attemptModel;
        let usage = null;
        let thinkingSignalled = false;

        try{
            const stream = await openRouter.chat.send(
                {
                    chatRequest : {
                        model : attemptModel,
                        messages,
                        maxTokens,
                        stream : true,
                        // without this the provider does not send token counts for streamed replies
                        streamOptions : {includeUsage : true}
                    }
                },
                {signal}
            );

            for await (const chunk of stream){
                if(chunk.error){
                    const error = new Error(chunk.error.message);
                    error.statusCode = chunk.error.code;
                    throw error;
                }

                if(chunk.model){
                    modelUsed = chunk.model;
                }

                const delta = chunk.choices?.[0]?.delta;

                if(delta?.reasoning && !text && !thinkingSignalled){
                    thinkingSignalled = true;
                    await onThinking();
                }

                if(delta?.content){
                    text += delta.content;
                    await onToken(delta.content);
                }

                if(chunk.usage){
                    const promptTokens = chunk.usage.promptTokens || 0;
                    const completionTokens = chunk.usage.completionTokens || 0;
                    usage = {promptTokens, completionTokens, totalTokens : promptTokens + completionTokens};
                }
            }

            if(!text){
                continue;
            }

            return {aiReply : text, modelUsed, usage, interrupted : false};
        }
        catch(err){
            // the user pressed stop or the browser went away: keep whatever text already exists
            if(signal?.aborted){
                return {aiReply : text, modelUsed, usage : null, interrupted : true};
            }

            // the user already saw some text, so we cannot switch to another model, keep the partial reply
            if(text){
                return {aiReply : text, modelUsed, usage : null, interrupted : true};
            }

            if(!isRetryable(err)){
                throw err;
            }
            console.log("AI stream failed on " + attemptModel + ": " + (err.statusCode || err.message));
        }
    }

    const error = new Error("The AI service is busy right now, please try again in a moment");
    error.status = 503;
    throw error;
}
