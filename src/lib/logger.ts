/**
 * Tiny, dependency-free structured logger for the server-side RAG pipeline.
 *
 * Goals: one readable line per event, a colored scope badge per stage, and a
 * built-in timer so each step reports its own duration. Server-only (uses ANSI
 * colors + process.env); never import it from a client component.
 *
 * Usage:
 *   const log = createLogger("extract");
 *   log.info("received file", { name: file.name });
 *   const end = log.timer("pdf load");
 *   // ...work...
 *   end("loaded", { pages: 3 });   // -> success line with elapsed ms
 */

type Level = "info" | "success" | "warn" | "error" | "debug";
type Meta = Record<string, unknown> | undefined;

// --- color support -------------------------------------------------------

const colorEnabled =
  typeof process !== "undefined" &&
  process.env.NO_COLOR !== "1" &&
  process.env.LOG_COLOR !== "0";

const paint = (code: number, text: string): string =>
  colorEnabled ? `\x1b[${code}m${text}\x1b[0m` : text;

const c = {
  dim: (t: string) => paint(2, t),
  bold: (t: string) => paint(1, t),
  gray: (t: string) => paint(90, t),
  red: (t: string) => paint(31, t),
  green: (t: string) => paint(32, t),
  yellow: (t: string) => paint(33, t),
  blue: (t: string) => paint(34, t),
  magenta: (t: string) => paint(35, t),
  cyan: (t: string) => paint(36, t),
};

// Fixed palette per known scope so a stage always reads in the same color.
const scopeColors: Record<string, (t: string) => string> = {
  extract: c.cyan,
  split: c.blue,
  embed: c.magenta,
  store: c.yellow,
  model: c.magenta,
  rag: c.green,
  chat: c.green,
  stats: c.gray,
  vectors: c.gray,
};

const levelGlyph: Record<Level, string> = {
  info: c.blue("▸"),
  success: c.green("✓"),
  warn: c.yellow("▲"),
  error: c.red("✗"),
  debug: c.gray("·"),
};

// --- formatting ----------------------------------------------------------

const SCOPE_WIDTH = 8;

function timestamp(): string {
  // HH:MM:SS.mmm — local time is fine for a dev/test project.
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(
    d.getMilliseconds(),
    3,
  )}`;
}

function formatValue(v: unknown): string {
  if (typeof v === "string") {
    const s = v.length > 80 ? `${v.slice(0, 77)}…` : v;
    return `"${s}"`;
  }
  if (typeof v === "number" || typeof v === "boolean" || v === null) {
    return String(v);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function formatMeta(meta: Meta): string {
  if (!meta) return "";
  const parts = Object.entries(meta).map(
    ([k, v]) => `${c.dim(k + "=")}${formatValue(v)}`,
  );
  return parts.length ? "  " + parts.join(" ") : "";
}

function formatDuration(ms: number): string {
  const text = ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
  return c.dim(`(${text})`);
}

// --- logger --------------------------------------------------------------

export interface Logger {
  info(message: string, meta?: Meta): void;
  success(message: string, meta?: Meta): void;
  warn(message: string, meta?: Meta): void;
  error(message: string, meta?: Meta): void;
  debug(message: string, meta?: Meta): void;
  /**
   * Starts a timer for a step. Call the returned function when the step ends;
   * it logs a success line with the elapsed time (or an error line if `failed`).
   */
  timer(step: string): (message?: string, meta?: Meta) => number;
}

export function createLogger(scope: string): Logger {
  const colorize = scopeColors[scope] ?? c.bold;
  const badge = colorize(scope.toUpperCase().padEnd(SCOPE_WIDTH));

  const emit = (level: Level, message: string, meta?: Meta, extra = "") => {
    const line = `${c.gray(timestamp())} ${badge} ${
      levelGlyph[level]
    } ${message}${extra}${formatMeta(meta)}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  return {
    info: (m, meta) => emit("info", m, meta),
    success: (m, meta) => emit("success", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    error: (m, meta) => emit("error", m, meta),
    debug: (m, meta) => emit("debug", m, meta),
    timer(step: string) {
      const startedAt = Date.now();
      emit("info", `${step} ${c.dim("…")}`);
      return (message = step, meta?: Meta) => {
        const elapsed = Date.now() - startedAt;
        emit("success", message, meta, " " + formatDuration(elapsed));
        return elapsed;
      };
    },
  };
}
