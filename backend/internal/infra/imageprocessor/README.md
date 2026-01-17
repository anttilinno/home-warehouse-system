# Image Processor

A Go package for image processing operations including thumbnail generation, image optimization, and validation.

## Features

- **Thumbnail Generation**: Create thumbnails maintaining aspect ratio
- **Multiple Sizes**: Pre-configured small (150px), medium (400px), and large (800px) thumbnails
- **Format Support**: JPEG, PNG, WebP
- **EXIF Orientation**: Automatic handling of EXIF orientation data
- **Image Validation**: Validate dimensions, format, and detect corrupted images
- **Optimization**: Compress images with configurable quality settings

## Installation

The package uses the `github.com/disintegration/imaging` library:

```bash
go get github.com/disintegration/imaging
```

## Usage

### Basic Setup

```go
import "github.com/antti/home-warehouse/go-backend/internal/infra/imageprocessor"

// Use default configuration
processor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())

// Or customize configuration
config := imageprocessor.Config{
    SmallSize:   150,
    MediumSize:  400,
    LargeSize:   800,
    JPEGQuality: 85,
    MinWidth:    100,
    MinHeight:   100,
    MaxWidth:    8192,
    MaxHeight:   8192,
}
processor := imageprocessor.NewProcessor(config)
```

### Generate Single Thumbnail

```go
ctx := context.Background()

err := processor.GenerateThumbnail(
    ctx,
    "/path/to/source.jpg",
    "/path/to/thumbnail.jpg",
    400, // max width
    400, // max height
)
```

### Generate All Thumbnail Sizes

```go
paths, err := processor.GenerateAllThumbnails(
    ctx,
    "/path/to/source.jpg",
    "/path/to/base/thumb.jpg",
)

// Returns map with paths for each size:
// {
//   "small": "/path/to/base/thumb_small.jpg",
//   "medium": "/path/to/base/thumb_medium.jpg",
//   "large": "/path/to/base/thumb_large.jpg"
// }
```

### Validate Image

```go
err := processor.Validate(ctx, "/path/to/image.jpg")
if err != nil {
    switch {
    case errors.Is(err, imageprocessor.ErrInvalidFormat):
        // Unsupported format
    case errors.Is(err, imageprocessor.ErrInvalidDimensions):
        // Image too small or too large
    case errors.Is(err, imageprocessor.ErrCorruptedImage):
        // Corrupted or unreadable image
    }
}
```

### Get Image Dimensions

```go
width, height, err := processor.GetDimensions(ctx, "/path/to/image.jpg")
```

### Optimize Image

```go
// Compress with specific quality
err := processor.Optimize(
    ctx,
    "/path/to/source.jpg",
    "/path/to/optimized.jpg",
    75, // quality (0-100)
)
```

## Configuration

### Environment Variables

You can configure the image processor using environment variables:

- `PHOTO_THUMBNAIL_SMALL_SIZE` - Small thumbnail size in pixels (default: 150)
- `PHOTO_THUMBNAIL_MEDIUM_SIZE` - Medium thumbnail size in pixels (default: 400)
- `PHOTO_THUMBNAIL_LARGE_SIZE` - Large thumbnail size in pixels (default: 800)
- `PHOTO_JPEG_QUALITY` - JPEG compression quality 0-100 (default: 85)

### Default Configuration

```go
Config{
    SmallSize:   150,   // Suitable for list views
    MediumSize:  400,   // Suitable for preview modals
    LargeSize:   800,   // Suitable for detail pages
    JPEGQuality: 85,    // High quality with reasonable compression
    MinWidth:    100,   // Minimum accepted width
    MinHeight:   100,   // Minimum accepted height
    MaxWidth:    8192,  // Maximum accepted width
    MaxHeight:   8192,  // Maximum accepted height
}
```

## Features Details

### Aspect Ratio Preservation

Thumbnails are generated using the `imaging.Fit()` function which:
- Maintains the original aspect ratio
- Scales the image to fit within the specified dimensions
- Centers the image within the bounding box

Example: A 1600x900 image scaled to 800x800 becomes 800x450.

### EXIF Orientation

The processor automatically handles EXIF orientation data using `imaging.AutoOrientation(true)`. This ensures:
- Images appear correctly oriented regardless of camera metadata
- Portrait photos from cameras/phones are displayed upright
- No manual rotation required

### Format Support

Supported input formats:
- JPEG/JPG
- PNG
- WebP

Output formats:
- JPEG (with configurable quality)
- PNG (with compression)

### Image Validation

The `Validate()` method checks:
1. File is readable and valid
2. Format is supported (JPEG, PNG, WebP)
3. Dimensions are within acceptable range
4. Image data is not corrupted

### Performance

Typical processing times (on modern hardware):
- Single thumbnail: < 100ms
- All thumbnail sizes: < 300ms
- Validation: < 50ms

The `image_too_large` test shows ~3.6s for a 10000x10000 image, which demonstrates the overhead for very large images.

## Error Handling

The package defines three main error types:

```go
var (
    ErrInvalidFormat     = errors.New("invalid image format")
    ErrInvalidDimensions = errors.New("invalid image dimensions")
    ErrCorruptedImage    = errors.New("corrupted image")
)
```

Use `errors.Is()` or `errors.As()` to check for specific errors:

```go
if errors.Is(err, imageprocessor.ErrInvalidFormat) {
    // Handle invalid format
}
```

## Testing

Run tests:

```bash
go test -v ./internal/infra/imageprocessor/...
```

Tests cover:
- Thumbnail generation with various aspect ratios
- All thumbnail size generation
- Image dimension retrieval
- Image optimization at different quality levels
- Image validation (valid, too small, too large, invalid format, corrupted)
- PNG format handling
- Aspect ratio preservation

## Dependencies

- `github.com/disintegration/imaging` - Pure Go image processing library (no C dependencies)

## Thread Safety

The `Processor` is safe for concurrent use as it holds no mutable state beyond the read-only configuration.

## Example: Processing Uploaded Photos

```go
func handlePhotoUpload(w http.ResponseWriter, r *http.Request) {
    processor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())
    ctx := r.Context()

    // Parse upload
    file, header, err := r.FormFile("photo")
    if err != nil {
        http.Error(w, "Invalid upload", http.StatusBadRequest)
        return
    }
    defer file.Close()

    // Save temporary file
    tmpPath := "/tmp/" + header.Filename
    out, err := os.Create(tmpPath)
    if err != nil {
        http.Error(w, "Failed to save file", http.StatusInternalServerError)
        return
    }
    defer os.Remove(tmpPath)

    if _, err := io.Copy(out, file); err != nil {
        http.Error(w, "Failed to save file", http.StatusInternalServerError)
        return
    }
    out.Close()

    // Validate image
    if err := processor.Validate(ctx, tmpPath); err != nil {
        switch {
        case errors.Is(err, imageprocessor.ErrInvalidFormat):
            http.Error(w, "Unsupported image format", http.StatusBadRequest)
        case errors.Is(err, imageprocessor.ErrInvalidDimensions):
            http.Error(w, "Image dimensions out of range", http.StatusBadRequest)
        case errors.Is(err, imageprocessor.ErrCorruptedImage):
            http.Error(w, "Corrupted image file", http.StatusBadRequest)
        default:
            http.Error(w, "Invalid image", http.StatusBadRequest)
        }
        return
    }

    // Generate thumbnails
    photoID := uuid.New()
    basePath := fmt.Sprintf("/storage/photos/%s.jpg", photoID)

    thumbnails, err := processor.GenerateAllThumbnails(ctx, tmpPath, basePath)
    if err != nil {
        http.Error(w, "Failed to process image", http.StatusInternalServerError)
        return
    }

    // Store photo metadata with thumbnail paths
    // ...

    w.WriteHeader(http.StatusCreated)
}
```
