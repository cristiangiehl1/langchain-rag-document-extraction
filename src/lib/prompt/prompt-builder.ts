// Structured chat prompt: a JSON `promptConfig` (persona + rules) rendered into
// two text templates with {placeholders} — system.txt (persona/rules) and
// human.txt (context/question). All editable static files under this directory,
// loaded once at module init. Server-only (reads from disk with `fs`).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger("chat");

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

/** Loads and validates the config + the system/human templates once, then caches them. */
function loadPrompt(): {
  config: PromptConfig;
  systemTemplate: string;
  humanTemplate: string;
} {
  const rawConfig = readFileSync(join(PROMPT_DIR, "prompt.config.json"), "utf8");
  const config = promptConfigSchema.parse(JSON.parse(rawConfig));
  const systemTemplate = readFileSync(join(PROMPT_DIR, "system.txt"), "utf8");
  const humanTemplate = readFileSync(join(PROMPT_DIR, "human.txt"), "utf8");
  log.info("prompt config loaded", {
    role: config.role,
    instructions: config.instructions.length,
    language: config.constraints.language,
  });
  return { config, systemTemplate, humanTemplate };
}

// Cached at module init (files are static; edits require a server restart).
const {
  config: PROMPT_CONFIG,
  systemTemplate: SYSTEM_TEMPLATE,
  humanTemplate: HUMAN_TEMPLATE,
} = loadPrompt();

export { PROMPT_CONFIG };

/** Replaces every {token} in the template with the matching value. */
function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  );
}

/**
 * Renders the structured chat prompt as two role-tagged parts: `system` (persona
 * and rules from promptConfig) and `human` (the runtime context and question).
 * Keeping instructions in the system role gives them higher priority than the
 * user turn and better resistance to prompt injection.
 */
export function buildChatPrompt(input: {
  context: string;
  question: string;
}): { system: string; human: string } {
  const c = PROMPT_CONFIG;
  const values = {
    role: c.role,
    task: c.task,
    tone: c.constraints.tone,
    language: c.constraints.language,
    format: c.constraints.format,
    instructions: c.instructions.map((i) => `- ${i}`).join("\n"),
    context: input.context,
    question: input.question,
  };
  return {
    system: render(SYSTEM_TEMPLATE, values).trim(),
    human: render(HUMAN_TEMPLATE, values).trim(),
  };
}
