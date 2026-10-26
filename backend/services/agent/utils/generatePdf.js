
import PDFDocument from "pdfkit";

const cleanMarkdown = (text) => text
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 ($2)")
  .replace(/\*\*(.*?)\*\*/g, "$1")
  .replace(/\*(.*?)\*/g, "$1")
  .replace(/`([^`]+)`/g, "$1");

const parseTableRow = (line) => line
  .trim()
  .replace(/^\|/, "")
  .replace(/\|$/, "")
  .split("|")
  .map((cell) => cleanMarkdown(cell.trim()));

const renderTable = (doc, rows) => {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = Math.max(...rows.map((row) => row.length));
  const columnWidth = pageWidth / columns;
  const cellPadding = 5;

  rows.forEach((row, rowIndex) => {
    const cells = Array.from({ length: columns }, (_, index) => row[index] ?? "");
    const font = rowIndex === 0 ? "Helvetica-Bold" : "Helvetica";
    doc.font(font).fontSize(9);

    const rowHeight = Math.max(
      24,
      ...cells.map((cell) =>
        doc.heightOfString(cell, {
          width: columnWidth - cellPadding * 2,
          lineGap: 2,
        }) + cellPadding * 2
      )
    );

    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }

    const top = doc.y;
    const left = doc.page.margins.left;
    cells.forEach((cell, columnIndex) => {
      const x = left + columnIndex * columnWidth;
      doc
        .fillColor(rowIndex === 0 ? "#F3F4F6" : "#FFFFFF")
        .strokeColor("#D1D5DB")
        .rect(x, top, columnWidth, rowHeight)
        .fillAndStroke();
      doc
        .fillColor("#374151")
        .font(font)
        .fontSize(9)
        .text(cell, x + cellPadding, top + cellPadding, {
          width: columnWidth - cellPadding * 2,
          lineGap: 2,
        });
    });
    doc.y = top + rowHeight;
  });

  doc.moveDown(0.5);
};

export const generatePdf = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      if (!data || typeof data !== "object") {
        throw new Error("PDF data must be an object.");
      }

      const title = String(data.title || "Untitled Document");
      const subtitle = String(data.subtitle || "");
      const content = String(data.content || "");

      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
        bufferPages: true,
        info: {
          Author: "ConvexAI",
          Title: title,
          Creator: "ConvexAI",
        },
      });

      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", (error) => {
        reject(error);
      });

      // Document title
      doc
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .fontSize(26)
        .text(title, {
          align: "center",
        });

      // Subtitle
      if (subtitle) {
        doc.moveDown(0.5);
        doc
          .fillColor("#6B7280")
          .font("Helvetica")
          .fontSize(12)
          .text(subtitle, {
            align: "center",
          });
      }

      doc.moveDown(1.5);

      // Render Markdown-style content
      const lines = content.replace(/\r\n?/g, "\n").split("\n");
      let inCodeBlock = false;

      for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[index];
        const line = rawLine.trimEnd();

        if (/^\s*```/.test(line) || /^\s*`[A-Za-z][\w+-]*\s*$/.test(line)) {
          inCodeBlock = !inCodeBlock;
          if (inCodeBlock) {
            doc.moveDown(0.3);
          } else {
            doc.moveDown(0.4);
          }
          continue;
        }

        if (/^\s*`\s*$/.test(line) && inCodeBlock) {
          inCodeBlock = false;
          doc.moveDown(0.4);
          continue;
        }

        if (!inCodeBlock && /^\s*\|.*\|\s*$/.test(line)) {
          const tableLines = [];
          while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
            tableLines.push(lines[index]);
            index += 1;
          }
          index -= 1;
          const tableRows = tableLines
            .map(parseTableRow)
            .filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));
          if (tableRows.length > 0) {
            renderTable(doc, tableRows);
          }
          continue;
        }

        if (!line.trim()) {
          doc.moveDown(0.5);
          continue;
        }

        // Code
        if (inCodeBlock) {
          doc
            .fillColor("#374151")
            .font("Courier")
            .fontSize(9)
            .text(line || " ", {
              indent: 8,
              lineGap: 2,
            });
          continue;
        }

        // H1
        if (line.startsWith("# ")) {
          doc.moveDown(0.6);
          doc
            .fillColor("#111827")
            .font("Helvetica-Bold")
            .fontSize(22)
            .text(cleanMarkdown(line.slice(2)));
          doc.moveDown(0.3);
          continue;
        }

        // H2
        if (line.startsWith("## ")) {
          doc.moveDown(0.5);
          doc
            .fillColor("#1F2937")
            .font("Helvetica-Bold")
            .fontSize(16)
            .text(cleanMarkdown(line.slice(3)));
          doc.moveDown(0.2);
          continue;
        }

        // H3
        if (line.startsWith("### ")) {
          doc.moveDown(0.4);
          doc
            .fillColor("#374151")
            .font("Helvetica-Bold")
            .fontSize(12)
            .text(cleanMarkdown(line.slice(4)));
          doc.moveDown(0.15);
          continue;
        }

        // Bullet points
        if (/^\s*[-*]\s+/.test(line)) {
          const text = line.replace(/^\s*[-*]\s+/, "");

          doc
            .fillColor("#374151")
            .font("Helvetica")
            .fontSize(10)
            .text(`•  ${text}`, {
              indent: 12,
              lineGap: 3,
            });
          continue;
        }

        // Numbered lists
        if (/^\s*\d+[.)]\s+/.test(line)) {
          doc
            .fillColor("#374151")
            .font("Helvetica")
            .fontSize(10)
            .text(line.trim(), {
              indent: 12,
              lineGap: 3,
            });
          continue;
        }

        // Horizontal rule
        if (/^\s*---+\s*$/.test(line)) {
          doc.moveDown(0.3);
          const y = doc.y;

          doc
            .strokeColor("#D1D5DB")
            .moveTo(50, y)
            .lineTo(545, y)
            .stroke();

          doc.moveDown(0.5);
          continue;
        }

        // Normal paragraphs
        const paragraph = cleanMarkdown(line);

        doc
          .fillColor("#374151")
          .font("Helvetica")
          .fontSize(10)
          .text(paragraph, {
            lineGap: 4,
            paragraphGap: 6,
          });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default generatePdf;
