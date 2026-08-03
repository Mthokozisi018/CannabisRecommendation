// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "https://d3ba0bde4eac4f8b6b6e8bbcccd59d13@o4511845984305152.ingest.de.sentry.io/4511846003769424";
const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? (isProduction ? "0.2" : "1"));

Sentry.init({
  dsn,
  environment: process.env.GREENCHOICE_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  tracesSampleRate,

  enableLogs: true,

  sendDefaultPii: false,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});
