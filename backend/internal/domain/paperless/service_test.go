package paperless

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	infrapaperless "github.com/antti/home-warehouse/go-backend/internal/infra/paperless"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/shared/crypto"
)

// --- fakes ---

type fakeRepo struct {
	stored    *StoredSettings
	getErr    error
	upsertErr error
	deleteErr error

	gotUpsert    UpsertParams
	deleteCalled bool
}

func (f *fakeRepo) Get(_ context.Context, _ uuid.UUID) (*StoredSettings, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	if f.stored == nil {
		return nil, shared.ErrNotFound
	}
	return f.stored, nil
}

func (f *fakeRepo) Upsert(_ context.Context, params UpsertParams) (*StoredSettings, error) {
	f.gotUpsert = params
	if f.upsertErr != nil {
		return nil, f.upsertErr
	}
	return &StoredSettings{
		WorkspaceID:       params.WorkspaceID,
		BaseURL:           params.BaseURL,
		APITokenEncrypted: params.APITokenEncrypted,
		SyncTagsEnabled:   params.SyncTagsEnabled,
		IsEnabled:         params.IsEnabled,
		UpdatedAt:         time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
	}, nil
}

func (f *fakeRepo) Delete(_ context.Context, _ uuid.UUID) error {
	f.deleteCalled = true
	return f.deleteErr
}

type fakeClient struct {
	doc    *infrapaperless.Document
	docErr error

	searchResult *infrapaperless.SearchResult
	searchErr    error

	gotBaseURL, gotToken string
	gotDocID             int
	gotQuery             string
	gotPage, gotPageSize int
}

func (f *fakeClient) GetDocument(_ context.Context, baseURL, token string, documentID int) (*infrapaperless.Document, error) {
	f.gotBaseURL, f.gotToken, f.gotDocID = baseURL, token, documentID
	if f.docErr != nil {
		return nil, f.docErr
	}
	return f.doc, nil
}

func (f *fakeClient) Search(_ context.Context, baseURL, token, query string, page, pageSize int) (*infrapaperless.SearchResult, error) {
	f.gotBaseURL, f.gotToken, f.gotQuery, f.gotPage, f.gotPageSize = baseURL, token, query, page, pageSize
	if f.searchErr != nil {
		return nil, f.searchErr
	}
	return f.searchResult, nil
}

// --- helpers ---

const testKeyMaterial = "test-key-material"

func newTestEncryptor(t *testing.T) *crypto.Encryptor {
	t.Helper()
	enc, err := crypto.NewEncryptor(testKeyMaterial)
	if err != nil {
		t.Fatalf("NewEncryptor: %v", err)
	}
	return enc
}

func encryptedToken(t *testing.T, enc *crypto.Encryptor, token string) string {
	t.Helper()
	ciphertext, err := enc.Encrypt(token)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	return ciphertext
}

var testWorkspaceID = uuid.New()

func enabledStored(t *testing.T, enc *crypto.Encryptor, baseURL, token string) *StoredSettings {
	t.Helper()
	return &StoredSettings{
		WorkspaceID:       testWorkspaceID,
		BaseURL:           baseURL,
		APITokenEncrypted: encryptedToken(t, enc, token),
		IsEnabled:         true,
	}
}

// --- GetSettings ---

func TestGetSettings_NotConfigured(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, nil)

	_, err := svc.GetSettings(context.Background(), testWorkspaceID)
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("err = %v, want ErrNotConfigured", err)
	}
}

func TestGetSettings_RepoError(t *testing.T) {
	wantErr := errors.New("db down")
	svc := NewService(&fakeRepo{getErr: wantErr}, &fakeClient{}, nil)

	_, err := svc.GetSettings(context.Background(), testWorkspaceID)
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want %v", err, wantErr)
	}
}

func TestGetSettings_Success(t *testing.T) {
	enc := newTestEncryptor(t)
	last := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	repo := &fakeRepo{stored: &StoredSettings{
		BaseURL:           "https://paperless.example.com",
		APITokenEncrypted: encryptedToken(t, enc, "secret"),
		SyncTagsEnabled:   true,
		IsEnabled:         true,
		LastSyncAt:        &last,
	}}
	svc := NewService(repo, &fakeClient{}, enc)

	got, err := svc.GetSettings(context.Background(), testWorkspaceID)
	if err != nil {
		t.Fatalf("GetSettings: %v", err)
	}
	if got.BaseURL != "https://paperless.example.com" || !got.HasToken || !got.SyncTagsEnabled || !got.IsEnabled {
		t.Errorf("unexpected settings: %+v", got)
	}
	if got.LastSyncAt == nil || !got.LastSyncAt.Equal(last) {
		t.Errorf("LastSyncAt = %v, want %v", got.LastSyncAt, last)
	}
}

// --- SaveSettings ---

func TestSaveSettings_InvalidBaseURL(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, newTestEncryptor(t))

	tests := []string{"", "   ", "ftp://example.com", "not-a-url", "https://"}
	for _, raw := range tests {
		_, err := svc.SaveSettings(context.Background(), testWorkspaceID, SaveSettingsInput{BaseURL: raw})
		if !errors.Is(err, ErrInvalidBaseURL) {
			t.Errorf("SaveSettings(%q) err = %v, want ErrInvalidBaseURL", raw, err)
		}
	}
}

func TestSaveSettings_FirstSaveWithoutToken(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, newTestEncryptor(t))

	_, err := svc.SaveSettings(context.Background(), testWorkspaceID, SaveSettingsInput{BaseURL: "https://p.example.com"})
	if !errors.Is(err, ErrTokenRequired) {
		t.Fatalf("err = %v, want ErrTokenRequired", err)
	}
}

func TestSaveSettings_FirstSaveWithToken_NoEncryptor(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, nil)

	token := "tok"
	_, err := svc.SaveSettings(context.Background(), testWorkspaceID, SaveSettingsInput{
		BaseURL:  "https://p.example.com",
		APIToken: &token,
	})
	if !errors.Is(err, ErrEncryptionKeyMissing) {
		t.Fatalf("err = %v, want ErrEncryptionKeyMissing", err)
	}
}

func TestSaveSettings_FirstSaveWithToken_Success(t *testing.T) {
	repo := &fakeRepo{}
	enc := newTestEncryptor(t)
	svc := NewService(repo, &fakeClient{}, enc)

	token := "tok_new"
	got, err := svc.SaveSettings(context.Background(), testWorkspaceID, SaveSettingsInput{
		BaseURL:         "https://p.example.com/",
		APIToken:        &token,
		SyncTagsEnabled: true,
		IsEnabled:       true,
	})
	if err != nil {
		t.Fatalf("SaveSettings: %v", err)
	}
	if got.BaseURL != "https://p.example.com" {
		t.Errorf("BaseURL = %q, want trailing slash trimmed", got.BaseURL)
	}
	if repo.gotUpsert.WorkspaceID != testWorkspaceID {
		t.Errorf("Upsert workspace = %v, want %v", repo.gotUpsert.WorkspaceID, testWorkspaceID)
	}
	decrypted, err := enc.Decrypt(repo.gotUpsert.APITokenEncrypted)
	if err != nil || decrypted != token {
		t.Errorf("stored token decrypt = %q, %v; want %q", decrypted, err, token)
	}
}

func TestSaveSettings_OmitTokenKeepsExisting(t *testing.T) {
	enc := newTestEncryptor(t)
	existingEncrypted := encryptedToken(t, enc, "already-stored")
	repo := &fakeRepo{stored: &StoredSettings{
		WorkspaceID:       testWorkspaceID,
		BaseURL:           "https://old.example.com",
		APITokenEncrypted: existingEncrypted,
		IsEnabled:         true,
	}}
	svc := NewService(repo, &fakeClient{}, enc)

	_, err := svc.SaveSettings(context.Background(), testWorkspaceID, SaveSettingsInput{
		BaseURL:   "https://new.example.com",
		IsEnabled: true,
	})
	if err != nil {
		t.Fatalf("SaveSettings: %v", err)
	}
	if repo.gotUpsert.APITokenEncrypted != existingEncrypted {
		t.Errorf("token was replaced, want kept as-is")
	}
}

func TestSaveSettings_RepoGetErrorNotNotFound(t *testing.T) {
	wantErr := errors.New("db down")
	svc := NewService(&fakeRepo{getErr: wantErr}, &fakeClient{}, newTestEncryptor(t))

	token := "tok"
	_, err := svc.SaveSettings(context.Background(), testWorkspaceID, SaveSettingsInput{
		BaseURL:  "https://p.example.com",
		APIToken: &token,
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want %v", err, wantErr)
	}
}

func TestSaveSettings_UpsertError(t *testing.T) {
	wantErr := errors.New("insert failed")
	svc := NewService(&fakeRepo{upsertErr: wantErr}, &fakeClient{}, newTestEncryptor(t))

	token := "tok"
	_, err := svc.SaveSettings(context.Background(), testWorkspaceID, SaveSettingsInput{
		BaseURL:  "https://p.example.com",
		APIToken: &token,
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want %v", err, wantErr)
	}
}

// --- DeleteSettings ---

func TestDeleteSettings(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo, &fakeClient{}, nil)

	if err := svc.DeleteSettings(context.Background(), testWorkspaceID); err != nil {
		t.Fatalf("DeleteSettings: %v", err)
	}
	if !repo.deleteCalled {
		t.Error("repo.Delete was not called")
	}
}

func TestDeleteSettings_Error(t *testing.T) {
	wantErr := errors.New("db down")
	svc := NewService(&fakeRepo{deleteErr: wantErr}, &fakeClient{}, nil)

	if err := svc.DeleteSettings(context.Background(), testWorkspaceID); !errors.Is(err, wantErr) {
		t.Fatalf("err = %v, want %v", err, wantErr)
	}
}

// --- connection() via Search / ResolveDocument ---

func TestSearch_NotConfigured(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, newTestEncryptor(t))

	_, err := svc.Search(context.Background(), testWorkspaceID, "q", 1, 20)
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("err = %v, want ErrNotConfigured", err)
	}
}

func TestSearch_NotEnabled(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: &StoredSettings{
		BaseURL:           "https://p.example.com",
		APITokenEncrypted: encryptedToken(t, enc, "tok"),
		IsEnabled:         false,
	}}
	svc := NewService(repo, &fakeClient{}, enc)

	_, err := svc.Search(context.Background(), testWorkspaceID, "q", 1, 20)
	if !errors.Is(err, ErrNotEnabled) {
		t.Fatalf("err = %v, want ErrNotEnabled", err)
	}
}

func TestSearch_EncryptorMissing(t *testing.T) {
	repo := &fakeRepo{stored: &StoredSettings{
		BaseURL:           "https://p.example.com",
		APITokenEncrypted: "irrelevant-because-no-encryptor",
		IsEnabled:         true,
	}}
	svc := NewService(repo, &fakeClient{}, nil)

	_, err := svc.Search(context.Background(), testWorkspaceID, "q", 1, 20)
	if !errors.Is(err, ErrEncryptionKeyMissing) {
		t.Fatalf("err = %v, want ErrEncryptionKeyMissing", err)
	}
}

func TestSearch_DecryptFailure(t *testing.T) {
	// Encrypted with a different key than the service's encryptor -> GCM auth fails.
	otherEnc, err := crypto.NewEncryptor("a-different-key")
	if err != nil {
		t.Fatalf("NewEncryptor: %v", err)
	}
	repo := &fakeRepo{stored: &StoredSettings{
		BaseURL:           "https://p.example.com",
		APITokenEncrypted: encryptedToken(t, otherEnc, "tok"),
		IsEnabled:         true,
	}}
	svc := NewService(repo, &fakeClient{}, newTestEncryptor(t))

	_, err = svc.Search(context.Background(), testWorkspaceID, "q", 1, 20)
	if !errors.Is(err, crypto.ErrInvalidCiphertext) {
		t.Fatalf("err = %v, want ErrInvalidCiphertext", err)
	}
}

func TestSearch_Success(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: enabledStored(t, enc, "https://p.example.com/", "tok")}
	client := &fakeClient{searchResult: &infrapaperless.SearchResult{Count: 1}}
	svc := NewService(repo, client, enc)

	_, err := svc.Search(context.Background(), testWorkspaceID, "warranty", 2, 10)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if client.gotBaseURL != "https://p.example.com" {
		t.Errorf("baseURL passed to client = %q, want trailing slash trimmed", client.gotBaseURL)
	}
	if client.gotToken != "tok" || client.gotQuery != "warranty" || client.gotPage != 2 || client.gotPageSize != 10 {
		t.Errorf("unexpected client call: %+v", client)
	}
}

func TestSearch_ClientError(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: enabledStored(t, enc, "https://p.example.com", "tok")}
	client := &fakeClient{searchErr: infrapaperless.ErrUnavailable}
	svc := NewService(repo, client, enc)

	_, err := svc.Search(context.Background(), testWorkspaceID, "q", 1, 20)
	if !errors.Is(err, infrapaperless.ErrUnavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	}
}

// --- ResolveDocument ---

func TestResolveDocument_NotConfigured(t *testing.T) {
	svc := NewService(&fakeRepo{}, &fakeClient{}, newTestEncryptor(t))

	_, err := svc.ResolveDocument(context.Background(), testWorkspaceID, 42)
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("err = %v, want ErrNotConfigured", err)
	}
}

func TestResolveDocument_ClientNotFound(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: enabledStored(t, enc, "https://p.example.com", "tok")}
	client := &fakeClient{docErr: infrapaperless.ErrDocumentNotFound}
	svc := NewService(repo, client, enc)

	_, err := svc.ResolveDocument(context.Background(), testWorkspaceID, 999)
	if !errors.Is(err, infrapaperless.ErrDocumentNotFound) {
		t.Fatalf("err = %v, want ErrDocumentNotFound", err)
	}
}

func TestResolveDocument_Success(t *testing.T) {
	enc := newTestEncryptor(t)
	repo := &fakeRepo{stored: enabledStored(t, enc, "https://p.example.com", "tok")}
	created := "2026-01-15"
	fileName := "receipt.pdf"
	client := &fakeClient{doc: &infrapaperless.Document{
		ID:               42,
		Title:            "Receipt",
		Created:          &created,
		OriginalFileName: &fileName,
	}}
	svc := NewService(repo, client, enc)

	got, err := svc.ResolveDocument(context.Background(), testWorkspaceID, 42)
	if err != nil {
		t.Fatalf("ResolveDocument: %v", err)
	}
	if client.gotDocID != 42 || client.gotToken != "tok" {
		t.Errorf("unexpected client call: %+v", client)
	}
	if got.DownloadURL != "https://p.example.com/api/documents/42/download/" {
		t.Errorf("DownloadURL = %q", got.DownloadURL)
	}
	if got.PreviewURL != "https://p.example.com/api/documents/42/preview/" {
		t.Errorf("PreviewURL = %q", got.PreviewURL)
	}
	if got.WebURL != "https://p.example.com/documents/42/details" {
		t.Errorf("WebURL = %q", got.WebURL)
	}
	if got.Title != "Receipt" || got.Created == nil || *got.Created != created {
		t.Errorf("unexpected details: %+v", got)
	}
}
