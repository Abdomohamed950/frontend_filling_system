import { io } from "socket.io-client";
import { TOKEN_KEY } from "@/lib/auth-storage";

export const SOCKET_URL_KEY = "fs-socket-url";

function resolveSocketUrl() {
  // An override saved from the connection-settings screen takes priority
  // over the build-time env var — see the matching note in `lib/api.js`.
  const stored = localStorage.getItem(SOCKET_URL_KEY)?.trim();
  if (stored) return stored;

  const explicit = import.meta.env.VITE_SOCKET_URL?.trim();
  if (explicit) return explicit;

  const port = import.meta.env.VITE_SOCKET_PORT?.trim() || "5000";
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

export const SOCKET_URL = resolveSocketUrl();

/**
 * One shared connection for the entire app. Each component used to call
 * `io(...)` at module scope, so a five-port operator screen opened six
 * separate websockets to the same gateway.
 */
export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ["websocket", "polling"],
  // A function (not a plain object) re-reads localStorage on every
  // (re)connect, so logging in/out is picked up without recreating the
  // socket. The gateway checks this token — and that its operator still
  // exists — before honoring `start_filling` (transport/socket.js).
  auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }),
});

/**
 * Port names are compared against the names returned by `/api/ports`. A
 * gateway that publishes `"Port1 "` for a row stored as `"port1"` would
 * otherwise have every one of its frames silently dropped, and the card
 * would sit at "غير متصل" forever. Casing and stray whitespace are
 * tolerated; anything beyond that is a genuine configuration mismatch and
 * should stay visible.
 */
export function samePort(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

if (import.meta.env.DEV) {
  // Makes "the port looks offline but the gateway is sending" answerable in
  // one glance: every inbound frame is printed with its exact port key.
  socket.onAny((event, ...args) => {
    console.debug("%c[socket ⇠]", "color:#38bdf8", event, ...args);
  });
  socket.on("connect", () => console.debug("%c[socket] connected", "color:#22c55e", SOCKET_URL));
  socket.on("connect_error", (err) =>
    console.debug("%c[socket] connect_error", "color:#ef4444", SOCKET_URL, err?.message)
  );
  window.__fsSocket = socket;
}

export default socket;
