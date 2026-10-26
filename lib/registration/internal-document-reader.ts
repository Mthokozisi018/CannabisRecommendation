import "server-only";
import { createWorker } from "tesseract.js";
import englishModel from "@tesseract.js-data/eng";
import { validDate } from "./validation";
import type { DocumentProvider, DocumentResult } from "./provider";

const months: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12"
};

function datesIn(text: string) {
  const dates = new Set<string>();
  const add = (year: string, month: string, day: string) => {
    const value = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (validDate(value)) dates.add(value);
  };
  for (const match of text.matchAll(/\b(19\d{2}|20\d{2})[-/.\s](\d{1,2})[-/.\s](\d{1,2})\b/g)) add(match[1], match[2], match[3]);
  for (const match of text.matchAll(/\b(\d{1,2})[-/.\s](\d{1,2})[-/.\s](19\d{2}|20\d{2})\b/g)) add(match[3], match[2], match[1]);
  for (const match of text.matchAll(/\b(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(19\d{2}|20\d{2})\b/g)) add(match[3], months[match[2]], match[1]);
  return [...dates];
}

// OCR is a reading aid, not proof that a document is genuine or belongs to its holder.
// A missing or ambiguous full birth date must never be inferred from a two-digit ID/MRZ year.
export function readDocumentText(text: string, type: "sa_id" | "passport"): DocumentResult {
  const lines = text.toUpperCase().replace(/\r/g, "").slice(0, 12_000).split("\n").map(line => line.trim()).filter(Boolean);
  const full = lines.join("\n");
  const hasDocumentCue = type === "sa_id"
    ? /IDENTITY|ID\s*(?:CARD|DOCUMENT|NO\b|NUMBER\b)/.test(full)
    : /PASSPORT|P<[A-Z]{3}/.test(full);
  if (!hasDocumentCue) return { status: "unreadable", documentType: type };
  const passportNumberLines = lines.flatMap((line, index) =>
    /PASSPORT\s*(?:NO|NUMBER)|DOCUMENT\s*(?:NO|NUMBER)/.test(line) ? [line, lines[index + 1] ?? ""] : []);
  const numberCandidates = type === "sa_id"
    ? [...full.matchAll(/(?:^|\D)(\d[\d\s-]{11,22}\d)(?=\D|$)/gm)].map(match => match[1].replace(/\D/g, "")).filter(value => value.length === 13)
    : passportNumberLines.flatMap(line => [...line.matchAll(/\b[A-Z0-9]{5,20}\b/g)].map(match => match[0])).filter(value => /\d/.test(value));
  const numbers = [...new Set(numberCandidates)];
  if (!numbers.length) return { status: "unreadable", documentType: type };
  const birthLines = lines.flatMap((line, index) => {
    if (!/BIRTH|\bDOB\b|GEBOORTE/.test(line)) return [];
    return datesIn(line).length ? [line] : [line, lines[index + 1] ?? ""];
  });
  const birthDates = datesIn(birthLines.join("\n"));
  // Passport issue/expiry dates must not be mistaken for a date of birth.
  // SA ID's encoded YYMMDD may corroborate, but cannot establish the century.
  const matchingDates = type === "sa_id"
    ? birthDates.filter(date => numbers.some(number => date.slice(2).replace(/-/g, "") === number.slice(0, 6)))
    : birthDates;
  return {
    status: "read", documentType: type,
    documentNumber: numbers.length === 1 ? numbers[0] : undefined,
    dateOfBirth: matchingDates.length === 1 ? matchingDates[0] : undefined
  };
}

export const internalDocumentProvider: DocumentProvider = {
  async read(image, type) {
    const worker = await createWorker("eng", 1, { langPath: englishModel.langPath, cacheMethod: "none" });
    try {
      const { data } = await worker.recognize(image);
      return readDocumentText(data.text, type);
    } finally {
      await worker.terminate();
    }
  }
};
