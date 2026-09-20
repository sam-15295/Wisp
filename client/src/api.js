import { createSseParser } from "./utils/sse.js";

// Every call to the backend goes through here: same-origin (Vite proxy), cookie included, errors become Error objects.

let onUnauthorized = () => {};

// the auth context registers a function here so an expired login sends the user back to the login page
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

const request = async (path, { method = "GET", body } = {}) => {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      onUnauthorized();
    }
    const error = new Error(data.message || "Something went wrong");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

export const api = {
  signup: (body) => request("/user/signup", { method: "POST", body }),
  login: (body) => request("/user/login", { method: "POST", body }),
  logout: () => request("/user/logout", { method: "POST" }),
  profile: () => request("/user/profile"),
  deleteAccount: () => request("/user/delete", { method: "DELETE" }),

  getChats: () => request("/chat/getRecentChat"),
  getModels: () => request("/chat/models"),
  renameChat: (chatId, topic) => request("/chat/" + chatId, { method: "PATCH", body: { topic } }),
  deleteChat: (chatId) => request("/chat/" + chatId, { method: "DELETE" }),
  getChat: (chatId) => request("/chat/" + chatId),
  getMessages: (chatId) => request("/msg/" + chatId)
};

// Sends a message and reads the reply while the server is still writing it.
// fetch + ReadableStream is used instead of EventSource because EventSource cannot send a POST body.
// Aborting through the signal closes the connection, which is what makes the server stop the AI (the Stop button).
export const streamMessage = async ({ chatId, content, model, signal, onEvent }) => {
  const response = await fetch(chatId ? "/msg/" + chatId + "/stream" : "/msg/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chatId ? { content } : { content, model }),
    signal
  });

  // problems found before the stream starts (validation, token limit) come back as a normal JSON error
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      onUnauthorized();
    }
    const error = new Error(data.message || "Something went wrong");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  const parser = createSseParser(onEvent);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    parser.feed(decoder.decode(value, { stream: true }));
  }
};
