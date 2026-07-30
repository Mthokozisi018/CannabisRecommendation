import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateProductionEnvironment } = await import("@/lib/environment");
    validateProductionEnvironment();
    const { logServerEvent } = await import("@/lib/logger");
    await logServerEvent("info", "application_runtime_started");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportServerException } = await import("@/lib/logger");
  await reportServerException("next_request_error", error, {
    routePath: request.path,
    routerKind: context.routerKind,
    routeType: context.routeType
  });
};
