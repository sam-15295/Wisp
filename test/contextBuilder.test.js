import test from "node:test";
import assert from "node:assert/strict";
import {buildContext, estimateTokens, getFoldCount, buildSummaryMessages, DEFAULT_SYSTEM_PROMPT} from "../service/contextBuilder.js";

const msg = (role, content)=> ({role, content});

test("estimateTokens uses about 4 characters per token", ()=>{
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("abcde"), 2);
    assert.equal(estimateTokens(undefined), 0);
});

test("system prompt always comes first and the whole history fits in a big budget", ()=>{
    const history = [msg("user", "hi"), msg("assistant", "hello"), msg("user", "how are you")];
    const result = buildContext({history, maxContextTokens : 10000});

    assert.deepEqual(result.messages[0], {role : "system", content : DEFAULT_SYSTEM_PROMPT});
    assert.equal(result.messages.length, 4);
    assert.equal(result.droppedCount, 0);
    assert.equal(result.messages.at(-1).content, "how are you");
});

test("summary is added as a second system message", ()=>{
    const result = buildContext({
        summary : "User is learning Node.",
        history : [msg("user", "next topic?")],
        maxContextTokens : 10000
    });

    assert.equal(result.messages[1].role, "system");
    assert.match(result.messages[1].content, /User is learning Node\./);
});

test("oldest messages are dropped first when the budget is small", ()=>{
    const long = "x".repeat(400);
    const history = [
        msg("user", "old question " + long),
        msg("assistant", "old answer " + long),
        msg("user", "new question")
    ];
    const result = buildContext({history, maxContextTokens : 150});

    assert.equal(result.droppedCount, 2);
    assert.equal(result.messages.at(-1).content, "new question");
    assert.ok(!result.messages.some((m)=> m.content.startsWith("old")));
});

test("the newest user message is kept even if it alone is over budget", ()=>{
    const history = [msg("user", "y".repeat(4000))];
    const result = buildContext({history, maxContextTokens : 10});

    assert.equal(result.messages.length, 2);
    assert.equal(result.droppedCount, 0);
});

test("a leading assistant message is removed after trimming", ()=>{
    const history = [
        msg("user", "u".repeat(600)),
        msg("assistant", "short answer"),
        msg("user", "follow up")
    ];
    // budget fits the assistant message + follow up but not the first user message
    const result = buildContext({history, maxContextTokens : 60});
    const firstNonSystem = result.messages.find((m)=> m.role !== "system");

    assert.equal(firstNonSystem.role, "user");
});

test("getFoldCount does nothing until the trigger is passed", ()=>{
    const args = {summarizedTill : 0, trigger : 14, keepRecent : 6};

    assert.equal(getFoldCount({...args, messageCount : 14}), 0);
    assert.equal(getFoldCount({...args, messageCount : 16}), 10);
});

test("getFoldCount only counts messages that are not summarized yet", ()=>{
    // 10 already folded, 16 unsummarized left -> fold 16 - 6 = 10 more
    assert.equal(getFoldCount({messageCount : 26, summarizedTill : 10, trigger : 14, keepRecent : 6}), 10);
    assert.equal(getFoldCount({messageCount : 22, summarizedTill : 10, trigger : 14, keepRecent : 6}), 0);
});

test("buildSummaryMessages includes the old summary, the transcript and truncates long messages", ()=>{
    const result = buildSummaryMessages("Likes Rust.", [
        {role : "user", content : "hello"},
        {role : "assistant", content : "z".repeat(5000)}
    ]);

    assert.equal(result[0].role, "system");
    assert.match(result[1].content, /Previous summary:\nLikes Rust\./);
    assert.match(result[1].content, /USER: hello/);
    assert.ok(result[1].content.length < 2000);
});
