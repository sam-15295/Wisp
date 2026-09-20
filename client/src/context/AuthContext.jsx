import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler } from "../api.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    setUsage(null);
  }, []);

  // asks the server who we are, the httpOnly cookie is what proves it (JavaScript can never read that cookie)
  const refreshProfile = useCallback(async () => {
    try {
      const data = await api.profile();
      setUser({ name: data.name, email: data.email, age: data.age });
      setUsage(data.usage);
    } catch (err) {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    refreshProfile().finally(() => setLoading(false));
  }, [clearSession, refreshProfile]);

  const value = useMemo(() => ({
    user,
    usage,
    loading,
    setUsage,
    refreshProfile,
    login: async (body) => {
      await api.login(body);
      await refreshProfile();
    },
    signup: async (body) => {
      await api.signup(body);
      await refreshProfile();
    },
    logout: async () => {
      await api.logout();
      clearSession();
    },
    deleteAccount: async () => {
      await api.deleteAccount();
      clearSession();
    }
  }), [user, usage, loading, refreshProfile, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
