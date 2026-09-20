import test from "node:test";
import assert from "node:assert/strict";
import { groupChats } from "./groupChats.js";
import { formatResetIn, formatTokens, initialOf } from "./format.js";

const now = new Date(2026, 8, 20, 15, 0, 0);
const daysAgo = (days, hour = 10) => new Date(2026, 8, 20 - days, hour, 0, 0).toISOString();

test("groupChats puts chats into Today, Previous 7 days and Older", () => {
  const chats = [
    { _id: "a", updatedAt: daysAgo(0, 9) },
    { _id: "b", updatedAt: daysAgo(1) },
    { _id: "c", updatedAt: daysAgo(7) },
    { _id: "d", updatedAt: daysAgo(8) },
    { _id: "e", updatedAt: daysAgo(40) }
  ];

  const groups = groupChats(chats, now);

  assert.deepEqual(groups.map((g) => g.label), ["Today", "Previous 7 days", "Older"]);
  assert.deepEqual(groups[0].chats.map((c) => c._id), ["a"]);
  assert.deepEqual(groups[1].chats.map((c) => c._id), ["b", "c"]);
  assert.deepEqual(groups[2].chats.map((c) => c._id), ["d", "e"]);
});

test("groupChats leaves out empty sections and keeps the given order", () => {
  const groups = groupChats([{ _id: "x", updatedAt: daysAgo(3) }, { _id: "y", updatedAt: daysAgo(2) }], now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Previous 7 days");
  assert.deepEqual(groups[0].chats.map((c) => c._id), ["x", "y"]);
});

test("groupChats handles an empty list", () => {
  assert.deepEqual(groupChats([], now), []);
});

test("formatResetIn shows hours and minutes, minutes only, or now", () => {
  const base = 1_000_000;

  assert.equal(formatResetIn(base + (4 * 60 + 12) * 60000, base), "4h 12m");
  assert.equal(formatResetIn(base + 45 * 60000, base), "45m");
  assert.equal(formatResetIn(base - 1000, base), "now");
  assert.equal(formatResetIn(undefined, base), "now");
});

test("formatTokens adds thousand separators and survives missing values", () => {
  assert.equal(formatTokens(12345), "12,345");
  assert.equal(formatTokens(undefined), "0");
});

test("initialOf returns an upper-case first letter", () => {
  assert.equal(initialOf("  sameer"), "S");
  assert.equal(initialOf(""), "?");
  assert.equal(initialOf(undefined), "?");
});
