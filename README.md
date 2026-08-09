# LangChain RAG Lab

> Plataforma para **fatiar documentos, gerar embeddings locais, armazená-los em pgvector e testar RAG** com chat em streaming — tudo com controle fino de cada parâmetro do pipeline.

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
- [Estrutura do projeto](#estrutura-do-projeto)
- [Scripts](#scripts)
- [Notas técnicas](#notas-técnicas)

---

## Visão geral

O **LangChain RAG Lab** é um laboratório interativo de _Retrieval-Augmented Generation_ (RAG). Ele permite carregar documentos (`.txt`, `.md`, `.pdf`), inspecionar como eles são divididos em _chunks_, gerar embeddings **localmente** (sem custo e sem enviar dados a APIs externas), persistir os vetores no **PostgreSQL + pgvector** e, por fim, conversar com o conteúdo através de um LLM com **respostas em streaming** e **citação das fontes recuperadas**.

O objetivo é ser transparente: cada etapa do pipeline (split, embedding, recuperação, geração) é explícita, pré-visualizável e configurável pela interface.

## Recursos

- **Pré-visualização de chunks** antes de qualquer gravação — nada é embutido ou persistido até a confirmação.
- **Embeddings locais** via `transformers.js` (modelo multilíngue de 384 dimensões), sem dependência de API externa.
- **Busca por similaridade** (distância de cosseno) sobre índice **HNSW** no pgvector.
- **Chat RAG com streaming** e exibição das fontes com o respectivo _score_ de similaridade.
- **Controle total da geração**: `temperature`, `top_p`, `top_k`, `max_tokens`, `frequency/presence penalty`, `seed` e `system prompt` — parâmetros desligados não são enviados à API.
- **Configuração persistida** no `localStorage`.
- **Camada de domínio orientada a objetos** (services + repository) com uma `CONFIG` central congelada e validação de entrada com **zod**.

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
        RS["RagService"]
    end

    subgraph Infra["Infraestrutura"]
        PG[("PostgreSQL + pgvector")]
        LLM["OpenRouter (LLM)"]
    end

    UI_I --> R1 --> DP
    UI_I --> R2 --> DP --> ES --> VR --> PG
    UI_C --> R3 --> RS
    RS --> ES
    RS --> VR --> PG
    RS --> LLM
    DL --> DP
```

**Fluxo resumido:** o documento é carregado (`DocumentLoader`), dividido (`DocumentProcessor`), embutido localmente (`EmbeddingsService`) e persistido (`VectorStoreRepository`). No chat, o `RagService` embute a pergunta, recupera os _chunks_ mais similares e monta o contexto para o LLM.

## Stack

| Camada | Tecnologias |
| --- | --- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, componentes estilo shadcn/ui, `react-markdown` + `remark-gfm` |
| **Orquestração RAG** | LangChain (`@langchain/core`, `@langchain/community`, `@langchain/textsplitters`, `@langchain/openai`) |
| **Embeddings** | `transformers.js` (`@huggingface/transformers`) — `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 384d, local |
| **LLM de chat** | OpenRouter (modelo `:free` configurável), com streaming |
| **Persistência** | PostgreSQL 16 + pgvector (índice HNSW / cosseno), via `pg` |
| **Validação** | zod |

## Pré-requisitos

- **Node.js** 18+ (testado no 24)
- **Docker** + Docker Compose
- Uma **chave de API do OpenRouter** ([openrouter.ai](https://openrouter.ai))

## Início rápido

```bash
# 1. Variáveis de ambiente
cp .env.example .env      # edite e defina OPENROUTER_API_KEY

# 2. Banco de dados (pgvector)
npm run db:up             # sobe o Postgres via docker compose

# 3. Dependências e servidor
npm install
npm run dev
```

Acesse **http://localhost:3000** (redireciona para `/ingest`).

> Na primeira subida do banco, `db/init/01-init.sql` roda automaticamente: habilita a extensão `vector`, cria a tabela `embeddings` com coluna `vector(384)` e um índice HNSW (cosseno).
>
> Na primeira geração de embeddings, o modelo (~90 MB) é baixado para um cache local. Depois disso, roda offline.

## Configuração

Todas as variáveis ficam no `.env` (veja `.env.example`):

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Chave de API do OpenRouter | — (obrigatória) |
| `OPENROUTER_MODEL` | Modelo de chat usado nas respostas | `google/gemma-4-26b-a4b-it:free` |
| `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` | Headers de atribuição recomendados pelo OpenRouter | `http://localhost:3000` / `LangChain RAG Lab` |
| `EMBEDDING_MODEL` | Modelo de embeddings (deve ser 384d p/ casar com `vector(384)`) | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credenciais do Postgres | `rag` / `ragpass` / `ragdb` |
| `POSTGRES_PORT` | Porta do host (não-padrão para evitar conflitos) | `5544` |
| `DATABASE_URL` | String de conexão | `postgresql://rag:ragpass@localhost:5544/ragdb` |

> **Trocar o modelo de embeddings** exige re-embutir os documentos já armazenados (dimensão do vetor precisa casar com a coluna). Use `npm run reembed`.
>
> Se o id do modelo `:free` sair do ar no OpenRouter, ajuste `OPENROUTER_MODEL`.

## Guia de uso

### Ingestão — `/ingest`

1. **Documento** — cole o texto ou anexe `.txt` / `.md` / `.pdf` (PDF via `PDFLoader` do LangChain).
2. **Configuração do split** — escolha o splitter (`RecursiveCharacterTextSplitter` ou `CharacterTextSplitter`), `chunkSize`, `chunkOverlap` e separadores opcionais.
3. **Pré-visualizar chunks** — mostra todos os chunks numerados e com tamanho. **Nada é enviado ao modelo nem ao banco nesta etapa.**
4. **Confirmar e gerar embeddings** — cada chunk é embutido localmente e gravado no pgvector com metadados (`source`, `chunkIndex`, etc.). Alterar o texto ou a config invalida o preview e exige pré-visualizar novamente.

### Chat RAG — `/chat`

- Faça perguntas; o app embute a pergunta, busca os `topK` chunks mais similares no pgvector, monta o contexto e chama o LLM via OpenRouter **com streaming**.
- Cada resposta exibe as **fontes recuperadas** com o **score de similaridade** (cosseno), o modelo usado e os **parâmetros aplicados**.
- **Painel lateral configurável** (persistido em `localStorage`):
  - **Recuperação:** `topK`, limiar mínimo de score.
  - **Geração:** `temperature`, `top_p`, `top_k` (sampling — distinto do `topK` de recuperação), `max_tokens`, `frequency_penalty`, `presence_penalty`, `seed`, `system prompt`.

## Estrutura do projeto

```
.
├── db/init/01-init.sql          # extensão pgvector + tabela embeddings + índice HNSW
├── docker-compose.yml           # PostgreSQL 16 + pgvector
├── scripts/
│   ├── reembed.mjs              # re-embute documentos armazenados
│   └── retrieve-test.mjs        # teste de recuperação por linha de comando
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
    │   ├── embeddings-service.ts #   EmbeddingsService (singleton, transformers.js)
    │   ├── vector-store-repository.ts # VectorStoreRepository (PGVectorStore + stats/clear)
    │   └── rag-service.ts        #   RagService (retrieval + geração em streaming)
    ├── lib/
    │   ├── config.ts             #   CONFIG central congelado (env)
    │   ├── schemas.ts            #   validação zod das rotas
    │   ├── stream.ts             #   protocolo de streaming
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
| `npm run db:up` / `npm run db:down` | Sobe / derruba o Postgres |
| `npm run reembed` | Re-embute os documentos armazenados |

## Notas técnicas

- **Similaridade exibida** = `1 - distância_cosseno` do pgvector (0..1, maior = mais similar).
- `serverExternalPackages` no `next.config.mjs` evita empacotar `@xenova/transformers`, `pdf-parse` e `pg` no bundle do servidor.
- O endpoint de chat envia primeiro um bloco JSON com as fontes, um delimitador, e então faz o streaming dos tokens da resposta (protocolo em `src/lib/stream.ts`).
- A dimensão do vetor (`384`) é acoplada ao modelo de embeddings; trocar o modelo requer re-embutir os documentos.

---

<sub>Desenvolvido por <a href="https://cristiangiehl.com.br/">Cristian Giehl</a>.</sub>
