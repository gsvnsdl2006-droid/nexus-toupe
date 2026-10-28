import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  resolve: {
    alias:
      mode === "test"
        ? [
            {
              find: /^\.\/project-config\.js$/,
              replacement: new URL(
                "./test-support/project-config.js",
                import.meta.url,
              ).pathname,
            },
          ]
        : [],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { spreadsheet: ["xlsx"], react: ["react", "react-dom"] },
      },
    },
  },
}));
