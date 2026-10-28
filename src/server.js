import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();

if (!config.ghlWebhookUrl) {
  console.warn('Warning: GHL_WEBHOOK_URL is not set. Leads will be rejected with 502.');
}
if (!config.webhookSecret) {
  console.warn('Warning: WEBHOOK_SECRET is not set. Anyone who knows the URL can post leads.');
}

createApp(config).listen(config.port, () => {
  console.log(`Lead automation listening on http://localhost:${config.port}`);
});
