import type { Instrumentation } from "next";
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { validateProductionEnvironment } = await import("@/lib/environment");
    validateProductionEnvironment();
    const { logServerEvent } = await import("@/lib/logger");
    await logServerEvent("info", "application_runtime_started");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  Sentry.captureRequestError(error, request, context);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logServerEvent } = await import("@/lib/logger");
    await logServerEvent("error", "next_request_error", {
      routePath: request.path,
      routerKind: context.routerKind,
      routeType: context.routeType,
      error
    });
  }
};
