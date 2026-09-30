import { load } from "cheerio";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { contentHash } from "@timsys/app-sdk";
import { extractText } from "./source-extraction.js";
import { canonicalContentUrl, FIELD_CATALOG, CONTENT_VERSION, type ContentPlan, type IntakeLink, type LinkOccurrence, type CapturedPage, type ContentResult, type EvidenceBlock } from "../domain/content-analysis.js";

const urlPattern = /https?:\/\/[^\s<>"“”]+/giu;
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const docxType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Intake keeps all occurrences: deduplicating retrieval must not erase programme associations. */
export async function readDocumentLinks(bytes: Buffer, mediaType: string): Promise<{links: IntakeLink[]; warnings: string[]}> {
  const found = new Map<string, IntakeLink>();
  const warnings: string[] = [];
  const add = (raw: string, label: string, context: string, locator: string) => {
    try {
      const url = canonicalContentUrl(raw), occurrence: LinkOccurrence = {label: clean(label), context: clean(context), locator, originalUrl: raw};
      const item = found.get(url) ?? {url, occurrences: []};
      if (!item.occurrences.some(x => JSON.stringify(x) === JSON.stringify(occurrence))) item.occurrences.push(occurrence);
      found.set(url, item);
    } catch { warnings.push(`Could not interpret a link at ${locator}: ${raw}`); }
  };
  if (mediaType === docxType || mediaType.includes("html")) {
    const html = mediaType === docxType ? await mammoth.convertToHtml({buffer: bytes}) : {value: bytes.toString("utf8"), messages: []};
    warnings.push(...html.messages.map(x => x.message));
    const $ = load(html.value);
    let context: string[] = [];
    $("p,h1,h2,h3,h4,h5,h6,li,td").each((index, element) => {
      // Process leaf content once; lists and tables often contain nested paragraphs.
      if ($(element).find("p,li,td").length) return;
      const text = clean($(element).text()), locator = `paragraph ${index + 1}`;
      const nearby = [...context.slice(-3), text].join(" | ");
      $(element).find("a[href]").each((_, anchor) => {
        const href = $(anchor).attr("href") ?? "", label = $(anchor).text();
        if (/^https?:/i.test(href)) add(href, label, nearby, locator);
        if (/^https?:/i.test(label) && href && label.replace(/\\$/, "") !== href.replace(/\\$/, "")) warnings.push(`Displayed URL and hyperlink target differ at ${locator}; both are retained.`);
      });
      for (const url of text.match(urlPattern) ?? []) add(url, text.replace(url, "").trim(), nearby, locator);
      if (text && !/https?:/.test(text)) context.push(text);
    });
  } else if (mediaType === "application/pdf") {
    const task = getDocument({data: new Uint8Array(bytes), useSystemFonts: true});
    const document = await task.promise;
    try {
      for (let n = 1; n <= document.numPages; n++) {
        const page = await document.getPage(n), text = (await page.getTextContent()).items.map(item => "str" in item ? item.str : "").join(" ");
        for (const annotation of await page.getAnnotations()) if (annotation.url) add(annotation.url, "PDF hyperlink", text.slice(0, 600), `page ${n}`);
        for (const url of text.match(urlPattern) ?? []) add(url, "PDF URL", text.slice(Math.max(0, text.indexOf(url) - 180), text.indexOf(url) + url.length + 100), `page ${n}`);
      }
    } finally { await task.destroy(); }
    if (!found.size) {
      const extracted = await extractText(bytes, mediaType, {ocr: true});
      warnings.push(...extracted.warnings);
      for (const url of extracted.text.match(urlPattern) ?? []) add(url, "OCR URL — verify", "Recovered from PDF text/OCR", "PDF text");
    }
  } else throw new Error("unsupported_document_type");
  return {links: [...found.values()], warnings: [...new Set(warnings)]};
}

export async function readContentPage(bytes: Buffer, mediaType: string, url: string, metadata: Omit<CapturedPage, "title" | "blocks" | "warnings" | "mediaType" | "url">): Promise<CapturedPage> {
  const blocks: EvidenceBlock[] = [], warnings: string[] = [];
  let title = new URL(url).hostname;
  const add = (text: string, heading: string, locator: string) => {
    text = clean(text);
    if (!text || text.length < 3 || blocks.length >= 1800) return;
    if (blocks.some(b => b.text === text && b.heading === heading)) return;
    blocks.push({id: contentHash(`${metadata.id}\n${locator}\n${text}`), text, heading, locator, pageId: metadata.id});
  };
  if (mediaType.includes("html")) {
    const $ = load(bytes.toString("utf8"));
    title = clean($("h1").first().text() || $("title").text()) || title;
    $("script,style,noscript,svg,template,nav,footer,aside,form,[role=navigation]").remove();
    const region = $("main").length ? $("main").first() : $("body");
    const headings: string[] = [];
    region.find("h1,h2,h3,h4,h5,h6,p,li,tr,dt,dd").each((index, element) => {
      const tag = element.tagName.toLowerCase(), text = $(element).text();
      if (/^h[1-6]$/.test(tag)) { headings.length = Number(tag[1]) - 1; headings[Number(tag[1]) - 1] = clean(text); }
      if ((tag === "p" && $(element).parents("li,td,th").length) || (tag === "li" && $(element).find("li").length)) return;
      add(text, headings.filter(Boolean).join(" › "), `${tag} block ${index + 1}${$(element).attr("id") ? ` (#${$(element).attr("id")})` : ""}`);
    });
    if (!blocks.length) add(region.text(), title, "body");
    if (/access denied|just a moment|verify you are human|page not found|404 not found/i.test(title)) warnings.push("This appears to be an access challenge or an error page; extracted text is not programme evidence.");
  } else {
    const result = await extractText(bytes, mediaType, {ocr: true});
    warnings.push(...result.warnings);
    let heading = "";
    for (const item of result.segments) {
      const pieces = item.content.split(/\n|(?<=[.!?])\s+(?=[A-Z])/u);
      for (const [index, text] of pieces.entries()) {
        if (/^[A-Za-z ]{3,55}:?$/.test(text.trim()) && FIELD_CATALOG.some(f => f.pattern.test(text))) heading = text;
        add(text, heading, item.locator.page ? `page ${item.locator.page}, passage ${index + 1}` : `paragraph ${item.ordinal}, passage ${index + 1}`);
      }
    }
    if (result.status !== "completed") warnings.push(`Extraction ${result.status}.`);
  }
  if (blocks.length >= 1800) warnings.push("Evidence block limit reached; inspect the original for additional information.");
  return {...metadata, url, title, mediaType, blocks, warnings};
}

export function classifyContent(page: CapturedPage): ContentResult["kind"] {
  const identity = `${page.title} ${new URL(page.url).pathname}`;
  if (/accreditation|accrediting|standards for schools/i.test(identity)) return "accreditation";
  if (/training|professional development|certificate|workshop/i.test(identity)) return "training";
  if (/degree|master|doctor|ph\.?d|ed\.?d|programme|program|curricul/i.test(identity)) return "programme";
  if (/catalog|directory|courses|programs|programmes/i.test(identity)) return "directory";
  return "unresolved";
}

export function analyseContent(pages: CapturedPage[], plan: ContentPlan): ContentResult {
  const first = pages[0], kind = first ? classifyContent(first) : "unresolved";
  const fields: Record<string, EvidenceBlock[]> = {};
  for (const field of FIELD_CATALOG.filter(f => plan.fields.includes(f.id))) {
    fields[field.id] = kind === "accreditation" ? [] : pages.flatMap(p => p.blocks).filter(block => {
      if (/access denied|verify you are human/i.test(block.text)) return false;
      const nearestHeading = block.heading.split(" › ").reverse().find(heading => FIELD_CATALOG.some(f => f.pattern.test(heading))) ?? "";
      const headingMatch = field.pattern.test(nearestHeading);
      // Never infer delivery from "apply online", credits from payments, or duration from unrelated dates.
      if (field.id === "delivery") return headingMatch || /(?:programme|program|course|study|classes|taught|delivered|offered).{0,65}\b(?:online|on[- ]campus|in[- ]person|hybrid)\b|\b(?:online|hybrid) (?:programme|program|course|degree)\b/i.test(block.text);
      if (field.id === "duration") return headingMatch || /\b\d+\s*(?:credit hours?|credits|ECTS|semester hours?)\b|(?:complete|duration|study|programme|program).{0,60}\b(?:\d+|one|two|three|four|five)\s*(?:years?|months?|semesters?)\b/i.test(block.text);
      return headingMatch || field.pattern.test(block.text);
    }).filter(b => b.text !== b.heading.split(" › ").at(-1)).slice(0, 100);
  }
  const missing = plan.fields.filter(id => !fields[id]?.length);
  const warnings = [...new Set(pages.flatMap(p => p.warnings))];
  if (kind === "accreditation") warnings.push("Accreditation context is retained separately. No programme comparison or accreditation judgement has been made.");
  if (pages.some(p => new Set(p.blocks.flatMap(b => b.heading.match(/master|doctor|bachelor/gi) ?? []).map(x => x.toLowerCase())).size > 1)) warnings.push("This page may describe several qualifications. Check the section attached to each passage before attributing it to a programme.");
  if (pages.some(p => p.blocks.some(b => b.text.length > 4000))) warnings.push("Some source passages are long; verify the relevant programme and section in the preserved evidence.");
  return {version: CONTENT_VERSION, title: first?.title ?? "No readable source", kind, fields, pages, observations: [], suggestions: [], warnings, coverage: {found: plan.fields.length - missing.length, requested: plan.fields.length, missing}, ai: {status: "off", notes: [], detail: "Deterministic extraction only."}};
}

export function rankSupportingLinks(html: string, baseUrl: string, rootUrl: string, plan: ContentPlan) {
  const $ = load(html), root = new URL(rootUrl), found = new Map<string, {url: string; label: string; reason: string; allowed: boolean; score: number}>();
  const base = $("base[href]").attr("href") ? new URL($("base[href]").attr("href")!, baseUrl).href : baseUrl;
  $("nav,footer,aside,form").remove();
  $("a[href]").each((_, anchor) => {
    try {
      const url = canonicalContentUrl($(anchor).attr("href")!, base), target = new URL(url), label = clean($(anchor).text());
      if (/logout|signout|login|apply-now|shopping|payment/i.test(target.pathname)) return;
      const searchable = `${label} ${target.pathname}`, matches = FIELD_CATALOG.filter(f => plan.fields.includes(f.id) && f.pattern.test(searchable));
      const attachment = /\.(?:pdf|docx)(?:$|\?)/i.test(url);
      const goalWords = plan.goal.toLowerCase().match(/[a-z]{5,}/g) ?? [];
      const score = matches.length * 5 + (attachment && /handbook|catalog|syllab|specification|programme|program|course/i.test(searchable) ? 4 : 0) + Math.min(2, goalWords.filter(w => searchable.toLowerCase().includes(w)).length);
      if (score < 4 || url === canonicalContentUrl(baseUrl)) return;
      const rootHost = root.hostname.replace(/^www\./, ""), host = target.hostname.replace(/^www\./, "");
      // Exact source host and its subdomains are automatic. Other hosts must be explicitly trusted.
      const allowed = host === rootHost || host.endsWith(`.${rootHost}`) || plan.allowedHosts.includes(target.hostname) || plan.allowedHosts.includes(host);
      found.set(url, {url, label: label || target.pathname, reason: matches.map(x => x.label).join(", ") || "Programme handbook or specification", allowed, score});
    } catch { /* Non-HTTP links are not research sources. */ }
  });
  return [...found.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}
