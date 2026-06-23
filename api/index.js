// Vercel serverless entry point. Exports the Express app as a request handler;
// Vercel's @vercel/node runtime invokes it per request (no app.listen).
import { createApp } from '../src/app.js';

const app = createApp();

export default app;
