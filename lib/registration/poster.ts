import "server-only";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";

// Measured against the supplied 1024 × 1536 template. The white opening spans
// x=318..706, y=591..961; keep the square clear of its rounded corners.
const templatePath = path.join(process.cwd(), "public", "branding", "greenchoice-registration-template.png");
const placement = { centerX: 512, centerY: 776, maxSize: 350 };

export async function generateRegistrationPoster(link: string) {
  const url = new URL(link);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || !/^\/register\/[a-f0-9]{64}$/.test(url.pathname)) {
    throw new Error("Invalid store registration URL.");
  }
  const template = sharp(templatePath);
  const metadata = await template.metadata();
  if (metadata.width !== 1024 || metadata.height !== 1536) {
    throw new Error("The registration poster template has unexpected dimensions.");
  }
  // Integer pixels per module avoid resampling/blur. Four white modules on each
  // side provide the QR quiet zone inside the measured template opening.
  const modules = QRCode.create(link, { errorCorrectionLevel: "M" }).modules.size;
  const scale = Math.floor(placement.maxSize / (modules + 8));
  if (scale < 3) throw new Error("The registration URL is too long for this poster.");
  const size = (modules + 8) * scale;
  const qr = await QRCode.toBuffer(link, {
    type: "png", scale, margin: 4, errorCorrectionLevel: "M",
    color: { dark: "#10271a", light: "#ffffff" },
  });
  const poster = await template.composite([{
    input: qr,
    left: Math.round(placement.centerX - size / 2),
    top: Math.round(placement.centerY - size / 2),
  }]).png().toBuffer();
  return `data:image/png;base64,${poster.toString("base64")}`;
}
