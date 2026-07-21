// Command mcp is the warehouse MCP server. It exposes read tools over stdio,
// backed by HTTP calls to the running backend. It is meant to be launched over
// SSH from a workstation (see PLAN-mcp-ssh.md) — stdin/stdout carry the MCP
// protocol, so all logging goes to stderr.
package main

import (
	"context"
	"log"
	"os"

	"github.com/antti/home-warehouse/go-backend/internal/mcp"
	mcpsdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

func main() {
	base := envOr("WAREHOUSE_MCP_URL", "http://localhost:8080")
	user := os.Getenv("WAREHOUSE_MCP_USER")
	pass := os.Getenv("WAREHOUSE_MCP_PASS")
	workspace := os.Getenv("WAREHOUSE_MCP_WORKSPACE_ID")
	if user == "" || pass == "" || workspace == "" {
		log.Fatal("mcp: set WAREHOUSE_MCP_USER, WAREHOUSE_MCP_PASS, and WAREHOUSE_MCP_WORKSPACE_ID")
	}

	client := mcp.New(base, user, pass, workspace)
	srv := mcpsdk.NewServer(&mcpsdk.Implementation{Name: "warehouse", Version: "0.1.0"}, nil)
	mcp.RegisterTools(srv, client)

	if err := srv.Run(context.Background(), &mcpsdk.StdioTransport{}); err != nil {
		log.Fatalf("mcp: %v", err)
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
