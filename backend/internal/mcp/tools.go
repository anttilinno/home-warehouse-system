package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

// RegisterTools wires the warehouse read tools onto srv, backed by c. Reads
// land first (safe to dogfood); mutations follow once trusted (PLAN-mcp-ssh.md).
func RegisterTools(srv *mcpsdk.Server, c *Client) {
	mcpsdk.AddTool(srv, &mcpsdk.Tool{
		Name:        "item_search",
		Description: "Full-text search items by name, brand, model, or description. Returns matching items and a total count.",
	}, searchHandler(c))

	mcpsdk.AddTool(srv, &mcpsdk.Tool{
		Name:        "item_get",
		Description: "Fetch one item by its UUID.",
	}, getHandler(c))

	mcpsdk.AddTool(srv, &mcpsdk.Tool{
		Name:        "item_lookup_barcode",
		Description: "Look up a single item by exact barcode (case-sensitive). Use item_search for partial or fuzzy matches.",
	}, barcodeHandler(c))
}

type searchArgs struct {
	Query string `json:"query" jsonschema:"search text over item name, brand, model, and description"`
	Limit int    `json:"limit,omitempty" jsonschema:"max results, 1-100 (default 50)"`
}

type getArgs struct {
	ID string `json:"id" jsonschema:"item UUID"`
}

type barcodeArgs struct {
	Code string `json:"code" jsonschema:"exact barcode to look up (case-sensitive)"`
}

func searchHandler(c *Client) mcpsdk.ToolHandlerFor[searchArgs, any] {
	return func(ctx context.Context, _ *mcpsdk.CallToolRequest, in searchArgs) (*mcpsdk.CallToolResult, any, error) {
		q := url.Values{}
		q.Set("q", in.Query)
		if in.Limit > 0 {
			q.Set("limit", fmt.Sprintf("%d", in.Limit))
		}
		return proxyGET(ctx, c, c.WsPath("/items/search")+"?"+q.Encode())
	}
}

func getHandler(c *Client) mcpsdk.ToolHandlerFor[getArgs, any] {
	return func(ctx context.Context, _ *mcpsdk.CallToolRequest, in getArgs) (*mcpsdk.CallToolResult, any, error) {
		return proxyGET(ctx, c, c.WsPath("/items/"+url.PathEscape(in.ID)))
	}
}

func barcodeHandler(c *Client) mcpsdk.ToolHandlerFor[barcodeArgs, any] {
	return func(ctx context.Context, _ *mcpsdk.CallToolRequest, in barcodeArgs) (*mcpsdk.CallToolResult, any, error) {
		return proxyGET(ctx, c, c.WsPath("/items/by-barcode/"+url.PathEscape(in.Code)))
	}
}

// proxyGET calls the backend and returns its raw JSON body as MCP text content.
// A backend/transport failure is returned as a tool error (IsError) so the
// agent sees the message rather than the whole call aborting. Passing the JSON
// through verbatim avoids re-modeling ItemResponse's ~27 fields and survives
// backend additions to it.
func proxyGET(ctx context.Context, c *Client, path string) (*mcpsdk.CallToolResult, any, error) {
	var raw json.RawMessage
	if err := c.Do(ctx, http.MethodGet, path, nil, &raw); err != nil {
		return &mcpsdk.CallToolResult{
			IsError: true,
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: err.Error()}},
		}, nil, nil
	}
	return &mcpsdk.CallToolResult{
		Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(raw)}},
	}, nil, nil
}
