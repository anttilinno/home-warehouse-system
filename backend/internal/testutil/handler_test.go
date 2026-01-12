package testutil

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHandlerTestSetup(t *testing.T) {
	setup := NewHandlerTestSetup()

	assert.NotNil(t, setup.Router)
	assert.NotNil(t, setup.API)
	assert.NotEqual(t, "", setup.WorkspaceID.String())
	assert.NotEqual(t, "", setup.UserID.String())
}

func TestHandlerTestSetup_Request(t *testing.T) {
	setup := NewHandlerTestSetup()

	// Register a test route
	setup.Router.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message":"ok"}`))
	})

	rec := setup.Get("/test")

	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestParseJSONResponse(t *testing.T) {
	setup := NewHandlerTestSetup()

	setup.Router.Get("/json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"id":"123","name":"test"}`))
	})

	rec := setup.Get("/json")

	type Response struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	response := ParseJSONResponse[Response](t, rec)
	assert.Equal(t, "123", response.ID)
	assert.Equal(t, "test", response.Name)
}

func TestAssertStatus(t *testing.T) {
	setup := NewHandlerTestSetup()

	setup.Router.Get("/ok", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	rec := setup.Get("/ok")
	AssertStatus(t, rec, http.StatusOK)
}

func TestAssertErrorResponse(t *testing.T) {
	setup := NewHandlerTestSetup()

	setup.Router.Get("/error", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error":"BadRequest","message":"Invalid input"}`))
	})

	rec := setup.Get("/error")
	AssertErrorResponse(t, rec, http.StatusBadRequest, "Invalid")
}
