/**
 * `localStorage` keys for the session — shared between auth-context.jsx
 * (owns them) and api.js/socket.js (read them to attach a token, or clear
 * them when the server says the session is no longer valid). Kept in their
 * own module so api.js doesn't have to import from auth-context.jsx, which
 * imports api.js itself.
 */
export const STORAGE_KEY = "fs-user";
export const TOKEN_KEY = "fs-token";
