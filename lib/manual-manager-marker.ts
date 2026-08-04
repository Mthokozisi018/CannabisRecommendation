export const MANUAL_MANAGER_APP_METADATA = {
  greenchoice_role: "manager",
  greenchoice_registration: "manual"
} as const;

export function hasManualManagerMarker(appMetadata: Record<string, unknown> | null | undefined) {
  return appMetadata?.greenchoice_role === MANUAL_MANAGER_APP_METADATA.greenchoice_role &&
    appMetadata?.greenchoice_registration === MANUAL_MANAGER_APP_METADATA.greenchoice_registration;
}
