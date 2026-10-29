import path from "node:path";
import os from "node:os";

// OCR fallback for documents without a text layer: scanned resumes, "Print to PDF" output
// (text turned into vector outlines), and plain image uploads.
// Heavy modules are imported lazily so the API starts (and text/DOCX/audio keep working) even without them.

const MAX_PAGES = 3; // resumes are short; caps CPU time per request
const RENDER_SCALE = 2.5; // ~180 DPI: sharp enough for small resume type

let workerPromise = null;
function getWorker() {
  // One shared worker; the English model is downloaded once and cached on disk.
  workerPromise ??= import("tesseract.js").then(({ createWorker }) =>
    createWorker("eng", 1, { cachePath: path.join(os.tmpdir(), "talentverse-tessdata") })
  );
  workerPromise.catch(() => (workerPromise = null)); // allow a retry after a failed model download
  return workerPromise;
}

export async function renderPdfPages(buffer, maxPages = MAX_PAGES) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const images = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // transparent background OCRs poorly
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      images.push(canvas.toBuffer("image/png"));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return { images, pageCount: doc.numPages };
}

export async function ocrImages(images) {
  const worker = await getWorker();
  const texts = [];
  for (const img of images) {
    const { data } = await worker.recognize(img);
    texts.push(data.text);
  }
  return texts.join("\n\n").trim();
}

export async function ocrPdf(buffer) {
  const { images, pageCount } = await renderPdfPages(buffer);
  return { text: await ocrImages(images), pages: images.length, pageCount };
}
