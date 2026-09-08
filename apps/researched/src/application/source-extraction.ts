import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { contentHash } from "@timsys/app-sdk";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { createRequire } from "node:module";
import { createWorker } from "tesseract.js";
import { load } from "cheerio";

export const EXTRACTOR_VERSION = "researched-text-v4";
const localRequire = createRequire(import.meta.url);
const englishData = localRequire("@tesseract.js-data/eng") as {
  code: string;
  gzip: boolean;
  langPath: string;
};

export interface ExtractedSegment {
  readonly ordinal: number;
  readonly kind: "heading"|"paragraph"|"list-item"|"table-row"|"page";
  readonly content: string;
  readonly hash: string;
  readonly locator: Readonly<Record<string,string|number>>;
}

export interface ExtractionResult {
  readonly status: "completed" | "empty" | "unsupported";
  readonly text: string;
  readonly segments: readonly ExtractedSegment[];
  readonly warnings: readonly string[];
  readonly extractorVersion: string;
}

const entities: Readonly<Record<string, string>> = Object.freeze({
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
});

function decodeEntities(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#x"))
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#"))
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return entities[entity.toLowerCase()] ?? match;
    },
  );
}

function normalise(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlText(value: string) {
  return normalise(
    decodeEntities(
      value
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(
          /<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
          " ",
        )
        .replace(/<(br|hr)\b[^>]*>/gi, "\n")
        .replace(
          /<\/(address|article|aside|blockquote|div|footer|h[1-6]|header|li|main|nav|p|section|table|tr)>/gi,
          "\n\n",
        )
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function segment(text: string,kind:ExtractedSegment["kind"]="paragraph",locator:Readonly<Record<string,string|number>>={}): readonly ExtractedSegment[] {
  return Object.freeze(
    text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((content, index) =>
        Object.freeze({
          ordinal: index + 1,
          kind,
          content,
          hash: contentHash(content),
          locator,
        }),
      ),
  );
}

function htmlSegments(value:string){
  const $=load(value),segments:ExtractedSegment[]=[];
  $("script,style,noscript,svg,template").remove();
  $("h1,h2,h3,h4,h5,h6,p,li,tr").each((_,element)=>{
    const tag=element.tagName.toLowerCase(),content=normalise($(element).text()); if(!content) return;
    const kind=tag.startsWith("h")?"heading":tag==="li"?"list-item":tag==="tr"?"table-row":"paragraph";
    segments.push(Object.freeze({ordinal:segments.length+1,kind,content,hash:contentHash(content),locator:Object.freeze({selector:$(element).attr("id")?`#${$(element).attr("id")}`:tag})}));
  });
  return Object.freeze(segments);
}

async function pdfText(bytes: Buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .trim(),
      );
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages.map(normalise);
}

async function pdfOcr(bytes: Buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const worker = await createWorker(englishData.code, undefined, {
    langPath: englishData.langPath,
    gzip: englishData.gzip,
  });
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.75 });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      await page.render({
        canvas: canvas as never,
        canvasContext: canvas.getContext("2d") as never,
        viewport,
      }).promise;
      const result = await worker.recognize(canvas.toBuffer("image/png"));
      pages.push(result.data.text);
      page.cleanup();
    }
  } finally {
    await worker.terminate();
    await loadingTask.destroy();
  }
  return normalise(pages.join("\n\n"));
}

async function wordText(bytes: Buffer, mediaType: string) {
  const isDocx =
    mediaType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mediaType === "application/vnd.ms-word.document.macroenabled.12";
  if (!isDocx) return null;
  const result = await mammoth.extractRawText({ buffer: bytes });
  return {
    text: normalise(result.value),
    warnings: result.messages.map((message) => message.message),
  };
}

export async function extractText(
  bytes: Buffer,
  mediaType: string,
  options: { ocr?: boolean } = {},
): Promise<ExtractionResult> {
  const type = mediaType.toLowerCase().split(";")[0]!.trim();
  if (type === "application/pdf") {
    const pageTexts = await pdfText(bytes);
    let text = normalise(pageTexts.join("\n\n"));
    const usedOcr = !text && options.ocr === true;
    if (usedOcr) text = await pdfOcr(bytes);
    const segments = usedOcr?segment(text,"page",{source:"ocr"}):Object.freeze(pageTexts.filter(Boolean).map((content,index)=>Object.freeze({ordinal:index+1,kind:"page" as const,content,hash:contentHash(content),locator:Object.freeze({page:index+1})})));
    return Object.freeze({
      status: text ? "completed" : "empty",
      text,
      segments,
      warnings: Object.freeze([
        ...(text
          ? usedOcr
            ? ["Text produced by OCR; verify it against the source image."]
            : []
          : ["The PDF contains no text layer and requires OCR."]),
      ]),
      extractorVersion: EXTRACTOR_VERSION,
    });
  }
  const word = await wordText(bytes, type);
  if (word) {
    return Object.freeze({
      status: word.text ? "completed" : "empty",
      text: word.text,
      segments: segment(word.text),
      warnings: Object.freeze(word.warnings),
      extractorVersion: EXTRACTOR_VERSION,
    });
  }
  if (!(type.includes("html") || type.startsWith("text/"))) {
    return Object.freeze({
      status: "unsupported",
      text: "",
      segments: Object.freeze([]),
      warnings: Object.freeze([
        `No extractor is registered for ${type || "unknown media type"}.`,
      ]),
      extractorVersion: EXTRACTOR_VERSION,
    });
  }
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const text = type.includes("html") ? htmlText(decoded) : normalise(decoded);
  const segments = type.includes("html") ? htmlSegments(decoded) : segment(text);
  return Object.freeze({
    status: text ? "completed" : "empty",
    text,
    segments,
    warnings: Object.freeze(
      text ? [] : ["The source contained no extractable text."],
    ),
    extractorVersion: EXTRACTOR_VERSION,
  });
}

export async function extractStoredSnapshot(
  storageRoot: string,
  storagePath: string,
  mediaType: string,
  options: { ocr?: boolean } = {},
) {
  if (!storagePath || isAbsolute(storagePath))
    throw new Error("invalid_snapshot_path");
  const root = resolve(storageRoot);
  const target = resolve(root, storagePath);
  const route = relative(root, target);
  if (!route || route.startsWith("..") || isAbsolute(route))
    throw new Error("invalid_snapshot_path");
  return await extractText(await readFile(target), mediaType, options);
}
