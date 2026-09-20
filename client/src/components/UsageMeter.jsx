import { formatResetIn, formatTokens } from "../utils/format.js";

// how much of the user's token budget is used in the current window
const UsageMeter = ({ usage }) => {
  if (!usage) {
    return null;
  }

  const percent = Math.min(100, Math.round((usage.tokenUsed / usage.tokenLimit) * 100));

  return (
    <div className="usage" title="Tokens are counted for both your messages and the replies">
      <div className="usage-row">
        <span>{formatTokens(usage.tokenUsed)} / {formatTokens(usage.tokenLimit)} tokens</span>
        <span>{percent}%</span>
      </div>
      <div className="usage-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={"usage-fill" + (percent >= 90 ? " usage-fill-high" : "")} style={{ width: percent + "%" }} />
      </div>
      <div className="usage-reset">Resets in {formatResetIn(usage.resetAt)}</div>
    </div>
  );
};

export default UsageMeter;
