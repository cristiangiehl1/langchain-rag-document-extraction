import { PageHeader } from "@/components/page-header";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <div className="flex flex-col h-dvh">
      <PageHeader
        title="Chat RAG"
        description="Pergunte algo e veja quais chunks foram recuperados do pgvector para responder."
      />
      <div className="flex-1 min-h-0">
        <ChatPanel />
      </div>
    </div>
  );
}
