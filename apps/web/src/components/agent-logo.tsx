import { cn } from "@agent-drop/ui/lib/utils";

/** A brand mark with an optional second file for dark backgrounds. Marks are
 * vendored under /logos rather than hotlinked, so they never flicker or 404. */
export type LogoSpec = { light: string; dark?: string };

export function AgentLogo({ logo, className }: { logo: LogoSpec; className?: string }) {
  const size = cn("size-4 shrink-0 object-contain", className);

  if (!logo.dark) {
    return <img src={logo.light} alt="" aria-hidden loading="lazy" className={size} />;
  }

  return (
    <>
      <img src={logo.light} alt="" aria-hidden loading="lazy" className={cn(size, "dark:hidden")} />
      <img
        src={logo.dark}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn(size, "hidden dark:block")}
      />
    </>
  );
}
