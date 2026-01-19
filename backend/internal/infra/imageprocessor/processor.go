package imageprocessor

import (
	"context"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg" // Register JPEG format
	"image/png"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/kolesa-team/go-webp/encoder"
	"github.com/kolesa-team/go-webp/webp"
	_ "golang.org/x/image/webp" // Register WebP format for decoding
)

var (
	ErrInvalidFormat     = errors.New("invalid image format")
	ErrInvalidDimensions = errors.New("invalid image dimensions")
	ErrCorruptedImage    = errors.New("corrupted image")
)

// ThumbnailSize represents a thumbnail dimension preset
type ThumbnailSize string

const (
	ThumbnailSizeSmall  ThumbnailSize = "small"
	ThumbnailSizeMedium ThumbnailSize = "medium"
	ThumbnailSizeLarge  ThumbnailSize = "large"
)

// Config holds image processing configuration
type Config struct {
	SmallSize   int     // Default: 150
	MediumSize  int     // Default: 400
	LargeSize   int     // Default: 800
	JPEGQuality int     // Default: 85
	WebPQuality float32 // Default: 75
	MinWidth    int     // Default: 100
	MinHeight   int     // Default: 100
	MaxWidth    int     // Default: 8192
	MaxHeight   int     // Default: 8192
}

// DefaultConfig returns default configuration
func DefaultConfig() Config {
	return Config{
		SmallSize:   150,
		MediumSize:  400,
		LargeSize:   800,
		JPEGQuality: 85,
		WebPQuality: 75,
		MinWidth:    100,
		MinHeight:   100,
		MaxWidth:    8192,
		MaxHeight:   8192,
	}
}

// LoadConfigFromEnv loads configuration from environment variables.
// Environment variables:
//   - PHOTO_THUMBNAIL_SMALL_SIZE: Small thumbnail size in pixels (default: 150)
//   - PHOTO_THUMBNAIL_MEDIUM_SIZE: Medium thumbnail size in pixels (default: 400)
//   - PHOTO_THUMBNAIL_LARGE_SIZE: Large thumbnail size in pixels (default: 800)
//   - PHOTO_JPEG_QUALITY: JPEG compression quality 0-100 (default: 85)
//   - PHOTO_WEBP_QUALITY: WebP compression quality 0-100 (default: 75)
//   - PHOTO_MIN_WIDTH: Minimum image width (default: 100)
//   - PHOTO_MIN_HEIGHT: Minimum image height (default: 100)
//   - PHOTO_MAX_WIDTH: Maximum image width (default: 8192)
//   - PHOTO_MAX_HEIGHT: Maximum image height (default: 8192)
func LoadConfigFromEnv() (Config, error) {
	cfg := DefaultConfig()
	var err error

	if v := os.Getenv("PHOTO_THUMBNAIL_SMALL_SIZE"); v != "" {
		cfg.SmallSize, err = strconv.Atoi(v)
		if err != nil {
			return cfg, fmt.Errorf("invalid PHOTO_THUMBNAIL_SMALL_SIZE: %w", err)
		}
		if cfg.SmallSize <= 0 {
			return cfg, fmt.Errorf("PHOTO_THUMBNAIL_SMALL_SIZE must be positive")
		}
	}

	if v := os.Getenv("PHOTO_THUMBNAIL_MEDIUM_SIZE"); v != "" {
		cfg.MediumSize, err = strconv.Atoi(v)
		if err != nil {
			return cfg, fmt.Errorf("invalid PHOTO_THUMBNAIL_MEDIUM_SIZE: %w", err)
		}
		if cfg.MediumSize <= 0 {
			return cfg, fmt.Errorf("PHOTO_THUMBNAIL_MEDIUM_SIZE must be positive")
		}
	}

	if v := os.Getenv("PHOTO_THUMBNAIL_LARGE_SIZE"); v != "" {
		cfg.LargeSize, err = strconv.Atoi(v)
		if err != nil {
			return cfg, fmt.Errorf("invalid PHOTO_THUMBNAIL_LARGE_SIZE: %w", err)
		}
		if cfg.LargeSize <= 0 {
			return cfg, fmt.Errorf("PHOTO_THUMBNAIL_LARGE_SIZE must be positive")
		}
	}

	if v := os.Getenv("PHOTO_JPEG_QUALITY"); v != "" {
		cfg.JPEGQuality, err = strconv.Atoi(v)
		if err != nil {
			return cfg, fmt.Errorf("invalid PHOTO_JPEG_QUALITY: %w", err)
		}
		if cfg.JPEGQuality < 0 || cfg.JPEGQuality > 100 {
			return cfg, fmt.Errorf("PHOTO_JPEG_QUALITY must be between 0 and 100")
		}
	}

	if v := os.Getenv("PHOTO_WEBP_QUALITY"); v != "" {
		quality, err := strconv.Atoi(v)
		if err != nil {
			return cfg, fmt.Errorf("invalid PHOTO_WEBP_QUALITY: %w", err)
		}
		if quality < 0 || quality > 100 {
			return cfg, fmt.Errorf("PHOTO_WEBP_QUALITY must be between 0 and 100")
		}
		cfg.WebPQuality = float32(quality)
	}

	if v := os.Getenv("PHOTO_MIN_WIDTH"); v != "" {
		cfg.MinWidth, err = strconv.Atoi(v)
		if err != nil {
			return cfg, fmt.Errorf("invalid PHOTO_MIN_WIDTH: %w", err)
		}
		if cfg.MinWidth <= 0 {
			return cfg, fmt.Errorf("PHOTO_MIN_WIDTH must be positive")
		}
	}

	if v := os.Getenv("PHOTO_MIN_HEIGHT"); v != "" {
		cfg.MinHeight, err = strconv.Atoi(v)
		if err != nil {
			return cfg, fmt.Errorf("invalid PHOTO_MIN_HEIGHT: %w", err)
		}
		if cfg.MinHeight <= 0 {
			return cfg, fmt.Errorf("PHOTO_MIN_HEIGHT must be positive")
		}
	}

	if v := os.Getenv("PHOTO_MAX_WIDTH"); v != "" {
		cfg.MaxWidth, err = strconv.Atoi(v)
		if err != nil {
			return cfg, fmt.Errorf("invalid PHOTO_MAX_WIDTH: %w", err)
		}
		if cfg.MaxWidth <= 0 {
			return cfg, fmt.Errorf("PHOTO_MAX_WIDTH must be positive")
		}
	}

	if v := os.Getenv("PHOTO_MAX_HEIGHT"); v != "" {
		cfg.MaxHeight, err = strconv.Atoi(v)
		if err != nil {
			return cfg, fmt.Errorf("invalid PHOTO_MAX_HEIGHT: %w", err)
		}
		if cfg.MaxHeight <= 0 {
			return cfg, fmt.Errorf("PHOTO_MAX_HEIGHT must be positive")
		}
	}

	return cfg, nil
}

// ImageProcessor defines the interface for image processing operations
type ImageProcessor interface {
	// GenerateThumbnail generates a single thumbnail with the given max dimensions
	GenerateThumbnail(ctx context.Context, sourcePath, destPath string, maxWidth, maxHeight int) error

	// GenerateAllThumbnails generates all thumbnail sizes
	GenerateAllThumbnails(ctx context.Context, sourcePath, baseDestPath string) (map[ThumbnailSize]string, error)

	// GetDimensions returns the width and height of an image
	GetDimensions(ctx context.Context, path string) (width, height int, err error)

	// Optimize compresses an image with quality settings
	Optimize(ctx context.Context, sourcePath, destPath string, quality int) error

	// Validate validates that a file is a valid image with acceptable dimensions
	Validate(ctx context.Context, path string) error
}

// Processor implements ImageProcessor
type Processor struct {
	config Config
}

// NewProcessor creates a new image processor with the given configuration
func NewProcessor(config Config) *Processor {
	return &Processor{config: config}
}

// GenerateThumbnail generates a single thumbnail maintaining aspect ratio
func (p *Processor) GenerateThumbnail(ctx context.Context, sourcePath, destPath string, maxWidth, maxHeight int) error {
	// Open source image
	src, err := imaging.Open(sourcePath, imaging.AutoOrientation(true))
	if err != nil {
		return fmt.Errorf("failed to open image: %w", err)
	}

	// Generate thumbnail maintaining aspect ratio
	thumb := imaging.Fit(src, maxWidth, maxHeight, imaging.Lanczos)

	// Ensure destination directory exists
	destDir := filepath.Dir(destPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	// Determine format from extension
	ext := strings.ToLower(filepath.Ext(destPath))

	switch ext {
	case ".jpg", ".jpeg":
		return imaging.Save(thumb, destPath, imaging.JPEGQuality(p.config.JPEGQuality))
	case ".png":
		return imaging.Save(thumb, destPath, imaging.PNGCompressionLevel(png.DefaultCompression))
	case ".webp":
		return p.saveWebP(thumb, destPath, p.config.WebPQuality)
	default:
		// Default to JPEG
		return imaging.Save(thumb, destPath, imaging.JPEGQuality(p.config.JPEGQuality))
	}
}

// saveWebP saves an image in WebP format
func (p *Processor) saveWebP(img image.Image, destPath string, quality float32) error {
	output, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer output.Close()

	options, err := encoder.NewLossyEncoderOptions(encoder.PresetDefault, quality)
	if err != nil {
		return fmt.Errorf("failed to create encoder options: %w", err)
	}

	if err := webp.Encode(output, img, options); err != nil {
		return fmt.Errorf("failed to encode webp: %w", err)
	}

	return nil
}

// GenerateAllThumbnails generates all thumbnail sizes
func (p *Processor) GenerateAllThumbnails(ctx context.Context, sourcePath, baseDestPath string) (map[ThumbnailSize]string, error) {
	sizes := map[ThumbnailSize]int{
		ThumbnailSizeSmall:  p.config.SmallSize,
		ThumbnailSizeMedium: p.config.MediumSize,
		ThumbnailSizeLarge:  p.config.LargeSize,
	}

	paths := make(map[ThumbnailSize]string)
	var firstErr error

	for size, maxDim := range sizes {
		// Generate path with size suffix
		ext := filepath.Ext(baseDestPath)
		pathWithoutExt := strings.TrimSuffix(baseDestPath, ext)
		destPath := fmt.Sprintf("%s_%s%s", pathWithoutExt, size, ext)

		err := p.GenerateThumbnail(ctx, sourcePath, destPath, maxDim, maxDim)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("failed to generate %s thumbnail: %w", size, err)
			}
			continue
		}

		paths[size] = destPath
	}

	// If we generated at least one thumbnail, consider it a success
	if len(paths) > 0 {
		return paths, nil
	}

	// If all failed, return the first error
	if firstErr != nil {
		return nil, firstErr
	}

	return paths, nil
}

// GetDimensions returns the width and height of an image
func (p *Processor) GetDimensions(ctx context.Context, path string) (int, int, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to decode image config: %w", err)
	}

	return config.Width, config.Height, nil
}

// Optimize compresses an image with quality settings
func (p *Processor) Optimize(ctx context.Context, sourcePath, destPath string, quality int) error {
	// Open source image
	src, err := imaging.Open(sourcePath, imaging.AutoOrientation(true))
	if err != nil {
		return fmt.Errorf("failed to open image: %w", err)
	}

	// Ensure destination directory exists
	destDir := filepath.Dir(destPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	// Determine format from extension
	ext := strings.ToLower(filepath.Ext(destPath))

	switch ext {
	case ".jpg", ".jpeg":
		return imaging.Save(src, destPath, imaging.JPEGQuality(quality))
	case ".png":
		// PNG uses compression level, convert quality (0-100) to level (0-9)
		level := png.CompressionLevel((100 - quality) * 9 / 100)
		if level > 9 {
			level = 9
		}
		return imaging.Save(src, destPath, imaging.PNGCompressionLevel(level))
	default:
		return imaging.Save(src, destPath, imaging.JPEGQuality(quality))
	}
}

// Validate validates that a file is a valid image with acceptable dimensions
func (p *Processor) Validate(ctx context.Context, path string) error {
	// Try to open and decode the file
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	// Check if file is actually an image by detecting format
	config, format, err := image.DecodeConfig(file)
	if err != nil {
		if errors.Is(err, image.ErrFormat) {
			return ErrInvalidFormat
		}
		return fmt.Errorf("%w: %v", ErrCorruptedImage, err)
	}

	// Validate format (JPEG, PNG, WebP)
	validFormats := map[string]bool{
		"jpeg": true,
		"jpg":  true,
		"png":  true,
		"webp": true,
	}
	if !validFormats[strings.ToLower(format)] {
		return fmt.Errorf("%w: unsupported format %s", ErrInvalidFormat, format)
	}

	// Validate dimensions
	if config.Width < p.config.MinWidth || config.Height < p.config.MinHeight {
		return fmt.Errorf("%w: image too small (%dx%d), minimum is %dx%d",
			ErrInvalidDimensions, config.Width, config.Height,
			p.config.MinWidth, p.config.MinHeight)
	}

	if config.Width > p.config.MaxWidth || config.Height > p.config.MaxHeight {
		return fmt.Errorf("%w: image too large (%dx%d), maximum is %dx%d",
			ErrInvalidDimensions, config.Width, config.Height,
			p.config.MaxWidth, p.config.MaxHeight)
	}

	// Try to actually decode the image to detect corruption
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("failed to seek: %w", err)
	}

	_, err = imaging.Decode(file, imaging.AutoOrientation(true))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrCorruptedImage, err)
	}

	return nil
}
