package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// embedDim is the nomic-embed-code embedding width. The DB column is
// halfvec(3584); a runtime mismatch is fatal (wrong model served).
const embedDim = 3584

// Embedder calls a local OpenAI-compatible /v1/embeddings endpoint — works with
// llama.cpp's llama-server (run with --embedding) and Ollama alike.
// nomic-embed-code embeds CODE DOCUMENTS without a prefix; only SEARCH QUERIES
// (A3 retrieval) take the "Represent this query…" prefix — indexing sends raw.
type Embedder struct {
	base  string
	model string
	http  *http.Client
}

func NewEmbedder(base, model string) *Embedder {
	return &Embedder{base: strings.TrimRight(base, "/"), model: model,
		http: &http.Client{Timeout: 5 * time.Minute}}
}

type embedReq struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}
type embedResp struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
}

// Embed returns one vector per input text, in input order.
func (e *Embedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	body, _ := json.Marshal(embedReq{Model: e.model, Input: texts})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.base+"/v1/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embeddings request (is llama-server running at %s?): %w", e.base, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var b bytes.Buffer
		b.ReadFrom(resp.Body)
		return nil, fmt.Errorf("embeddings status %d: %s", resp.StatusCode, strings.TrimSpace(b.String()))
	}
	var out embedResp
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if len(out.Data) != len(texts) {
		return nil, fmt.Errorf("embeddings count %d != inputs %d", len(out.Data), len(texts))
	}
	// Reorder by Index — the spec returns data in order, but don't assume it.
	vecs := make([][]float32, len(texts))
	for _, d := range out.Data {
		if d.Index < 0 || d.Index >= len(texts) {
			return nil, fmt.Errorf("embedding index %d out of range", d.Index)
		}
		if len(d.Embedding) != embedDim {
			return nil, fmt.Errorf("embedding dim %d != expected %d — wrong model? (index %d)", len(d.Embedding), embedDim, d.Index)
		}
		vecs[d.Index] = d.Embedding
	}
	return vecs, nil
}

// embedText is the document representation embedded per symbol. Kept identical
// to the hashing input so re-embeds are detected correctly.
func embedText(pkgPath, kind, recv, name, sig, doc string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s %s", kind, name)
	if recv != "" {
		fmt.Fprintf(&b, " (%s)", recv)
	}
	fmt.Fprintf(&b, " in %s\n", pkgPath)
	if sig != "" {
		b.WriteString(sig + "\n")
	}
	b.WriteString(doc)
	return strings.TrimSpace(b.String())
}

// hashText keys re-embedding on both content and model, so swapping the model
// forces a full re-embed.
func hashText(model, text string) string {
	h := sha256.Sum256([]byte(model + "\x00" + text))
	return hex.EncodeToString(h[:])
}

// halfvecLiteral renders a float32 slice as a pgvector halfvec text literal.
func halfvecLiteral(v []float32) string {
	var b strings.Builder
	b.Grow(len(v) * 8)
	b.WriteByte('[')
	for i, f := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(float64(f), 'g', -1, 32))
	}
	b.WriteByte(']')
	return b.String()
}

type embedTarget struct {
	id   int64
	text string
	hash string
}

// FetchEmbedTargets returns symbols whose embedding is missing or whose
// embed-text changed since the last run (incremental re-embed).
func (s *Store) FetchEmbedTargets(ctx context.Context, model string) ([]embedTarget, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, pkg_path, kind, recv, name,
		       COALESCE(signature,''), COALESCE(doc,''),
		       COALESCE(embed_hash,''), (embedding IS NULL)
		FROM symbols`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var targets []embedTarget
	for rows.Next() {
		var (
			id                                          int64
			pkg, kind, recv, name, sig, doc, storedHash string
			embNull                                     bool
		)
		if err := rows.Scan(&id, &pkg, &kind, &recv, &name, &sig, &doc, &storedHash, &embNull); err != nil {
			return nil, err
		}
		text := embedText(pkg, kind, recv, name, sig, doc)
		hash := hashText(model, text)
		if embNull || storedHash != hash {
			targets = append(targets, embedTarget{id: id, text: text, hash: hash})
		}
	}
	return targets, rows.Err()
}

// SaveEmbeddings writes vectors + hashes for a batch of targets.
func (s *Store) SaveEmbeddings(ctx context.Context, targets []embedTarget, vecs [][]float32) error {
	batch := &pgx.Batch{}
	for i, t := range targets {
		batch.Queue(
			`UPDATE symbols SET embedding = $1::halfvec, embed_hash = $2 WHERE id = $3`,
			halfvecLiteral(vecs[i]), t.hash, t.id)
	}
	br := s.pool.SendBatch(ctx, batch)
	defer br.Close()
	for range targets {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}
