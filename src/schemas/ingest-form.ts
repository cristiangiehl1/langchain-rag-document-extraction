import { z } from "zod";
import type { SplitConfig } from "@/lib/types";

/**
 * Client-side form schema for the ingestion panel (react-hook-form + zodResolver).
 *
 * The schema has two shapes:
 *  - INPUT  (what the inputs edit): flat fields incl. `separatorsText` as a string.
 *  - OUTPUT (what `.transform()` returns): already in the `{ text, source, config }`
 *    shape the API expects — so the submit handler needs zero formatting logic.
 *
 * The API routes still re-validate the request with their own schemas.
 */

/** useFieldArray rows -> ["\n\n", ". "] with typed escapes resolved and blanks dropped. */
function parseSeparators(items: { value: string }[]): string[] | undefined {
  const arr = items
    .map((s) => s.value.replace(/\\n/g, "\n").replace(/\\t/g, "\t"))
    .filter((s) => s.length > 0);
  return arr.length ? arr : undefined;
}

export const ingestFormSchema = z
  .object({
    text: z.string().min(1, "Cole ou anexe um texto primeiro."),
    source: z.string().max(200, "Máximo de 200 caracteres."),
    chunkSize: z
      .number({ invalid_type_error: "Informe um número." })
      .int("Deve ser um inteiro.")
      .min(1, "Mínimo 1.")
      .max(100_000, "Máximo 100000."),
    chunkOverlap: z
      .number({ invalid_type_error: "Informe um número." })
      .int("Deve ser um inteiro.")
      .min(0, "Mínimo 0.")
      .max(100_000, "Máximo 100000."),
    // One row per custom separator (useFieldArray needs objects, not bare strings).
    separators: z.array(z.object({ value: z.string() })),
  })
  .refine((v) => v.chunkOverlap < v.chunkSize, {
    message: "chunkOverlap deve ser menor que chunkSize.",
    path: ["chunkOverlap"],
  })
  // Format straight into the request bodies the API expects.
  .transform((v) => ({
    text: v.text,
    source: v.source.trim() || "pasted-text",
    config: {
      chunkSize: v.chunkSize,
      chunkOverlap: v.chunkOverlap,
      separators: parseSeparators(v.separators),
    } satisfies SplitConfig,
  }));

/** Field values the inputs bind to (register/watch/defaultValues). */
export type IngestFormInput = z.input<typeof ingestFormSchema>;
/** Transformed values delivered to handleSubmit — already API-ready. */
export type IngestFormValues = z.output<typeof ingestFormSchema>;

export const INGEST_FORM_DEFAULTS: IngestFormInput = {
  text: "",
  source: "",
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: [],
};
