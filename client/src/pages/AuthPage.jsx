import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Wordmark } from "../components/Logo.jsx";
import { APP_NAME } from "../config.js";

const AuthPage = ({ mode }) => {
  const isSignup = mode === "signup";
  const { user, login, signup } = useAuth();

  const [form, setForm] = useState({ name: "", age: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // already logged in: nothing to do on this page
  if (user) {
    return <Navigate to="/" replace />;
  }

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (isSignup) {
        const body = { name: form.name, email: form.email, password: form.password };
        if (form.age !== "") {
          body.age = Number(form.age);
        }
        await signup(body);
      } else {
        await login({ email: form.email, password: form.password });
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <Wordmark name={APP_NAME} />
        <p className="auth-lead">
          {isSignup ? "Create an account to start chatting." : "Welcome back. Sign in to continue."}
        </p>

        {isSignup && (
          <label className="field">
            <span>Name</span>
            <input type="text" value={form.name} onChange={update("name")} autoComplete="name" required />
          </label>
        )}

        {isSignup && (
          <label className="field">
            <span>Age <em>(optional)</em></span>
            <input type="number" min="10" max="100" value={form.age} onChange={update("age")} />
          </label>
        )}

        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={update("email")} autoComplete="email" required />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={update("password")}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
          />
        </label>

        {isSignup && (
          <p className="hint">8-30 characters with an uppercase letter, a lowercase letter, a number and a symbol.</p>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
        </button>

        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create an account"}</Link>
        </p>
      </form>
    </div>
  );
};

export default AuthPage;
