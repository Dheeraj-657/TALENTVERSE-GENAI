import multer from "multer";
import env from "../config/env.js";
import { AppError } from "./errors.js";

export const DOC_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "txt",
};

export const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/flac",
  "video/webm", // browser MediaRecorder sometimes labels audio-only recordings this way
]);

// Files stay in memory only: raw uploads are never written to disk or the database.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (DOC_TYPES[file.mimetype] || AUDIO_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new AppError(415, "UNSUPPORTED_FILE_TYPE", `Unsupported file type: ${file.mimetype}. Use PDF, DOCX, TXT or an audio file.`));
  },
});
