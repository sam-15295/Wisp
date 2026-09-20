import test from "node:test";
import assert from "node:assert/strict";
import { createSseParser } from "./sse.js";

const collect = () => {
  const events = [];
  const parser = createSseParser((event, data) => events.push([event, data]));
  return { events, parser };
};

test("parses several events that arrive in one chunk", () => {
  const { events, parser } = collect();
  parser.feed('event: start\ndata: {}\n\nevent: token\ndata: {"text":"Hi"}\n\n');

  assert.deepEqual(events, [["start", {}], ["token", { text: "Hi" }]]);
});

test("waits for the rest when an event is cut in the middle", () => {
  const { events, parser } = collect();
  parser.feed('event: token\ndata: {"te');
  assert.equal(events.length, 0);

  parser.feed('xt":"Hello"}\n');
  assert.equal(events.length, 0);

  parser.feed("\n");
  assert.deepEqual(events, [["token", { text: "Hello" }]]);
});

test("ignores heartbeat comments", () => {
  const { events, parser } = collect();
  parser.feed(': ping\n\nevent: token\ndata: {"text":"a"}\n\n: ping\n\n');

  assert.deepEqual(events, [["token", { text: "a" }]]);
});

test("handles CRLF line endings, even when \\r and \\n arrive in different chunks", () => {
  const { events, parser } = collect();
  parser.feed('event: token\r\ndata: {"text":"x"}\r');
  parser.feed("\n\r\n");

  assert.deepEqual(events, [["token", { text: "x" }]]);
});

test("joins multi-line data and uses 'message' when no event name is given", () => {
  const { events, parser } = collect();
  parser.feed('data: {"a":\ndata: 1}\n\n');

  assert.deepEqual(events, [["message", { a: 1 }]]);
});

test("skips a block whose data is not valid JSON and keeps going", () => {
  const { events, parser } = collect();
  parser.feed('event: token\ndata: {broken\n\nevent: token\ndata: {"text":"ok"}\n\n');

  assert.deepEqual(events, [["token", { text: "ok" }]]);
});

test("keeps text that contains newlines and unicode intact", () => {
  const { events, parser } = collect();
  parser.feed("event: token\ndata: " + JSON.stringify({ text: "line1\nline2 ✓" }) + "\n\n");

  assert.deepEqual(events, [["token", { text: "line1\nline2 ✓" }]]);
});
