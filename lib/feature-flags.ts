import "server-only";

const enabledValues = new Set(["1", "true", "yes", "on"]);

export function isCustomerExperienceEnabled() {
  const configured = process.env.GREENCHOICE_CUSTOMER_EXPERIENCE_ENABLED;
  return configured ? enabledValues.has(configured.trim().toLowerCase()) : false;
}
