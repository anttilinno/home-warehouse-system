package importjob

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queue"
)

// UploadHandler handles file upload for import jobs
type UploadHandler struct {
	repo  Repository
	queue *queue.Queue
}

// NewUploadHandler creates a new upload handler
func NewUploadHandler(repo Repository, queue *queue.Queue) *UploadHandler {
	return &UploadHandler{
		repo:  repo,
		queue: queue,
	}
}

// RegisterUploadRoutes registers upload routes on a Chi router
func (h *UploadHandler) RegisterUploadRoutes(r chi.Router) {
	r.Post("/imports/upload", h.HandleUpload)
}

// HandleUpload handles file upload
// POST /imports/upload
func (h *UploadHandler) HandleUpload(w http.ResponseWriter, r *http.Request) {
	// Get workspace and user from context
	workspaceID, ok := appMiddleware.GetWorkspaceID(r.Context())
	if !ok {
		http.Error(w, "workspace context required", http.StatusUnauthorized)
		return
	}

	authUser, ok := appMiddleware.GetAuthUser(r.Context())
	if !ok {
		http.Error(w, "user context required", http.StatusUnauthorized)
		return
	}
	userID := authUser.ID

	// Parse multipart form (10MB limit)
	if err := r.ParseMultipartForm(MaxFileSize); err != nil {
		http.Error(w, "file too large", http.StatusBadRequest)
		return
	}

	// Get entity type
	entityTypeStr := r.FormValue("entity_type")
	if entityTypeStr == "" {
		http.Error(w, "entity_type is required", http.StatusBadRequest)
		return
	}
	entityType := EntityType(entityTypeStr)

	// Validate entity type
	if entityType != EntityTypeItems && entityType != EntityTypeInventory &&
		entityType != EntityTypeLocations && entityType != EntityTypeContainers &&
		entityType != EntityTypeCategories && entityType != EntityTypeBorrowers {
		http.Error(w, "invalid entity_type", http.StatusBadRequest)
		return
	}

	// Get file from form
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != AllowedCSVExt {
		http.Error(w, "only CSV files are supported", http.StatusBadRequest)
		return
	}

	// Validate file size
	if header.Size > MaxFileSize {
		http.Error(w, "file size exceeds maximum allowed (10MB)", http.StatusBadRequest)
		return
	}

	// Create upload directory if it doesn't exist
	if err := os.MkdirAll(UploadDir, 0755); err != nil {
		http.Error(w, "failed to create upload directory", http.StatusInternalServerError)
		return
	}

	// Generate unique filename
	filename := fmt.Sprintf("%s_%s%s", uuid.New().String(), "import", ext)
	filePath := filepath.Join(UploadDir, filename)

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		os.Remove(filePath)
		http.Error(w, "failed to save file", http.StatusInternalServerError)
		return
	}

	// Create import job
	job, err := NewImportJob(workspaceID, userID, entityType, header.Filename, filePath, header.Size)
	if err != nil {
		os.Remove(filePath)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Save job to database
	if err := h.repo.SaveJob(r.Context(), job); err != nil {
		os.Remove(filePath)
		http.Error(w, "failed to create import job", http.StatusInternalServerError)
		return
	}

	// Enqueue job for processing
	_, err = h.queue.Enqueue(r.Context(), "import.process", map[string]any{
		"import_job_id": job.ID().String(),
		"workspace_id":  workspaceID.String(),
	})
	if err != nil {
		http.Error(w, "failed to enqueue import job", http.StatusInternalServerError)
		return
	}

	// Return job response
	response := toImportJobResponse(job)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}
