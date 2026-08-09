import { z } from "zod";

// Split configuration shared by /api/preview and /api/embed.
export const splitConfigSchema = z
  .object({
    chunkSize: z.coerce.number().int().min(1).max(100_000),
    chunkOverlap: z.coerce.number().int().min(0).max(100_000),
    separators: z.array(z.string()).optional(),
  })
  .refine((c) => c.chunkOverlap < c.chunkSize, {
    message: "chunkOverlap must be smaller than chunkSize.",
    path: ["chunkOverlap"],
  });

export const previewSchema = z.object({
  text: z.string().min(1, "Text is empty."),
  config: splitConfigSchema,
});

export const embedSchema = z.object({
  text: z.string().min(1, "Text is empty."),
  source: z.string().trim().max(200).optional().default("pasted-text"),
  config: splitConfigSchema,
});

export const retrievalConfigSchema = z.object({
  topK: z.coerce.number().int().min(1).max(50).default(4),
  minScore: z.number().min(0).max(1).nullable().default(null),
  source: z.string().trim().min(1).nullable().default(null),
});

export const generationConfigSchema = z.object({
  temperature: z.coerce.number().min(0).max(2).default(0.3),
  topP: z.coerce.number().min(0).max(1).default(1),
  topK: z.coerce.number().int().min(1).max(1000).nullable().default(null),
  maxTokens: z.coerce.number().int().min(1).max(32_000).default(1024),
  frequencyPenalty: z.coerce.number().min(-2).max(2).default(0),
  presencePenalty: z.coerce.number().min(-2).max(2).default(0),
  systemPrompt: z.string().max(8_000).default(""),
});

export const chatSchema = z.object({
  question: z.string().min(1, "Question is empty."),
  retrieval: retrievalConfigSchema,
  generation: generationConfigSchema,
});

/** Formats the first Zod issue into a short, user-friendly message. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
