// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "https://d3ba0bde4eac4f8b6b6e8bbcccd59d13@o4511845984305152.ingest.de.sentry.io/4511846003769424";
const tracesSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? (isProduction ? "0.2" : "1"));
const replaySessionSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_REPLAY_SAMPLE_RATE ?? (isProduction ? "0.02" : "1"));
const replayOnErrorSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_REPLAY_ERROR_SAMPLE_RATE ?? "1");

Sentry.init({
  dsn,
  environment: process.env.NEXT_PUBLIC_GREENCHOICE_ENV ?? process.env.NODE_ENV,

  integrations: [Sentry.replayIntegration()],

  tracesSampleRate,
  enableLogs: true,

  replaysSessionSampleRate: replaySessionSampleRate,

  replaysOnErrorSampleRate: replayOnErrorSampleRate,

  sendDefaultPii: false,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
