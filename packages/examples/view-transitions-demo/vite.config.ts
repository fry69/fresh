import { defineConfig } from "vite";
import fresh from "fresh";
import tailwindcss from "tailwindcss";

export default defineConfig({
  plugins: [
    fresh({
      app: "./main.ts",
    }),
    tailwindcss(),
  ],
});
