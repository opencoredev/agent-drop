/**
 * Tiny, dependency-free, SSR-safe syntax highlighter.
 *
 * Each tokenizer is a pure function `string -> Token[]` so the server and the
 * client always produce byte-identical output (no async, no DOM, no hydration
 * mismatch). Tokens carry a semantic `kind`; the renderer maps each kind to a
 * coss theme token (see `code-block.tsx`), keeping colors subtle rather than a
 * rainbow. The concatenation of every token's `value` always equals the input.
 */

export type TokenKind =
  | "plain"
  | "comment"
  | "string"
  | "url"
  | "number"
  | "keyword"
  | "flag"
  | "property"
  | "punctuation"
  | "marker";

export interface Token {
  kind: TokenKind;
  value: string;
}

export type HighlightLanguage = "bash" | "prompt" | "plain";

const URL_RE = /https?:\/\/[^\s"'`)]+/;

/** Append `value` to the list, merging into the previous run when kinds match. */
function push(tokens: Token[], kind: TokenKind, value: string): void {
  if (!value) return;
  const last = tokens[tokens.length - 1];
  if (last && last.kind === kind) {
    last.value += value;
    return;
  }
  tokens.push({ kind, value });
}

/**
 * Split a plain run further into URLs vs. plain text. Used by every tokenizer so
 * links are always recognizable, wherever they appear.
 */
function pushWithUrls(tokens: Token[], kind: TokenKind, value: string): void {
  let rest = value;
  let match = URL_RE.exec(rest);
  while (match) {
    push(tokens, kind, rest.slice(0, match.index));
    push(tokens, "url", match[0]);
    rest = rest.slice(match.index + match[0].length);
    match = URL_RE.exec(rest);
  }
  push(tokens, kind, rest);
}

const BASH_KEYWORDS = new Set([
  "curl",
  "sudo",
  "cd",
  "cat",
  "echo",
  "export",
  "mkdir",
  "cp",
  "mv",
  "rm",
  "ls",
  "git",
  "npx",
  "bunx",
  "bun",
  "npm",
]);

/** Highlight a shell command line (curl, flags, quoted strings, comments). */
function tokenizeBashLine(line: string, tokens: Token[]): void {
  // Whole-line comment.
  if (/^\s*#/.test(line)) {
    push(tokens, "comment", line);
    return;
  }

  let i = 0;
  let atWordStart = true;
  while (i < line.length) {
    const ch = line[i];

    // Quoted string ('...' or "..."), kept whole including quotes.
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\") j += 1; // skip escaped char
        j += 1;
      }
      j = Math.min(j + 1, line.length);
      // Strings may embed URLs/escapes; highlight URLs inside them too.
      pushWithUrls(tokens, "string", line.slice(i, j));
      i = j;
      atWordStart = false;
      continue;
    }

    // Trailing comment after whitespace.
    if (ch === "#" && i > 0 && /\s/.test(line[i - 1])) {
      push(tokens, "comment", line.slice(i));
      return;
    }

    // Flags: -X, --header (only at the start of a word).
    if (ch === "-" && atWordStart) {
      let j = i + 1;
      while (j < line.length && /[\w-]/.test(line[j])) j += 1;
      push(tokens, "flag", line.slice(i, j));
      i = j;
      atWordStart = false;
      continue;
    }

    // A URL starting here (e.g. the endpoint in `curl ... https://...`).
    if ((ch === "h" || ch === "H") && /^https?:\/\//i.test(line.slice(i))) {
      const url = URL_RE.exec(line.slice(i));
      if (url) {
        push(tokens, "url", url[0]);
        i += url[0].length;
        atWordStart = false;
        continue;
      }
    }

    // Bare words: keyword commands (curl, git, …) vs. plain text.
    if (/[A-Za-z]/.test(ch) && atWordStart) {
      let j = i;
      while (j < line.length && /[\w-]/.test(line[j])) j += 1;
      const word = line.slice(i, j);
      push(tokens, BASH_KEYWORDS.has(word) ? "keyword" : "plain", word);
      i = j;
      atWordStart = false;
      continue;
    }

    // A single other character (operators, braces, whitespace, etc.).
    if (/\s/.test(ch)) {
      push(tokens, "plain", ch);
      atWordStart = true;
    } else if (/[{}[\],]/.test(ch)) {
      push(tokens, "punctuation", ch);
      atWordStart = false;
    } else {
      pushWithUrls(tokens, "plain", ch);
      atWordStart = /[|&;(]/.test(ch);
    }
    i += 1;
  }
}

function tokenizeBash(code: string): Token[] {
  const tokens: Token[] = [];
  const lines = code.split("\n");
  lines.forEach((line, idx) => {
    tokenizeBashLine(line, tokens);
    if (idx < lines.length - 1) push(tokens, "plain", "\n");
  });
  return tokens;
}

/**
 * Highlight the agent setup prompt. It is prose, not code, so we only accent the
 * load-bearing bits: leading step numbers, URLs, inline `code`/paths, and the
 * quoted config line. Everything else stays plain for readability.
 */
function tokenizePromptLine(line: string, tokens: Token[]): void {
  let rest = line;

  // Leading numbered-step marker, e.g. "1." or "2.".
  const marker = /^(\s*)(\d+\.)(\s+)/.exec(rest);
  if (marker) {
    push(tokens, "plain", marker[1]);
    push(tokens, "marker", marker[2]);
    push(tokens, "plain", marker[3]);
    rest = rest.slice(marker[0].length);
  }

  // A line that is purely (mostly) a quoted instruction reads as a "string".
  const quoted = /^(\s*)(".*"?)\s*$/.exec(rest);
  if (quoted && rest.trim().startsWith('"')) {
    push(tokens, "plain", quoted[1]);
    pushWithUrls(tokens, "string", quoted[2]);
    push(tokens, "plain", rest.slice(quoted[1].length + quoted[2].length));
    return;
  }

  // Otherwise: plain text with URLs and inline `code` spans lifted out.
  const segments = rest.split(/(`[^`]*`)/);
  for (const seg of segments) {
    if (seg.startsWith("`") && seg.endsWith("`") && seg.length >= 2) {
      push(tokens, "property", seg);
    } else {
      pushWithUrls(tokens, "plain", seg);
    }
  }
}

function tokenizePrompt(code: string): Token[] {
  const tokens: Token[] = [];
  const lines = code.split("\n");
  lines.forEach((line, idx) => {
    tokenizePromptLine(line, tokens);
    if (idx < lines.length - 1) push(tokens, "plain", "\n");
  });
  return tokens;
}

function tokenizePlain(code: string): Token[] {
  const tokens: Token[] = [];
  pushWithUrls(tokens, "plain", code);
  return tokens;
}

/** Tokenize `code` for the given language. Pure and deterministic. */
export function highlight(code: string, language: HighlightLanguage): Token[] {
  switch (language) {
    case "bash":
      return tokenizeBash(code);
    case "prompt":
      return tokenizePrompt(code);
    default:
      return tokenizePlain(code);
  }
}
