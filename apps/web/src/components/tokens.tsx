import { useMemo } from "react";

import { type HighlightLanguage, type TokenKind, highlight } from "@/lib/highlight";

/**
 * Maps each semantic token kind to a theme color. Deliberately restrained: a few
 * muted accents over foreground/muted so code reads as premium, not a rainbow.
 * `plain` inherits the surrounding text color.
 */
const KIND_CLASS: Record<TokenKind, string | undefined> = {
  plain: undefined,
  comment: "text-muted-foreground/70 italic",
  string: "text-success",
  url: "text-info underline decoration-info/30 underline-offset-2",
  number: "text-warning",
  keyword: "text-foreground font-medium",
  flag: "text-warning",
  property: "text-foreground/90",
  punctuation: "text-muted-foreground",
  marker: "text-warning font-medium",
};

/** Highlighted source, shared by the code block and the one-line command block. */
export function Tokens({ text, language }: { text: string; language: HighlightLanguage }) {
  // Pure + deterministic, so server and client render identical tokens (no
  // hydration mismatch). Memoized to avoid re-tokenizing on unrelated renders.
  const tokens = useMemo(() => highlight(text, language), [text, language]);

  return (
    <>
      {tokens.map((token, i) => (
        // Tokens are a stable, deterministic stream, so the index is a fine key.
        <span key={i} className={KIND_CLASS[token.kind]}>
          {token.value}
        </span>
      ))}
    </>
  );
}
