declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(source: unknown): { promise: Promise<{ numPages: number; getPage(page: number): Promise<{ getTextContent(): Promise<{ items: { str?: string }[] }> }> }> };
}

declare module "cloudflare:workers" {
  export const env: { DB?: unknown };
}

interface Fetcher { fetch(input: Request | string, init?: RequestInit): Promise<Response> }
interface D1Database { prepare(query: string): unknown }
