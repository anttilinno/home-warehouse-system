package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store writes the extracted graph to the pgvector code-graph DB. Embeddings
// are left NULL here; the A2 embedder fills them in a later pass.
type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("connect codegraph db: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping codegraph db: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

// Reset clears the graph for a clean full re-extract. CASCADE drops edges too.
func (s *Store) Reset(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, `TRUNCATE symbols RESTART IDENTITY CASCADE`)
	return err
}

// Save upserts all symbols (filling Symbol.ID), then inserts edges. Symbols are
// keyed by (pkg_path, recv, name, kind); re-running updates positions/signatures
// in place and preserves existing embeddings for unchanged rows.
func (s *Store) Save(ctx context.Context, symbols []*Symbol, edges []*Edge) error {
	if err := s.upsertSymbols(ctx, symbols); err != nil {
		return fmt.Errorf("upsert symbols: %w", err)
	}
	if err := s.insertEdges(ctx, edges); err != nil {
		return fmt.Errorf("insert edges: %w", err)
	}
	return nil
}

const upsertSymbolSQL = `
INSERT INTO symbols
    (pkg_path, name, kind, recv, exported, generated, file, line, signature, doc)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
ON CONFLICT (pkg_path, recv, name, kind) DO UPDATE SET
    exported  = EXCLUDED.exported,
    generated = EXCLUDED.generated,
    file      = EXCLUDED.file,
    line      = EXCLUDED.line,
    signature = EXCLUDED.signature,
    doc       = EXCLUDED.doc
RETURNING id`

func (s *Store) upsertSymbols(ctx context.Context, symbols []*Symbol) error {
	batch := &pgx.Batch{}
	for _, sym := range symbols {
		batch.Queue(upsertSymbolSQL,
			sym.PkgPath, sym.Name, sym.Kind, sym.Recv, sym.Exported,
			sym.Generated, sym.File, sym.Line, sym.Signature, sym.Doc)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()
	for _, sym := range symbols {
		if err := br.QueryRow().Scan(&sym.ID); err != nil {
			return fmt.Errorf("%s.%s: %w", sym.PkgPath, sym.Name, err)
		}
	}
	return nil
}

func (s *Store) insertEdges(ctx context.Context, edges []*Edge) error {
	batch := &pgx.Batch{}
	for _, e := range edges {
		if e.Src.ID == 0 || e.Dst.ID == 0 {
			continue
		}
		batch.Queue(
			`INSERT INTO edges (src_id, dst_id, kind) VALUES ($1,$2,$3)
			 ON CONFLICT DO NOTHING`,
			e.Src.ID, e.Dst.ID, e.Kind)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()
	for i := 0; i < batch.Len(); i++ {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}
