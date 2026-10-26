
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Saves files inside backend/services/agent/generated
const outputDir = path.resolve(__dirname, "../generated");

export const downloadPdf = async (pdfBuffer, filename) => {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error("A valid PDF buffer is required.");
  }

  fs.mkdirSync(outputDir, { recursive: true });

  // Always generate a safe filename
  const safeFilename =
    typeof filename === "string" &&
    /^[a-zA-Z0-9_-]+\.pdf$/i.test(filename)
      ? filename
      : `document-${randomUUID()}.pdf`;

  const filepath = path.join(outputDir, safeFilename);

  await fs.promises.writeFile(filepath, pdfBuffer);

  return {
    filename: safeFilename,
    filepath,
    mimeType: "application/pdf",
  };
};

export default downloadPdf;
