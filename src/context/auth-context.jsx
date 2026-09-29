import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { STORAGE_KEY, TOKEN_KEY } from "@/lib/auth-storage";

const AuthContext = createContext(null);

/**
 * Built-in accounts used when no auth backend is reachable, so the panel
 * stays demonstrable on a bench with only the frontend running. Disabled
 * in production builds unless explicitly re-enabled, otherwise an offline
 * backend would become a way in.
 */
const OFFLINE_ACCOUNTS = [
  { username: "admin", password: "admin", name: "مدير النظام", role: "admin" },
  { username: "operator", password: "operator", name: "مشغل المحطة", role: "operator" },
];

const OFFLINE_LOGIN_ENABLED =
  import.meta.env.VITE_ALLOW_OFFLINE_LOGIN === "true" || import.meta.env.DEV;

/**
 * A demo account has no row in `operator`, so it gets no id — and without an
 * integer id the operator console refuses to start a fill, since
 * `operator_id` is a foreign key.
 *
 * Set `VITE_OFFLINE_OPERATOR_ID` to a real `operator(id)` when bench-testing
 * the gateway without the auth service running.
 */
const OFFLINE_OPERATOR_ID =
  Number.parseInt(import.meta.env.VITE_OFFLINE_OPERATOR_ID ?? "", 10) || null;

export const ROLE_HOME = { admin: "/admin/history", operator: "/operator" };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const persist = useCallback((nextUser, token) => {
    setUser(nextUser);
    if (nextUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      if (token) localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const login = useCallback(
    async (username, password) => {
      const credentials = {
        username: username.trim(),
        password,
      };

      try {
        const { data } = await api.post("/auth/login", credentials);
        const account = data.user ?? data;
        const nextUser = {
          id: account.id,
          name: account.name || account.username || credentials.username,
          username: account.username || credentials.username,
          role: account.role || "operator",
        };
        persist(nextUser, data.token);
        return { ok: true, user: nextUser };
      } catch (error) {
        const status = error?.response?.status;

        // A reachable backend that rejects the credentials is the final word.
        if (status === 401 || status === 403) {
          return { ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة." };
        }

        const backendMissing = !error?.response || status === 404 || status === 501;
        if (!(backendMissing && OFFLINE_LOGIN_ENABLED)) {
          return {
            ok: false,
            message:
              error?.response?.data?.message ||
              "تعذر الوصول إلى خادم المصادقة. تحقق من إعدادات الاتصال.",
          };
        }

        const match = OFFLINE_ACCOUNTS.find(
          (a) => a.username === credentials.username && a.password === password
        );
        if (!match) {
          return { ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة." };
        }

        const nextUser = {
          id: OFFLINE_OPERATOR_ID,
          name: match.name,
          username: match.username,
          role: match.role,
          offline: true,
        };
        persist(nextUser);
        return { ok: true, offline: true, user: nextUser };
      }
    },
    [persist]
  );

  const logout = useCallback(() => {
    // Tells the server to invalidate this operator's token(s) — without
    // this call, "logout" only cleared localStorage; the token itself
    // stayed valid (and replayable) until its natural expiry. Best-effort:
    // an unreachable backend shouldn't trap the user in a session they
    // asked to leave, so the local logout below always proceeds.
    api.post("/auth/logout").catch(() => {});
    persist(null);
  }, [persist]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin",
      login,
      logout,
      homeFor: (role) => ROLE_HOME[role] ?? "/operator",
    }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
