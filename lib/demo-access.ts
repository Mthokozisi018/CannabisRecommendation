export function isReadOnlyDemo(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  return user?.app_metadata?.greenchoice_demo_view_only === true;
}
