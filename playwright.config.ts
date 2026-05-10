// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
  },
  // Start both dev servers before running tests
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3001/api/health",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
