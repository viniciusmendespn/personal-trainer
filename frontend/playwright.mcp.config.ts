import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/mcp', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8766', channel: process.env.CP_BROWSER_CHANNEL || 'msedge', headless: true },
  webServer: { command: 'python ../backend/tests/visual_harness.py', url: 'http://127.0.0.1:8766', reuseExistingServer: false, timeout: 30000 },
})
