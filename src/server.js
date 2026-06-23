// Local dev entry point: starts a long-running HTTP server.
// On Vercel the app is served by api/index.js instead (no listen()).
import { config } from './config.js';
import { createApp } from './app.js';
import { closeBrowser } from './screenshot.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Website Assessment Dashboard running on http://localhost:${config.port}`);
  if (!config.anthropicApiKey) {
    console.warn('  ! ANTHROPIC_API_KEY not set — scoring will fail until configured.');
  }
});

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});
