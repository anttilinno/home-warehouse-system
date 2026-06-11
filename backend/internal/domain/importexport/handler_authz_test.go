package importexport_test

import (
	"encoding/base64"
	"net/http"
	"testing"

	"github.com/antti/home-warehouse/go-backend/internal/domain/importexport"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// F5: members must not reach the import / workspace-restore endpoints —
// they bypass the approval pipeline.
func TestImportExportHandler_MemberForbidden(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	setup.SetRole("member")

	handler := importexport.NewHandler(nil, nil) // services must never be reached
	handler.RegisterRoutes(setup.API)

	payload := base64.StdEncoding.EncodeToString([]byte("name\nWidget"))

	t.Run("entity import is forbidden", func(t *testing.T) {
		rec := setup.Post("/import/item", `{"format":"csv","data":"`+payload+`"}`)
		testutil.AssertStatus(t, rec, http.StatusForbidden)
	})

	t.Run("workspace import is forbidden", func(t *testing.T) {
		rec := setup.Post("/import/workspace", `{"format":"json","data":"`+payload+`"}`)
		testutil.AssertStatus(t, rec, http.StatusForbidden)
	})

	t.Run("workspace export is forbidden", func(t *testing.T) {
		rec := setup.Get("/export/workspace")
		testutil.AssertStatus(t, rec, http.StatusForbidden)
	})
}

func TestImportExportHandler_ViewerForbidden(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	setup.SetRole("viewer")

	handler := importexport.NewHandler(nil, nil)
	handler.RegisterRoutes(setup.API)

	payload := base64.StdEncoding.EncodeToString([]byte("name\nWidget"))
	rec := setup.Post("/import/item", `{"format":"csv","data":"`+payload+`"}`)
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}
