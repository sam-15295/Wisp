import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Menu } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { WispGlyph } from "../components/Logo.jsx";
import { APP_NAME } from "../config.js";

const ChatPage = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, usage, logout, deleteAccount } = useAuth();

  const [chats, setChats] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadChats = useCallback(async () => {
    try {
      const data = await api.getChats();
      setChats(data.chats);
    } catch (err) {
      // a 401 is handled globally, anything else just leaves the old list in place
    }
  }, []);

  useEffect(() => {
    loadChats();
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

      <main className="main">
        <header className="main-header">
          <button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} strokeWidth={1.8} />
          </button>
          <span className="main-title">{APP_NAME}</span>
        </header>

        <div className="empty-state">
          <span className="empty-glyph"><WispGlyph size={28} /></span>
          <h1>How can I help you today?</h1>
          <p>The chat window arrives in the next step.</p>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;
