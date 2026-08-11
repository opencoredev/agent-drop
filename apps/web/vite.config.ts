import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  // `nitro()` gives TanStack Start an agnostic deploy layer; on Vercel it
  // auto-emits the Build Output API (`.vercel/output`) — see TanStack hosting docs.
  plugins: [tailwindcss(), tanstackStart(), nitro(), viteReact()],
  ssr: {
    // Build: bundle all deps into the SSR output. Required on Vercel, because
    // Nitro's file tracing misses bun's hoisted `.bun/` node_modules and
    // externalized deps (react, etc.) go missing at runtime.
    //
    // Dev: leave deps external. The dev SSR module runner evaluates inlined
    // files as ESM, so a CJS entry like `react/index.js` throws
    // "module is not defined" the moment it is inlined.
    noExternal: command === "build" ? true : [],
  },
}));
