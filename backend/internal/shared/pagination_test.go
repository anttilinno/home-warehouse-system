package shared

import "testing"

func TestPaginationLimit(t *testing.T) {
	tests := []struct {
		name     string
		pageSize int
		want     int
	}{
		{name: "zero page size falls back to default", pageSize: 0, want: DefaultPageSize},
		{name: "negative page size falls back to default", pageSize: -5, want: DefaultPageSize},
		{name: "in-range page size is kept", pageSize: 25, want: 25},
		{name: "max page size is kept", pageSize: MaxPageSize, want: MaxPageSize},
		{name: "oversized page size clamps to max", pageSize: 10000, want: MaxPageSize},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := Pagination{Page: 1, PageSize: tt.pageSize}
			if got := p.Limit(); got != tt.want {
				t.Errorf("Limit() = %d, want %d", got, tt.want)
			}
		})
	}
}

// TestPaginationOffsetMatchesLimit guards the clamp-consistency fix: Offset()
// must advance by the same (clamped) window Limit() reads, or page N+1 skips
// rows whenever the caller's PageSize exceeds MaxPageSize.
func TestPaginationOffsetMatchesLimit(t *testing.T) {
	tests := []struct {
		name     string
		page     int
		pageSize int
		want     int
	}{
		{name: "page 1 offset is zero", page: 1, pageSize: 25, want: 0},
		{name: "page below 1 treated as page 1", page: 0, pageSize: 25, want: 0},
		{name: "page 3 with in-range size", page: 3, pageSize: 25, want: 50},
		{name: "page 2 with oversized size uses clamped window", page: 2, pageSize: 10000, want: MaxPageSize},
		{name: "page 2 with zero size uses default window", page: 2, pageSize: 0, want: DefaultPageSize},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := Pagination{Page: tt.page, PageSize: tt.pageSize}
			if got := p.Offset(); got != tt.want {
				t.Errorf("Offset() = %d, want %d", got, tt.want)
			}
			// Invariant: consecutive pages tile the keyspace with no gaps.
			if tt.page >= 1 {
				next := Pagination{Page: tt.page + 1, PageSize: tt.pageSize}
				if next.Offset() != p.Offset()+p.Limit() {
					t.Errorf("page windows leave a gap: next.Offset()=%d, want %d", next.Offset(), p.Offset()+p.Limit())
				}
			}
		})
	}
}
