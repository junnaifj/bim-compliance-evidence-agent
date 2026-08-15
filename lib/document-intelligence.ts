import type { RuleDefinition } from "./compliance";

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

export function extractRulesFromText(text: string, sourceDocumentId: string): RuleDefinition[] {
  const candidates = text.split(/\n|(?<=[.;。；])\s+/).map((item) => item.trim()).filter((item) => item.length > 12);
  const rules: RuleDefinition[] = [];
  for (const [index, sentence] of candidates.entries()) {
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
      sourceDocumentId, sourceAnchor: `Text segment ${index + 1}`, target: "IfcDoor", field: "clearWidth", operator: ">=", threshold, unit: "mm",
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
  const hash = await digest(buffer); const id = `doc-${hash.slice(0, 12)}`; let extractedText = ""; let previewHtml = ""; const warnings: string[] = [];
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
      const pdfjs = await import("pdfjs-dist/build/pdf.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      const pages: string[] = []; const extractionLimit = Math.min(pdf.numPages, 25);
      for (let pageNumber = 1; pageNumber <= extractionLimit; pageNumber += 1) {
        const content = await (await pdf.getPage(pageNumber)).getTextContent();
        pages.push(`[Page ${pageNumber}]\n${content.items.map((item: { str?: string }) => item.str ?? "").join(" ")}`);
      }
      extractedText = pages.join("\n\n");
      if (pdf.numPages > extractionLimit) warnings.push(`Text extraction was bounded to the first ${extractionLimit} of ${pdf.numPages} pages for responsive in-browser review. The complete original remains available in the preview.`);
    } catch {
      warnings.push("Text extraction is unavailable for this PDF, for example because copying is restricted or the document uses unsupported encoding. The original remains available in the private preview; use an authorised OCR copy for catalogue extraction.");
    }
  } else if (extension === "dwg") {
    throw new Error("DWG requires an authorised ODA or Autodesk conversion connector. Convert it to DXF or PDF for this assessment build.");
  } else throw new Error("Unsupported rule-source format. Use PDF, DOCX, XLSX, CSV, text, JSON, YAML, IDS, IFC or DXF.");
  if (!extractedText.trim()) warnings.push("No machine-readable text was found. OCR or manual transcription may be required.");
  const previewUrl = extension === "pdf" ? URL.createObjectURL(file) : undefined;
  return { id, name: file.name, mime: file.type || `application/${extension}`, size: file.size, hash, previewUrl, previewHtml, extractedText, source: "uploaded", licence: "User-supplied; not redistributed", rules: extractRulesFromText(extractedText, id), warnings };
}
