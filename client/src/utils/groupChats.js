const DAY = 24 * 60 * 60 * 1000;

// Splits the chat list (already newest first) into the sidebar sections. `now` is a parameter so tests can fix the date.
export const groupChats = (chats, now = new Date()) => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const groups = [
    { label: "Today", chats: [] },
    { label: "Previous 7 days", chats: [] },
    { label: "Older", chats: [] }
  ];

  for (const chat of chats) {
    const time = new Date(chat.updatedAt).getTime();

    if (time >= startOfToday) {
      groups[0].chats.push(chat);
    } else if (time >= startOfToday - 7 * DAY) {
      groups[1].chats.push(chat);
    } else {
      groups[2].chats.push(chat);
    }
  }

  return groups.filter((group) => group.chats.length > 0);
};
