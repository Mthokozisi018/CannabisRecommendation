// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { isSensitiveRegistrationUrl } from "@/lib/registration/telemetry";

const isProduction = process.env.NODE_ENV === "production";
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
const enabled = Boolean(dsn);
const tracesSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? (isProduction ? "0.2" : "0"));

Sentry.init({
  dsn,
  enabled,
  environment: process.env.NEXT_PUBLIC_GREENCHOICE_ENV ?? process.env.NODE_ENV,

  // Registration can be reached by client navigation from a staff page. Do not
  // start session replay anywhere until a route-safe collection policy is approved.
  integrations: [],
  beforeSend: event => isSensitiveRegistrationUrl(window.location.pathname) || isSensitiveRegistrationUrl(event.request?.url) ? null : event,
  beforeSendTransaction: event => isSensitiveRegistrationUrl(window.location.pathname) || isSensitiveRegistrationUrl(event.request?.url) ? null : event,
  beforeBreadcrumb: breadcrumb => isSensitiveRegistrationUrl(breadcrumb.data?.url as string | undefined) ? null : breadcrumb,

  tracesSampleRate,
  enableLogs: enabled && isProduction,

  replaysSessionSampleRate: 0,

  replaysOnErrorSampleRate: 0,

  sendDefaultPii: false,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
