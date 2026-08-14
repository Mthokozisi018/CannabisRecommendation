import "server-only";
import { existsSync } from "fs";
import { join } from "path";

const termsPdfPath = join(process.cwd(), "public", "legal", "terms-of-service.pdf");
const privacyPdfPath = join(process.cwd(), "public", "legal", "privacy-policy.pdf");

export const LEGAL_DOCUMENTS = {
  terms: {
    label: "Terms of Service",
    href: "/legal/terms-of-service.pdf",
    version: "v1.0"
  },
  privacy: {
    label: "Privacy Policy",
    href: "/legal/privacy-policy.pdf",
    version: "v1.0"
  }
} as const;

export function getLegalDocumentStatus() {
  const termsExists = existsSync(termsPdfPath);
  const privacyExists = existsSync(privacyPdfPath);
  const missingLabels: string[] = [];
  if (!termsExists) missingLabels.push(LEGAL_DOCUMENTS.terms.label);
  if (!privacyExists) missingLabels.push(LEGAL_DOCUMENTS.privacy.label);

  return {
    termsHref: LEGAL_DOCUMENTS.terms.href,
    privacyHref: LEGAL_DOCUMENTS.privacy.href,
    available: termsExists && privacyExists,
    missingLabels
  };
}

export function assertLegalDocumentsAvailable() {
  const status = getLegalDocumentStatus();
  if (!status.available) {
    throw new Error(`Legal documents are missing: ${status.missingLabels.join(", ")}.`);
  }
}
