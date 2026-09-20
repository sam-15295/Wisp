import test from "node:test";
import assert from "node:assert/strict";
import {getAllowedModels, isModelAllowed} from "../config/models.js";

const setEnv = (defaultModel, allowed)=>{
    process.env.DEFAULT_AI_MODEL = defaultModel;

    if(allowed === undefined){
        delete process.env.ALLOWED_MODELS;
    }
    else{
        process.env.ALLOWED_MODELS = allowed;
    }
}

test("the default model is allowed even when ALLOWED_MODELS is not set", ()=>{
    setEnv("openrouter/free", undefined);

    assert.deepEqual(getAllowedModels(), ["openrouter/free"]);
    assert.equal(isModelAllowed("openrouter/free"), true);
});

test("ALLOWED_MODELS is split, trimmed and de-duplicated, the default is always included", ()=>{
    setEnv("openrouter/free", " a/one:free , b/two:free,, openrouter/free ");

    assert.deepEqual(getAllowedModels(), ["openrouter/free", "a/one:free", "b/two:free"]);
});

test("models outside the list are rejected, including non-string values", ()=>{
    setEnv("openrouter/free", "a/one:free");

    assert.equal(isModelAllowed("openai/gpt-4o"), false);
    assert.equal(isModelAllowed(""), false);
    assert.equal(isModelAllowed(undefined), false);
    assert.equal(isModelAllowed({model : "a/one:free"}), false);
    assert.equal(isModelAllowed("a/one:free"), true);
});
