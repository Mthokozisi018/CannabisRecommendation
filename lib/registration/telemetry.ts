// Shared by browser/server Sentry configurations; never import registration data here.
export function isSensitiveRegistrationUrl(value?: string) {
  return Boolean(value && (/\/(?:api\/registration|register)(?:\/|$)/.test(value) || value === process.env.QR_VERIFICATION_URL));
}
