-- Code-graph + semantic-search store for the AI-assisted Go refactoring tool.
-- Runs once on container first start. Separate DB from the app (warehouse_*);
-- holds the symbol/edge graph extracted from go/packages + go/types and the
-- per-symbol embeddings used for semantic search over the backend code.
CREATE EXTENSION IF NOT EXISTS vector;

-- Embeddings come from nomic-embed-code (3584-dim). pgvector HNSW indexes a
-- plain `vector` only up to 2000 dims, so embeddings are stored as `halfvec`
-- (2 bytes/dim, HNSW up to 4000 dims). If you swap to a <=2000-dim model,
-- switch the column + index back to `vector` / `vector_cosine_ops`.
CREATE TABLE IF NOT EXISTS symbols (
    id         bigserial PRIMARY KEY,
    pkg_path   text   NOT NULL,          -- e.g. internal/domain/warehouse/item
    name       text   NOT NULL,
    kind       text   NOT NULL,          -- func | method | type | var | const | pkg
    recv       text   NOT NULL DEFAULT '', -- receiver type for methods, else ''
    exported   bool   NOT NULL,
    generated  bool   NOT NULL DEFAULT false, -- sqlc/codegen — excluded as refactor target
    file       text   NOT NULL,
    line       int    NOT NULL,
    signature  text,                     -- rendered go/types signature
    doc        text,                     -- godoc — improves embedding quality
    embed_hash text,                     -- hash of embed-text; A2 skips re-embed if unchanged
    embedding  halfvec(3584),            -- NULL until A2 embeds
    UNIQUE (pkg_path, recv, name, kind)
);

-- Typed edges between symbols (the code graph).
CREATE TABLE IF NOT EXISTS edges (
    src_id  bigint NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    dst_id  bigint NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
    kind    text   NOT NULL,             -- calls | references | imports | implements | embeds
    PRIMARY KEY (src_id, dst_id, kind)
);

-- ANN index for semantic search; cosine matches normalized code embeddings.
CREATE INDEX IF NOT EXISTS symbols_embedding_hnsw
    ON symbols USING hnsw (embedding halfvec_cosine_ops);

-- Metadata filters applied alongside ANN ("similar funcs in pkg X, exported").
CREATE INDEX IF NOT EXISTS symbols_pkg_path  ON symbols (pkg_path);
CREATE INDEX IF NOT EXISTS symbols_kind      ON symbols (kind);

-- Reverse traversal: "who calls / references X" (graph-expand from seeds).
CREATE INDEX IF NOT EXISTS edges_dst_kind    ON edges (dst_id, kind);
