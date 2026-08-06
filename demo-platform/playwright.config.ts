import { defineConfig, devices } from "@playwright/test";

const repoRoot = process.cwd();
const localBffEnv = {
  ...process.env,
  DEMO_MODE: "LOCAL",
  PORT: "3001",
  PHASE5_API_BASE_URL: "http://127.0.0.1:3001"
};
const localWebEnv = {
  ...process.env,
  DEMO_MODE: "LOCAL",
  PHASE5_API_BASE_URL: "http://127.0.0.1:3001"
};

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: [
    {
      command: "npx tsx apps/bff/src/server.ts",
      url: "http://127.0.0.1:3001/healthz",
      cwd: repoRoot,
      env: localBffEnv,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000
    },
    {
      command: "npm run dev --workspace @stratton/demo-web -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173/workbench",
      cwd: repoRoot,
      env: localWebEnv,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.platform === "win32"
          ? {
              channel: "msedge"
            }
          : {})
      }
    }
  ]
});
