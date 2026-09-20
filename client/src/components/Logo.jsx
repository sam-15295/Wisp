// The Wisp glyph: a thin curl of smoke. Used as the assistant avatar and in the wordmark.
export const WispGlyph = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 21c-2.5-1.3-3-4-1.3-6 1.5-1.8 4-2.3 4.2-4.6.2-1.9-1.1-3.1-2.2-4.4 3.500-.1 7.300 1.600 7.500 5.300.2 2.900-2 4.200-2.800 5.700-.9 1.700-.1 3.500 1.800 4.300" />
    <path d="M16 8c1.800.6 3.100 2.100 3.400 4 .3 2-.4 3.400-1.400 4.700" />
  </svg>
);

export const Wordmark = ({ name }) => (
  <div className="wordmark">
    <span className="wordmark-glyph"><WispGlyph size={22} /></span>
    <span className="wordmark-text">{name}</span>
  </div>
);
