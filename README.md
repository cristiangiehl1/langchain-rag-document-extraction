# LangChain RAG Lab

> Plataforma para **fatiar documentos, gerar embeddings, armazená-los em pgvector e testar RAG** com chat em streaming — tudo com controle fino de cada parâmetro do pipeline.

<p align="left">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" />
  <img alt="LangChain" src="https://img.shields.io/badge/LangChain-0.3-1C3C3C" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-4169E1?logo=postgresql&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white" />
</p>

---

## Índice

- [Visão geral](#visão-geral)
- [Recursos](#recursos)
- [Arquitetura](#arquitetura)
- [Stack](#stack)
- [Pré-requisitos](#pré-requisitos)
- [Início rápido](#início-rápido)
- [Configuração](#configuração)
- [Guia de uso](#guia-de-uso)
- [Deploy (Vercel + Supabase)](#deploy-vercel--supabase)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Scripts](#scripts)
- [Notas técnicas](#notas-técnicas)

---

## Visão geral

O **LangChain RAG Lab** é um laboratório interativo de _Retrieval-Augmented Generation_ (RAG). Ele permite carregar documentos (`.txt`, `.md`, `.pdf`), inspecionar como eles são divididos em _chunks_, gerar embeddings via **HuggingFace Inference API**, persistir os vetores no **PostgreSQL + pgvector** e, por fim, conversar com o conteúdo através de um LLM com **respostas em streaming** e **citação das fontes recuperadas**.

O objetivo é ser transparente: cada etapa do pipeline (split, embedding, recuperação, geração) é explícita, pré-visualizável e configurável pela interface.

## Recursos

- **Pré-visualização de chunks** antes de qualquer gravação — nada é embutido ou persistido até a confirmação.
- **Embeddings** via HuggingFace Inference API (modelo multilíngue de 384 dimensões) — sem modelo local, pronto para serverless.
- **Busca por similaridade** (distância de cosseno) sobre índice **HNSW** no pgvector.
- **Chat RAG com streaming** e exibição das fontes com o respectivo _score_ de similaridade.
- **Prompt estruturado** (`promptConfig` + templates) montado em `SystemMessage` (persona/regras) + `HumanMessage` (contexto/pergunta), com _override_ opcional por system prompt livre.
- **Controle da geração**: `temperature`, `top_p`, `top_k`, `max_tokens`, `frequency/presence penalty` e `system prompt` — parâmetros desligados não são enviados à API.
- **Configuração persistida** no `localStorage`.
- **Ambiente validado com zod** no boot (`src/lib/env.ts`) e **camada de domínio OOP** (services + repository) com uma `CONFIG` central congelada.

## Arquitetura

```mermaid
flowchart LR
    subgraph Client["Cliente (Next.js App Router)"]
        UI_I["/ingest"]
        UI_C["/chat"]
    end

    subgraph API["API Routes (controllers finos)"]
        R1["/api/preview"]
        R2["/api/embed"]
        R3["/api/chat"]
    end

    subgraph Domain["Camada de domínio (src/server)"]
        DL["DocumentLoader"]
        DP["DocumentProcessor"]
        ES["EmbeddingsService"]
        VR["VectorStoreRepository"]
        CS["ChatService"]
    end

    subgraph Infra["Infraestrutura"]
        PG[("PostgreSQL + pgvector<br/>(Supabase em prod)")]
        HF["HuggingFace Inference API"]
        LLM["OpenRouter (LLM)"]
    end

    UI_I --> R1 --> DP
    UI_I --> R2 --> DP --> ES --> VR --> PG
    ES --> HF
    UI_C --> R3 --> CS
    CS --> ES
    CS --> VR --> PG
    CS --> LLM
    DL --> DP
```

**Fluxo resumido:** o documento é carregado (`DocumentLoader`), dividido (`DocumentProcessor`), embutido pela HuggingFace Inference API (`EmbeddingsService`) e persistido (`VectorStoreRepository`). No chat, o `ChatService` embute a pergunta, recupera os _chunks_ mais similares e monta o contexto para o LLM.

## Stack

| Camada | Tecnologias |
| --- | --- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, componentes estilo shadcn/ui, `react-markdown` + `remark-gfm` |
| **Orquestração RAG** | LangChain (`@langchain/core`, `@langchain/community`, `@langchain/textsplitters`, `@langchain/openai`) |
| **Embeddings** | HuggingFace Inference API (`@huggingface/inference`) — `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, 384d |
| **LLM de chat** | OpenRouter (modelo `:free` configurável), com streaming |
| **Persistência** | PostgreSQL 16 + pgvector (índice HNSW / cosseno) via `pg` — Docker em dev, **Supabase** em prod |
| **Validação** | zod (rotas + variáveis de ambiente) |

## Pré-requisitos

- **Node.js** 18+ (testado no 24)
- Uma **chave de API do OpenRouter** ([openrouter.ai](https://openrouter.ai))
- Um **token da HuggingFace** ([huggingface.co/settings/tokens](https://huggingface.co/settings/tokens))
- **Docker** + Docker Compose — apenas para o Postgres local em desenvolvimento

## Início rápido

```bash
# 1. Variáveis de ambiente
cp .env.example .env      # defina OPENROUTER_API_KEY e HUGGINGFACEHUB_API_TOKEN

# 2. Banco de dados local (pgvector)
npm run db:up             # sobe o Postgres via docker compose

# 3. Dependências e servidor
npm install
npm run dev
```

Acesse **http://localhost:3000** (redireciona para `/ingest`).

> Na primeira subida do banco, `db/init/01-init.sql` roda automaticamente: habilita a extensão `vector`, cria a tabela `embeddings` com coluna `vector(384)` e um índice HNSW (cosseno).
>
> Os embeddings são gerados remotamente (HuggingFace Inference API) — não há modelo baixado localmente. Se o modelo estiver "adormecido" no HF, a primeira chamada pode demorar alguns segundos (cold start).

## Configuração

As variáveis são **validadas com zod** no boot (`src/lib/env.ts`) — se algo estiver faltando ou inválido, a aplicação falha na inicialização com uma mensagem clara. Todas ficam no `.env` (veja `.env.example`):

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Chave de API do OpenRouter | — (obrigatória) |
| `OPENROUTER_MODEL` | Modelo de chat usado nas respostas | `google/gemma-4-26b-a4b-it:free` |
| `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` | Headers de atribuição recomendados pelo OpenRouter | `http://localhost:3000` / `LangChain RAG Lab` |
| `HUGGINGFACEHUB_API_TOKEN` | Token da HuggingFace Inference API (embeddings) | — (obrigatória) |
| `EMBEDDING_MODEL` | Modelo de embeddings (384d p/ casar com `vector(384)`; use o repo `sentence-transformers/...`) | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| `DATABASE_URL` | String de conexão Postgres (dev: Docker; prod: pooler do Supabase) | `postgresql://rag:ragpass@localhost:5544/ragdb` |
| `POSTGRES_*` | Credenciais/porta lidas pelo **docker-compose** (não pela app) | `rag` / `ragpass` / `ragdb` / `5544` |

> **Trocar o modelo de embeddings** exige re-ingerir os documentos (a dimensão do vetor precisa casar com a coluna `vector(384)`).
>
> Se o id do modelo `:free` sair do ar no OpenRouter, ajuste `OPENROUTER_MODEL`.

## Guia de uso

### Ingestão — `/ingest`

1. **Documento** — cole o texto ou anexe `.txt` / `.md` / `.pdf` (PDF via `PDFLoader` do LangChain).
2. **Configuração do split** — escolha o splitter (`RecursiveCharacterTextSplitter` ou `CharacterTextSplitter`), `chunkSize`, `chunkOverlap` e separadores opcionais.
3. **Pré-visualizar chunks** — mostra todos os chunks numerados e com tamanho. **Nada é enviado ao modelo nem ao banco nesta etapa.**
4. **Confirmar e gerar embeddings** — cada chunk é embutido via HuggingFace Inference API e gravado no pgvector com metadados (`source`, `chunkIndex`, etc.). Alterar o texto ou a config invalida o preview e exige pré-visualizar novamente.

### Chat RAG — `/chat`

- Faça perguntas; o app embute a pergunta, busca os `topK` chunks mais similares no pgvector, monta o contexto e chama o LLM via OpenRouter **com streaming**.
- Cada resposta exibe as **fontes recuperadas** com o **score de similaridade** (cosseno), o modelo usado e os **parâmetros aplicados**.
- **Painel lateral configurável** (persistido em `localStorage`):
  - **Recuperação:** `topK`, limiar mínimo de score.
  - **Geração:** `temperature`, `top_p`, `top_k` (sampling — distinto do `topK` de recuperação), `max_tokens`, `frequency_penalty`, `presence_penalty`, `system prompt`.

## Deploy (Vercel + Supabase)

### 1. Banco vetorial no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, cole e rode o conteúdo de [`db/supabase.sql`](db/supabase.sql) (habilita `vector`, cria a tabela `embeddings` e os índices).
3. Em **Project Settings → Database → Connection string**, copie a URL do **Transaction pooler** (porta `6543`, ideal para serverless).

### 2. App na Vercel

1. Importe o repositório na Vercel (framework detectado: Next.js).
2. Em **Settings → Environment Variables**, defina:
   - `OPENROUTER_API_KEY`
   - `HUGGINGFACEHUB_API_TOKEN`
   - `DATABASE_URL` → a URL do **Transaction pooler** do Supabase
   - (opcionais) `OPENROUTER_MODEL`, `EMBEDDING_MODEL`, `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME`
3. Deploy. As funções de API já rodam com `runtime = "nodejs"` e `maxDuration = 60` (teto do plano Hobby).

> A conexão com o Supabase usa TLS automaticamente (a app detecta host não-local e ativa `ssl`). Ingestões muito grandes podem esbarrar no limite de 60s do Hobby — quebre em lotes menores ou use o plano Pro (até 300s).

## Estrutura do projeto

```
.
├── db/
│   ├── init/01-init.sql         # schema para o Postgres local (docker)
│   └── supabase.sql             # schema para colar no SQL Editor do Supabase
├── docker-compose.yml           # PostgreSQL 16 + pgvector (dev)
└── src/
    ├── app/
    │   ├── api/                  # controllers finos (Route Handlers)
    │   │   ├── preview/          #   split sem persistir
    │   │   ├── embed/            #   gera e grava embeddings
    │   │   ├── chat/             #   RAG + streaming
    │   │   ├── extract/          #   extração de texto (upload)
    │   │   ├── stats/            #   estatísticas do vector store
    │   │   └── vectors/          #   inspeção/limpeza de vetores
    │   ├── ingest/               # página de ingestão
    │   ├── chat/                 # página de chat
    │   └── layout.tsx / page.tsx
    ├── server/                   # camada de domínio (OOP)
    │   ├── document-loader.ts    #   DocumentLoader (txt/md/pdf)
    │   ├── document-processor.ts #   DocumentProcessor (split via LangChain)
    │   ├── embeddings-service.ts #   EmbeddingsService (HuggingFace Inference API)
    │   ├── vector-store-repository.ts # VectorStoreRepository (PGVectorStore + stats/clear)
    │   └── chat-service.ts       #   ChatService (retrieval + geração em streaming)
    ├── lib/
    │   ├── env.ts                #   validação zod das variáveis de ambiente
    │   ├── config.ts             #   CONFIG central congelado (derivado do env)
    │   ├── schemas.ts            #   validação zod das rotas
    │   ├── stream.ts             #   protocolo de streaming
    │   ├── prompt/               #   prompt estruturado (config + templates + builder)
    │   ├── types.ts / defaults.ts#   contratos e defaults
    │   └── logger.ts / utils.ts
    ├── schemas/                  # schemas dos formulários (client)
    └── components/               # UI (shadcn-style), ingest e chat
```

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build de produção / servir produção |
| `npm run typecheck` | Checagem de tipos (`tsc --noEmit`) |
| `npm run lint` | ESLint (`next lint`) |
| `npm run db:up` / `npm run db:down` | Sobe / derruba o Postgres local |

## Notas técnicas

- **Similaridade exibida** = `1 - distância_cosseno` do pgvector (0..1, maior = mais similar).
- `serverExternalPackages` no `next.config.mjs` evita empacotar `pdf-parse` e `pg` no bundle do servidor; `outputFileTracingIncludes` garante que os arquivos de prompt (lidos via `fs`) sigam junto na função da Vercel.
- O endpoint de chat envia primeiro um bloco JSON com as fontes, um delimitador, e então faz o streaming dos tokens da resposta (protocolo em `src/lib/stream.ts`).
- A dimensão do vetor (`384`) é acoplada ao modelo de embeddings; trocar o modelo requer re-ingerir os documentos.

---

<sub>Desenvolvido por <a href="https://cristiangiehl.com.br/">Cristian Giehl</a>.</sub>
