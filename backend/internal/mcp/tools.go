package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

// RegisterTools wires the warehouse tools onto srv, backed by c. Reads landed
// first (safe to dogfood); the mutations below followed once reads were trusted
// (PLAN-mcp-ssh.md step 7). Every tool inherits the backend's per-workspace
// authorization — the service account writes exactly what that user could.
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

	mcpsdk.AddTool(srv, &mcpsdk.Tool{
		Name:        "item_create",
		Description: "Create a new item. sku and name are required; sku must be unique in the workspace. Returns the created item.",
	}, createHandler(c))

	mcpsdk.AddTool(srv, &mcpsdk.Tool{
		Name:        "item_update",
		Description: "Update fields on an existing item by UUID. Only the fields you pass are changed; omitted fields are left as-is. Returns the updated item.",
	}, updateHandler(c))

	mcpsdk.AddTool(srv, &mcpsdk.Tool{
		Name:        "inventory_move",
		Description: "Move an inventory entry (by UUID) to a new location, optionally into a container. Returns the updated inventory entry.",
	}, moveHandler(c))
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

// createArgs mirrors the backend POST /items body. It is sent through verbatim,
// so its json keys must match the handler's CreateItemInput.Body. Optional
// fields are pointers with omitempty: an unset field is dropped from the body
// rather than sent as a zero value the backend would treat as intentional.
type createArgs struct {
	SKU          string  `json:"sku" jsonschema:"stock keeping unit (required, unique in workspace)"`
	Name         string  `json:"name" jsonschema:"item name (required)"`
	Description  *string `json:"description,omitempty" jsonschema:"item description"`
	Brand        *string `json:"brand,omitempty" jsonschema:"brand name"`
	Model        *string `json:"model,omitempty" jsonschema:"model name or number"`
	Barcode      *string `json:"barcode,omitempty" jsonschema:"barcode or UPC"`
	SerialNumber *string `json:"serial_number,omitempty" jsonschema:"serial number"`
	Manufacturer *string `json:"manufacturer,omitempty" jsonschema:"manufacturer name"`
}

// updateArgs carries the item UUID (path) plus the patchable fields (body). ID
// is split out in the handler so it never leaks into the PATCH body.
type updateArgs struct {
	ID           string  `json:"id" jsonschema:"item UUID to update (required)"`
	Name         *string `json:"name,omitempty" jsonschema:"item name"`
	Description  *string `json:"description,omitempty" jsonschema:"item description"`
	Brand        *string `json:"brand,omitempty" jsonschema:"brand name"`
	Model        *string `json:"model,omitempty" jsonschema:"model name or number"`
	Barcode      *string `json:"barcode,omitempty" jsonschema:"barcode or UPC"`
	SerialNumber *string `json:"serial_number,omitempty" jsonschema:"serial number"`
	NeedsReview  *bool   `json:"needs_review,omitempty" jsonschema:"whether the item needs review"`
}

// moveArgs carries the inventory UUID (path) plus the move target (body).
type moveArgs struct {
	InventoryID string  `json:"inventory_id" jsonschema:"inventory entry UUID to move (required)"`
	LocationID  string  `json:"location_id" jsonschema:"destination location UUID (required)"`
	ContainerID *string `json:"container_id,omitempty" jsonschema:"optional destination container UUID"`
}

func searchHandler(c *Client) mcpsdk.ToolHandlerFor[searchArgs, any] {
	return func(ctx context.Context, _ *mcpsdk.CallToolRequest, in searchArgs) (*mcpsdk.CallToolResult, any, error) {
		q := url.Values{}
		q.Set("q", in.Query)
		if in.Limit > 0 {
			q.Set("limit", fmt.Sprintf("%d", in.Limit))
		}
		return proxy(ctx, c, http.MethodGet, c.WsPath("/items/search")+"?"+q.Encode(), nil)
	}
}

func getHandler(c *Client) mcpsdk.ToolHandlerFor[getArgs, any] {
	return func(ctx context.Context, _ *mcpsdk.CallToolRequest, in getArgs) (*mcpsdk.CallToolResult, any, error) {
		return proxy(ctx, c, http.MethodGet, c.WsPath("/items/"+url.PathEscape(in.ID)), nil)
	}
}

func barcodeHandler(c *Client) mcpsdk.ToolHandlerFor[barcodeArgs, any] {
	return func(ctx context.Context, _ *mcpsdk.CallToolRequest, in barcodeArgs) (*mcpsdk.CallToolResult, any, error) {
		return proxy(ctx, c, http.MethodGet, c.WsPath("/items/by-barcode/"+url.PathEscape(in.Code)), nil)
	}
}

func createHandler(c *Client) mcpsdk.ToolHandlerFor[createArgs, any] {
	return func(ctx context.Context, _ *mcpsdk.CallToolRequest, in createArgs) (*mcpsdk.CallToolResult, any, error) {
		// createArgs already matches the backend body 1:1 — send it as-is.
		return proxy(ctx, c, http.MethodPost, c.WsPath("/items"), in)
	}
}

func updateHandler(c *Client) mcpsdk.ToolHandlerFor[updateArgs, any] {
	return func(ctx context.Context, _ *mcpsdk.CallToolRequest, in updateArgs) (*mcpsdk.CallToolResult, any, error) {
		// Drop ID (a path param) from the body; forward only patchable fields.
		body := struct {
			Name         *string `json:"name,omitempty"`
			Description  *string `json:"description,omitempty"`
			Brand        *string `json:"brand,omitempty"`
			Model        *string `json:"model,omitempty"`
			Barcode      *string `json:"barcode,omitempty"`
			SerialNumber *string `json:"serial_number,omitempty"`
			NeedsReview  *bool   `json:"needs_review,omitempty"`
		}{in.Name, in.Description, in.Brand, in.Model, in.Barcode, in.SerialNumber, in.NeedsReview}
		return proxy(ctx, c, http.MethodPatch, c.WsPath("/items/"+url.PathEscape(in.ID)), body)
	}
}

func moveHandler(c *Client) mcpsdk.ToolHandlerFor[moveArgs, any] {
	return func(ctx context.Context, _ *mcpsdk.CallToolRequest, in moveArgs) (*mcpsdk.CallToolResult, any, error) {
		body := struct {
			LocationID  string  `json:"location_id"`
			ContainerID *string `json:"container_id,omitempty"`
		}{in.LocationID, in.ContainerID}
		return proxy(ctx, c, http.MethodPost, c.WsPath("/inventory/"+url.PathEscape(in.InventoryID)+"/move"), body)
	}
}

// proxy calls the backend and returns its raw JSON body as MCP text content. A
// nil body sends no request body (reads). A backend/transport failure is
// returned as a tool error (IsError) so the agent sees the message rather than
// the whole call aborting. Passing the JSON through verbatim avoids re-modeling
// ItemResponse's ~27 fields and survives backend additions to it.
func proxy(ctx context.Context, c *Client, method, path string, body any) (*mcpsdk.CallToolResult, any, error) {
	var raw json.RawMessage
	if err := c.Do(ctx, method, path, body, &raw); err != nil {
		return &mcpsdk.CallToolResult{
			IsError: true,
			Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: err.Error()}},
		}, nil, nil
	}
	return &mcpsdk.CallToolResult{
		Content: []mcpsdk.Content{&mcpsdk.TextContent{Text: string(raw)}},
	}, nil, nil
}
