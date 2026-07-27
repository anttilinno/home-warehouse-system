package locationphoto_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/locationphoto"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// fakeService records what the handlers ask for and hands back canned answers.
type fakeService struct {
	uploaded  *locationphoto.UploadInput
	photo     *locationphoto.LocationPhoto
	list      []*locationphoto.LocationPhoto
	body      string
	mimeType  string
	uploadErr error
	deleted   []uuid.UUID
}

func (f *fakeService) Upload(_ context.Context, input locationphoto.UploadInput) (*locationphoto.LocationPhoto, error) {
	f.uploaded = &input
	if f.uploadErr != nil {
		return nil, f.uploadErr
	}
	return f.photo, nil
}

func (f *fakeService) ListByLocation(_ context.Context, _, _ uuid.UUID) ([]*locationphoto.LocationPhoto, error) {
	return f.list, nil
}

func (f *fakeService) Get(_ context.Context, id, _ uuid.UUID) (*locationphoto.LocationPhoto, error) {
	if f.photo != nil && f.photo.ID == id {
		return f.photo, nil
	}
	return nil, nil
}

func (f *fakeService) OpenFile(_ context.Context, _ *locationphoto.LocationPhoto) (io.ReadCloser, string, error) {
	return io.NopCloser(strings.NewReader(f.body)), f.mimeType, nil
}

func (f *fakeService) Delete(_ context.Context, id, _ uuid.UUID) error {
	f.deleted = append(f.deleted, id)
	return nil
}

func samplePhoto(wsID uuid.UUID) *locationphoto.LocationPhoto {
	return &locationphoto.LocationPhoto{
		ID:           uuid.MustParse("00000000-0000-0000-0000-0000000000cc"),
		WorkspaceID:  wsID,
		LocationID:   uuid.MustParse("00000000-0000-0000-0000-0000000000dd"),
		FileID:       uuid.MustParse("00000000-0000-0000-0000-0000000000ee"),
		CreatedAt:    time.Unix(0, 0).UTC(),
		OriginalName: "shelf.jpg",
		MimeType:     "image/jpeg",
		SizeBytes:    4,
	}
}

// multipartBody builds a one-part form; contentType is what the part claims.
func multipartBody(t *testing.T, field, filename, contentType, content string) (*bytes.Buffer, string) {
	t.Helper()
	buf := &bytes.Buffer{}
	w := multipart.NewWriter(buf)
	h := make(map[string][]string)
	h["Content-Disposition"] = []string{
		`form-data; name="` + field + `"; filename="` + filename + `"`,
	}
	h["Content-Type"] = []string{contentType}
	part, err := w.CreatePart(h)
	if err != nil {
		t.Fatalf("CreatePart: %v", err)
	}
	if _, err := part.Write([]byte(content)); err != nil {
		t.Fatalf("write part: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	return buf, w.FormDataContentType()
}

func postUpload(t *testing.T, setup *testutil.HandlerTestSetup, locationID uuid.UUID, body *bytes.Buffer, contentType string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost,
		"/locations/"+locationID.String()+"/photos", body)
	req.Header.Set("Content-Type", contentType)
	rec := httptest.NewRecorder()
	setup.Router.ServeHTTP(rec, req)
	return rec
}

func TestUpload(t *testing.T) {
	t.Run("stores an image and echoes the photo", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		svc := &fakeService{photo: samplePhoto(setup.WorkspaceID)}
		locationphoto.RegisterUploadHandler(setup.Router, svc)

		body, ct := multipartBody(t, "photo", "shelf.jpg", "image/jpeg", "JPEG")
		rec := postUpload(t, setup, svc.photo.LocationID, body, ct)

		testutil.AssertStatus(t, rec, http.StatusCreated)
		if svc.uploaded == nil {
			t.Fatal("service was never called")
		}
		if svc.uploaded.LocationID != svc.photo.LocationID {
			t.Fatalf("location = %s, want %s", svc.uploaded.LocationID, svc.photo.LocationID)
		}
		// Workspace comes from context, never from the request body.
		if svc.uploaded.WorkspaceID != setup.WorkspaceID {
			t.Fatalf("workspace = %s, want %s", svc.uploaded.WorkspaceID, setup.WorkspaceID)
		}
		if !strings.Contains(rec.Body.String(), "shelf.jpg") {
			t.Fatalf("response %q missing the file name", rec.Body.String())
		}
	})

	t.Run("rejects a non-image before storing anything", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		svc := &fakeService{photo: samplePhoto(setup.WorkspaceID)}
		locationphoto.RegisterUploadHandler(setup.Router, svc)

		body, ct := multipartBody(t, "photo", "payload.html",
			"text/html", "<script>alert(1)</script>")
		rec := postUpload(t, setup, svc.photo.LocationID, body, ct)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		if svc.uploaded != nil {
			t.Fatal("service was called for a non-image upload")
		}
	})

	t.Run("rejects a missing photo part", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		svc := &fakeService{photo: samplePhoto(setup.WorkspaceID)}
		locationphoto.RegisterUploadHandler(setup.Router, svc)

		body, ct := multipartBody(t, "wrongfield", "shelf.jpg", "image/jpeg", "JPEG")
		rec := postUpload(t, setup, svc.photo.LocationID, body, ct)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		if svc.uploaded != nil {
			t.Fatal("service was called without a photo part")
		}
	})

	t.Run("a storage failure is a 500, not a half-written 201", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		svc := &fakeService{
			photo:     samplePhoto(setup.WorkspaceID),
			uploadErr: errors.New("disk full"),
		}
		locationphoto.RegisterUploadHandler(setup.Router, svc)

		body, ct := multipartBody(t, "photo", "shelf.jpg", "image/jpeg", "JPEG")
		rec := postUpload(t, setup, svc.photo.LocationID, body, ct)

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
	})
}

func TestServe(t *testing.T) {
	t.Run("streams the bytes with the stored mime type", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		svc := &fakeService{
			photo:    samplePhoto(setup.WorkspaceID),
			body:     "JPEG",
			mimeType: "image/jpeg",
		}
		locationphoto.RegisterServeHandler(setup.Router, svc)

		req := httptest.NewRequest(http.MethodGet,
			"/location-photos/"+svc.photo.ID.String()+"/file", nil)
		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		testutil.AssertStatus(t, rec, http.StatusOK)
		if got := rec.Header().Get("Content-Type"); got != "image/jpeg" {
			t.Fatalf("Content-Type = %q, want image/jpeg", got)
		}
		if rec.Body.String() != "JPEG" {
			t.Fatalf("body = %q, want the stored bytes", rec.Body.String())
		}
	})

	t.Run("an unknown id is 404", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		svc := &fakeService{photo: samplePhoto(setup.WorkspaceID)}
		locationphoto.RegisterServeHandler(setup.Router, svc)

		req := httptest.NewRequest(http.MethodGet,
			"/location-photos/"+uuid.New().String()+"/file", nil)
		rec := httptest.NewRecorder()
		setup.Router.ServeHTTP(rec, req)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
	})
}

func TestJSONRoutes(t *testing.T) {
	t.Run("lists a location's photos", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		photo := samplePhoto(setup.WorkspaceID)
		svc := &fakeService{photo: photo, list: []*locationphoto.LocationPhoto{photo}}
		locationphoto.RegisterRoutes(setup.API, svc)

		rec := setup.Get("/locations/" + photo.LocationID.String() + "/photos")

		testutil.AssertStatus(t, rec, http.StatusOK)
		body := rec.Body.String()
		if !strings.Contains(body, "shelf.jpg") {
			t.Fatalf("response %q missing the photo", body)
		}
		// The URL must be the serve route the SPA can render directly.
		if !strings.Contains(body, "/location-photos/"+photo.ID.String()+"/file") {
			t.Fatalf("response %q missing the file URL", body)
		}
	})

	t.Run("delete removes a known photo", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		photo := samplePhoto(setup.WorkspaceID)
		svc := &fakeService{photo: photo}
		locationphoto.RegisterRoutes(setup.API, svc)

		rec := setup.Request(http.MethodDelete, "/location-photos/"+photo.ID.String(), "")

		if rec.Code != http.StatusOK && rec.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want 200/204", rec.Code)
		}
		if len(svc.deleted) != 1 || svc.deleted[0] != photo.ID {
			t.Fatalf("deleted = %v, want [%s]", svc.deleted, photo.ID)
		}
	})

	t.Run("delete of an unknown id is 404 and deletes nothing", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		svc := &fakeService{photo: samplePhoto(setup.WorkspaceID)}
		locationphoto.RegisterRoutes(setup.API, svc)

		rec := setup.Request(http.MethodDelete, "/location-photos/"+uuid.New().String(), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		if len(svc.deleted) != 0 {
			t.Fatalf("deleted = %v, want none", svc.deleted)
		}
	})
}
