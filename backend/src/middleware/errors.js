import { ZodError } from "zod";
import multer from "multer";

// Typed application error so every failure reaches the client in one consistent shape.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong.";
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_FAILED";
    message = "Request data failed validation.";
    details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  } else if (err instanceof multer.MulterError) {
    status = 400;
    code = err.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_ERROR";
    message = err.message;
  } else if (err?.code === "ERR_SQLITE_ERROR" && /constraint/i.test(err.message)) {
    status = 400;
    code = "DB_CONSTRAINT_FAILED";
    message = "The record violates a database constraint.";
    details = [{ path: "", message: err.message }];
  } else if (err?.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "Request body is not valid JSON.";
  } else if (err?.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body is too large.";
  }

  if (status >= 500) console.error("[error]", err);

  res.status(status).json({ ok: false, error: { code, message, ...(details ? { details } : {}) } });
}
