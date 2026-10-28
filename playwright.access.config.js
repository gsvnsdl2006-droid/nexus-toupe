import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./auth-e2e",
  use: {
    baseURL: "http://127.0.0.1:5176",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run dev -- --mode test --port 5176 --strictPort",
    url: "http://127.0.0.1:5176",
    env: {
      VITE_SUPABASE_URL: "https://nexus-access-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    },
    reuseExistingServer: false,
  },
  reporter: "list",
});
