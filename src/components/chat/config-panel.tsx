"use client";

import * as React from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { RotateCcw, Sliders, Search } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { InfoHint } from "@/components/ui/tooltip";
import type { StoreStats } from "@/lib/types";
import {
  CHAT_CONFIG_DEFAULTS,
  type ChatConfigFormValues,
} from "@/schemas/chat-config-form";

interface Props {
  form: UseFormReturn<ChatConfigFormValues>;
}

export function ConfigPanel({ form }: Props) {
  const { control, register, reset: resetForm } = form;
  const [sources, setSources] = React.useState<StoreStats["sources"]>([]);

  // Load the list of stored documents so retrieval can be scoped to one of them.
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) return;
        const data = (await res.json()) as StoreStats;
        setSources(data.sources ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function reset() {
    resetForm(CHAT_CONFIG_DEFAULTS);
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sliders className="size-4 text-accent" /> Configuração
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw /> Reset
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        {/* Retrieval */}
        <section className="space-y-4">
          <SectionTitle icon={<Search className="size-3.5" />} title="Recuperação (RAG)" />

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label>Documento</Label>
              <InfoHint text="Restringe a busca a um único documento (metadata.source). 'Todos' pesquisa em toda a base." />
            </div>
            <Controller
              control={control}
              name="retrieval.source"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value === "" ? null : e.target.value)
                  }
                >
                  <option value="">Todos os documentos</option>
                  {sources.map((s) => (
                    <option key={s.source} value={s.source}>
                      {s.source} ({s.chunks})
                    </option>
                  ))}
                </Select>
              )}
            />
          </div>

          <Controller
            control={control}
            name="retrieval.topK"
            render={({ field }) => (
              <SliderRow
                label="topK (chunks recuperados)"
                hint="Quantos trechos mais similares são buscados no pgvector e enviados como contexto."
                value={field.value}
                min={1}
                max={20}
                step={1}
                onChange={field.onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="retrieval.minScore"
            render={({ field }) => (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Label>Limiar mínimo de score</Label>
                    <InfoHint text="Descarta chunks com similaridade de cosseno abaixo do valor (0 a 1). Desligado = usa todos os topK." />
                  </div>
                  <Switch
                    checked={field.value !== null}
                    onCheckedChange={(on) => field.onChange(on ? 0.3 : null)}
                  />
                </div>
                {field.value !== null ? (
                  <SliderRow
                    label="min score"
                    value={field.value}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={field.onChange}
                  />
                ) : null}
              </div>
            )}
          />
        </section>

        <Separator />

        {/* Generation */}
        <section className="space-y-4">
          <SectionTitle icon={<Sliders className="size-3.5" />} title="Geração (LLM)" />

          <Controller
            control={control}
            name="generation.temperature"
            render={({ field }) => (
              <SliderRow
                label="temperature"
                hint="Aleatoriedade da resposta. Baixo = determinístico e factual; alto = criativo."
                value={field.value}
                min={0}
                max={2}
                step={0.05}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="generation.topP"
            render={({ field }) => (
              <SliderRow
                label="top_p"
                hint="Nucleus sampling: considera os tokens até somar esta probabilidade acumulada."
                value={field.value}
                min={0}
                max={1}
                step={0.01}
                onChange={field.onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="generation.topK"
            render={({ field }) => (
              <ToggleNumberRow
                label="top_k (sampling do modelo)"
                hint="Limita a amostragem aos K tokens mais prováveis. É DIFERENTE do topK de recuperação acima. Nem todo modelo suporta; se desligado, não é enviado."
                value={field.value}
                fallback={40}
                min={1}
                max={200}
                step={1}
                onChange={field.onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="generation.maxTokens"
            render={({ field }) => (
              <SliderRow
                label="max_tokens (resposta)"
                hint="Número máximo de tokens gerados na resposta."
                value={field.value}
                min={64}
                max={4096}
                step={64}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="generation.frequencyPenalty"
            render={({ field }) => (
              <SliderRow
                label="frequency_penalty"
                hint="Penaliza tokens que já apareceram, reduzindo repetição literal."
                value={field.value}
                min={-2}
                max={2}
                step={0.1}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="generation.presencePenalty"
            render={({ field }) => (
              <SliderRow
                label="presence_penalty"
                hint="Incentiva a introdução de novos temas/palavras não usados ainda."
                value={field.value}
                min={-2}
                max={2}
                step={0.1}
                onChange={field.onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="generation.seed"
            render={({ field }) => (
              <ToggleNumberRow
                label="seed (reprodutibilidade)"
                hint="Fixa a semente de amostragem para respostas reproduzíveis. Desligado = não enviado."
                value={field.value}
                fallback={42}
                min={0}
                max={2 ** 31 - 1}
                step={1}
                onChange={field.onChange}
              />
            )}
          />

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label>system prompt</Label>
              <InfoHint text="Instrução de sistema enviada ao modelo. Vazio = usa o prompt RAG padrão do servidor." />
            </div>
            <Textarea
              className="min-h-[90px] font-mono text-[11px]"
              placeholder="(padrão: responder usando apenas o contexto recuperado)"
              {...register("generation.systemPrompt")}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
      <span className="text-accent">{icon}</span>
      {title}
    </div>
  );
}

function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label>{label}</Label>
          {hint ? <InfoHint text={hint} /> : null}
        </div>
        <span className="font-mono text-[11px] text-accent tabular-nums">
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

/** A param that can be turned off entirely (sends nothing) or set to a value. */
function ToggleNumberRow({
  label,
  hint,
  value,
  fallback,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  fallback: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label>{label}</Label>
          {hint ? <InfoHint text={hint} /> : null}
        </div>
        <Switch
          checked={value !== null}
          onCheckedChange={(on) => onChange(on ? fallback : null)}
        />
      </div>
      {value !== null ? (
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      ) : null}
    </div>
  );
}
