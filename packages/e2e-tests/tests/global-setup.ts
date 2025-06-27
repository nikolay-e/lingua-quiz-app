import { test } from '@playwright/test';

// Global hook to capture browser console errors
test.beforeEach(async ({ page }) => {
  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[Browser Error] ${msg.text()}`);
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    console.error(`[Page Error] ${error.message}`);
  });
});