import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import updatePopupPlugin from "./plugins/updatePopupPlugin.js";
import reloadExtensionPlugin from "./plugins/reloadExtensionPlugin.js";
import cleanMainFile from "./plugins/cleanMainFile.js";
import tailwindcss from '@tailwindcss/vite'


export default defineConfig(({ command, mode }) => {
  // Enable reload plugins only in dev mode (watch mode)
  const isDev =
    command === "build" && process.env.npm_lifecycle_event === "dev";
  const enableReload = isDev || process.env.ENABLE_RELOAD === "true";

  console.log(
    `Build mode: ${command}, Script: ${process.env.npm_lifecycle_event}`
  );
  console.log(`Reload plugins: ${enableReload ? "ENABLED" : "DISABLED"}`);

  const plugins = [
    !enableReload && cleanMainFile(), 
    reloadExtensionPlugin(enableReload), 
    react(), 
    tailwindcss()
  ];

  if (enableReload) {
    plugins.push(updatePopupPlugin());
  }
  
  return {
    plugins,
    build: {
      outDir: isDev ? "dev" : "build",
      rollupOptions: {
        input: {
          main: "./index.html",
          background: "src/background/background.js",
          content: "src/content/content.js",
        },
      },
    },
  };
});