package worker

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// TestFindAllPages_LoadsBeyondMaxPageSize is the regression test for the
// import-cache truncation bug: lookup caches were loaded with a single
// Pagination{PageSize: 10000} call whose Limit() silently clamped to
// shared.MaxPageSize (100), so any workspace with >100 locations/items
// resolved CSV references against a truncated cache.
func TestFindAllPages_LoadsBeyondMaxPageSize(t *testing.T) {
	const totalRows = 150 // > shared.MaxPageSize, spans two pages

	rows := make([]string, totalRows)
	for i := range rows {
		rows[i] = fmt.Sprintf("location-%03d", i)
	}

	var requestedPages []shared.Pagination
	find := func(ctx context.Context, p shared.Pagination) ([]string, int, error) {
		requestedPages = append(requestedPages, p)
		if p.Limit() > shared.MaxPageSize {
			t.Fatalf("requested page size %d exceeds MaxPageSize %d", p.Limit(), shared.MaxPageSize)
		}
		start := p.Offset()
		if start >= len(rows) {
			return nil, totalRows, nil
		}
		end := start + p.Limit()
		if end > len(rows) {
			end = len(rows)
		}
		return rows[start:end], totalRows, nil
	}

	got, err := findAllPages(context.Background(), find)
	if err != nil {
		t.Fatalf("findAllPages returned error: %v", err)
	}

	if len(got) != totalRows {
		t.Fatalf("findAllPages returned %d rows, want %d (cache truncated)", len(got), totalRows)
	}
	for i, name := range got {
		if name != rows[i] {
			t.Fatalf("row %d = %q, want %q (rows skipped or duplicated across pages)", i, name, rows[i])
		}
	}
	if len(requestedPages) != 2 {
		t.Errorf("expected 2 page requests for %d rows, got %d", totalRows, len(requestedPages))
	}
}

// TestFindAllPages_ExactPageBoundary ensures an exact multiple of the page
// size terminates (with one trailing empty page) and returns every row.
func TestFindAllPages_ExactPageBoundary(t *testing.T) {
	const totalRows = shared.MaxPageSize * 2

	find := func(ctx context.Context, p shared.Pagination) ([]int, int, error) {
		start := p.Offset()
		if start >= totalRows {
			return nil, totalRows, nil
		}
		batch := make([]int, p.Limit())
		for i := range batch {
			batch[i] = start + i
		}
		return batch, totalRows, nil
	}

	got, err := findAllPages(context.Background(), find)
	if err != nil {
		t.Fatalf("findAllPages returned error: %v", err)
	}
	if len(got) != totalRows {
		t.Fatalf("findAllPages returned %d rows, want %d", len(got), totalRows)
	}
}

// TestFindAllPages_PropagatesError ensures a failed cache load surfaces as an
// error (the worker must abort the import) instead of yielding a partial or
// empty cache.
func TestFindAllPages_PropagatesError(t *testing.T) {
	boom := errors.New("db unavailable")
	find := func(ctx context.Context, p shared.Pagination) ([]string, int, error) {
		if p.Page >= 2 {
			return nil, 0, boom
		}
		batch := make([]string, p.Limit())
		return batch, 0, nil
	}

	_, err := findAllPages(context.Background(), find)
	if !errors.Is(err, boom) {
		t.Fatalf("findAllPages error = %v, want %v", err, boom)
	}
}
