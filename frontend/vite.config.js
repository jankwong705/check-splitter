import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base is "./" so the build works on GitHub Pages under a subpath.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
