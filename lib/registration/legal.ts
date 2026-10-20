import { REGISTRATION_NOTICE_VERSION } from "./validation";

// Versioned, registration-specific notices. Deployment is gated on recorded approval.
export const registrationLegalDocuments = {
  "customer-terms": {
    title: "Customer Terms & Conditions",
    sections: [
      { id: "registration", heading: "Registering with a store", content: "This registration creates a customer record with the store shown on your form. You must provide accurate details, be at least 18 years old, and submit a readable photograph of your own document. Registration does not create an online sign-in account or guarantee a purchase. Store staff can find your record by cellphone number and link it to purchases at this store." },
      { id: "document-checks", heading: "Document checks and assistance", content: "We compare the document number you enter with the number read from your image, and check your age from the document result. A number match does not by itself prove document authenticity or rightful ownership. Failed, unreadable or inconclusive checks cannot complete online registration. Ask the store for assistance; staff must not use assistance to bypass required checks. If these details may already be registered, the store must use its authorised resolution process rather than changing another person's record." },
      { id: "purchases", heading: "Purchases and support", content: "Purchases remain subject to the store's applicable sale terms and legal requirements. Keep your cellphone details current by contacting the store. Nothing in these terms removes your statutory consumer or privacy rights. For registration questions, contact the store where you scanned the QR code." }
    ]
  },
  privacy: {
    title: "Privacy Notice",
    sections: [
      { id: "customer-record", heading: "Your store customer record", content: "GreenChoice processes your name, email address, cellphone number, document-check result and acknowledgements to register you with the named store. The email address is required; agreeing to marketing is not. Authorised staff at that store can see the limited customer details needed to find your record and link a sale. Another store does not gain access to your customer record or purchase history from this registration." },
      { id: "identity-documents", heading: "Identity documents", content: "Your image is processed by the store's approved document-reading service. It is held in private temporary storage during processing and deleted after the attempt. Interrupted or failed deletions are retried by the scheduled cleanup service, with a one-hour expiry target. We do not retain raw OCR output. The registration record retains only the document type, last four characters, a protected fingerprint, a number-match result, an age-check result and their time. Receptionists cannot access the document image or full number. These checks are not a claim of identity authenticity or ownership verification." },
      { id: "consent-records", heading: "Acknowledgements and your choices", content: "We record the versions of the notices you acknowledge, the time and your Register Customer action. Promotional consent is separate, store-specific and limited to the channels you select. Ask the store to withdraw promotional consent or correct your contact information. Withdrawal does not undo necessary registration or sale records." },
      { id: "rights", heading: "Privacy requests and retention", content: "Contact the named store to request access, correction, deletion or information about its customer and transaction retention schedule. Records required for legal obligations may need to be retained. The store must provide its responsible-party contact details, approved processor information and record-retention schedule before enabling this registration service. You may raise privacy concerns with South Africa's Information Regulator." }
    ]
  },
  "id-verification": {
    title: "ID Verification Notice",
    sections: [
      { id: "checks", heading: "What we check", content: "Submit a clear photo of your SA ID or passport. We validate the number format, compare it with the number read by the approved service and separately confirm that you are at least 18. For SA IDs we also validate the date and checksum; the service's full birth date must agree with the document. We do not infer adulthood from an ambiguous two-digit year." },
      { id: "limitations", heading: "Results and limitations", content: "A successful document-number match is not a statement that your identity, document authenticity or ownership has been verified. A mismatch, unreadable image, unresolved age check, under-age result, manual-review result or unavailable service prevents online registration. You can correct the number, retake the image or retry. Contact the store for authorised assistance when needed." },
      { id: "temporary-storage", heading: "Temporary use of the image", content: "The image is used only for this registration check, stored privately during processing and then deleted. Raw OCR output is not saved. See the Identity documents section of the Privacy Notice for the limited evidence retained. Your document image and full number are not included in receptionist searches or the success screen." }
    ]
  },
  marketing: {
    title: "Store Marketing Choices",
    sections: [
      { id: "optional", heading: "Promotions are optional", content: "You can register without promotional messages. Selecting promotions authorises only the store named on your form to use the channels you actively choose: Email, SMS or WhatsApp. Opening this notice does not select any checkbox. You may withdraw consent by contacting that store or using an available unsubscribe option." }
    ]
  }
} as const;
export type RegistrationLegalSlug = keyof typeof registrationLegalDocuments;
export { REGISTRATION_NOTICE_VERSION };
