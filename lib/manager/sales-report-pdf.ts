import "server-only";

import type { ManagerSalesReport } from "@/lib/manager/sales-overview";

const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 38;
const BOTTOM = 50;

function safeText(value: string | number) {
  return String(value).normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim().replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function rand(value: number) {
  return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0/g, " ")}`;
}
function wrap(value: string, max = 78) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
}
export function buildManagerSalesReportPdf({ report, storeName, generatedAt }: { report: ManagerSalesReport; storeName: string; generatedAt: Date }) {
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = HEIGHT - MARGIN;
  const text = (value: string | number, x: number, size = 9, bold = false, shade = "0.12 0.12 0.12") => {
    commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${shade} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${safeText(value)}) Tj ET`);
  };
  const line = (x1: number, yy: number, x2: number, shade = "0.75 0.80 0.76") => commands.push(`0.6 w ${shade} RG ${x1} ${yy.toFixed(2)} m ${x2} ${yy.toFixed(2)} l S`);
  const pageHeader = (continued = false) => {
    commands.push(`0.06 0.12 0.07 rg 0 ${(HEIGHT - 72).toFixed(2)} ${WIDTH.toFixed(2)} 72 re f`);
    commands.push(`0.44 0.85 0.26 rg 0 ${(HEIGHT - 76).toFixed(2)} ${WIDTH.toFixed(2)} 4 re f`);
    y = HEIGHT - 34; text("GreenChoice", MARGIN, 18, true, "1 1 1");
    y -= 19; text(`${storeName} - Sales Overview${continued ? " (continued)" : ""}`, MARGIN, 10, false, "0.84 0.93 0.81");
    y = HEIGHT - 96; text(`Period: ${report.periodLabel}`, MARGIN, 10, true);
    y -= 15; text(`Generated: ${new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(generatedAt)}`, MARGIN, 8, false, "0.35 0.39 0.36");
    const filters = [`Receptionist: ${report.filters.receptionist === "all" ? "All" : report.filters.receptionist}`, `Category: ${report.filters.category === "all" ? "All" : report.filters.category}`];
    if (report.filters.search) filters.push(`Search: ${report.filters.search}`);
    for (const filterLine of wrap(filters.join(" | "), 100)) { y -= 12; text(filterLine, MARGIN, 8, false, "0.35 0.39 0.36"); }
    y -= 14;
  };
  const finishPage = () => { pages.push(commands); commands = []; };
  const nextPage = () => { finishPage(); pageHeader(true); };
  const ensure = (height: number) => { if (y - height < BOTTOM) nextPage(); };
  const itemHeader = () => {
    text("Product", MARGIN + 8, 8, true, "0.10 0.38 0.15");
    text("Category / subcategory", 270, 8, true, "0.10 0.38 0.15");
    text("Qty", 430, 8, true, "0.10 0.38 0.15");
    text("Unit / subtotal", 470, 8, true, "0.10 0.38 0.15");
    y -= 12; line(MARGIN, y, WIDTH - MARGIN); y -= 11;
  };
  pageHeader();
  text(`Unique customers: ${report.summary.uniqueCustomers}`, MARGIN, 11, true, "0.10 0.38 0.15");
  text(`Revenue: ${rand(report.summary.revenue)}`, 220, 11, true, "0.10 0.38 0.15");
  text(`Transactions: ${report.summary.transactionCount}`, 410, 11, true, "0.10 0.38 0.15");
  y -= 24; line(MARGIN, y, WIDTH - MARGIN); y -= 18;

  if (report.transactions.length === 0) {
    text("No completed sales match the selected filters.", MARGIN, 10);
  }
  for (const transaction of report.transactions) {
    ensure(110);
    text(`${transaction.receiptReference} | ${transaction.date} ${transaction.time} | ${rand(transaction.recordedTotal)}`, MARGIN, 10, true);
    y -= 14;
    for (const detail of wrap(`${transaction.customerName} (${transaction.customerPhone}) | Receptionist: ${transaction.receptionistName} | Items: ${transaction.itemCount}`, 105)) {
      text(detail, MARGIN, 8, false, "0.32 0.36 0.33"); y -= 11;
    }
    if (transaction.needsReconciliation) { text("Recorded total differs from item subtotals; recorded total remains authoritative.", MARGIN, 8, true, "0.65 0.30 0.05"); y -= 12; }
    if (y - 28 < BOTTOM) {
      nextPage();
      text(`${transaction.receiptReference} (continued)`, MARGIN, 10, true);
      y -= 18;
    }
    itemHeader();
    const entries = transaction.items.length ? transaction.items : [{ product: "Historical sale item details unavailable", category: "Uncategorized", subcategory: "Unspecified", quantity: transaction.itemCount, unitPrice: transaction.recordedTotal, subtotal: transaction.recordedTotal }];
    for (const item of entries) {
      const productLines = wrap(item.product, 42);
      const categoryLines = wrap(`${item.category} / ${item.subcategory}`, 32);
      const rowLines = Math.max(productLines.length, categoryLines.length);
      if (y - rowLines * 10 - 8 < BOTTOM) {
        nextPage();
        text(`${transaction.receiptReference} (continued)`, MARGIN, 10, true);
        y -= 18;
        itemHeader();
      }
      for (let lineIndex = 0; lineIndex < rowLines; lineIndex += 1) {
        if (productLines[lineIndex]) text(productLines[lineIndex], MARGIN + 8, 8);
        if (categoryLines[lineIndex]) text(categoryLines[lineIndex], 270, 8);
        if (lineIndex === 0) {
          text(item.quantity, 435, 8);
          text(`${rand(item.unitPrice)} / ${rand(item.subtotal)}`, 470, 7.4);
        }
        y -= 10;
      }
      y -= 6;
    }
    line(MARGIN, y, WIDTH - MARGIN); y -= 18;
  }
  finishPage();

  pages.forEach((page, index) => {
    page.push(`BT /F1 8 Tf 0.36 0.40 0.37 rg ${MARGIN} 28 Td (${safeText("GreenChoice Sales Overview")}) Tj ET`);
    page.push(`BT /F1 8 Tf 0.36 0.40 0.37 rg ${(WIDTH - MARGIN - 55).toFixed(2)} 28 Td (${safeText(`Page ${index + 1} of ${pages.length}`)}) Tj ET`);
  });

  const objects: string[] = ["", "<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  const pageIds: number[] = [];
  pages.forEach((page) => {
    const content = page.join("\n");
    const contentId = objects.push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`) - 1;
    const pageId = objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`) - 1;
    pageIds.push(pageId);
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(output, "latin1");
    output += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "latin1");
}
