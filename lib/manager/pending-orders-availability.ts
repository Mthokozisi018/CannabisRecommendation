export function pendingOrdersUiEnabled(env: Record<string, string | undefined> = process.env) {
  const production = env.GREENCHOICE_ENV === "production" || env.VERCEL_ENV === "production";
  return production
    ? env.GREENCHOICE_PENDING_ORDERS_ENABLED === "true"
    : env.GREENCHOICE_PENDING_ORDERS_ENABLED !== "false";
}
