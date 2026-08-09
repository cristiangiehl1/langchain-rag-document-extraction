import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LangChain RAG Lab",
  description:
    "Split documents, generate local embeddings, store them in pgvector, and test RAG.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <TooltipProvider delayDuration={150}>
          <div className="flex min-h-dvh">
            <Sidebar />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#141A21",
                border: "1px solid #232B33",
                color: "#E6EDF3",
              },
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
