import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("ra_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  /**
   * Login/update user data.
   *
   * CRITICAL FIX: When called for a partial update (e.g. from Setup:
   * `login({ ...user, setupDone: true })`), the `userData` object doesn't
   * have a fresh `.token` field. The old code did:
   *
   *     localStorage.setItem("ra_token", userData.token);
   *
   * which wrote `undefined` and killed the session, causing 403 errors
   * on every subsequent API call.
   *
   * The fix: only overwrite the token if a NEW one is actually provided.
   */
  const login = (userData) => {
    localStorage.setItem("ra_user", JSON.stringify(userData));

    // Only overwrite token if the update carries a new one.
    // Setup/Profile pages call login({ ...user, setupDone: true }) which
    // has NO token field — we must keep the existing token intact.
    if (userData.token) {
      localStorage.setItem("ra_token", userData.token);
    }

    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("ra_user");
    localStorage.removeItem("ra_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
