package paperless

import (
	"context"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	infrapaperless "github.com/antti/home-warehouse/go-backend/internal/infra/paperless"
)

func withWorkspace(id uuid.UUID) context.Context {
	return context.WithValue(context.Background(), appMiddleware.WorkspaceContextKey, id)
}

func humaStatus(t *testing.T, err error) int {
	t.Helper()
	se, ok := err.(huma.StatusError)
	if !ok {
		t.Fatalf("err = %v, not a huma.StatusError", err)
	}
	return se.GetStatus()
}

func TestGetSettingsHandler_NoWorkspace(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, nil)
	_, err := getSettings(svc)(context.Background(), &struct{}{})
	if err == nil || humaStatus(t, err) != 401 {
		t.Fatalf("err = %v, want 401", err)
	}
}

func TestGetSettingsHandler_NotConfigured(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, nil)
	out, err := getSettings(svc)(withWorkspace(testWorkspaceID), &struct{}{})
	if err != nil {
		t.Fatalf("getSettings: %v", err)
	}
	if out.Body.Configured {
		t.Errorf("Configured = true, want false")
	}
}

func TestGetSettingsHandler_Success(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: enabledStored(t, enc, "https://p.example.com", "tok")}
	svc := NewService(repo, &fakeClient{}, enc)

	out, err := getSettings(svc)(withWorkspace(testWorkspaceID), &struct{}{})
	if err != nil {
		t.Fatalf("getSettings: %v", err)
	}
	if !out.Body.Configured || out.Body.BaseURL != "https://p.example.com" || !out.Body.HasToken {
		t.Errorf("unexpected response: %+v", out.Body)
	}
}

func TestSaveSettingsHandler_NoWorkspace(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, nil)
	input := &SaveSettingsInputBody{}
	input.Body.BaseURL = "https://p.example.com"
	_, err := saveSettings(svc)(context.Background(), input)
	if err == nil || humaStatus(t, err) != 401 {
		t.Fatalf("err = %v, want 401", err)
	}
}

func TestSaveSettingsHandler_InvalidBaseURL(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, newTestEncryptor(t))
	input := &SaveSettingsInputBody{}
	input.Body.BaseURL = "not-a-url"
	_, err := saveSettings(svc)(withWorkspace(testWorkspaceID), input)
	if err == nil || humaStatus(t, err) != 400 {
		t.Fatalf("err = %v, want 400", err)
	}
}

func TestSaveSettingsHandler_EncryptionKeyMissing(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, nil)
	token := "tok"
	input := &SaveSettingsInputBody{}
	input.Body.BaseURL = "https://p.example.com"
	input.Body.APIToken = &token
	_, err := saveSettings(svc)(withWorkspace(testWorkspaceID), input)
	if err == nil || humaStatus(t, err) != 503 {
		t.Fatalf("err = %v, want 503", err)
	}
}

func TestSaveSettingsHandler_Success(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, newTestEncryptor(t))
	token := "tok"
	input := &SaveSettingsInputBody{}
	input.Body.BaseURL = "https://p.example.com"
	input.Body.APIToken = &token
	input.Body.IsEnabled = true

	out, err := saveSettings(svc)(withWorkspace(testWorkspaceID), input)
	if err != nil {
		t.Fatalf("saveSettings: %v", err)
	}
	if !out.Body.Configured || out.Body.BaseURL != "https://p.example.com" {
		t.Errorf("unexpected response: %+v", out.Body)
	}
}

func TestDeleteSettingsHandler_NoWorkspace(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, nil)
	_, err := deleteSettings(svc)(context.Background(), &struct{}{})
	if err == nil || humaStatus(t, err) != 401 {
		t.Fatalf("err = %v, want 401", err)
	}
}

func TestDeleteSettingsHandler_Success(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, &fakeClient{}, nil)
	_, err := deleteSettings(svc)(withWorkspace(testWorkspaceID), &struct{}{})
	if err != nil {
		t.Fatalf("deleteSettings: %v", err)
	}
	if !repo.deleteCalled {
		t.Error("repo.Delete was not called")
	}
}

func TestSearchDocumentsHandler_NoWorkspace(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, nil)
	_, err := searchDocuments(svc)(context.Background(), &SearchInput{Query: "q"})
	if err == nil || humaStatus(t, err) != 401 {
		t.Fatalf("err = %v, want 401", err)
	}
}

func TestSearchDocumentsHandler_NotConfigured(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, newTestEncryptor(t))
	_, err := searchDocuments(svc)(withWorkspace(testWorkspaceID), &SearchInput{Query: "q"})
	if err == nil || humaStatus(t, err) != 409 {
		t.Fatalf("err = %v, want 409", err)
	}
}

func TestSearchDocumentsHandler_Success(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: enabledStored(t, enc, "https://p.example.com", "tok")}
	fileName := "receipt.pdf"
	client := &fakeClient{searchResult: &infrapaperless.SearchResult{
		Count:   1,
		Results: []infrapaperless.Document{{ID: 9, Title: "Fridge warranty", OriginalFileName: &fileName}},
	}}
	svc := NewService(repo, client, enc)

	out, err := searchDocuments(svc)(withWorkspace(testWorkspaceID), &SearchInput{Query: "warranty", Page: 1, PageSize: 20})
	if err != nil {
		t.Fatalf("searchDocuments: %v", err)
	}
	if out.Body.Count != 1 || len(out.Body.Results) != 1 || out.Body.Results[0].ID != 9 {
		t.Errorf("unexpected response: %+v", out.Body)
	}
}

func TestResolveDocumentHandler_ClientUnauthorized(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: enabledStored(t, enc, "https://p.example.com", "tok")}
	client := &fakeClient{docErr: infrapaperless.ErrUnauthorized}
	svc := NewService(repo, client, enc)

	_, err := resolveDocument(svc)(withWorkspace(testWorkspaceID), &ResolveDocumentInput{ID: 1})
	if err == nil || humaStatus(t, err) != 502 {
		t.Fatalf("err = %v, want 502", err)
	}
}

func TestResolveDocumentHandler_ClientNotFound(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: enabledStored(t, enc, "https://p.example.com", "tok")}
	client := &fakeClient{docErr: infrapaperless.ErrDocumentNotFound}
	svc := NewService(repo, client, enc)

	_, err := resolveDocument(svc)(withWorkspace(testWorkspaceID), &ResolveDocumentInput{ID: 1})
	if err == nil || humaStatus(t, err) != 404 {
		t.Fatalf("err = %v, want 404", err)
	}
}

func TestResolveDocumentHandler_Success(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: enabledStored(t, enc, "https://p.example.com", "tok")}
	client := &fakeClient{doc: &infrapaperless.Document{ID: 42, Title: "Receipt"}}
	svc := NewService(repo, client, enc)

	out, err := resolveDocument(svc)(withWorkspace(testWorkspaceID), &ResolveDocumentInput{ID: 42})
	if err != nil {
		t.Fatalf("resolveDocument: %v", err)
	}
	if out.Body.ID != 42 || out.Body.WebURL != "https://p.example.com/documents/42/details" {
		t.Errorf("unexpected response: %+v", out.Body)
	}
}
