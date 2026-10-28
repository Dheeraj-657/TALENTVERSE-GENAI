import Groq, { toFile, APIError } from "groq-sdk";
import env from "../config/env.js";
import { AppError } from "../middleware/errors.js";
import { buildMessages, buildRepairMessage } from "../prompts/index.js";
import { normalizeAiOutput } from "../schemas/common.js";

let defaultClient;
function getClient(injected) {
  if (injected) return injected;
  if (!env.groqApiKey) throw new AppError(503, "AI_NOT_CONFIGURED", "GROQ_API_KEY is not set on the server.");
  defaultClient ??= new Groq({ apiKey: env.groqApiKey, timeout: 60_000, maxRetries: 2 });
  return defaultClient;
}

function mapProviderError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof APIError || err?.status) {
    if (err.status === 429) return new AppError(429, "AI_RATE_LIMITED", "The AI provider is rate limiting requests. Try again shortly.");
    if (err.status === 401) return new AppError(502, "AI_AUTH_FAILED", "The server's AI API key was rejected.");
    return new AppError(502, "AI_PROVIDER_ERROR", `AI provider error: ${err.message}`);
  }
  return new AppError(502, "AI_PROVIDER_ERROR", err?.message || "AI request failed.");
}

function parseJson(content) {
  try {
    return { value: JSON.parse(content) };
  } catch {
    // Some models wrap JSON in ``` fences despite instructions.
    const m = String(content).match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return { value: JSON.parse(m[0]) };
      } catch {
        /* fall through */
      }
    }
    return { error: "Response was not valid JSON." };
  }
}

/**
 * Schema-guided extraction:
 *   prompt with JSON Schema -> JSON mode completion -> normalise -> Zod validate
 *   -> on failure, one repair round with the exact validation errors -> Zod validate again.
 * Returns { data, attempts, usage } or throws AI_OUTPUT_INVALID (422) with the issues.
 */
export async function extractStructured({ promptKey, schema, input, context, client }) {
  const groq = getClient(client);
  const messages = buildMessages(promptKey, schema, { input, context });
  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  let lastIssues = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: env.groqModel,
        messages,
        temperature: 0.1,
        max_tokens: 8192,
        response_format: { type: "json_object" },
      });
    } catch (err) {
      throw mapProviderError(err);
    }

    usage.prompt_tokens += completion.usage?.prompt_tokens || 0;
    usage.completion_tokens += completion.usage?.completion_tokens || 0;
    const content = completion.choices?.[0]?.message?.content ?? "";

    const parsed = parseJson(content);
    if (parsed.error) {
      lastIssues = [{ path: "", message: parsed.error }];
    } else {
      const result = schema.safeParse(normalizeAiOutput(parsed.value));
      if (result.success) return { data: result.data, attempts: attempt, usage, model: env.groqModel };
      lastIssues = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    }

    messages.push({ role: "assistant", content: content || "{}" }, buildRepairMessage(lastIssues));
  }

  throw new AppError(422, "AI_OUTPUT_INVALID", "The AI response did not match the required schema after a repair attempt.", lastIssues);
}

export async function transcribeAudio({ buffer, filename, mimetype, client }) {
  const groq = getClient(client);
  try {
    const file = await toFile(buffer, filename || "audio.webm", { type: mimetype });
    const result = await groq.audio.transcriptions.create({ file, model: env.groqAudioModel, response_format: "json", temperature: 0 });
    return result.text || "";
  } catch (err) {
    throw mapProviderError(err);
  }
}
