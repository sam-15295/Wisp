import "dotenv/config";

// The API key is shared by all users, so the client must never choose an arbitrary model.
// Allowed models come from ALLOWED_MODELS (comma separated), the default model is always allowed.
export const getAllowedModels = ()=>{
    const fromEnv = (process.env.ALLOWED_MODELS || "")
    .split(",")
    .map((model)=> model.trim())
    .filter(Boolean);

    const defaultModel = process.env.DEFAULT_AI_MODEL;

    return [...new Set([defaultModel, ...fromEnv].filter(Boolean))];
}

export const isModelAllowed = (model)=>{
    return typeof model === "string" && getAllowedModels().includes(model);
}
