# codegraph — A1 extractor

Step **A1** of the AI-assisted Go refactoring tool. Loads the backend with
`go/packages` + `go/types`, extracts the symbol/edge graph, and writes it to the
pgvector code-graph DB. Embeddings (A2, `nomic-embed-code`) and architecture
queries (A3) are separate passes.

## Pipeline

```
go/packages + go/types  →  symbols + edges  →  pgvector (:5433)  →  [A2 embed] → [A3 query]
```

- **symbols**: one row per func/method/type/var/const. sqlc-generated files are
  flagged `generated=true` and excluded as refactor targets (still graph nodes).
- **edges**: `calls` + `references` between in-module symbols. Edges to
  stdlib/third-party are dropped. `imports`/`implements`/`embeds` come later.

## Run

```bash
# 1. start the code-graph DB (separate from the app DBs)
docker compose --profile codegraph up -d postgres-codegraph

# 2. one-time: resolve deps (needs network; pulls golang.org/x/tools)
cd tools/codegraph && GO111MODULE=on go mod tidy

# 3. extract the backend graph
GO111MODULE=on go run . -src ../../backend -reset
```

> **`GO111MODULE=on` is load-bearing here.** There's a stray `go.mod` (module
> `rotmud`) at the GOPATH root `~/go/go.mod`. Under the default
> `GO111MODULE=auto`, go mis-resolves and reports "go.mod file not found" from
> this subdir. Forcing `on` fixes it. Permanent fix: remove `~/go/go.mod`
> (GOPATH root should not be a module).

Flags: `-src` (module path), `-pkgs` (default `./...`), `-reset` (TRUNCATE
first), `-dsn` / `CODEGRAPH_DSN` (default
`postgres://wh:wh@localhost:5433/codegraph?sslmode=disable`).

## Embeddings (A2)

Per-symbol semantic embeddings via a local **OpenAI-compatible `/v1/embeddings`**
endpoint (llama.cpp `llama-server`, or Ollama). For GraphRAG search. Incremental:
re-embeds only symbols whose vector is missing or whose embed-text changed
(`embed_hash` = sha256 of model + text).

```bash
# llama.cpp — serve nomic-embed-code (GGUF) with embeddings enabled.
# NOTE port 8081: the app backend already owns :8080.
# --pooling last is REQUIRED: the base is Qwen2.5-Coder-7B (last-token pooling);
# the GGUF default (mean) produces wrong vectors. -hf auto-fetches from HF.
llama-server -hf nomic-ai/nomic-embed-code-GGUF:Q8_0 --embedding --pooling last --port 8081

docker compose --profile codegraph up -d postgres-codegraph
GO111MODULE=on go run . embed        # fills embedding halfvec(3584) + embed_hash
```

Flags: `-embed-url` / `EMBED_URL` (default `http://localhost:8081`), `-model` /
`EMBED_MODEL` (default `nomic-embed-code`), `-batch` (default 16). The dim is
asserted at runtime: if the served model doesn't return 3584-dim vectors the run
aborts (swap the `halfvec(3584)` column + `embedDim` const to match).

> nomic-embed-code embeds **code documents raw** (no prefix). A3 *search queries*
> use the `"Represent this query for searching relevant code: "` prefix
> (verbatim from the model's `config_sentence_transformers.json`); `search`
> applies it automatically.

## GraphRAG search (A3)

Hybrid retrieval: embed a natural-language query (asymmetric prefix), pull the
top-k semantic **seeds** from pgvector, then **graph-expand** over the edge table
to surface the structural neighbourhood a refactor would touch. Needs the
embedder up (for the query vector).

```bash
GO111MODULE=on go run . search "authenticate user login and issue jwt" -k 6 -hops 1
```

Flags: `-k` (vector seeds, default 8), `-hops` (expand depth, default 1; 0 =
seeds only), `-kind` (filter seeds: func/method/type/var/const), `-pkg` (filter
seeds by pkg_path prefix). Expansion is bounded by the hop ceiling — finite even
on the cyclic call graph (no CYCLE clause needed); neighbours capped at 100.
Relation labels are seed-relative (`calls`/`called-by`, `references`/`referenced-by`).

## Architecture queries (A3)

Pure graph traversal — no embeddings needed. `GO111MODULE=on go run . query <name>`:

| query | what |
|-------|------|
| `summary` | symbol/edge/package counts |
| `god-files` | files ranked by size + fan-in/out (sqlc excluded) |
| `hotspots` | most depended-upon symbols (choke points) |
| `targets` | refactor priority = symbols × coupling |
| `layers` | layer→layer edge matrix |
| `violations` | genuine layer breaches, vertical-slice aware (api/middleware exempt) |
| `cross-domain` | edges between bounded-context modules (coupling smell) |
| `deadcode` | unreferenced non-exported funcs/methods (candidates) |

`violations` is tuned to this codebase's vertical-slice layout: domain modules
own their HTTP routes and call shared `api/middleware` helpers by design, so
that path is exempt; real breaches are transport-core/shared-kernel/cmd rule
breaks. `deadcode` is candidates only — no reflection/route-table awareness yet.

## Notes

- **Own go.module** — keeps `golang.org/x/tools` out of the app `go.mod`.
- **halfvec(3584)** — `nomic-embed-code` is 3584-dim; pgvector HNSW caps plain
  `vector` at 2000, so embeddings use `halfvec` (HNSW up to 4000). Schema:
  `docker/codegraph/init.sql`. Verify the served dim once the model is up; if you
  switch to a ≤2000-dim model, move the column + index back to `vector`.
- A1 leaves `embedding` NULL — A2 fills it and sets `embed_hash` for incremental
  re-embed.
