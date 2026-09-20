import { useAuth } from "../context/AuthContext.jsx";

// placeholder, the real sidebar and chat window arrive in the next steps
const ChatPage = () => {
  const { user, logout } = useAuth();

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <p className="auth-lead">Signed in as {user.name}.</p>
        <button className="btn-primary" onClick={logout}>Log out</button>
      </div>
    </div>
  );
};

export default ChatPage;
