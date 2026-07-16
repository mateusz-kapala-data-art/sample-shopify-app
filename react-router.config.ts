import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

// SSR app. The Vercel preset is applied ONLY when building on Vercel (VERCEL=1) so it
// emits the Build Output API bundle there, while local `react-router build` (and the
// Dockerfile) keep producing the standard build/ output.
export default {
  ssr: true,
  presets: process.env.VERCEL ? [vercelPreset()] : [],
} satisfies Config;
