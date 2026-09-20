export const formatTokens = (count) => new Intl.NumberFormat("en-US").format(count ?? 0);

// "4h 12m" until the token window resets
export const formatResetIn = (resetAt, now = Date.now()) => {
  const ms = new Date(resetAt).getTime() - now;

  if (!(ms > 0)) {
    return "now";
  }

  const minutes = Math.ceil(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return hours > 0 ? hours + "h " + rest + "m" : rest + "m";
};

export const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";
