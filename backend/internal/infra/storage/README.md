# Storage Package

The storage package provides a flexible and secure interface for handling file uploads and storage in the Home Warehouse System. It includes comprehensive validation, sanitization, and configuration capabilities.

## Overview

The package is designed with the following principles:
- **Security First**: Path traversal protection, filename sanitization, MIME type validation
- **Flexibility**: Interface-based design allows multiple storage backends
- **Testability**: Comprehensive unit tests with 100% coverage
- **Configuration**: Environment-based configuration with sensible defaults

## Package Structure

```
storage/
├── storage.go          # Storage interface definition
├── local_storage.go    # Local filesystem implementation
├── validation.go       # MIME type validation
├── config.go          # Configuration management
├── storage_test.go    # Storage tests
├── validation_test.go # Validation tests
└── config_test.go     # Configuration tests
```

## Storage Interface

The `Storage` interface defines the contract for file storage operations:

```go
type Storage interface {
    Save(ctx context.Context, workspaceID, itemID, filename string, reader io.Reader) (path string, err error)
    Get(ctx context.Context, path string) (io.ReadCloser, error)
    Delete(ctx context.Context, path string) error
    GetURL(ctx context.Context, path string) (string, error)
    Exists(ctx context.Context, path string) (bool, error)
}
```

## LocalStorage Implementation

The `LocalStorage` implementation stores files on the local filesystem with the following features:

### File Organization

Files are organized in a hierarchical structure:
```
{base_dir}/
  {workspace_id}/
    {item_id}/
      {uuid}_{filename}
```

Example:
```
./uploads/photos/
  workspace-123/
    item-456/
      550e8400-e29b-41d4-a716-446655440000_photo.jpg
```

### Security Features

1. **Path Traversal Protection**: All paths are validated to prevent `../` attacks
2. **Filename Sanitization**: Removes unsafe characters and path components
3. **Atomic Writes**: Uses temporary files to prevent partial writes
4. **Permission Management**: Proper file/directory permissions (0755/0644)

### Usage Example

```go
// Create storage instance
storage, err := NewLocalStorage("./uploads/photos")
if err != nil {
    log.Fatal(err)
}

// Save a file
file, _ := os.Open("photo.jpg")
defer file.Close()

path, err := storage.Save(ctx, "workspace-123", "item-456", "photo.jpg", file)
if err != nil {
    log.Fatal(err)
}

// Get file URL
url, err := storage.GetURL(ctx, path)
// Returns: "/uploads/photos/workspace-123/item-456/{uuid}_photo.jpg"

// Retrieve file
reader, err := storage.Get(ctx, path)
if err != nil {
    log.Fatal(err)
}
defer reader.Close()

// Delete file
err = storage.Delete(ctx, path)
```

## MIME Type Validation

The package includes MIME type validation to ensure only allowed file types are uploaded.

### Default Allowed Types

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

### Usage Example

```go
// Using default allowed types
err := ValidateMimeType("image/jpeg")
if err != nil {
    log.Fatal(err)
}

// Custom validator
validator := NewMimeTypeValidator([]string{"image/jpeg", "image/png"})
if validator.IsAllowed("image/webp") {
    // This will be false
}
```

## Configuration

Configuration is managed through environment variables with sensible defaults.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PHOTO_STORAGE_PATH` | `./uploads/photos` | Base directory for storing photos |
| `PHOTO_MAX_FILE_SIZE_MB` | `10` | Maximum file size in megabytes |
| `PHOTO_ALLOWED_TYPES` | `image/jpeg,image/png,image/webp` | Comma-separated list of allowed MIME types |

### Usage Example

```go
// Load configuration from environment
cfg, err := LoadConfigFromEnv()
if err != nil {
    log.Fatal(err)
}

// Validate configuration
if err := cfg.Validate(); err != nil {
    log.Fatal(err)
}

// Create storage with configuration
storage, err := NewLocalStorage(cfg.StoragePath)
if err != nil {
    log.Fatal(err)
}

// Create MIME type validator
validator := NewMimeTypeValidator(cfg.AllowedMimeTypes)

// Get max file size in bytes
maxBytes := cfg.MaxFileSizeBytes()
```

## Helper Functions

### SanitizeFilename

Removes unsafe characters and path components from filenames:

```go
safe := SanitizeFilename("../../../etc/passwd")
// Returns: "passwd"

safe := SanitizeFilename("file@#$%^&*().jpg")
// Returns: "file.jpg"
```

### GenerateStoragePath

Creates a storage path for organizing files:

```go
path := GenerateStoragePath("workspace-123", "item-456", "photo.jpg")
// Returns: "workspace-123/item-456/photo.jpg"
```

## Error Handling

The package defines several error types:

- `ErrFileNotFound`: File doesn't exist
- `ErrInvalidPath`: Path is invalid or unsafe
- `ErrInvalidMimeType`: MIME type is not allowed

Example:

```go
_, err := storage.Get(ctx, "nonexistent/path.jpg")
if errors.Is(err, storage.ErrFileNotFound) {
    // Handle not found case
}
```

## Testing

The package includes comprehensive unit tests:

```bash
# Run all tests
go test ./internal/infra/storage/

# Run with coverage
go test -cover ./internal/infra/storage/

# Run specific test
go test -run TestLocalStorage_Save ./internal/infra/storage/
```

## Integration with Application

### Initialization

Initialize storage during application startup:

```go
// Load configuration
cfg, err := storage.LoadConfigFromEnv()
if err != nil {
    log.Fatalf("Failed to load storage config: %v", err)
}

// Create storage instance
photoStorage, err := storage.NewLocalStorage(cfg.StoragePath)
if err != nil {
    log.Fatalf("Failed to create storage: %v", err)
}

// Create MIME type validator
mimeValidator := storage.NewMimeTypeValidator(cfg.AllowedMimeTypes)
```

### HTTP Handler Example

```go
func uploadPhotoHandler(storage storage.Storage, validator *storage.MimeTypeValidator, maxSize int64) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        // Limit request body size
        r.Body = http.MaxBytesReader(w, r.Body, maxSize)

        // Parse multipart form
        if err := r.ParseMultipartForm(maxSize); err != nil {
            http.Error(w, "File too large", http.StatusBadRequest)
            return
        }

        file, header, err := r.FormFile("photo")
        if err != nil {
            http.Error(w, "Failed to read file", http.StatusBadRequest)
            return
        }
        defer file.Close()

        // Validate MIME type
        mimeType := header.Header.Get("Content-Type")
        if err := validator.Validate(mimeType); err != nil {
            http.Error(w, "Invalid file type", http.StatusBadRequest)
            return
        }

        // Save file
        workspaceID := r.Context().Value("workspace_id").(string)
        itemID := r.FormValue("item_id")

        path, err := storage.Save(r.Context(), workspaceID, itemID, header.Filename, file)
        if err != nil {
            http.Error(w, "Failed to save file", http.StatusInternalServerError)
            return
        }

        // Get URL
        url, err := storage.GetURL(r.Context(), path)
        if err != nil {
            http.Error(w, "Failed to generate URL", http.StatusInternalServerError)
            return
        }

        // Return response
        json.NewEncoder(w).Encode(map[string]string{
            "path": path,
            "url":  url,
        })
    }
}
```

## Future Enhancements

Potential improvements for future releases:

1. **Cloud Storage Backends**: Implement S3, Azure Blob, Google Cloud Storage
2. **Image Processing**: Automatic thumbnail generation, resizing, optimization
3. **CDN Integration**: Support for CDN URL generation
4. **Metadata Storage**: Store file metadata (size, MIME type, dimensions)
5. **Versioning**: Support for file versioning and history
6. **Cleanup**: Automatic cleanup of orphaned files
7. **Compression**: Automatic compression for large images
8. **Virus Scanning**: Integration with antivirus scanning

## License

Part of the Home Warehouse System project.
