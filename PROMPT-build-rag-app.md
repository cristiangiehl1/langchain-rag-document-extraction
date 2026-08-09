# Prompt: construir app de embeddings + RAG (Next.js)

> Como usar (aplicando as práticas do Opus 4.8):
> - **Effort:** rode em `xhigh` (coding/agêntico).
> - **Autonomia:** este prompt especifica tarefa, intenção e restrições no 1º turno de
>   propósito — evite arrastar requisitos ao longo de vários turnos.
> - **Design:** a spec de UI abaixo é concreta para quebrar o "house style" creme/serif
>   do modelo (que fica errado em dev tools). Não relaxe essa spec.
> - Cole tudo abaixo desta linha como o prompt.

---

## Papel e objetivo

Você é um engenheiro sênior full-stack. Construa, do zero e de ponta a ponta, um app web
para **fazer embeddings de documentos e testar RAG**. Entregue código funcional, rodável
com `docker compose up` + `npm run dev`, com instruções claras de setup.

Trabalhe de forma autônoma: tome decisões técnicas razoáveis dentro das restrições abaixo,
sem parar para perguntar, exceto se houver ambiguidade que impeça o build. Ao final,
resuma o que foi feito e como rodar.

## Stack (obrigatória — não substitua)

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS** + **shadcn/ui**.
- **LangChain** (JS/TS) para split, embeddings e cadeia de RAG.
- **Embeddings:** `Xenova/all-MiniLM-L6-v2` rodando **localmente** via `@xenova/transformers`
  (dimensão 384). Não chame API externa para embeddings.
- **LLM de chat/completion:** `google/gemma-4-26b-a4b-it:free` via **OpenRouter**
  (chave em `OPENROUTER_API_KEY`, base URL do OpenRouter). Use apenas modelos free.
- **Banco vetorial:** **PostgreSQL + pgvector** em container Docker, integrado via
  `PGVectorStore` do LangChain.

## Infra / Docker

- `docker-compose.yml` subindo imagem Postgres **com pgvector** (ex.: `pgvector/pgvector`),
  porta exposta, volume persistente e `CREATE EXTENSION IF NOT EXISTS vector` na inicialização.
- Script/migração que cria a tabela de embeddings com coluna `vector(384)` e index adequado
  (ex.: HNSW ou IVFFlat).
- `.env.example` com todas as variáveis (`OPENROUTER_API_KEY`, `DATABASE_URL`, etc.).

## Funcionalidades (escopo explícito — implemente TODAS)

### 1. Entrada do documento
- O usuário pode **colar texto** em um textarea **ou anexar arquivo** (`.txt`, `.md`, `.pdf`).
- Mostrar contagem de caracteres/tokens aproximada do texto carregado.

### 2. Configuração do split (LangChain)
Campos editáveis na UI, com valores padrão sensatos:
- `chunkSize` (padrão 1000)
- `chunkOverlap` (padrão 200)
- seletor de **splitter** (ex.: `RecursiveCharacterTextSplitter` por padrão)
- separadores customizáveis (opcional)

### 3. Preview do split ANTES de embutir  ← requisito central
- Ao clicar em "Pré-visualizar chunks", rodar o splitter e **exibir na UI todos os chunks
  resultantes** (numerados, com tamanho de cada um e total de chunks).
- **Nada é enviado ao modelo nem ao banco nesta etapa.**
- Só **após o usuário confirmar** ("Confirmar e gerar embeddings") o app gera os embeddings
  de cada chunk e os armazena no Postgres/pgvector (com metadados: origem, índice do chunk).
- Mostrar progresso e resultado (nº de vetores gravados).

### 4. Chat / completion com RAG
- Tela de chat onde o usuário faz perguntas.
- Fluxo RAG: embutir a pergunta → buscar top-k por similaridade no pgvector → montar contexto
  → chamar `google/gemma-4-26b-a4b-it:free` via OpenRouter → responder.
- **Exibir as fontes/chunks recuperados** (com score de similaridade) junto da resposta, para
  o usuário verificar se o RAG está realmente usando os documentos.

- **Painel de configuração de inferência na UI** (editável pelo usuário a cada pergunta,
  com valores padrão sensatos e envio à API do OpenRouter apenas dos parâmetros suportados):
  - **Recuperação (RAG):**
    - `topK` de chunks recuperados (padrão 4)
    - limiar mínimo de score de similaridade (opcional, padrão desligado)
  - **Geração (LLM):**
    - `temperature` (padrão 0.3)
    - `top_p` (padrão 1.0)
    - `top_k` de sampling do modelo (parâmetro do OpenRouter, distinto do topK de recuperação
      — deixe isso explícito na UI para não confundir os dois)
    - `max_tokens` da resposta (padrão 1024)
    - `frequency_penalty` e `presence_penalty` (padrão 0)
    - `seed` (opcional, para reprodutibilidade)
    - `system prompt` editável (textarea)
  - Exibir tooltip/descrição curta em cada campo explicando o efeito.
  - Persistir as configs entre mensagens da mesma sessão (ex.: estado/localStorage).
  - Validar limites (ranges) de cada parâmetro antes de enviar; se o modelo não suportar
    algum parâmetro, omití-lo da chamada em vez de enviar valor inválido.

## Requisitos de UI (spec de design — siga à risca)

Este é um **dev tool técnico**, não uma peça editorial. Adote uma estética de painel técnico:

- Tema **dark**, base neutra fria: fundo `#0B0F14`, superfícies `#141A21`, bordas `#232B33`.
- Acento único **teal/ciano** (`#2DD4BF`) para ações primárias e destaques de estado.
- Tipografia **sans-serif técnica** para UI e **monoespaçada** para chunks/JSON/scores.
  NÃO use serifas de display, fundos creme, itálicos decorativos nem acento terracota/âmbar.
- `border-radius` de 6px consistente em cards, botões, inputs.
- Layout: sidebar de navegação (Ingestão | Chat) + área principal com cards bem espaçados.
- Estados claros de loading/erro/sucesso; feedback em cada ação.

```text
<frontend_aesthetics>
NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial,
system fonts), cliched color schemes (particularly purple gradients on white or dark
backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks
context-specific character. Use unique fonts, cohesive colors and themes, and animations for
effects and micro-interactions.
</frontend_aesthetics>
```

## Restrições e qualidade

- TypeScript estrito (`strict: true`); sem `any` desnecessário.
- Separe camadas: rotas de API / Server Actions para embeddings e chat; UI só consome.
- Trate erros de API do OpenRouter e do banco com mensagens úteis ao usuário.
- Não faça polling nem chamadas ao LLM na etapa de preview de chunks.
- Aplique cada requisito a TODAS as telas relevantes, não apenas à primeira.

## Entregáveis

1. Repositório completo e rodável.
2. `docker-compose.yml` + migração pgvector.
3. `README.md` com passo a passo: subir Docker, instalar deps, variáveis de ambiente, rodar.
4. `.env.example`.
5. Resumo final do que foi implementado e das decisões técnicas relevantes.
