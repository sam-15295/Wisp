import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "../model/userSchema.js";
import {reserveTokens, settleTokens, refundTokens, getUsage} from "../service/quotaService.js";

// These tests use a real MongoDB (a separate test database) because the point is database atomicity.
// If MongoDB is not running the whole file is skipped instead of failing.
const TEST_DB = "mongodb://127.0.0.1:27017/chatgpt_quota_test";

let mongoUp = true;
try{
    await mongoose.connect(TEST_DB, {serverSelectionTimeoutMS : 2000});
}
catch(err){
    mongoUp = false;
}

let counter = 0;
const makeUser = (usage = {})=>{
    counter++;
    return User.create({
        name : "Quota Tester",
        email : "quota" + counter + "-" + Date.now() + "@test.com",
        password : "not-used",
        usage : {tokenLimit : 1000, ...usage}
    });
}

test.after(async ()=>{
    if(mongoUp){
        await User.deleteMany({name : "Quota Tester"});
        await mongoose.disconnect();
    }
});

test("reserve adds to tokenUsed while under the limit", {skip : !mongoUp}, async ()=>{
    const user = await makeUser();
    const usage = await reserveTokens(user._id, 400);

    assert.equal(usage.tokenUsed, 400);
});

test("reserve returns null and changes nothing when it would exceed the limit", {skip : !mongoUp}, async ()=>{
    const user = await makeUser({tokenUsed : 800});
    const usage = await reserveTokens(user._id, 300);
    const after = await getUsage(user._id);

    assert.equal(usage, null);
    assert.equal(after.tokenUsed, 800);
});

test("parallel reservations can never go over the limit (no race condition)", {skip : !mongoUp}, async ()=>{
    const user = await makeUser();

    // limit is 1000, each request wants 300, so at most 3 may succeed
    const results = await Promise.all(
        Array.from({length : 10}, ()=> reserveTokens(user._id, 300))
    );

    const succeeded = results.filter(Boolean).length;
    const after = await getUsage(user._id);

    assert.equal(succeeded, 3);
    assert.equal(after.tokenUsed, 900);
});

test("settle replaces the reservation with the real cost and tracks the lifetime total", {skip : !mongoUp}, async ()=>{
    const user = await makeUser();
    await reserveTokens(user._id, 500);
    const usage = await settleTokens(user._id, 500, 120);

    assert.equal(usage.tokenUsed, 120);
    assert.equal(usage.totalTokenUsed, 120);
});

test("refund gives the reservation back and never goes below zero", {skip : !mongoUp}, async ()=>{
    const user = await makeUser();
    await reserveTokens(user._id, 500);
    await refundTokens(user._id, 500);
    assert.equal((await getUsage(user._id)).tokenUsed, 0);

    await refundTokens(user._id, 500);
    assert.equal((await getUsage(user._id)).tokenUsed, 0);
});

test("an expired window is reset before reserving", {skip : !mongoUp}, async ()=>{
    const user = await makeUser({tokenUsed : 950, resetAt : new Date(Date.now() - 1000)});
    const usage = await reserveTokens(user._id, 300);

    assert.equal(usage.tokenUsed, 300);
    assert.ok(usage.resetAt.getTime() > Date.now());
});
