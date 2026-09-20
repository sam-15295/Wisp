import { WispGlyph } from "./Logo.jsx";
import { initialOf } from "../utils/format.js";

// a small fixed palette, the same name always gets the same color
const PALETTE = ["#c96f4a", "#b8895a", "#8f9a6a", "#6f9c8a", "#7f86ad", "#a6708f"];

const colorFor = (name = "") => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
};

export const UserAvatar = ({ name, size = 32 }) => (
  <span
    className="avatar"
    style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.45 }}
    aria-hidden="true"
  >
    {initialOf(name)}
  </span>
);

export const AssistantAvatar = ({ size = 32 }) => (
  <span className="avatar avatar-assistant" style={{ width: size, height: size }} aria-hidden="true">
    <WispGlyph size={size * 0.6} />
  </span>
);
