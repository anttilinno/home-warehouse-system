package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// A stale cached token yields a 401; the client must re-login once and retry
// the same request transparently.
func TestClient_ReloginsOnceOn401(t *testing.T) {
	var logins, itemCalls int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/auth/login":
			logins++
			// tok1 on the first login, tok2 on the re-login.
			_ = json.NewEncoder(w).Encode(map[string]string{"token": tokenFor(logins)})
		case "/workspaces/ws1/items":
			itemCalls++
			if r.Header.Get("Authorization") == "Bearer tok1" {
				w.WriteHeader(http.StatusUnauthorized) // simulate expired token
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	c := New(srv.URL, "e@x", "pw", "ws1")
	var out map[string]any
	if err := c.Do(context.Background(), http.MethodGet, c.WsPath("/items"), nil, &out); err != nil {
		t.Fatalf("Do: %v", err)
	}
	if out["ok"] != true {
		t.Fatalf("want ok=true, got %v", out)
	}
	if logins != 2 {
		t.Fatalf("want 2 logins (initial + re-login), got %d", logins)
	}
	if itemCalls != 2 {
		t.Fatalf("want 2 item calls (401 + retry), got %d", itemCalls)
	}
}

// A persistent 401 (server never accepts the token) must surface ErrAuth, not
// an infinite retry loop or a generic error.
func TestClient_PersistentUnauthorized_IsErrAuth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/login" {
			_ = json.NewEncoder(w).Encode(map[string]string{"token": "tok"})
			return
		}
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	c := New(srv.URL, "e@x", "pw", "ws1")
	err := c.Do(context.Background(), http.MethodGet, c.WsPath("/items"), nil, nil)
	if !errors.Is(err, ErrAuth) {
		t.Fatalf("want ErrAuth, got %v", err)
	}
}

// Rejected credentials at login must surface ErrAuth.
func TestClient_BadCredentials_IsErrAuth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	c := New(srv.URL, "e@x", "wrong", "ws1")
	err := c.Do(context.Background(), http.MethodGet, c.WsPath("/items"), nil, nil)
	if !errors.Is(err, ErrAuth) {
		t.Fatalf("want ErrAuth, got %v", err)
	}
}

func tokenFor(n int) string {
	switch n {
	case 1:
		return "tok1"
	default:
		return "tok2"
	}
}
