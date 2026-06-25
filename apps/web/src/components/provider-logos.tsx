// Provider logos sourced from models.dev (https://models.dev/logos/<id>.svg).
const PROVIDERS = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "google", name: "Google" },
  { id: "xai", name: "xAI" },
  { id: "meta", name: "Meta" },
  { id: "mistral", name: "Mistral" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "groq", name: "Groq" },
] as const;

export function ProviderLogos() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
      {PROVIDERS.map((p) => (
        <img
          key={p.id}
          src={`https://models.dev/logos/${p.id}.svg`}
          alt={p.name}
          title={p.name}
          loading="lazy"
          className="h-6 w-auto opacity-55 grayscale transition hover:opacity-90 dark:opacity-70 dark:invert dark:hover:opacity-100"
        />
      ))}
    </div>
  );
}
