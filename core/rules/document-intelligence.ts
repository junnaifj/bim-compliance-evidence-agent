import type { RuleDefinition } from "../compliance/compliance";

export type RuleDocument = {
  id: string;
  name: string;
  mime: string;
  size: number;
  hash: string;
  previewUrl?: string;
  previewHtml?: string;
  extractedText: string;
  source: "uploaded" | "official-link" | "sample";
  sourceUrl?: string;
  licence: string;
  rules: RuleDefinition[];
  warnings: string[];
  extractionStatus: "EXTRACTION_ERROR" | "NO_MACHINE_TEXT" | "TEXT_EXTRACTED_NO_RULES" | "DRAFT_RULES_EXTRACTED";
  pageCount?: number;
  characterCount: number;
  candidatePassages: string[];
  passages: RequirementPassage[];
  workerStatus: "NOT_REQUIRED" | "READY" | "FAILED";
};

export type RequirementPassage = {
  text: string;
  sourceAnchor: string;
  classification: "EXECUTABLE" | "STRUCTURABLE" | "REFERENCE_ONLY";
  missing: string[];
};

export const officialRuleSources = [
  {
    id: "hkbd-bim",
    title: { en: "Buildings Department — Building Information Modelling", zh: "香港屋宇署—建筑信息模拟" },
    publisher: "Buildings Department, HKSAR Government",
    url: "https://www.bd.gov.hk/en/resources/online-tools/building-information-modelling/index.html",
    note: { en: "Official BIM submission guidance and links. Plans prevail where BIM information differs.", zh: "官方 BIM 呈交指引及相关链接；如 BIM 资料与图则不一致，以图则为准。" },
    redistribution: false,
  },
  {
    id: "hkbldg-codes",
    title: { en: "Buildings Department — Codes and Design Manuals", zh: "香港屋宇署—守则及设计手册" },
    publisher: "Buildings Department, HKSAR Government",
    url: "https://www.bd.gov.hk/en/resources/codes-and-references/codes-and-design-manuals/index.html",
    note: { en: "Official index of current codes and design manuals. Open the source to confirm the applicable edition.", zh: "现行守则及设计手册的官方目录；请从官方来源确认适用版本。" },
    redistribution: false,
  },
  {
    id: "devb-harmonisation",
    title: { en: "DEVB BIM Harmonisation Guidelines for Works Departments v3.0", zh: "发展局工务部门 BIM 协调指引 v3.0" },
    publisher: "Development Bureau, HKSAR Government",
    url: "https://www.devb.gov.hk/en/publications_and_press_releases/publications/devb-harmonisation-guideline/index.html",
    note: { en: "Official publication page. The full document is not redistributed in this public repository.", zh: "官方发布页面；本公开仓库不再分发完整文件。" },
    redistribution: false,
  },
  {
    id: "hkbd-bimsps-2023",
    title: { en: "Buildings Department — BIM in Statutory Plan Submissions 2023", zh: "香港屋宇署—法定图则呈交 BIM 指引 2023" },
    publisher: "Buildings Department, HKSAR Government",
    url: "https://www.bd.gov.hk/doc/en/resources/codes-and-references/code-and-design-manuals/BIMSPS_e.pdf",
    note: { en: "Official guidance for BIM in statutory plan submissions other than General Building Plans. The local manual-test copy is not redistributed.", zh: "有关一般建筑图则以外法定图则呈交的官方 BIM 指引；本地手动测试副本不会随仓库分发。" },
    redistribution: false,
  },
] as const;

async function digest(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

export function catalogueRequirementPassages(text: string): RequirementPassage[] {
  const unsafeInstruction = /(ignore (?:all|previous)|reveal (?:api|secret|password)|system prompt|mark all .* compliant)/i;
  let currentPage: number | undefined;
  const passages: RequirementPassage[] = [];
  for (const raw of text.split(/\n|(?<=[.;。；])\s+/)) {
    const page = raw.match(/^\[Page (\d+)\]\s*/i); if (page) currentPage = Number(page[1]);
    const item = raw.replace(/^\[Page \d+\]\s*/, "").replace(/\s+/g, " ").trim();
    if (item.length < 30 || item.length > 800) continue;
    if (unsafeInstruction.test(item)) { passages.push({ text: item, sourceAnchor: currentPage ? `Page ${currentPage}` : "Document text", classification: "REFERENCE_ONLY", missing: ["security review: instruction-like text cannot become executable"] }); continue; }
    if (!/(shall|must|required|should|not less|minimum|须|应|必须|不得|至少)/i.test(item)) continue;
    const hasTarget = /(door|exit|egress|room|space|wall|beam|门|出口|疏散|房间|空间|墙|梁)/i.test(item);
    const hasMetric = /\d+(?:\.\d+)?\s*(?:mm|毫米|m|米)\b/i.test(item);
    const missing = [!hasTarget && "target element", !hasMetric && "measurable threshold"].filter(Boolean) as string[];
    passages.push({ text: item, sourceAnchor: currentPage ? `Page ${currentPage}` : "Document text", classification: hasTarget && hasMetric ? "EXECUTABLE" : hasTarget ? "STRUCTURABLE" : "REFERENCE_ONLY", missing });
  }
  return passages;
}

export const extractRequirementPassages = (text: string): string[] => catalogueRequirementPassages(text).map((item) => item.text);

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions) throw new Error("[PDF_WORKER_CONFIGURATION] PDF.js did not expose GlobalWorkerOptions.");
  const workerPath = "/pdf.worker.min.mjs"; const workerUrl = typeof location === "undefined" ? workerPath : new URL(workerPath, location.origin).href;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) throw new Error("[PDF_WORKER_CONFIGURATION] The PDF worker URL could not be configured.");
  return pdfjs;
}

export async function verifyPdfWorker(): Promise<{ status: "READY" | "FAILED"; url: string; detail: string }> {
  const url = typeof location === "undefined" ? "/pdf.worker.min.mjs" : new URL("/pdf.worker.min.mjs", location.origin).href;
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Number(response.headers.get("content-length") ?? 0);
    return { status: "READY", url, detail: bytes ? `${bytes.toLocaleString()} bytes` : "asset reachable" };
  } catch (error) {
    return { status: "FAILED", url, detail: error instanceof Error ? error.message : "worker asset unavailable" };
  }
}

export function extractRulesFromText(text: string, sourceDocumentId: string): RuleDefinition[] {
  const candidates = text.split(/\n|(?<=[.;。；])\s+/).map((item) => item.trim());
  const rules: RuleDefinition[] = [];
  let pageNumber: number | undefined;
  for (const [index, sentence] of candidates.entries()) {
    const page = sentence.match(/^\[Page (\d+)\]/i); if (page) pageNumber = Number(page[1]);
    if (sentence.length <= 12) continue;
    const door = /(door|exit|egress|门|出口|疏散)/i.test(sentence);
    const width = /(width|clear opening|净宽|宽度)/i.test(sentence);
    const metric = sentence.match(/(\d+(?:\.\d+)?)\s*(mm|毫米|m|米)\b/i);
    const required = /(shall|must|required|not less|minimum|至少|不得小于|应|必须)/i.test(sentence);
    if (!door || !width || !metric || !required) continue;
    const threshold = Math.round(Number(metric[1]) * (/^(m|米)$/i.test(metric[2]) ? 1000 : 1));
    rules.push({
      id: `EXTRACTED-${sourceDocumentId.slice(-6).toUpperCase()}-${String(rules.length + 1).padStart(3, "0")}`, version: 1,
      title: { en: `Extracted door-width requirement · ${threshold} mm`, zh: `提取的门宽要求 · ${threshold} 毫米` },
      description: { en: sentence, zh: sentence }, authority: "Unverified extracted source", jurisdiction: "Requires confirmation",
      sourceDocumentId, sourceAnchor: pageNumber ? `Page ${pageNumber} · text segment ${index + 1}` : `Text segment ${index + 1}`, target: "IfcDoor", field: "clearWidth", operator: ">=", threshold, unit: "mm",
      scope: /(exit|egress|出口|疏散)/i.test(sentence) ? "Exit or egress doors" : "Requires confirmation", exceptions: [], missingEvidencePolicy: "REVIEW", severity: "HIGH", status: "DRAFT", extractionConfidence: 0.78,
    });
  }
  return rules;
}

export async function readRuleDocument(file: File): Promise<RuleDocument> {
  if (file.size > 40 * 1024 * 1024) throw new Error("The rule-source file exceeds the 40 MB assessment limit.");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""; const buffer = await file.arrayBuffer();
  // pdf.js may transfer/detach the supplied ArrayBuffer. Capture the evidence hash
  // before any parser receives it so the audit record can never degrade to the
  // SHA-256 of an empty buffer after extraction.
  const hash = await digest(buffer); const id = `doc-${hash.slice(0, 12)}`; let extractedText = ""; let previewHtml = ""; let pageCount: number | undefined; let extractionFailed = false; let workerStatus: RuleDocument["workerStatus"] = "NOT_REQUIRED"; const warnings: string[] = [];
  const textTypes = ["txt", "md", "csv", "json", "yaml", "yml", "ids", "dxf", "ifc"];
  if (textTypes.includes(extension)) {
    extractedText = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    previewHtml = `<pre>${escapeHtml(extractedText.slice(0, 120000))}</pre>`;
    if (["dxf", "ifc"].includes(extension)) warnings.push(`${extension.toUpperCase()} rule extraction is limited to readable annotations and properties; geometry alone is not a deterministic regulation.`);
  } else if (extension === "docx") {
    const mammoth = await import("mammoth");
    const [html, raw] = await Promise.all([mammoth.convertToHtml({ arrayBuffer: buffer }), mammoth.extractRawText({ arrayBuffer: buffer })]);
    previewHtml = html.value; extractedText = raw.value; warnings.push(...html.messages.map((item: { message: string }) => item.message));
  } else if (extension === "xlsx") {
    const { default: readXlsxFile } = await import("read-excel-file/browser"); const sheets = await readXlsxFile(buffer);
    const cell = (value: unknown) => value instanceof Date ? value.toISOString() : String(value ?? "");
    extractedText = sheets.map(({ sheet, data }) => `# Sheet: ${sheet}\n${data.map((row) => row.map((value) => JSON.stringify(cell(value))).join(",")).join("\n")}`).join("\n\n");
    previewHtml = sheets.map(({ sheet, data }) => `<h3>${escapeHtml(sheet)}</h3><table>${data.slice(0, 500).map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(cell(value))}</td>`).join("")}</tr>`).join("")}</table>`).join("");
  } else if (extension === "xls") {
    throw new Error("Legacy XLS is not parsed in-browser. Save it as XLSX or CSV to retain a safer, bounded import path.");
  } else if (extension === "pdf") {
    try {
      const health = await verifyPdfWorker(); workerStatus = health.status;
      if (health.status === "FAILED") throw new Error(`[PDF_WORKER_UNAVAILABLE] ${health.url}: ${health.detail}`);
      const pdfjs = await loadPdfJs(); const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise; pageCount = pdf.numPages;
      const pages: string[] = []; const extractionLimit = pdf.numPages;
      for (let pageNumber = 1; pageNumber <= extractionLimit; pageNumber += 1) {
        const content = await (await pdf.getPage(pageNumber)).getTextContent();
        pages.push(`[Page ${pageNumber}]\n${content.items.map((item: { str?: string }) => item.str ?? "").join(" ")}`);
      }
      extractedText = pages.join("\n\n");
    } catch (error) {
      extractionFailed = true; const detail = error instanceof Error ? error.message : "Unknown PDF extraction error";
      warnings.push(`PDF text extraction failed [PDF_EXTRACTION_ERROR]: ${detail}. The original remains available in the private preview; use an authorised OCR copy if the document is scanned or copy-restricted.`);
    }
  } else if (extension === "dwg") {
    throw new Error("DWG requires an authorised ODA or Autodesk conversion connector. Convert it to DXF or PDF for this assessment build.");
  } else throw new Error("Unsupported rule-source format. Use PDF, DOCX, XLSX, CSV, text, JSON, YAML, IDS, IFC or DXF.");
  if (!extractedText.trim()) warnings.push("No machine-readable text was found. The PDF may be scanned, encrypted or copy-restricted; authorised OCR or manual transcription may be required.");
  const previewUrl = extension === "pdf" ? URL.createObjectURL(file) : undefined; const rules = extractRulesFromText(extractedText, id); const passages = catalogueRequirementPassages(extractedText); const candidatePassages = passages.map((item) => item.text); const extractionStatus = extractionFailed ? "EXTRACTION_ERROR" : !extractedText.trim() ? "NO_MACHINE_TEXT" : rules.length ? "DRAFT_RULES_EXTRACTED" : "TEXT_EXTRACTED_NO_RULES";
  return { id, name: file.name, mime: file.type || `application/${extension}`, size: file.size, hash, previewUrl, previewHtml, extractedText, source: "uploaded", licence: "User-supplied; not redistributed", rules, warnings, extractionStatus, pageCount, characterCount: extractedText.length, candidatePassages, passages, workerStatus };
}
