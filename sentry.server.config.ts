// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { isSensitiveRegistrationUrl } from "@/lib/registration/telemetry";

const isProduction = process.env.NODE_ENV === "production";
const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;
const enabled = Boolean(dsn);
const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? (isProduction ? "0.2" : "0"));

Sentry.init({
  dsn,
  enabled,
  environment: process.env.GREENCHOICE_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  tracesSampleRate,

  enableLogs: enabled && isProduction,

  sendDefaultPii: false,
  beforeSend: event => isSensitiveRegistrationUrl(event.request?.url) ? null : event,
  beforeSendTransaction: event => isSensitiveRegistrationUrl(event.request?.url) || isSensitiveRegistrationUrl(event.transaction) ? null : event,
  beforeBreadcrumb: breadcrumb => isSensitiveRegistrationUrl(breadcrumb.data?.url as string | undefined) ? null : breadcrumb,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});
