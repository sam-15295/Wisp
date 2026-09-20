import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";

const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="boot-screen" />;
  }
  return user ? children : <Navigate to="/login" replace />;
};

const App = () => (
  <Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/signup" element={<AuthPage mode="signup" />} />
    <Route path="/" element={<RequireAuth><ChatPage /></RequireAuth>} />
    <Route path="/c/:chatId" element={<RequireAuth><ChatPage /></RequireAuth>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
