"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Upload,
  Scissors,
  CheckCircle2,
  Loader2,
  Database,
  FileText,
  Plus,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { InfoHint } from "@/components/ui/tooltip";
import { approxTokens } from "@/lib/utils";
import type { PreviewResponse, EmbedResponse } from "@/lib/types";
import { StoreStats } from "@/components/ingest/store-stats";
import {
  ingestFormSchema,
  INGEST_FORM_DEFAULTS,
  type IngestFormInput,
  type IngestFormValues,
} from "@/schemas/ingest-form";

export function IngestPanel() {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<IngestFormInput, unknown, IngestFormValues>({
    resolver: zodResolver(ingestFormSchema),
    defaultValues: INGEST_FORM_DEFAULTS,
    mode: "onChange",
  });

  const separators = useFieldArray({ control, name: "separators" });

  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [busy, setBusy] = React.useState<null | "extract" | "preview" | "embed">(
    null,
  );
  const [statsKey, setStatsKey] = React.useState(0);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Any change to the text or split config invalidates a prior preview, so the
  // user must always re-preview the exact content before embedding it.
  React.useEffect(() => {
    const sub = watch((_, { name }) => {
      if (!name) return;
      if (
        name === "text" ||
        name === "chunkSize" ||
        name === "chunkOverlap" ||
        name.startsWith("separators")
      ) {
        setPreview(null);
      }
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const text = watch("text");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("extract");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao ler o arquivo.");
      setValue("text", data.text ?? "", { shouldValidate: true });
      setValue("source", data.source ?? file.name, { shouldValidate: true });
      setPreview(null);
      toast.success(`Arquivo carregado: ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ler arquivo.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const onPreview = handleSubmit(async (data) => {
    setBusy("preview");
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text, config: data.config }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao dividir o texto.");
      setPreview(json as PreviewResponse);
      toast.success(`${json.totalChunks} chunks gerados (nada foi salvo ainda).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no preview.");
    } finally {
      setBusy(null);
    }
  });

  const onEmbed = handleSubmit(async (data) => {
    if (!preview) return;
    setBusy("embed");
    try {
      const res = await fetch("/api/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: data.text,
          source: data.source,
          config: data.config,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao gerar embeddings.");
      const ok = json as EmbedResponse;
      toast.success(`${ok.storedVectors} vetores armazenados (${ok.source}).`);
      setStatsKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao embutir.");
    } finally {
      setBusy(null);
    }
  });

  const chars = text.length;
  const tokens = approxTokens(text);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-5">
      {/* 1. Document input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-accent" /> 1. Documento
          </CardTitle>
          <CardDescription>
            Cole o texto ou anexe um arquivo (.txt, .md, .pdf).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.pdf"
              onChange={handleFile}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy !== null}
            >
              {busy === "extract" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Upload />
              )}
              Anexar arquivo
            </Button>
            <div className="flex-1 min-w-[180px]">
              <Input
                placeholder="Identificador do documento (source)"
                {...register("source")}
              />
              <FieldError message={errors.source?.message} />
            </div>
          </div>
          <Textarea
            className="min-h-[180px] font-mono text-xs scrollbar-thin"
            placeholder="Cole aqui o texto do documento…"
            {...register("text")}
          />
          <FieldError message={errors.text?.message} />
          <div className="flex gap-2 text-[11px] text-muted font-mono">
            <Badge variant="mono">{chars.toLocaleString()} chars</Badge>
            <Badge variant="mono">~{tokens.toLocaleString()} tokens</Badge>
          </div>
        </CardContent>
      </Card>

      {/* 2. Split config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="size-4 text-accent" /> 2. Configuração do split
          </CardTitle>
          <CardDescription>
            Parâmetros do RecursiveCharacterTextSplitter do LangChain.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="chunkSize"
            hint="Tamanho máximo (em caracteres) de cada chunk."
            error={errors.chunkSize?.message}
          >
            <Input
              type="number"
              min={1}
              {...register("chunkSize", { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="chunkOverlap"
            hint="Quantos caracteres do fim de um chunk se repetem no início do próximo. Deve ser menor que chunkSize."
            error={errors.chunkOverlap?.message}
          >
            <Input
              type="number"
              min={0}
              {...register("chunkOverlap", { valueAsNumber: true })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Separadores customizados (opcional)"
              hint="Um separador por campo, na ordem de prioridade. Use \n para quebra de linha e \t para tab. Sem nenhum = separadores padrão da biblioteca."
            >
              <div className="space-y-2">
                {separators.fields.length === 0 ? (
                  <p className="text-[11px] text-muted">
                    Nenhum separador — usando os padrões do
                    RecursiveCharacterTextSplitter.
                  </p>
                ) : (
                  separators.fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center font-mono text-[11px] text-muted">
                        {index + 1}
                      </span>
                      <Input
                        className="font-mono text-xs"
                        placeholder={"\\n\\n"}
                        {...register(`separators.${index}.value`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => separators.remove(index)}
                        aria-label={`Remover separador ${index + 1}`}
                      >
                        <X />
                      </Button>
                    </div>
                  ))
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => separators.append({ value: "" })}
                >
                  <Plus /> Adicionar separador
                </Button>
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={onPreview} disabled={busy !== null}>
              {busy === "preview" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Scissors />
              )}
              Pré-visualizar chunks
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Preview + confirm */}
      {preview ? (
        <Card className="animate-fade-in">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-4 text-accent" /> 3. Preview dos chunks
              </CardTitle>
              <CardDescription>
                Nada foi enviado ao modelo nem ao banco. Confirme para gerar os
                embeddings.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="accent">{preview.totalChunks} chunks</Badge>
              <Button onClick={onEmbed} disabled={busy !== null}>
                {busy === "embed" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                Confirmar e gerar embeddings
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[420px] space-y-2 overflow-y-auto scrollbar-thin pr-1">
              {preview.chunks.map((c) => (
                <div
                  key={c.index}
                  className="rounded-md border border-border bg-surface-2/60"
                >
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                    <span className="font-mono text-[11px] text-accent">
                      chunk #{c.index}
                    </span>
                    <Badge variant="mono">{c.size} chars</Badge>
                  </div>
                  <pre className="whitespace-pre-wrap break-words px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/90">
                    {c.content}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Store stats */}
      <StoreStats
        refreshKey={statsKey}
        onClear={() => setStatsKey((k) => k + 1)}
      />
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {hint ? <InfoHint text={hint} /> : null}
      </div>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-danger">{message}</p>;
}
