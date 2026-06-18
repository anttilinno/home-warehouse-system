// Command codegraph is step A1 of the AI-assisted Go refactoring tool: it loads
// the backend with go/packages + go/types, extracts the symbol/edge graph, and
// writes it to the pgvector code-graph DB. Embeddings (A2) and architecture
// queries (A3) are separate passes.
//
// Usage:
//
//	docker compose --profile codegraph up -d postgres-codegraph
//	cd tools/codegraph && GO111MODULE=on go mod tidy
//	GO111MODULE=on go run . -src ../../backend -reset   # A1 extract
//	GO111MODULE=on go run . query god-files             # A3 arch report
//	GO111MODULE=on go run . embed                        # A2 embed (needs Ollama)
package main

import (
	"context"
	"flag"
	"log"
	"os"
	"time"
)

func main() {
	var (
		src      = flag.String("src", "../../backend", "path to the Go module to extract")
		patterns = flag.String("pkgs", "./...", "package patterns to load")
		dsn      = flag.String("dsn", envOr("CODEGRAPH_DSN",
			"postgres://wh:wh@localhost:5433/codegraph?sslmode=disable"),
			"pgvector code-graph DSN")
		reset    = flag.Bool("reset", false, "TRUNCATE the graph before writing (clean full extract)")
		embedURL = flag.String("embed-url", envOr("EMBED_URL", "http://localhost:8081"),
			"OpenAI-compatible embeddings base URL (llama-server --embedding)")
		model = flag.String("model", envOr("EMBED_MODEL", "nomic-embed-code"), "embedding model name (embed/search)")
		batch = flag.Int("batch", 16, "embed batch size")
		// search (GraphRAG retrieval) knobs.
		topK = flag.Int("k", 8, "search: number of vector seeds")
		hops = flag.Int("hops", 1, "search: graph-expand depth from seeds (0 = seeds only)")
		kind = flag.String("kind", "", "search: filter seeds by kind (func/method/type/var/const)")
		pkg  = flag.String("pkg", "", "search: filter seeds by pkg_path prefix")
	)
	flag.Parse()

	// Subcommands that hit the local 7B embedder (embed, search) can be slow and
	// get no deadline. Extract/query are pure SQL — cap them at 5m.
	cmd := flag.Arg(0)
	ctx := context.Background()
	if cmd != "embed" && cmd != "search" {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 5*time.Minute)
		defer cancel()
	}

	store, err := NewStore(ctx, *dsn)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer store.Close()

	// `query <name>` runs an A3 architecture report; otherwise A1 extract.
	if cmd == "query" {
		if err := store.RunQuery(ctx, flag.Arg(1)); err != nil {
			log.Fatalf("query: %v", err)
		}
		return
	}

	// `embed` fills missing/stale embeddings via the local model (A2).
	if cmd == "embed" {
		if err := runEmbed(ctx, store, *embedURL, *model, *batch); err != nil {
			log.Fatalf("embed: %v", err)
		}
		return
	}

	// `search <query>` is GraphRAG hybrid retrieval (A3): vector seeds + graph
	// expand. Needs the embedder up for the query vector.
	if cmd == "search" {
		emb := NewEmbedder(*embedURL, *model)
		opts := searchOpts{k: *topK, hops: *hops, kind: *kind, pkg: *pkg}
		if err := store.RunSearch(ctx, emb, flag.Arg(1), opts); err != nil {
			log.Fatalf("search: %v", err)
		}
		return
	}

	log.Printf("loading %s (%s)…", *src, *patterns)
	symbols, edges, err := Extract(*src, *patterns)
	if err != nil {
		log.Fatalf("extract: %v", err)
	}
	log.Printf("extracted %d symbols, %d edges", len(symbols), len(edges))

	if *reset {
		if err := store.Reset(ctx); err != nil {
			log.Fatalf("reset: %v", err)
		}
	}
	if err := store.Save(ctx, symbols, edges); err != nil {
		log.Fatalf("save: %v", err)
	}
	log.Printf("done — graph written to %s", *dsn)
}

// runEmbed embeds all symbols whose vector is missing or whose embed-text
// changed, in batches, via the local Ollama model.
func runEmbed(ctx context.Context, store *Store, embedURL, model string, batchSize int) error {
	targets, err := store.FetchEmbedTargets(ctx, model)
	if err != nil {
		return err
	}
	if len(targets) == 0 {
		log.Printf("nothing to embed — all %s embeddings current", model)
		return nil
	}
	log.Printf("embedding %d symbols (model=%s, batch=%d)…", len(targets), model, batchSize)

	emb := NewEmbedder(embedURL, model)
	done := 0
	for start := 0; start < len(targets); start += batchSize {
		end := min(start+batchSize, len(targets))
		chunk := targets[start:end]

		texts := make([]string, len(chunk))
		for i, t := range chunk {
			texts[i] = t.text
		}
		vecs, err := emb.Embed(ctx, texts)
		if err != nil {
			return err
		}
		if err := store.SaveEmbeddings(ctx, chunk, vecs); err != nil {
			return err
		}
		done += len(chunk)
		log.Printf("  %d/%d", done, len(targets))
	}
	log.Printf("done — embedded %d symbols", done)
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
