import test from "node:test";
import assert from "node:assert/strict";
import {signupSchema, loginSchema} from "../validators/userValidator.js";

const validSignup = {name : "Sameer", age : 21, email : "sam@test.com", password : "Passw0rd!x"};

const firstError = (result)=> result.error.issues[0].message;

test("a valid signup passes", ()=>{
    assert.equal(signupSchema.safeParse(validSignup).success, true);
});

test("password without a special character is rejected (regression: the old regex range !-~ matched every letter)", ()=>{
    const result = signupSchema.safeParse({...validSignup, password : "Password123"});

    assert.equal(result.success, false);
    assert.match(firstError(result), /special character/);
});

test("each password rule is enforced", ()=>{
    const cases = [
        ["Ab1!", /atleast 8/],
        ["password1!", /uppercase/],
        ["PASSWORD1!", /lowercase/],
        ["Password!!", /number/]
    ];

    for(const [password, message] of cases){
        const result = signupSchema.safeParse({...validSignup, password});
        assert.equal(result.success, false, password);
        assert.match(firstError(result), message, password);
    }
});

test("email is trimmed and lower-cased", ()=>{
    const result = signupSchema.safeParse({...validSignup, email : "  Sam@Test.COM "});

    assert.equal(result.success, true);
    assert.equal(result.data.email, "sam@test.com");
});

test("bad email, short name and out of range age are rejected", ()=>{
    assert.equal(signupSchema.safeParse({...validSignup, email : "not-an-email"}).success, false);
    assert.equal(signupSchema.safeParse({...validSignup, name : "ab"}).success, false);
    assert.equal(signupSchema.safeParse({...validSignup, age : 5}).success, false);
    assert.equal(signupSchema.safeParse({...validSignup, age : 150}).success, false);
});

test("age is optional", ()=>{
    const {age, ...withoutAge} = validSignup;
    assert.equal(signupSchema.safeParse(withoutAge).success, true);
});

test("login does not apply the signup strength rules, it only needs a password", ()=>{
    assert.equal(loginSchema.safeParse({email : "sam@test.com", password : "abc"}).success, true);
    assert.equal(loginSchema.safeParse({email : "sam@test.com", password : ""}).success, false);
    assert.equal(loginSchema.safeParse({email : "sam@test.com"}).success, false);
});
