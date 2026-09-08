import { describe, expect, it } from "vitest";
import { extractText } from "../src/application/source-extraction.js";
import { createCanvas, loadImage, PDFDocument } from "@napi-rs/canvas";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const JSZip = require("jszip");

describe("source text extraction", () => {
  it("extracts readable HTML into stable, traceable segments", async () => {
    const result = await extractText(
      Buffer.from(
        `<!doctype html><title>Ignored metadata</title><main><h1>Research &amp; evidence</h1><p>First finding.</p><script>discard()</script><p>Second finding.</p></main>`,
      ),
      "text/html; charset=utf-8",
    );
    expect(result.status).toBe("completed");
    expect(result.text).toContain("Research & evidence");
    expect(result.text).not.toContain("discard");
    expect(result.segments.length).toBeGreaterThan(1);
    expect(result.segments[0]).toMatchObject({kind:"heading",locator:{selector:"h1"}});
    expect(
      result.segments.every(
        (item, index) => item.ordinal === index + 1 && item.hash.length > 20,
      ),
    ).toBe(true);
  });

  it("normalises plain text without inventing content", async () => {
    const result = await extractText(
      Buffer.from("Line one   \r\n\r\n\r\nLine two"),
      "text/plain",
    );
    expect(result.text).toBe("Line one\n\nLine two");
    expect(result.segments.map((item) => item.content)).toEqual([
      "Line one",
      "Line two",
    ]);
  });

  it("extracts text from a genuine PDF text layer", async () => {
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      "<< /Length 47 >>\nstream\nBT /F1 12 Tf 72 720 Td (PDF evidence) Tj ET\nendstream",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
      .join(
        "\n",
      )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const result = await extractText(Buffer.from(pdf), "application/pdf");
    expect(result.status).toBe("completed");
    expect(result.text).toContain("PDF evidence");
    expect(result.segments[0]).toMatchObject({kind:"page",locator:{page:1}});
  });
  it("uses bundled local OCR for an image-only PDF", async () => {
    const imageCanvas = createCanvas(700, 180);
    const imageContext = imageCanvas.getContext("2d");
    imageContext.fillStyle = "white";
    imageContext.fillRect(0, 0, 700, 180);
    imageContext.fillStyle = "black";
    imageContext.font = "bold 52px Arial";
    imageContext.fillText("OCR TEST 123", 40, 110);
    const image = await loadImage(imageCanvas.toBuffer("image/png"));
    const pdf = new PDFDocument();
    const page = pdf.beginPage(700, 180);
    (page as unknown as { drawImage: typeof imageContext.drawImage }).drawImage(
      image,
      0,
      0,
      700,
      180,
    );
    pdf.endPage();
    const result = await extractText(pdf.close(), "application/pdf", {
      ocr: true,
    });
    expect(result.status).toBe("completed");
    expect(result.text.toUpperCase()).toContain("OCR TEST 123");
    expect(result.warnings[0]).toContain("OCR");
  }, 60_000);
  it("extracts paragraphs from a genuine Word document container", async () => {
    const archive = new JSZip();
    archive.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    archive.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    archive.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Word evidence paragraph</w:t></w:r></w:p><w:p><w:r><w:t>Second traceable statement</w:t></w:r></w:p></w:body></w:document>`);
    const bytes = await archive.generateAsync({ type: "nodebuffer" });
    const result = await extractText(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(result.status).toBe("completed");
    expect(result.text).toContain("Word evidence paragraph");
    expect(result.text).toContain("Second traceable statement");
  });
});
