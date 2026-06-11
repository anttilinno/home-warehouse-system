package paperless

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClient_GetDocument(t *testing.T) {
	var gotAuth, gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id": 42, "title": "Receipt — Dishwasher", "created": "2026-01-15", "original_file_name": "receipt.pdf"}`))
	}))
	defer server.Close()

	client := NewClient()
	doc, err := client.GetDocument(context.Background(), server.URL, "secret-token", 42)
	if err != nil {
		t.Fatalf("GetDocument: %v", err)
	}

	if gotAuth != "Token secret-token" {
		t.Errorf("Authorization header = %q, want %q", gotAuth, "Token secret-token")
	}
	if gotPath != "/api/documents/42/" {
		t.Errorf("path = %q, want %q", gotPath, "/api/documents/42/")
	}
	if doc.ID != 42 || doc.Title != "Receipt — Dishwasher" {
		t.Errorf("unexpected document: %+v", doc)
	}
	if doc.OriginalFileName == nil || *doc.OriginalFileName != "receipt.pdf" {
		t.Errorf("original_file_name = %v, want receipt.pdf", doc.OriginalFileName)
	}
}

func TestClient_GetDocument_TrailingSlashBaseURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/documents/7/" {
			t.Errorf("path = %q, want /api/documents/7/", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"id": 7, "title": "x"}`))
	}))
	defer server.Close()

	client := NewClient()
	if _, err := client.GetDocument(context.Background(), server.URL+"/", "t", 7); err != nil {
		t.Fatalf("GetDocument: %v", err)
	}
}

func TestClient_Search(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Token tok" {
			t.Errorf("Authorization header = %q, want %q", got, "Token tok")
		}
		q := r.URL.Query()
		if q.Get("query") != "warranty fridge" {
			t.Errorf("query = %q, want %q", q.Get("query"), "warranty fridge")
		}
		if q.Get("page") != "2" || q.Get("page_size") != "10" {
			t.Errorf("pagination = page %q size %q, want 2/10", q.Get("page"), q.Get("page_size"))
		}
		_, _ = w.Write([]byte(`{"count": 1, "results": [{"id": 9, "title": "Fridge warranty"}]}`))
	}))
	defer server.Close()

	client := NewClient()
	result, err := client.Search(context.Background(), server.URL, "tok", "warranty fridge", 2, 10)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if result.Count != 1 || len(result.Results) != 1 || result.Results[0].ID != 9 {
		t.Errorf("unexpected result: %+v", result)
	}
}

func TestClient_Search_EmptyResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"count": 0, "results": []}`))
	}))
	defer server.Close()

	client := NewClient()
	result, err := client.Search(context.Background(), server.URL, "tok", "nothing", 0, 0)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if result.Results == nil {
		t.Error("Results should be an empty slice, not nil")
	}
}

func TestClient_ErrorMapping(t *testing.T) {
	tests := []struct {
		name    string
		status  int
		wantErr error
	}{
		{"unauthorized", http.StatusUnauthorized, ErrUnauthorized},
		{"forbidden", http.StatusForbidden, ErrUnauthorized},
		{"not found", http.StatusNotFound, ErrDocumentNotFound},
		{"server error", http.StatusInternalServerError, ErrUnavailable},
		{"bad gateway", http.StatusBadGateway, ErrUnavailable},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.status)
			}))
			defer server.Close()

			client := NewClient()
			_, err := client.GetDocument(context.Background(), server.URL, "tok", 1)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("GetDocument with status %d: got %v, want %v", tt.status, err, tt.wantErr)
			}
		})
	}
}

func TestClient_ConnectionRefused(t *testing.T) {
	client := NewClient()
	// Port 1 should refuse connections.
	_, err := client.GetDocument(context.Background(), "http://127.0.0.1:1", "tok", 1)
	if !errors.Is(err, ErrUnavailable) {
		t.Errorf("GetDocument against dead host: got %v, want ErrUnavailable", err)
	}
}

func TestClient_MalformedJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{not json`))
	}))
	defer server.Close()

	client := NewClient()
	_, err := client.GetDocument(context.Background(), server.URL, "tok", 1)
	if !errors.Is(err, ErrUnavailable) {
		t.Errorf("GetDocument with bad JSON: got %v, want ErrUnavailable", err)
	}
}
