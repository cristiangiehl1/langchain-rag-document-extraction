# LangChain RAG Lab

App para **fatiar documentos, gerar embeddings locais, armazená-los em pgvector e testar RAG** com chat em streaming.

- **Next.js** (App Router) · **TypeScript** · **Tailwind** · componentes estilo **shadcn/ui**
- **LangChain** para split, embeddings e recuperação
- **Embeddings locais** com `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (multilíngue, bom com português) via `HuggingFaceTransformersEmbeddings` (`@huggingface/transformers`, 384 dimensões, sem API externa)
- **Camada de domínio orientada a objetos** (services + repository) com um `CONFIG` central congelado
- **LLM de chat** `google/gemma-4-26b-a4b-it:free` via **OpenRouter** (streaming)
- **PostgreSQL + pgvector** em Docker
- Validação de entrada com **zod**
- Respostas da LLM renderizadas como **Markdown** (`react-markdown` + `remark-gfm`)

## Pré-requisitos

- Node.js 18+ (testado no 24)
- Docker + Docker Compose

## 1. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` e coloque sua `OPENROUTER_API_KEY`. As credenciais do Postgres já vêm
alinhadas com o `docker-compose.yml`.

> **Modelo:** o padrão é `google/gemma-4-26b-a4b-it:free`. Se esse id mudar/sair do ar no
> OpenRouter, ajuste `OPENROUTER_MODEL` no `.env` para outro modelo `:free`.

## 2. Subir o banco (pgvector)

```bash
npm run db:up      # docker compose up -d
```

Na primeira subida, o `db/init/01-init.sql` roda automaticamente: habilita a extensão
`vector`, cria a tabela `embeddings` com coluna `vector(384)` e um índice HNSW (cosseno).

## 3. Instalar e rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000 (redireciona para `/ingest`).

> Na **primeira** geração de embeddings, o modelo `all-MiniLM-L6-v2` é baixado para um
> cache local (~90 MB). Depois disso roda offline.

## Fluxo de uso

### Ingestão (`/ingest`)
1. **Documento** — cole o texto ou anexe `.txt` / `.md` / `.pdf` (PDF via `PDFLoader` do LangChain).
2. **Configuração do split** — escolha o splitter (`RecursiveCharacterTextSplitter` ou
   `CharacterTextSplitter`), `chunkSize`, `chunkOverlap` e separadores opcionais.
3. **Pré-visualizar chunks** — mostra todos os chunks (numerados, com tamanho).
   **Nada é enviado ao modelo nem ao banco nesta etapa.**
4. **Confirmar e gerar embeddings** — só então cada chunk é embutido localmente e gravado
   no pgvector (com metadados: `source`, `chunkIndex`, etc.).
   Alterar o texto ou a config invalida o preview e exige pré-visualizar de novo.

### Chat RAG (`/chat`)
- Faça perguntas; o app embute a pergunta, busca os `topK` chunks mais similares no
  pgvector, monta o contexto e chama o LLM via OpenRouter **com streaming**.
- Cada resposta mostra as **fontes recuperadas** com o **score de similaridade** (cosseno),
  o modelo usado e os **parâmetros aplicados**.
- Painel lateral configurável (persistido em `localStorage`):
  - **Recuperação:** `topK`, limiar mínimo de score.
  - **Geração:** `temperature`, `top_p`, `top_k` (sampling — distinto do topK de
    recuperação), `max_tokens`, `frequency_penalty`, `presence_penalty`, `seed`,
    `system prompt`. Parâmetros desligados **não** são enviados à API.

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e produção |
| `npm run typecheck` | Checagem de tipos (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run db:up` / `npm run db:down` | Sobe / derruba o Postgres |

## Estrutura

```
db/init/01-init.sql          extensão pgvector + tabela + índices
docker-compose.yml           Postgres + pgvector
src/server/                  camada de domínio (OOP)
  embeddings-service.ts      EmbeddingsService (singleton, transformers.js)
  vector-store-repository.ts VectorStoreRepository (PGVectorStore + stats/clear)
  document-processor.ts      DocumentProcessor (split do LangChain)
  document-loader.ts         DocumentLoader (extração txt/md/pdf)
  rag-service.ts             RagService (retrieval + geração em streaming)
src/lib/
  config.ts                  CONFIG central congelado (env)
  schemas.ts                 validação zod das rotas
  stream.ts                  protocolo do streaming
  types.ts / defaults.ts     contratos e defaults
src/app/api/                 controllers finos: preview embed chat extract stats
src/components/              UI (shadcn-style, componentes de função), ingest e chat
```

## Notas técnicas

- Similaridade exibida = `1 - distância_cosseno` do pgvector (0..1, maior = mais similar).
- `serverExternalPackages` no `next.config.mjs` evita empacotar `@xenova/transformers`,
  `pdf-parse` e `pg` no bundle do servidor.
- O endpoint de chat envia primeiro um bloco JSON com as fontes, um delimitador, e então
  faz o streaming dos tokens da resposta.
