import { Button } from "@agent-drop/ui/components/button";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["system", "light", "dark"] as const;
const LABEL = { system: "System theme", light: "Light theme", dark: "Dark theme" } as const;

/** One button that steps through system, light, dark. The icon shows the current
 * choice, so the control takes one slot instead of three. */
export function ThemeToggle() {
  // next-themes only knows the stored choice on the client; render a stable icon
  // on the server to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { theme, setTheme } = useTheme();

  const current = mounted && theme ? ((theme as (typeof ORDER)[number]) ?? "system") : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!;
  const Icon = current === "light" ? SunIcon : current === "dark" ? MoonIcon : MonitorIcon;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`${LABEL[current]}. Switch to ${LABEL[next].toLowerCase()}`}
      title={LABEL[current]}
      onClick={() => setTheme(next)}
    >
      <Icon />
    </Button>
  );
}
