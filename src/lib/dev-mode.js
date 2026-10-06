import { useSyncExternalStore } from "react";
import { socket } from "@/lib/socket";

/**
 * Two separate things share the name "dev mode":
 *
 *  - **unlocked** — a per-browser flag, set by tapping the login logo five
 *    times. It only decides whether the dev-mode screen appears in the admin
 *    sidebar.
 *  - **enabled** — the gateway's shared state (`dev_mode_status`). The UI never
 *    keeps its own copy of this; it only mirrors what the server reports.
 */
const KEY = "filling.devMode";
const listeners = new Set();

export function isDevMode() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setDevMode(enabled) {
  try {
    if (enabled) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — dev mode just won't persist */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Whether the dev-mode screen has been unlocked in this browser. */
export function useDevUnlocked() {
  return useSyncExternalStore(subscribe, isDevMode, () => false);
}

// The gateway sends `dev_mode_status` once, on connect — long before the dev
// screen mounts — so it is captured here at module scope and cached.
let serverEnabled = null;
const statusListeners = new Set();
function setServerEnabled(value) {
  serverEnabled = value;
  statusListeners.forEach((fn) => fn());
}
socket.on("dev_mode_status", (payload) => setServerEnabled(Boolean(payload?.enabled)));
socket.on("disconnect", () => setServerEnabled(null));

function subscribeStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

/** Gateway-reported dev mode state; `null` while unknown (disconnected). */
export function useDevModeStatus() {
  return useSyncExternalStore(subscribeStatus, () => serverEnabled, () => null);
}

export const PHASE_LABELS = {
  moving: "العربية بتتحرك تحت المنفذ",
  reading: "قراءة الرقم",
  starting: "بدء التعبئة",
  filling: "جارٍ التعبئة",
  filled: "انتهت التعبئة",
  leaving: "العربية بتخرج",
  done: "اكتملت الدورة",
  blocked: "تعذّرت الدورة",
};

export const BLOCK_REASONS = {
  read_failed: "الكاميرا ما قرتش رقم السيارة.",
  trips_exhausted: "الشاحنة وصلت للحد الأقصى من النقلات.",
  invalid_quantity: "الكمية خارج الحد المسموح.",
  start_timeout: "الجهاز ما بدأش التعبئة في الوقت المناسب.",
  error: "خطأ داخلي.",
};

/** A cycle that has not reached `done` still owns the port. */
export const cycleActive = (cycle) => Boolean(cycle) && cycle.phase !== "done";
