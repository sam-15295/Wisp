// Server-Sent Events arrive as a text stream: "event: token\ndata: {...}\n\n". The network can cut that text
// anywhere (in the middle of a word, between the two newlines), so the parser keeps a buffer and only fires an
// event once a full block, ended by a blank line, has arrived.
// (The browser's built-in EventSource only supports GET requests, but we need POST, so we parse by hand.)
export const createSseParser = (onEvent) => {
  let buffer = "";

  const dispatch = (block) => {
    let event = "message";
    const dataLines = [];

    for (const line of block.split("\n")) {
      // lines starting with ":" are comments, the server uses them as heartbeats
      if (line === "" || line.startsWith(":")) {
        continue;
      }

      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);

      if (value.startsWith(" ")) {
        value = value.slice(1);
      }

      if (field === "event") {
        event = value;
      } else if (field === "data") {
        dataLines.push(value);
      }
    }

    if (dataLines.length === 0) {
      return;
    }

    let data;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch (err) {
      return;
    }
    onEvent(event, data);
  };

  return {
    feed(chunk) {
      // normalized on the whole buffer, so a "\r\n" split across two chunks is still joined correctly
      buffer = (buffer + chunk).replace(/\r\n/g, "\n");

      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        dispatch(buffer.slice(0, index));
        buffer = buffer.slice(index + 2);
      }
    }
  };
};
