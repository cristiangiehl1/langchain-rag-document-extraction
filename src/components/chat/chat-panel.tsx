"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  User,
  Bot,
  FileSearch,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfigPanel } from "@/components/chat/config-panel";
import { Markdown } from "@/components/chat/markdown";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { META_DELIM, ERROR_DELIM } from "@/lib/stream";
import { CONFIG_STORAGE_KEY } from "@/lib/defaults";
import type { ChatSource } from "@/lib/types";
import {
  chatConfigFormSchema,
  CHAT_CONFIG_DEFAULTS,
  type ChatConfigFormValues,
} from "@/schemas/chat-config-form";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  usedParams?: string[];
  model?: string;
  streaming?: boolean;
  error?: string | null;
}

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export function ChatPanel() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // The retrieval + generation knobs live in a single react-hook-form form.
  const form = useForm<ChatConfigFormValues>({
    resolver: zodResolver(chatConfigFormSchema),
    defaultValues: CHAT_CONFIG_DEFAULTS,
  });

  // Hydrate config from localStorage (client only).
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        form.reset({
          retrieval: { ...CHAT_CONFIG_DEFAULTS.retrieval, ...saved.retrieval },
          generation: {
            ...CHAT_CONFIG_DEFAULTS.generation,
            ...saved.generation,
          },
        });
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, [form]);

  // Persist config across messages in the session.
  React.useEffect(() => {
    const sub = form.watch((value) => {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(value));
    });
    return () => sub.unsubscribe();
  }, [form]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function patch(id: string, data: Partial<Message>) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...data } : m)),
    );
  }

  async function send() {
    const question = input.trim();
    if (!question || sending) return;
    setInput("");
    setSending(true);

    const userMsg: Message = { id: nextId(), role: "user", content: question };
    const botId = nextId();
    const botMsg: Message = {
      id: botId,
      role: "assistant",
      content: "",
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);

    try {
      const { retrieval, generation } = form.getValues();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, retrieval, generation }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let metaParsed = false;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });

        if (!metaParsed) {
          const idx = raw.indexOf(META_DELIM);
          if (idx === -1) continue;
          const meta = JSON.parse(raw.slice(0, idx));
          patch(botId, {
            sources: meta.sources,
            usedParams: meta.usedParams,
            model: meta.model,
          });
          raw = raw.slice(idx + META_DELIM.length);
          metaParsed = true;
        }

        const errIdx = raw.indexOf(ERROR_DELIM);
        if (errIdx !== -1) {
          patch(botId, {
            content: raw.slice(0, errIdx),
            error: raw.slice(errIdx + ERROR_DELIM.length),
          });
        } else {
          patch(botId, { content: raw });
        }
      }

      patch(botId, { streaming: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat failed.";
      patch(botId, { streaming: false, error: message });
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Conversation */}
      <div className="flex flex-1 min-w-0 flex-col">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-thin grid-bg"
        >
          <div className="mx-auto max-w-3xl p-6 space-y-4">
            {messages.length === 0 ? (
              <EmptyState />
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-surface/60 p-3">
          <div className="mx-auto max-w-3xl flex items-end gap-2">
            <Textarea
              className="min-h-[44px] max-h-40 resize-none"
              placeholder="Pergunte algo sobre os documentos embutidos…  (Enter envia, Shift+Enter quebra linha)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={sending}
            />
            <div className="flex flex-col gap-1">
              <Button onClick={send} disabled={sending || !input.trim()}>
                {sending ? <Loader2 className="animate-spin" /> : <Send />}
                Enviar
              </Button>
              {messages.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMessages([])}
                  disabled={sending}
                >
                  <Trash2 /> Limpar
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Config sidebar */}
      <div className="hidden lg:flex w-80 shrink-0 border-l border-border bg-surface">
        <ConfigPanel form={form} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <div className="flex size-10 items-center justify-center rounded-md bg-accent/10 text-accent">
        <FileSearch className="size-5" />
      </div>
      <p className="text-sm font-medium">Teste o RAG dos seus documentos</p>
      <p className="max-w-sm text-xs text-muted">
        Faça uma pergunta. As respostas mostram os chunks recuperados do pgvector
        e o score de similaridade de cada um.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border",
          isUser
            ? "border-border bg-surface-2 text-muted"
            : "border-accent/40 bg-accent/10 text-accent",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div className={cn("min-w-0 flex-1 space-y-2", isUser && "flex flex-col items-end")}>
        {!isUser && message.sources && message.sources.length > 0 ? (
          <Sources sources={message.sources} />
        ) : !isUser && message.sources && !message.streaming ? (
          <p className="text-[11px] text-warning">
            Nenhum chunk recuperado — o banco está vazio ou nada passou no limiar.
          </p>
        ) : null}

        <div
          className={cn(
            "inline-block max-w-full rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed",
            isUser
              ? "border-border bg-surface-2"
              : "border-border bg-surface",
          )}
        >
          {message.content ? (
            isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <Markdown content={message.content} />
            )
          ) : message.streaming ? (
            <span className="inline-flex items-center gap-2 text-muted">
              <Loader2 className="size-3.5 animate-spin" />
              {message.sources ? "gerando resposta…" : "recuperando contexto…"}
            </span>
          ) : null}
          {message.streaming && message.content ? (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />
          ) : null}
        </div>

        {message.error ? (
          <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger">
            <AlertTriangle className="size-3.5" /> {message.error}
          </div>
        ) : null}

        {!isUser && message.usedParams && message.usedParams.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="mono">{message.model}</Badge>
            {message.usedParams.map((p) => (
              <Badge key={p} variant="accent">
                {p}
              </Badge>
            ))}
          </div>
        ) : null}

      </div>
    </div>
  );
}

function Sources({ sources }: { sources: ChatSource[] }) {
  return (
    <details className="group w-full rounded-md border border-border bg-surface-2/50">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-muted select-none">
        <FileSearch className="size-3.5 text-accent" />
        {sources.length} fonte(s) recuperada(s)
        <span className="ml-auto text-[10px] group-open:hidden">expandir</span>
      </summary>
      <div className="space-y-2 border-t border-border p-2">
        {sources.map((s) => (
          <div key={s.index} className="rounded-md border border-border bg-background">
            <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
              <span className="font-mono text-[11px] text-accent">
                [{s.index}] {s.source}
                {s.chunkIndex !== null ? ` · chunk ${s.chunkIndex}` : ""}
              </span>
              <Badge variant={s.score >= 0.5 ? "success" : "mono"}>
                score {s.score.toFixed(3)}
              </Badge>
            </div>
            <pre className="max-h-40 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground/80">
              {s.content}
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}
