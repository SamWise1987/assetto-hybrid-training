const SAFE_CONTEXT_KEYS = new Set([
  "appState",
  "column",
  "filename",
  "itemCount",
  "kind",
  "line",
  "method",
  "operation",
  "platform",
  "route",
  "source",
  "status",
  "statusCode",
]);

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const FILE_PATH_PATTERN = /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s)]+/g;
const BEARER_PATTERN = /\b(?:authorization\s*[:=]\s*)?Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const SECRET_PAIR_PATTERN = /\b(access[_-]?token|refresh[_-]?token|authorization|password|native[_-]?token|p256dh|auth)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s&,}]+)/gi;

function normalizeText(value: unknown) {
  return String(value ?? "Errore sconosciuto")
    .replace(BEARER_PATTERN, "authorization=[redacted]")
    .replace(SECRET_PAIR_PATTERN, "$1=[redacted]")
    .replace(JWT_PATTERN, "[token]")
    .replace(URL_PATTERN, "[url]")
    .replace(EMAIL_PATTERN, "[email]")
    .replace(UUID_PATTERN, "[id]")
    .replace(FILE_PATH_PATTERN, "[path]")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeErrorMessage(value: unknown, subsystem?: string) {
  const message = normalizeText(value);
  if (subsystem === "health") {
    if (/denied|permission|permesso|autorizz/i.test(message)) return "Permesso Health non concesso.";
    if (/unavailable|not available|non disponibile|unsupported/i.test(message)) return "Health non disponibile su questo dispositivo.";
    return "Sincronizzazione Health non riuscita.";
  }
  return (message || "Errore sconosciuto").slice(0, 500);
}

export function sanitizeErrorContext(context: unknown) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return {};
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(context).slice(0, 20)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) sanitized[key] = value;
    else if (typeof value === "boolean" || value === null) sanitized[key] = value;
    else if (typeof value === "string") sanitized[key] = normalizeText(value).slice(0, 200);
  }
  return sanitized;
}
