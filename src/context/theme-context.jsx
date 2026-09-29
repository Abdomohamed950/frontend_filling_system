import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

const STORAGE_KEY = "fs-theme";
const ThemeContext = createContext(null);

const media = window.matchMedia("(prefers-color-scheme: dark)");

function subscribeToSystemTheme(callback) {
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** Reads the OS preference as an external store — no state to keep in sync. */
function useSystemPrefersDark() {
  return useSyncExternalStore(
    subscribeToSystemTheme,
    () => media.matches,
    () => false
  );
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "system"
  );
  const systemPrefersDark = useSystemPrefersDark();

  // Derived, not stored — the two inputs above fully determine it.
  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme(isDark ? "light" : "dark"),
    [isDark]
  );

  const value = useMemo(
    () => ({ theme, isDark, setTheme, toggleTheme }),
    [theme, isDark, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
