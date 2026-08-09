import { PageHeader } from "@/components/page-header";
import { IngestPanel } from "@/components/ingest/ingest-panel";

export default function IngestPage() {
  return (
    <div className="flex flex-col h-dvh">
      <PageHeader
        title="Ingestão de documentos"
        description="Cole ou anexe um texto, configure o split, pré-visualize e então gere os embeddings."
      />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <IngestPanel />
      </div>
    </div>
  );
}
