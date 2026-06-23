// Best-effort Chromium download for screenshot capture. Never fails install:
// the fetcher degrades to HTML-only scoring when the browser is absent.
import { execSync } from 'node:child_process';

try {
  execSync('npx playwright install chromium', { stdio: 'inherit' });
} catch (err) {
  console.warn(
    '\n[postinstall] Could not install Chromium for Playwright.\n' +
      'Screenshot capture will be disabled; HTML-only scoring still works.\n' +
      'Run "npx playwright install chromium" manually to enable visual scoring.\n'
  );
}
