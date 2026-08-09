"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, FileStack, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/ingest", label: "Ingestão", icon: FileStack, hint: "Split + embeddings" },
  { href: "/chat", label: "Chat RAG", icon: MessagesSquare, hint: "Testar recuperação" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="flex size-7 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Database className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">RAG Lab</div>
          <div className="text-[10px] text-muted font-mono">pgvector · langchain</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-2">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-surface-2 text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="font-medium">{item.label}</span>
                <span className="text-[10px] text-muted">{item.hint}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-3 border-t border-border">
        <p className="text-[10px] leading-relaxed text-muted font-mono">
          Embeddings locais
          <br />
          all-MiniLM-L6-v2 · 384d
        </p>
      </div>
    </aside>
  );
}
