"use strict";
const crypto = require("crypto"),
  mammoth = require("mammoth"),
  { createCanvas, loadImage } = require("@napi-rs/canvas"),
  { createWorker } = require("tesseract.js"),
  english = require("@tesseract.js-data/eng");
const VERSION = "timsys-document-v1";
function normalise(v) {
  return String(v || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((x) => x.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function hash(v) {
  return crypto.createHash("sha256").update(v).digest("hex");
}
function segments(text, kind = "paragraph", locator = {}) {
  return normalise(text)
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((content, i) => ({
      ordinal: i + 1,
      kind,
      content,
      content_hash: hash(content),
      locator,
    }));
}
async function pdf(bytes, ocr) {
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs"),
    task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }),
    doc = await task.promise,
    pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n),
        content = await page.getTextContent(),
        text = normalise(
          content.items
            .map((x) => ("str" in x ? x.str + (x.hasEOL ? "\n" : " ") : ""))
            .join(""),
        ),
        operators = await page.getOperatorList(),
        visualCount = operators.fnArray.filter((op) =>
          [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject].includes(op),
        ).length;
      pages.push({ page: n, text, visualCount });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  if (pages.some((x) => x.text))
    return {
      text: normalise(pages.map((x) => x.text).join("\n\n")),
      segments: pages
        .filter((x) => x.text)
        .map((x, i) => ({
          ordinal: i + 1,
          kind: "page",
          content: x.text,
          content_hash: hash(x.text),
          locator: { page: x.page, method: "native_text" },
        })),
      warnings: [],
      usedOcr: false,
      assets: pages.flatMap((x) => Array.from({ length: x.visualCount }, (_, i) => ({ ordinal: 1 + pages.slice(0, x.page - 1).reduce((n, p) => n + p.visualCount, 0) + i, asset_type: "embedded_visual", locator: { page: x.page, visual_index: i + 1 }, description: "Embedded image, chart, graph or diagram requiring contextual review." }))),
    };
  if (!ocr)
    return {
      text: "",
      segments: [],
      warnings: [
        "The PDF has no readable text layer. Run OCR to read scanned pages.",
      ],
      usedOcr: false,
      assets: [],
    };
  const task2 = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
    }),
    doc2 = await task2.promise,
    worker = await createWorker(english.code, undefined, {
      langPath: english.langPath,
      gzip: english.gzip,
    }),
    out = [];
  try {
    for (let n = 1; n <= doc2.numPages; n++) {
      const page = await doc2.getPage(n),
        view = page.getViewport({ scale: 1.75 }),
        canvas = createCanvas(Math.ceil(view.width), Math.ceil(view.height));
      await page.render({
        canvas,
        canvasContext: canvas.getContext("2d"),
        viewport: view,
      }).promise;
      const result = await worker.recognize(canvas.toBuffer("image/png")),
        text = normalise(result.data.text);
      if (text)
        out.push({ page: n, text, confidence: result.data.confidence / 100 });
      page.cleanup();
    }
  } finally {
    await worker.terminate();
    await task2.destroy();
  }
  return {
    text: normalise(out.map((x) => x.text).join("\n\n")),
    segments: out.map((x, i) => ({
      ordinal: i + 1,
      kind: "page",
      content: x.text,
      content_hash: hash(x.text),
      locator: { page: x.page, method: "ocr" },
      confidence: x.confidence,
    })),
    warnings: [
      "Text was produced by OCR. Check it against the original pages before analysis.",
    ],
    usedOcr: true,
    assets: out.map((x, i) => ({ ordinal: i + 1, asset_type: "scanned_page", locator: { page: x.page }, description: "Scanned page used for OCR; inspect visual relationships against the original." })),
  };
}
async function imageOcr(bytes) {
  const worker = await createWorker(english.code, undefined, {
    langPath: english.langPath,
    gzip: english.gzip,
  });
  try {
    const image = await loadImage(bytes),
      canvas = createCanvas(image.width, image.height),
      ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const result = await worker.recognize(canvas.toBuffer("image/png")),
      text = normalise(result.data.text);
    return {
      text,
      segments: text
        ? [
            {
              ordinal: 1,
              kind: "page",
              content: text,
              content_hash: hash(text),
              locator: { page: 1, method: "ocr" },
              confidence: result.data.confidence / 100,
            },
          ]
        : [],
      warnings: [
        "Text was produced by OCR. Check it against the original image before analysis.",
      ],
      usedOcr: true,
      assets: [{ ordinal: 1, asset_type: "source_image", locator: { page: 1 }, description: "Source image requiring visual interpretation in addition to OCR text." }],
    };
  } finally {
    await worker.terminate();
  }
}
async function extractBytes(bytes, mime, options = {}) {
  const type = String(mime || "")
    .toLowerCase()
    .split(";")[0];
  if (type === "application/pdf") {
    const result = await pdf(bytes, options.ocr === true);
    return { ...result, status: result.text ? "completed" : "empty" };
  }
  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/vnd.ms-word.document.macroenabled.12"
  ) {
    const result = await mammoth.extractRawText({ buffer: bytes }),
      html = await mammoth.convertToHtml({ buffer: bytes }),
      text = normalise(result.value),
      imageCount = (html.value.match(/<img\b/gi) || []).length;
    return {
      status: text ? "completed" : "empty",
      text,
      segments: segments(text),
      warnings: result.messages.map((x) => x.message),
      usedOcr: false,
      assets: Array.from({ length: imageCount }, (_, i) => ({ ordinal: i + 1, asset_type: "embedded_visual", locator: { document_order: i + 1 }, description: "Embedded Word image requiring contextual review." })),
    };
  }
  if (type.startsWith("image/")) {
    if (!options.ocr)
      return {
        status: "empty",
        text: "",
        segments: [],
        warnings: ["Image text requires OCR."],
        usedOcr: false,
        assets: [{ ordinal: 1, asset_type: "source_image", locator: { page: 1 }, description: "Source image was not OCR processed." }],
      };
    const r = await imageOcr(bytes);
    return { ...r, status: r.text ? "completed" : "empty" };
  }
  if (type.startsWith("text/")) {
    const text = normalise(new TextDecoder().decode(bytes));
    return {
      status: text ? "completed" : "empty",
      text,
      segments: segments(text),
      warnings: [],
      usedOcr: false,
      assets: [],
    };
  }
  return {
    status: "unsupported",
    text: "",
    segments: [],
    warnings: [`No extractor is registered for ${type || "this file type"}.`],
    usedOcr: false,
    assets: [],
  };
}
module.exports = { VERSION, extractBytes, normalise, hash };
