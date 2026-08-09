"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Database,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Hash,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type {
  StoreStats as Stats,
  VectorDetail,
  VectorListResponse,
} from "@/lib/types";

const PAGE_SIZE = 20;

export function StoreStats({
  refreshKey,
  onClear,
}: {
  refreshKey: number;
  onClear: () => void;
}) {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Detailed vector listing (lazy, paginated).
  const [showDetails, setShowDetails] = React.useState(false);
  const [items, setItems] = React.useState<VectorDetail[]>([]);
  const [total, setTotal] = React.useState(0);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  // "" => all documents; otherwise a specific source.
  const [selectedSource, setSelectedSource] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao ler estatísticas.");
      setStats(data as Stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler o banco.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetails = React.useCallback(
    async (offset: number, source: string) => {
      setDetailsLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (source) params.set("source", source);
        const res = await fetch(`/api/vectors?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Falha ao listar vetores.");
        const payload = data as VectorListResponse;
        setTotal(payload.total);
        setItems((prev) =>
          offset === 0 ? payload.items : [...prev, ...payload.items],
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Erro ao listar vetores.",
        );
      } finally {
        setDetailsLoading(false);
      }
    },
    [],
  );

  // Refresh summary and reset the (possibly stale) detail list whenever the store changes.
  React.useEffect(() => {
    load();
    setItems([]);
    setShowDetails(false);
    setSelectedSource("");
  }, [load, refreshKey]);

  function toggleDetails() {
    const next = !showDetails;
    setShowDetails(next);
    if (next && items.length === 0) loadDetails(0, selectedSource);
  }

  function handleSourceChange(source: string) {
    setSelectedSource(source);
    setItems([]);
    loadDetails(0, source);
  }

  async function handleClear() {
    if (!confirm("Apagar TODOS os vetores armazenados?")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/stats", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao limpar.");
      toast.success(`${data.deleted} vetores removidos.`);
      onClear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao limpar.");
    } finally {
      setClearing(false);
    }
  }

  const totalVectors = stats?.totalVectors ?? 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4 text-accent" /> Banco vetorial
          </CardTitle>
          <CardDescription>
            Vetores atualmente armazenados no pgvector.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleClear}
            disabled={clearing || totalVectors === 0}
          >
            {clearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Limpar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-xs text-danger font-mono">{error}</p>
        ) : stats ? (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl text-accent">
                {totalVectors.toLocaleString()}
              </span>
              <span className="text-xs text-muted">vetores totais</span>
            </div>

            {stats.sources.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stats.sources.map((s) => (
                  <Badge key={s.source} variant="mono">
                    {s.source} · {s.chunks}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">
                Nenhum documento embutido ainda.
              </p>
            )}

            {totalVectors > 0 ? (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={toggleDetails}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
                >
                  {showDetails ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                  {showDetails ? "Ocultar detalhes" : "Ver detalhes dos vetores"}
                </button>

                {showDetails ? (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <Label className="shrink-0 text-muted">Documento:</Label>
                      <Select
                        value={selectedSource}
                        onChange={(e) => handleSourceChange(e.target.value)}
                        disabled={detailsLoading}
                      >
                        <option value="">
                          Todos os documentos ({totalVectors})
                        </option>
                        {stats.sources.map((s) => (
                          <option key={s.source} value={s.source}>
                            {s.source} ({s.chunks})
                          </option>
                        ))}
                      </Select>
                    </div>

                    {!detailsLoading && items.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted">
                        Nenhum chunk para este documento.
                      </p>
                    ) : null}

                    {items.map((v) => (
                      <VectorRow key={v.id} v={v} />
                    ))}

                    {detailsLoading ? (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted">
                        <Loader2 className="size-3.5 animate-spin" /> carregando…
                      </div>
                    ) : null}

                    {items.length < total ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => loadDetails(items.length, selectedSource)}
                        disabled={detailsLoading}
                      >
                        Carregar mais ({items.length}/{total})
                      </Button>
                    ) : items.length > 0 ? (
                      <p className="text-center text-[11px] text-muted">
                        {items.length} de {total} exibidos
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted">Carregando…</p>
        )}
      </CardContent>
    </Card>
  );
}

function VectorRow({ v }: { v: VectorDetail }) {
  return (
    <div className="rounded-md border border-border bg-surface-2/50">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="flex items-center gap-1 font-mono text-[11px] text-accent">
          <Hash className="size-3" />
          {v.source}
          {v.chunkIndex !== null ? ` · chunk ${v.chunkIndex}` : ""}
        </span>
        <Badge variant="mono">{v.dim}d</Badge>
        {v.ingestedAt ? (
          <span className="ml-auto text-[10px] text-muted">
            {new Date(v.ingestedAt).toLocaleString()}
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5 px-3 py-2">
        <div className="font-mono text-[11px] text-muted">
          <span className="text-foreground/70">embedding[0:8]</span> ={" "}
          <span className="text-accent">
            [{v.preview.map((n) => n.toFixed(4)).join(", ")}
            {v.dim > v.preview.length ? ", …" : ""}]
          </span>
        </div>
        <pre className="max-h-28 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
          {v.content}
        </pre>
      </div>

      {/* Full metadata jsonb stored with the vector */}
      <div className="border-t border-border px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
          metadata
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          {Object.entries(v.metadata).map(([k, val]) => (
            <div key={k} className="min-w-0 font-mono text-[10px] leading-tight">
              <span className="text-muted">{k}: </span>
              <span className="break-words text-foreground/85">
                {typeof val === "object" ? JSON.stringify(val) : String(val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border px-3 py-1">
        <span className="font-mono text-[10px] text-muted">id: {v.id}</span>
      </div>
    </div>
  );
}
