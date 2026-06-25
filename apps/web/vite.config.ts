import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
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
    // Bundle all deps into the SSR output. Required on Vercel: Nitro's file
    // tracing misses bun's hoisted `.bun/` node_modules, so externalized deps
    // (react, etc.) are missing at runtime in the serverless function.
    noExternal: true,
  },
});
