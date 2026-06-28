// Package paperless is a minimal read-only client for the Paperless-ngx REST
// API (token auth, /api/documents/). It covers exactly what the warehouse
// needs today: resolve a document by id and fulltext search. There is no
// ingest/write path — the ingest direction is deliberately deferred (see
// .planning/ROADMAP.md "DMS Migration").
package paperless

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Sentinel errors mapped from Paperless HTTP responses. Handlers translate
// these to the matching API status codes.
var (
	// ErrUnauthorized means the configured API token was rejected (401/403).
	ErrUnauthorized = errors.New("paperless: invalid or expired API token")
	// ErrDocumentNotFound means the document id does not exist (404).
	ErrDocumentNotFound = errors.New("paperless: document not found")
	// ErrUnavailable means the Paperless instance could not be reached or
	// answered with an unexpected status.
	ErrUnavailable = errors.New("paperless: instance unavailable")
)

const defaultTimeout = 10 * time.Second

// Document is the subset of a Paperless-ngx document the warehouse displays.
type Document struct {
	ID               int     `json:"id"`
	Title            string  `json:"title"`
	Created          *string `json:"created,omitempty"`
	Added            *string `json:"added,omitempty"`
	OriginalFileName *string `json:"original_file_name,omitempty"`
}

// SearchResult is one page of a fulltext search.
type SearchResult struct {
	Count   int        `json:"count"`
	Results []Document `json:"results"`
}

// Client talks to a Paperless-ngx instance. It is stateless with respect to
// the target instance: base URL and token are per-call because each workspace
// can point at a different Paperless.
type Client struct {
	httpClient *http.Client
}

// NewClient returns a Client with a sane default timeout.
func NewClient() *Client {
	return &Client{httpClient: &http.Client{Timeout: defaultTimeout}}
}

// NewClientWithHTTPClient allows injecting a custom *http.Client (tests).
func NewClientWithHTTPClient(httpClient *http.Client) *Client {
	return &Client{httpClient: httpClient}
}

// GetDocument resolves a document id to its metadata.
func (c *Client) GetDocument(ctx context.Context, baseURL, token string, documentID int) (*Document, error) {
	endpoint := fmt.Sprintf("%s/api/documents/%d/", strings.TrimRight(baseURL, "/"), documentID)

	var doc Document
	if err := c.getJSON(ctx, endpoint, token, &doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

// Search runs a fulltext query against /api/documents/?query=.
func (c *Client) Search(ctx context.Context, baseURL, token, query string, page, pageSize int) (*SearchResult, error) {
	params := url.Values{}
	params.Set("query", query)
	if page > 0 {
		params.Set("page", fmt.Sprintf("%d", page))
	}
	if pageSize > 0 {
		params.Set("page_size", fmt.Sprintf("%d", pageSize))
	}
	endpoint := fmt.Sprintf("%s/api/documents/?%s", strings.TrimRight(baseURL, "/"), params.Encode())

	var result SearchResult
	if err := c.getJSON(ctx, endpoint, token, &result); err != nil {
		return nil, err
	}
	if result.Results == nil {
		result.Results = []Document{}
	}
	return &result, nil
}

// getJSON performs an authenticated GET and decodes the JSON body into out,
// mapping HTTP failures to the package sentinel errors.
func (c *Client) getJSON(ctx context.Context, endpoint, token string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("paperless: build request: %w", err)
	}
	req.Header.Set("Authorization", "Token "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return ErrUnauthorized
	case resp.StatusCode == http.StatusNotFound:
		return ErrDocumentNotFound
	case resp.StatusCode != http.StatusOK:
		return fmt.Errorf("%w: unexpected status %d", ErrUnavailable, resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("%w: decode response: %v", ErrUnavailable, err)
	}
	return nil
}
