import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Menu, X } from "lucide-react";
import { api, streamMessage } from "../api.js";
import Message, { StreamingMessage } from "./Message.jsx";
import Composer from "./Composer.jsx";
import { WispGlyph } from "./Logo.jsx";
import { formatResetIn, shortModel } from "../utils/format.js";

const STARTERS = [
  "Explain how JWT authentication works",
  "Write a Node.js function that retries a failed request",
  "Plan a relaxed 3 day trip to Goa"
];

const formatError = (err) => {
  if (err.status === 429 && err.data?.resetAt) {
    return "Token limit reached. Your window resets in " + formatResetIn(err.data.resetAt) + ".";
  }
  return err.message;
};

const ChatWindow = ({ chatId, title, models, userName, onOpenMenu, onCreated, onChatsChanged, setUsage, refreshProfile }) => {
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatModel, setChatModel] = useState("");
  const [newModel, setNewModel] = useState("");

  const abortRef = useRef(null);
  const runRef = useRef(0);
  const skipLoadRef = useRef(null);
  const pendingTextRef = useRef("");
  const stickRef = useRef(true);
  const scrollRef = useRef(null);

  const streaming = pending !== null;

  useEffect(() => {
    if (models && !newModel) {
      setNewModel(models.defaultModel);
    }
  }, [models, newModel]);

  // Opening another chat (or leaving this page) stops a reply that is still being written.
  // Bumping runRef makes the old send() ignore everything that arrives afterwards.
  useEffect(() => {
    return () => {
      runRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [chatId]);

  useEffect(() => {
    setError("");
    setPending(null);

    if (!chatId) {
      setMessages([]);
      setChatModel("");
      return undefined;
    }

    // this chat was just created by our own stream, its messages are already on screen
    if (skipLoadRef.current === chatId) {
      skipLoadRef.current = null;
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([api.getChat(chatId), api.getMessages(chatId)])
      .then(([chat, data]) => {
        if (!cancelled) {
          setChatModel(chat.model);
          setMessages(data.msg);
          stickRef.current = true;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMessages([]);
          setError(err.status === 404 ? "This chat does not exist." : err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // keep the newest text in view, unless the user scrolled up to read something
  useEffect(() => {
    if (stickRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending]);

  const onScroll = () => {
    const box = scrollRef.current;
    stickRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  };

  // The user pressed Stop. The server saves the partial reply only after it notices the closed connection,
  // so we ask for the saved version a moment later to get the real ids and token counts.
  const syncAfterStop = (runId, startedAt, wasNewChat) => {
    setTimeout(async () => {
      if (runRef.current !== runId) {
        return;
      }

      await refreshProfile();
      const list = await onChatsChanged();

      if (runRef.current !== runId) {
        return;
      }

      if (wasNewChat) {
        const created = list && list[0];
        if (created && new Date(created.updatedAt).getTime() >= startedAt - 1000) {
          onCreated(created._id);
        }
      } else {
        try {
          const data = await api.getMessages(chatId);
          if (runRef.current === runId) {
            setMessages(data.msg);
          }
        } catch (err) {
          // keep what is on screen
        }
      }
    }, 1500);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || streaming) {
      return;
    }

    const runId = ++runRef.current;
    const startedAt = Date.now();
    const tempId = "user-" + startedAt;
    const alive = () => runRef.current === runId;
    const controller = new AbortController();

    abortRef.current = controller;
    pendingTextRef.current = "";
    stickRef.current = true;
    let finished = false;

    setError("");
    setDraft("");
    setMessages((current) => [...current, { tempId, role: "user", content: text }]);
    setPending({ text: "", thinking: false });

    try {
      await streamMessage({
        chatId,
        content: text,
        model: newModel,
        signal: controller.signal,
        onEvent: (event, data) => {
          if (!alive()) {
            return;
          }

          if (event === "thinking") {
            setPending((current) => current && { ...current, thinking: true });
          } else if (event === "token") {
            pendingTextRef.current += data.text;
            setPending({ text: pendingTextRef.current, thinking: false });
          } else if (event === "done") {
            finished = true;
            abortRef.current = null;
            setMessages((current) => [...current.filter((m) => m.tempId !== tempId), data.userMessage, data.assistantMessage]);
            setPending(null);
            setUsage(data.quota);
            onChatsChanged();

            if (!chatId) {
              skipLoadRef.current = data.chatId;
              setChatModel(newModel);
              onCreated(data.chatId);
            }
          } else if (event === "error") {
            throw new Error(data.message);
          }
        }
      });

      if (!finished && alive()) {
        throw new Error("The connection was interrupted.");
      }
    } catch (err) {
      if (!alive()) {
        return;
      }

      const partial = pendingTextRef.current;
      abortRef.current = null;
      setPending(null);

      if (err.name === "AbortError") {
        // Stop button: keep the words that already arrived
        if (partial) {
          setMessages((current) => [...current, { tempId: "assistant-" + startedAt, role: "assistant", content: partial, interrupted: true }]);
        } else {
          setMessages((current) => current.filter((m) => m.tempId !== tempId));
          setDraft(text);
        }
        syncAfterStop(runId, startedAt, !chatId);
        return;
      }

      // a real failure: show it, and give the user their text back if nothing was answered
      setError(formatError(err));
      if (partial) {
        setMessages((current) => [...current, { tempId: "assistant-" + startedAt, role: "assistant", content: partial, interrupted: true }]);
        syncAfterStop(runId, startedAt, !chatId);
      } else {
        setMessages((current) => current.filter((m) => m.tempId !== tempId));
        setDraft(text);
      }
      refreshProfile();
    }
  };

  const stop = () => abortRef.current?.abort();

  const isEmpty = !chatId && messages.length === 0 && !streaming;
  const shownModel = chatId ? chatModel : newModel;

  return (
    <main className="main">
      <header className="main-header">
        <button className="icon-btn menu-btn" aria-label="Open menu" onClick={onOpenMenu}>
          <Menu size={20} strokeWidth={1.8} />
        </button>
        <span className="main-title">{chatId ? title || "Chat" : "New chat"}</span>
        {shownModel && <span className="model-chip">{shortModel(shownModel)}</span>}
      </header>

      <div className="thread-scroll" ref={scrollRef} onScroll={onScroll}>
        {isEmpty && (
          <div className="empty-state">
            <span className="empty-glyph"><WispGlyph size={28} /></span>
            <h1>How can I help you today?</h1>

            {models && models.models.length > 1 && (
              <label className="model-picker">
                <span>Model</span>
                <select value={newModel} onChange={(event) => setNewModel(event.target.value)}>
                  {models.models.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="starters">
              {STARTERS.map((starter) => (
                <button key={starter} className="starter" onClick={() => setDraft(starter)}>{starter}</button>
              ))}
            </div>
          </div>
        )}

        {loading && <p className="thread-status">Loading messages...</p>}

        {!isEmpty && !loading && (
          <div className="thread">
            {messages.map((message) => (
              <Message key={message._id || message.tempId} message={message} userName={userName} />
            ))}
            {pending && <StreamingMessage pending={pending} />}
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={16} strokeWidth={1.8} />
          <span>{error}</span>
          <button className="icon-btn" aria-label="Dismiss" onClick={() => setError("")}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      )}

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={send}
        onStop={stop}
        streaming={streaming}
        disabled={loading}
      />
    </main>
  );
};

export default ChatWindow;
