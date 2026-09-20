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
  getMessages: (chatId) => request("/msg/" + chatId)
};
