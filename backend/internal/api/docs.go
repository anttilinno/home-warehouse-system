package api

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
	"net/http"
)

// RegisterDocsRoutes registers additional documentation routes on the chi router.
// The standard /docs and /openapi.json are already provided by Huma.
// This adds alternative documentation UIs.
func RegisterDocsRoutes(r chi.Router) {
	// Swagger UI is available via the default Huma docs at /docs
	// This provides an alternative Redoc UI
	r.Get("/redoc", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(redocHTML))
	})
}

// redocHTML provides a Redoc documentation UI
const redocHTML = `<!DOCTYPE html>
<html>
  <head>
    <title>Home Warehouse API Documentation</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url='/openapi.json'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`

// GetOpenAPIInfo returns the OpenAPI info for the API.
func GetOpenAPIInfo() *huma.Info {
	return &huma.Info{
		Title:       "Home Warehouse API",
		Version:     "1.0.0",
		Description: APIDescription,
		Contact: &huma.Contact{
			Name:  "Home Warehouse Team",
			Email: "support@example.com",
		},
		License: &huma.License{
			Name: "MIT",
			URL:  "https://opensource.org/licenses/MIT",
		},
	}
}

// APIDescription is the full API description for OpenAPI docs.
const APIDescription = `
# Home Warehouse API

A comprehensive inventory management system for home and small business use.

## Features

- **User Authentication**: JWT-based authentication with refresh tokens
- **Workspace Management**: Multi-tenant workspace support
- **Inventory Management**: Track items, quantities, and locations
- **Loan Tracking**: Track borrowed items and due dates
- **Location Hierarchy**: Organize items by location with parent-child relationships
- **Category Management**: Categorize items with hierarchical categories
- **PWA Support**: Offline-first with sync capabilities
- **Barcode Lookup**: Lookup product information via barcode

## Authentication

Most endpoints require authentication via JWT bearer token.

` + "```" + `
Authorization: Bearer <your-jwt-token>
` + "```" + `

## Quick Start

1. Register a new user: ` + "`POST /auth/register`" + `
2. Login to get tokens: ` + "`POST /auth/login`" + `
3. Create a workspace: ` + "`POST /workspaces`" + `
4. Start managing inventory!

## API Groups

- **Auth**: User registration, login, and token management
- **Users**: User profile and preferences
- **Workspaces**: Workspace CRUD and member management
- **Categories**: Item categorization
- **Locations**: Physical location management
- **Containers**: Storage containers within locations
- **Items**: Item definitions
- **Inventory**: Stock levels and movements
- **Borrowers**: People who borrow items
- **Loans**: Track borrowed items
- **Activity**: Audit log
- **Analytics**: Dashboard and statistics
- **Sync**: PWA offline sync support
`
