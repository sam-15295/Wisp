import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";
import ChatWindow from "../components/ChatWindow.jsx";

const ChatPage = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, usage, setUsage, refreshProfile, logout, deleteAccount } = useAuth();

  const [chats, setChats] = useState([]);
  const [models, setModels] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // returns the fresh list so callers can look at it (the chat window uses this after a stopped reply)
  const loadChats = useCallback(async () => {
    try {
      const data = await api.getChats();
      setChats(data.chats);
      return data.chats;
    } catch (err) {
      // a 401 is handled globally, anything else just leaves the old list in place
      return null;
    }
  }, []);

  useEffect(() => {
    loadChats();
    api.getModels().then(setModels).catch(() => {});
  }, [loadChats]);

  const renameChat = async (id, topic) => {
    try {
      await api.renameChat(id, topic);
      setChats((current) => current.map((chat) => (chat._id === id ? { ...chat, topic } : chat)));
    } catch (err) {
      loadChats();
    }
  };

  const deleteChat = async (id) => {
    try {
      await api.deleteChat(id);
      setChats((current) => current.filter((chat) => chat._id !== id));
      if (id === chatId) {
        navigate("/");
      }
    } catch (err) {
      loadChats();
    }
  };

  const activeChat = chats.find((chat) => chat._id === chatId);

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        activeId={chatId}
        user={user}
        usage={usage}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => {
          setSidebarOpen(false);
          navigate("/");
        }}
        onRename={renameChat}
        onDelete={deleteChat}
        onLogout={logout}
        onDeleteAccount={deleteAccount}
      />

      <ChatWindow
        chatId={chatId}
        title={activeChat?.topic}
        models={models}
        userName={user.name}
        onOpenMenu={() => setSidebarOpen(true)}
        onCreated={(id) => navigate("/c/" + id)}
        onChatsChanged={loadChats}
        setUsage={setUsage}
        refreshProfile={refreshProfile}
      />
    </div>
  );
};

export default ChatPage;
