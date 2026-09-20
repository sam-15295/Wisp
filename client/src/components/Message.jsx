import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { AssistantAvatar, UserAvatar } from "./Avatar.jsx";
import { shortModel } from "../utils/format.js";

// code blocks get a copy button, the text is read from the rendered element so highlighting never matters
const CodeBlock = ({ children }) => {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.current.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // clipboard blocked by the browser, nothing else to do
    }
  };

  return (
    <div className="code-block">
      <button className="code-copy" onClick={copy} aria-label="Copy code">
        {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.8} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
};

const Markdown = ({ text }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock }}>
    {text}
  </ReactMarkdown>
);

const Message = ({ message, userName }) => {
  if (message.role === "user") {
    return (
      <div className="msg msg-user">
        <div className="bubble-user">{message.content}</div>
        <UserAvatar name={userName} size={28} />
      </div>
    );
  }

  return (
    <div className="msg msg-assistant">
      <AssistantAvatar size={28} />
      <div className="bubble-assistant">
        <div className="markdown">
          <Markdown text={message.content} />
        </div>
        {(message.model || message.interrupted) && (
          <div className="msg-meta">
            {message.interrupted && <span className="tag-stopped">Stopped</span>}
            {message.model && <span>{shortModel(message.model)}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

// the reply that is still being written: text so far, or the pulsing dots while nothing has arrived yet
export const StreamingMessage = ({ pending }) => (
  <div className="msg msg-assistant">
    <AssistantAvatar size={28} />
    <div className="bubble-assistant">
      {pending.text ? (
        <div className="markdown">
          <Markdown text={pending.text} />
        </div>
      ) : (
        <div className="typing" aria-label={pending.thinking ? "Thinking" : "Waiting for a reply"}>
          <span /><span /><span />
          {pending.thinking && <em>Thinking</em>}
        </div>
      )}
    </div>
  </div>
);

export default Message;
