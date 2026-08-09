import { z } from "zod";
import { DEFAULT_GENERATION, DEFAULT_RETRIEVAL } from "@/lib/defaults";

/**
 * Client-side form schema for the chat config panel (retrieval + generation knobs).
 * Managed by react-hook-form; the /api/chat route re-validates with its own schema.
 */
export const retrievalFormSchema = z.object({
  topK: z.number().int().min(1).max(50),
  minScore: z.number().min(0).max(1).nullable(),
  source: z.string().min(1).nullable(),
});

export const generationFormSchema = z.object({
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1),
  topK: z.number().int().min(1).max(1000).nullable(),
  maxTokens: z.number().int().min(1).max(32_000),
  frequencyPenalty: z.number().min(-2).max(2),
  presencePenalty: z.number().min(-2).max(2),
  systemPrompt: z.string().max(8_000),
});

export const chatConfigFormSchema = z.object({
  retrieval: retrievalFormSchema,
  generation: generationFormSchema,
});

export type ChatConfigFormValues = z.infer<typeof chatConfigFormSchema>;

export const CHAT_CONFIG_DEFAULTS: ChatConfigFormValues = {
  retrieval: DEFAULT_RETRIEVAL,
  generation: DEFAULT_GENERATION,
};
