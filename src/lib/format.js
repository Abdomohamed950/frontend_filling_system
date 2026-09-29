const LOCALE = "ar-EG";

/** Formats a quantity/meter reading, tolerating null and non-numeric input. */
export function formatNumber(value, fractionDigits = 0) {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || Number.isNaN(n)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return `${formatDate(d)} · ${formatTime(d)}`;
}

/** Short "منذ ٥ دقائق" style label used in live status lines. */
export function formatRelative(value) {
  const d = toDate(value);
  if (!d) return "—";

  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return "الآن";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return formatDate(d);
}

/** Accepts Date | ISO string | "YYYY-MM-DD HH:mm:ss" | epoch ms. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "string") {
    // MySQL-style timestamps parse inconsistently across browsers.
    const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * The numeric `operator(id)` for a signed-in user, or `null`.
 *
 * `operator_id` is an integer foreign key, so a username or a placeholder
 * string would be rejected by the insert. Anything non-integer resolves to
 * `null` so the failure is explicit at the boundary rather than a constraint
 * violation deep in the gateway.
 */
export function toOperatorId(user) {
  const raw = user?.id;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

/**
 * Serializes a Date as `YYYY-MM-DD HH:mm:ss` in **local** time, for query
 * parameters compared against a Postgres `timestamp without time zone`.
 *
 * `toISOString()` must not be used here. It emits UTC with a trailing `Z`,
 * and Postgres discards the offset when casting to a tz-less timestamp — so
 * the bounds silently land N hours off (3h in Egypt), and "today" returns
 * yesterday evening's rows.
 */
export function toSqlTimestamp(value) {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Turns an ISO date into the `yyyy-MM-dd` a date input expects. */
export function toInputDate(value) {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Duration between two timestamps as `1س 12د` / `45د` / `30ث`. */
export function formatDuration(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return "—";

  const totalSeconds = Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours) return `${hours}س ${minutes}د`;
  if (minutes) return `${minutes}د ${seconds}ث`;
  return `${seconds}ث`;
}
