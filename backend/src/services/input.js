import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import env from "../config/env.js";
import { AppError } from "../middleware/errors.js";
import { DOC_TYPES, AUDIO_TYPES } from "../middleware/upload.js";
import { transcribeAudio } from "./ai.js";
import { ocrPdf, ocrImages } from "./ocr.js";

const MIN_CHARS = 30;

async function documentToText(file) {
  const kind = DOC_TYPES[file.mimetype];
  try {
    if (kind === "pdf") return (await pdfParse(file.buffer)).text;
    if (kind === "docx") return (await mammoth.extractRawText({ buffer: file.buffer })).value;
    if (kind === "image") return "";
    return file.buffer.toString("utf8");
  } catch {
    throw new AppError(422, "UNREADABLE_DOCUMENT", `Could not read "${file.originalname}". The file may be corrupted or password protected.`);
  }
}

// PDFs with no text layer (scans, "Print to PDF" output) and images go through OCR.
async function ocrDocument(file, ocr) {
  try {
    if (DOC_TYPES[file.mimetype] === "image") return await ocr.images([file.buffer]);
    return (await ocr.pdf(file.buffer)).text;
  } catch (err) {
    console.error("[ocr] failed:", err.message);
    throw new AppError(422, "OCR_FAILED", `"${file.originalname}" has no selectable text and OCR could not read it. Try a DOCX or paste the text.`);
  }
}

const defaultOcr = { pdf: ocrPdf, images: ocrImages };

/**
 * Turns a request into plain text, whatever the input type.
 *   multipart "file"  -> PDF / DOCX / TXT text extraction (OCR fallback for image-only PDFs and images),
 *                        or audio -> Whisper transcript
 *   JSON / form "text" -> used as-is
 */
export async function resolveInput(req) {
  let text = "";
  let source;

  if (req.file) {
    const file = req.file;
    if (AUDIO_TYPES.has(file.mimetype)) {
      text = await transcribeAudio({ buffer: file.buffer, filename: file.originalname, mimetype: file.mimetype, client: req.app.locals.aiClient });
      source = { type: "audio", file_name: file.originalname, mime: file.mimetype, size_bytes: file.size };
    } else {
      text = await documentToText(file);
      let extraction = "text_layer";
      if (text.trim().length < MIN_CHARS && ["pdf", "image"].includes(DOC_TYPES[file.mimetype])) {
        text = await ocrDocument(file, req.app.locals.ocr || defaultOcr);
        extraction = "ocr";
      }
      source = { type: "document", file_name: file.originalname, mime: file.mimetype, size_bytes: file.size, extraction };
    }
  } else if (typeof req.body?.text === "string") {
    text = req.body.text;
    source = { type: "text" };
  } else if (req.body?.text !== undefined) {
    throw new AppError(400, "INVALID_INPUT", '"text" must be a string.');
  }

  text = text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  if (!source && !text) throw new AppError(400, "EMPTY_INPUT", 'Provide "text" or upload a "file" (PDF, DOCX, TXT, image or audio).');
  if (!text) {
    const hint = source?.type === "audio" ? "No speech was detected in the audio." : "No readable text was found in the document, even with OCR.";
    throw new AppError(422, "NO_TEXT_EXTRACTED", hint);
  }
  if (text.length < MIN_CHARS) throw new AppError(400, "INPUT_TOO_SHORT", `Input is too short (${text.length} chars). Provide at least ${MIN_CHARS} characters.`);
  if (text.length > env.maxInputChars) {
    throw new AppError(413, "INPUT_TOO_LONG", `Input is ${text.length} chars; the limit is ${env.maxInputChars}.`);
  }

  source.chars = text.length;
  return { text, source };
}
