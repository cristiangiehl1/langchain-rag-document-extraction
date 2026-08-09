// Structured RAG prompt: a JSON `promptConfig` (persona + rules) rendered into a
// text `template` with {placeholders}. Both are editable static files under this
// directory, loaded once at module init. Server-only (reads from disk with `fs`).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger("rag");

/** Shape of prompt.config.json — mirrors the structure used across the project. */
export const promptConfigSchema = z.object({
  metadata: z
    .object({
      created_by: z.string().optional(),
      date: z.string().optional(),
      version: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  task: z.string().min(1),
  role: z.string().min(1),
  instructions: z.array(z.string().min(1)).min(1),
  constraints: z.object({
    language: z.string().min(1),
    tone: z.string().min(1),
    max_length: z.number().optional(),
    format: z.string().min(1),
  }),
  examples: z
    .array(
      z.object({
        question: z.string(),
        expected_structure: z.string(),
      }),
    )
    .optional(),
  context_rules: z
    .object({
      use_only_provided_context: z.boolean().optional(),
      cite_examples_from_context: z.boolean().optional(),
      indicate_if_insufficient_context: z.boolean().optional(),
    })
    .optional(),
});

export type PromptConfig = z.infer<typeof promptConfigSchema>;

const PROMPT_DIR = join(process.cwd(), "src", "lib", "prompt");

/** Loads and validates prompt.config.json + template.txt once, then caches them. */
function loadPrompt(): { config: PromptConfig; template: string } {
  const rawConfig = readFileSync(join(PROMPT_DIR, "prompt.config.json"), "utf8");
  const config = promptConfigSchema.parse(JSON.parse(rawConfig));
  const template = readFileSync(join(PROMPT_DIR, "template.txt"), "utf8");
  log.info("prompt config loaded", {
    role: config.role,
    instructions: config.instructions.length,
    language: config.constraints.language,
  });
  return { config, template };
}

// Cached at module init (files are static; edits require a server restart).
const { config: PROMPT_CONFIG, template: PROMPT_TEMPLATE } = loadPrompt();

export { PROMPT_CONFIG };

/** Replaces every {token} in the template with the matching value. */
function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  );
}

/**
 * Renders the structured RAG prompt into a single string, interpolating the
 * persona/rules from promptConfig plus the runtime `context` and `question`.
 */
export function buildRagPrompt(input: {
  context: string;
  question: string;
}): string {
  const c = PROMPT_CONFIG;
  return render(PROMPT_TEMPLATE, {
    role: c.role,
    task: c.task,
    tone: c.constraints.tone,
    language: c.constraints.language,
    format: c.constraints.format,
    instructions: c.instructions.map((i) => `- ${i}`).join("\n"),
    context: input.context,
    question: input.question,
  }).trim();
}
