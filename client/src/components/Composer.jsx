import { useLayoutEffect, useRef } from "react";
import { ArrowUpRight, Square } from "lucide-react";

const MAX_LENGTH = 4000;

// The text box grows with its content (up to about 6 lines, then it scrolls inside).
// While the AI is answering, the send button turns into a Stop button.
const Composer = ({ value, onChange, onSend, onStop, streaming, disabled }) => {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const box = ref.current;
    box.style.height = "auto";
    box.style.height = box.scrollHeight + "px";
  }, [value]);

  const canSend = value.trim() !== "" && !streaming && !disabled;

  const send = () => {
    if (canSend) {
      onSend();
    }
  };

  return (
    <div className="composer">
      <div className="composer-box">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          placeholder="Message Wisp..."
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter adds a new line (isComposing = the user is still choosing an IME character)
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
        />

        {streaming ? (
          <button className="send-btn send-btn-stop" onClick={onStop} aria-label="Stop generating">
            <Square size={14} strokeWidth={2.4} fill="currentColor" />
          </button>
        ) : (
          <button className="send-btn" onClick={send} disabled={!canSend} aria-label="Send message">
            <ArrowUpRight size={18} strokeWidth={2.2} />
          </button>
        )}
      </div>
      <p className="composer-hint">Enter to send, Shift+Enter for a new line</p>
    </div>
  );
};

export default Composer;
