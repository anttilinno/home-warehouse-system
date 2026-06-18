package main

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"
)

// queryPrefix is the instruction nomic-embed-code prepends to SEARCH QUERIES
// (asymmetric retrieval: code documents are embedded raw, queries are not).
// Verbatim from the model's config_sentence_transformers.json — changing it
// degrades recall. Trailing space is intentional.
const queryPrefix = "Represent this query for searching relevant code: "

// searchOpts tunes a GraphRAG retrieval. Vector seeds come first (semantic
// match), then the graph is expanded outward to pull in the structural
// neighbourhood a refactor would have to touch.
type searchOpts struct {
	k    int    // number of vector seeds
	hops int    // graph-expand depth from seeds (0 = seeds only)
	kind string // optional kind filter applied to SEEDS (func/method/type/...)
	pkg  string // optional pkg_path LIKE prefix filter applied to SEEDS
}

// seedRow is a vector-search hit: a symbol ranked by cosine distance to the query.
type seedRow struct {
	id       int64
	pkgPath  string
	name     string
	kind     string
	recv     string
	file     string
	line     int
	distance float64
}

// neighborRow is a symbol reached by expanding the graph from the seed set.
type neighborRow struct {
	pkgPath  string
	name     string
	kind     string
	file     string
	line     int
	hop      int
	relation string // calls | called-by | references | referenced-by | implements | ...
}

// RunSearch is GraphRAG hybrid retrieval (A3 query path): embed the query with
// the asymmetric prefix, pull the top-k semantic seeds from pgvector, then
// graph-expand `hops` levels over the edge table to surface the structural
// neighbourhood. Prints seeds then neighbours.
func (s *Store) RunSearch(ctx context.Context, emb *Embedder, query string, opts searchOpts) error {
	if query == "" {
		return fmt.Errorf("search: empty query")
	}

	// Embed the query (single input, prefixed). Reuses the dim-guard in Embed.
	vecs, err := emb.Embed(ctx, []string{queryPrefix + query})
	if err != nil {
		return fmt.Errorf("embed query: %w", err)
	}
	qlit := halfvecLiteral(vecs[0])

	seeds, err := s.vectorSeeds(ctx, qlit, opts)
	if err != nil {
		return fmt.Errorf("vector seeds: %w", err)
	}
	if len(seeds) == 0 {
		fmt.Println("no seeds — is the graph embedded? (go run . embed)")
		return nil
	}

	printSeeds(seeds)

	if opts.hops <= 0 {
		return nil
	}
	seedIDs := make([]int64, len(seeds))
	for i, sd := range seeds {
		seedIDs[i] = sd.id
	}
	neighbors, err := s.expand(ctx, seedIDs, opts.hops)
	if err != nil {
		return fmt.Errorf("graph expand: %w", err)
	}
	printNeighbors(neighbors, opts.hops)
	return nil
}

// vectorSeeds returns the k symbols closest to the query vector, with optional
// kind/pkg metadata filters. Cosine distance via the halfvec HNSW index.
func (s *Store) vectorSeeds(ctx context.Context, qlit string, opts searchOpts) ([]seedRow, error) {
	// Args: $1 query vector, $2 kind ('' = any), $3 pkg LIKE ('' = any), $4 limit.
	const sql = `
		SELECT s.id, s.pkg_path, s.name, s.kind, s.recv, s.file, s.line,
		       (s.embedding <=> $1::halfvec)::float8 AS distance
		FROM symbols s
		WHERE s.embedding IS NOT NULL
		  AND ($2 = '' OR s.kind = $2)
		  AND ($3 = '' OR s.pkg_path LIKE $3 || '%')
		ORDER BY s.embedding <=> $1::halfvec
		LIMIT $4`
	rows, err := s.pool.Query(ctx, sql, qlit, opts.kind, opts.pkg, opts.k)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []seedRow
	for rows.Next() {
		var r seedRow
		if err := rows.Scan(&r.id, &r.pkgPath, &r.name, &r.kind, &r.recv,
			&r.file, &r.line, &r.distance); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// expand walks the edge graph outward from the seed ids up to `hops` levels and
// returns each reached neighbour with its minimum hop distance and the relation
// to the seed set. Direction is preserved: an outbound `calls` edge surfaces the
// neighbour as a dependency ("calls"), an inbound one as a dependent ("called-by").
//
// Termination is guaranteed by the strict hop bound — the depth ceiling makes
// the recursion finite even though the call graph contains cycles, so no CYCLE
// clause is needed. Seeds themselves are excluded from the neighbour set.
func (s *Store) expand(ctx context.Context, seedIDs []int64, hops int) ([]neighborRow, error) {
	// $1 seed ids, $2 max hops. The recursive term joins each frontier symbol to
	// both its outbound and inbound edges; `dir` records which side matched so we
	// can label the relation. min(hop) + a relation priority dedupe per neighbour.
	const sql = `
		WITH RECURSIVE walk AS (
		    SELECT id AS sym_id, 0 AS hop, ''::text AS edge_kind, ''::text AS dir
		    FROM symbols WHERE id = ANY($1::bigint[])
		  UNION ALL
		    SELECT nb.id, w.hop + 1, e.kind,
		           CASE WHEN e.src_id = w.sym_id THEN 'out' ELSE 'in' END
		    FROM walk w
		    JOIN edges e ON e.src_id = w.sym_id OR e.dst_id = w.sym_id
		    JOIN symbols nb
		      ON nb.id = CASE WHEN e.src_id = w.sym_id THEN e.dst_id ELSE e.src_id END
		    WHERE w.hop < $2
		),
		reached AS (
		    SELECT sym_id, min(hop) AS hop,
		           -- pick the relation from the shallowest reaching edge
		           (array_agg(edge_kind ORDER BY hop))[1] AS edge_kind,
		           (array_agg(dir       ORDER BY hop))[1] AS dir
		    FROM walk
		    WHERE hop > 0
		    GROUP BY sym_id
		)
		SELECT s.pkg_path, s.name, s.kind, s.file, s.line, r.hop, r.edge_kind, r.dir
		FROM reached r
		JOIN symbols s ON s.id = r.sym_id
		WHERE r.sym_id <> ALL($1::bigint[])   -- drop seeds reached via a cycle
		ORDER BY r.hop, s.pkg_path, s.name
		LIMIT 100`
	rows, err := s.pool.Query(ctx, sql, seedIDs, hops)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []neighborRow
	for rows.Next() {
		var (
			r             neighborRow
			edgeKind, dir string
		)
		if err := rows.Scan(&r.pkgPath, &r.name, &r.kind, &r.file, &r.line,
			&r.hop, &edgeKind, &dir); err != nil {
			return nil, err
		}
		r.relation = relationLabel(edgeKind, dir)
		out = append(out, r)
	}
	return out, rows.Err()
}

// relationLabel turns an edge kind + direction into a seed-relative verb.
func relationLabel(kind, dir string) string {
	switch kind {
	case "calls":
		if dir == "out" {
			return "calls"
		}
		return "called-by"
	case "references":
		if dir == "out" {
			return "references"
		}
		return "referenced-by"
	default:
		if dir == "out" {
			return kind
		}
		return kind + "-by"
	}
}

func printSeeds(seeds []seedRow) {
	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	defer w.Flush()
	fmt.Fprintln(w, "SEED\tdist\tkind\tsymbol\tfile:line")
	for _, r := range seeds {
		name := r.name
		if r.recv != "" {
			name = "(" + r.recv + ")." + name
		}
		fmt.Fprintf(w, "\t%.3f\t%s\t%s.%s\t%v:%d\n",
			r.distance, r.kind, r.pkgPath, name, trimFile(r.file), r.line)
	}
}

func printNeighbors(neighbors []neighborRow, hops int) {
	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	defer w.Flush()
	fmt.Fprintf(w, "\nNEIGHBOURHOOD (%d-hop)\thop\trelation\tkind\tsymbol\tfile:line\n", hops)
	for _, r := range neighbors {
		fmt.Fprintf(w, "\t%d\t%s\t%s\t%s.%s\t%v:%d\n",
			r.hop, r.relation, r.kind, r.pkgPath, r.name, trimFile(r.file), r.line)
	}
	fmt.Fprintf(w, "\n(%d neighbours)\n", len(neighbors))
}
