// Package mcp holds the warehouse MCP server: a thin HTTP client to the
// running backend plus the tool definitions that call it (see PLAN-mcp-ssh.md).
//
// The client uses the same JWT the browser gets from POST /auth/login, but
// sends it via the Authorization: Bearer header rather than a cookie. The
// backend accepts that (internal/api/middleware/auth.go extractToken) and
// Bearer requests skip CSRF (internal/api/middleware/csrf.go), so no cookie jar
// or CSRF token plumbing is needed. Real backend routes live at root
// (/auth/login, /workspaces/{id}/...) — the /api prefix is only the frontend's
// Vite dev proxy.
package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Sentinel errors. Tool handlers map these to MCP errors.
var (
	// ErrAuth means the service-account credentials were rejected (401 at
	// login, or a 401 that persisted after a fresh re-login).
	ErrAuth = errors.New("mcp: login rejected (check WAREHOUSE_MCP_USER/WAREHOUSE_MCP_PASS)")
	// ErrUnavailable means the backend was unreachable or answered with an
	// unexpected status.
	ErrUnavailable = errors.New("mcp: backend unavailable")
)

const defaultTimeout = 15 * time.Second

// Client is a thin, workspace-scoped HTTP client to the running backend. It
// logs in lazily, caches the JWT, and re-logs-in once on a 401 (tokens expire).
// Safe for concurrent tool calls: the cached token is mutex-guarded.
type Client struct {
	baseURL     string
	workspaceID string
	email       string
	password    string
	hc          *http.Client

	mu    sync.Mutex
	token string
}

// New builds a client. baseURL is the backend root, e.g. http://localhost:8080.
func New(baseURL, email, password, workspaceID string) *Client {
	return &Client{
		baseURL:     strings.TrimRight(baseURL, "/"),
		workspaceID: workspaceID,
		email:       email,
		password:    password,
		hc:          &http.Client{Timeout: defaultTimeout},
	}
}

// WsPath builds a workspace-scoped path: WsPath("/items") ->
// "/workspaces/<id>/items".
func (c *Client) WsPath(suffix string) string {
	return "/workspaces/" + c.workspaceID + suffix
}

// Do issues an authenticated request to path (root-relative, e.g.
// c.WsPath("/items")). On a 401 it re-logs in once and retries. When out is
// non-nil the JSON response body is decoded into it.
func (c *Client) Do(ctx context.Context, method, path string, in, out any) error {
	c.mu.Lock()
	haveToken := c.token != ""
	c.mu.Unlock()
	if !haveToken {
		if err := c.login(ctx); err != nil {
			return err
		}
	}

	resp, err := c.send(ctx, method, path, in)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		if err := c.login(ctx); err != nil {
			return err
		}
		resp, err = c.send(ctx, method, path, in)
		if err != nil {
			return err
		}
		if resp.StatusCode == http.StatusUnauthorized {
			resp.Body.Close()
			return ErrAuth
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("%w: %s %s -> %d", ErrUnavailable, method, path, resp.StatusCode)
	}
	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			return fmt.Errorf("%w: decode response: %v", ErrUnavailable, err)
		}
	}
	return nil
}

// send performs one request with the current cached token. It does not retry.
func (c *Client) send(ctx context.Context, method, path string, in any) (*http.Response, error) {
	var body io.Reader
	if in != nil {
		b, err := json.Marshal(in)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	tok := c.token
	c.mu.Unlock()
	req.Header.Set("Authorization", "Bearer "+tok)
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	return resp, nil
}

// login exchanges the service-account credentials for a fresh JWT and caches
// it. ponytail: login-on-401 rather than the refresh-token flow — one extra
// Authenticate call per token expiry, not worth the second code path for a
// single-user homelab MCP. Add refresh if login latency ever bites.
func (c *Client) login(ctx context.Context) error {
	creds := map[string]string{"email": c.email, "password": c.password}
	b, err := json.Marshal(creds)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/auth/login", bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return ErrAuth
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: login -> %d", ErrUnavailable, resp.StatusCode)
	}
	var lr struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&lr); err != nil {
		return fmt.Errorf("%w: decode login: %v", ErrUnavailable, err)
	}
	if lr.Token == "" {
		return ErrAuth
	}
	c.mu.Lock()
	c.token = lr.Token
	c.mu.Unlock()
	return nil
}
