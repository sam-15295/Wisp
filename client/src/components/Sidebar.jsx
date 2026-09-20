import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, MoreHorizontal, Pencil, Plus, Trash2, UserX, X } from "lucide-react";
import { Wordmark } from "./Logo.jsx";
import { UserAvatar } from "./Avatar.jsx";
import UsageMeter from "./UsageMeter.jsx";
import { groupChats } from "../utils/groupChats.js";
import { APP_NAME } from "../config.js";

const ChatItem = ({ chat, active, onRename, onDelete, onNavigate }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(chat.topic);
  const menuRef = useRef(null);

  // close the small menu when the user clicks anywhere else
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const close = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const saveName = () => {
    setEditing(false);
    const topic = draft.trim();
    if (topic && topic !== chat.topic) {
      onRename(chat._id, topic);
    }
  };

  if (editing) {
    return (
      <li className="chat-item chat-item-editing">
        <input
          className="chat-rename-input"
          value={draft}
          maxLength={60}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={saveName}
          onKeyDown={(event) => {
            if (event.key === "Enter") saveName();
            if (event.key === "Escape") setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className={"chat-item" + (active ? " chat-item-active" : "")}>
      <Link to={"/c/" + chat._id} className="chat-link" onClick={onNavigate} title={chat.topic}>
        {chat.topic}
      </Link>

      <div className="chat-menu-wrap" ref={menuRef}>
        <button
          className="icon-btn chat-menu-btn"
          aria-label="Chat options"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal size={16} strokeWidth={1.8} />
        </button>

        {menuOpen && (
          <div className="popover">
            <button
              className="popover-item"
              onClick={() => {
                setDraft(chat.topic);
                setEditing(true);
                setMenuOpen(false);
              }}
            >
              <Pencil size={15} strokeWidth={1.8} /> Rename
            </button>
            <button
              className="popover-item popover-danger"
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                setMenuOpen(false);
                onDelete(chat._id);
              }}
            >
              <Trash2 size={15} strokeWidth={1.8} /> {confirming ? "Click again to delete" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </li>
  );
};

const Sidebar = ({ chats, activeId, user, usage, open, onClose, onNewChat, onRename, onDelete, onLogout, onDeleteAccount }) => {
  const [profileMenu, setProfileMenu] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!profileMenu) {
      return undefined;
    }
    const close = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileMenu(false);
        setConfirmAccount(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileMenu]);

  const groups = groupChats(chats);

  return (
    <>
      <div className={"sidebar-backdrop" + (open ? " sidebar-backdrop-open" : "")} onClick={onClose} />

      <aside className={"sidebar" + (open ? " sidebar-open" : "")} aria-label="Chats">
        <div className="sidebar-top">
          <Wordmark name={APP_NAME} />
          <button className="icon-btn sidebar-close" aria-label="Close menu" onClick={onClose}>
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <button className="new-chat" onClick={onNewChat}>
          <Plus size={16} strokeWidth={2} /> New chat
        </button>

        <nav className="chat-list">
          {groups.length === 0 && <p className="chat-list-empty">Your chats will show up here.</p>}

          {groups.map((group) => (
            <section key={group.label}>
              <h3 className="group-label">{group.label}</h3>
              <ul>
                {group.chats.map((chat) => (
                  <ChatItem
                    key={chat._id}
                    chat={chat}
                    active={chat._id === activeId}
                    onRename={onRename}
                    onDelete={onDelete}
                    onNavigate={onClose}
                  />
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="sidebar-profile" ref={profileRef}>
          <UsageMeter usage={usage} />

          <button className="profile-btn" onClick={() => setProfileMenu((openMenu) => !openMenu)}>
            <UserAvatar name={user.name} />
            <span className="profile-text">
              <span className="profile-name">{user.name}</span>
              <span className="profile-email">{user.email}</span>
            </span>
            <MoreHorizontal size={16} strokeWidth={1.8} />
          </button>

          {profileMenu && (
            <div className="popover popover-up">
              <button className="popover-item" onClick={onLogout}>
                <LogOut size={15} strokeWidth={1.8} /> Log out
              </button>
              <button
                className="popover-item popover-danger"
                onClick={() => {
                  if (!confirmAccount) {
                    setConfirmAccount(true);
                    return;
                  }
                  onDeleteAccount();
                }}
              >
                <UserX size={15} strokeWidth={1.8} /> {confirmAccount ? "Click again: delete everything" : "Delete account"}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
