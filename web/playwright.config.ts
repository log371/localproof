import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://127.0.0.1:3010" },
  webServer: {
    command: "python3 -m http.server 3010 --bind 127.0.0.1 --directory out",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: false,
  },
});
