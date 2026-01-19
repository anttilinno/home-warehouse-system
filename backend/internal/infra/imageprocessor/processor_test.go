package imageprocessor

import (
	"context"
	"image"
	"image/color"
	_ "image/gif"  // Register GIF format
	_ "image/jpeg" // Register JPEG format
	"image/png"
	_ "image/png" // Register PNG format
	"os"
	"path/filepath"
	"testing"

	"github.com/disintegration/imaging"
)

// createTestImage creates a simple test image with the given dimensions
func createTestImage(t *testing.T, width, height int, filename string) string {
	t.Helper()

	// Create a simple gradient image
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Fill with gradient
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r := uint8(float64(x) / float64(width) * 255)
			g := uint8(float64(y) / float64(height) * 255)
			b := uint8(128)
			img.Set(x, y, color.RGBA{R: r, G: g, B: b, A: 255})
		}
	}

	// Save to file
	file, err := os.Create(filename)
	if err != nil {
		t.Fatalf("failed to create test image file: %v", err)
	}
	defer file.Close()

	// Determine format from extension
	ext := filepath.Ext(filename)
	switch ext {
	case ".png":
		if err := png.Encode(file, img); err != nil {
			t.Fatalf("failed to encode PNG: %v", err)
		}
	case ".jpg", ".jpeg":
		if err := imaging.Save(img, filename, imaging.JPEGQuality(85)); err != nil {
			t.Fatalf("failed to encode JPEG: %v", err)
		}
	default:
		t.Fatalf("unsupported format: %s", ext)
	}

	return filename
}

func TestProcessor_GenerateThumbnail(t *testing.T) {
	// Create temp directory for test
	tmpDir := t.TempDir()

	// Create test image
	sourcePath := createTestImage(t, 1000, 800, filepath.Join(tmpDir, "source.jpg"))

	processor := NewProcessor(DefaultConfig())
	ctx := context.Background()

	tests := []struct {
		name       string
		maxWidth   int
		maxHeight  int
		wantWidth  int
		wantHeight int
	}{
		{
			name:       "landscape to square",
			maxWidth:   400,
			maxHeight:  400,
			wantWidth:  400,
			wantHeight: 320, // Maintains aspect ratio 1000:800 = 400:320
		},
		{
			name:       "small thumbnail",
			maxWidth:   150,
			maxHeight:  150,
			wantWidth:  150,
			wantHeight: 120,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			destPath := filepath.Join(tmpDir, "thumb_"+tt.name+".jpg")

			err := processor.GenerateThumbnail(ctx, sourcePath, destPath, tt.maxWidth, tt.maxHeight)
			if err != nil {
				t.Fatalf("GenerateThumbnail() error = %v", err)
			}

			// Verify thumbnail exists
			if _, err := os.Stat(destPath); os.IsNotExist(err) {
				t.Fatalf("thumbnail was not created")
			}

			// Check dimensions
			width, height, err := processor.GetDimensions(ctx, destPath)
			if err != nil {
				t.Fatalf("GetDimensions() error = %v", err)
			}

			if width != tt.wantWidth || height != tt.wantHeight {
				t.Errorf("GetDimensions() = %d x %d, want %d x %d", width, height, tt.wantWidth, tt.wantHeight)
			}
		})
	}
}

func TestProcessor_GenerateAllThumbnails(t *testing.T) {
	tmpDir := t.TempDir()

	// Create test image
	sourcePath := createTestImage(t, 1200, 900, filepath.Join(tmpDir, "source.jpg"))

	processor := NewProcessor(DefaultConfig())
	ctx := context.Background()

	baseDestPath := filepath.Join(tmpDir, "thumb.jpg")

	paths, err := processor.GenerateAllThumbnails(ctx, sourcePath, baseDestPath)
	if err != nil {
		t.Fatalf("GenerateAllThumbnails() error = %v", err)
	}

	// Verify all thumbnail sizes were created
	expectedSizes := []ThumbnailSize{
		ThumbnailSizeSmall,
		ThumbnailSizeMedium,
		ThumbnailSizeLarge,
	}

	for _, size := range expectedSizes {
		path, ok := paths[size]
		if !ok {
			t.Errorf("missing thumbnail size: %s", size)
			continue
		}

		// Verify file exists
		if _, err := os.Stat(path); os.IsNotExist(err) {
			t.Errorf("thumbnail file does not exist: %s", path)
		}
	}

	// Verify dimensions
	expectedDims := map[ThumbnailSize]struct{ maxWidth, maxHeight int }{
		ThumbnailSizeSmall:  {150, 112}, // 1200:900 ratio = 150:112
		ThumbnailSizeMedium: {400, 300}, // 1200:900 ratio = 400:300
		ThumbnailSizeLarge:  {800, 600}, // 1200:900 ratio = 800:600
	}

	for size, expected := range expectedDims {
		path := paths[size]
		width, height, err := processor.GetDimensions(ctx, path)
		if err != nil {
			t.Errorf("GetDimensions() for %s error = %v", size, err)
			continue
		}

		if width != expected.maxWidth || height != expected.maxHeight {
			t.Errorf("size %s: got %d x %d, want %d x %d", size, width, height, expected.maxWidth, expected.maxHeight)
		}
	}
}

func TestProcessor_GetDimensions(t *testing.T) {
	tmpDir := t.TempDir()

	tests := []struct {
		name   string
		width  int
		height int
		format string
	}{
		{"jpeg_landscape", 800, 600, ".jpg"},
		{"png_portrait", 600, 800, ".png"},
		{"square", 400, 400, ".jpg"},
	}

	processor := NewProcessor(DefaultConfig())
	ctx := context.Background()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := createTestImage(t, tt.width, tt.height, filepath.Join(tmpDir, tt.name+tt.format))

			width, height, err := processor.GetDimensions(ctx, path)
			if err != nil {
				t.Fatalf("GetDimensions() error = %v", err)
			}

			if width != tt.width || height != tt.height {
				t.Errorf("GetDimensions() = %d x %d, want %d x %d", width, height, tt.width, tt.height)
			}
		})
	}
}

func TestProcessor_Optimize(t *testing.T) {
	tmpDir := t.TempDir()

	sourcePath := createTestImage(t, 1000, 800, filepath.Join(tmpDir, "source.jpg"))

	processor := NewProcessor(DefaultConfig())
	ctx := context.Background()

	tests := []struct {
		name    string
		quality int
	}{
		{"high_quality", 95},
		{"medium_quality", 75},
		{"low_quality", 50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			destPath := filepath.Join(tmpDir, "optimized_"+tt.name+".jpg")

			err := processor.Optimize(ctx, sourcePath, destPath, tt.quality)
			if err != nil {
				t.Fatalf("Optimize() error = %v", err)
			}

			// Verify file exists
			stat, err := os.Stat(destPath)
			if os.IsNotExist(err) {
				t.Fatalf("optimized file was not created")
			}

			// Verify it's a valid image
			width, height, err := processor.GetDimensions(ctx, destPath)
			if err != nil {
				t.Fatalf("GetDimensions() error = %v", err)
			}

			if width != 1000 || height != 800 {
				t.Errorf("dimensions changed: got %d x %d, want 1000 x 800", width, height)
			}

			t.Logf("Optimized at quality %d: %d bytes", tt.quality, stat.Size())
		})
	}
}

func TestProcessor_Validate(t *testing.T) {
	tmpDir := t.TempDir()
	processor := NewProcessor(DefaultConfig())
	ctx := context.Background()

	t.Run("valid_image", func(t *testing.T) {
		path := createTestImage(t, 500, 500, filepath.Join(tmpDir, "valid.jpg"))

		err := processor.Validate(ctx, path)
		if err != nil {
			t.Errorf("Validate() error = %v, want nil", err)
		}
	})

	t.Run("image_too_small", func(t *testing.T) {
		path := createTestImage(t, 50, 50, filepath.Join(tmpDir, "too_small.jpg"))

		err := processor.Validate(ctx, path)
		if err == nil {
			t.Error("Validate() error = nil, want ErrInvalidDimensions")
		}
		if err != nil && err != ErrInvalidDimensions && err.Error() == "" {
			t.Errorf("Validate() error = %v, want ErrInvalidDimensions", err)
		}
	})

	t.Run("image_too_large", func(t *testing.T) {
		path := createTestImage(t, 10000, 10000, filepath.Join(tmpDir, "too_large.jpg"))

		err := processor.Validate(ctx, path)
		if err == nil {
			t.Error("Validate() error = nil, want ErrInvalidDimensions")
		}
	})

	t.Run("invalid_format", func(t *testing.T) {
		// Create a text file
		path := filepath.Join(tmpDir, "not_an_image.txt")
		if err := os.WriteFile(path, []byte("this is not an image"), 0644); err != nil {
			t.Fatalf("failed to create test file: %v", err)
		}

		err := processor.Validate(ctx, path)
		if err == nil {
			t.Error("Validate() error = nil, want ErrInvalidFormat or ErrCorruptedImage")
		}
	})

	t.Run("corrupted_image", func(t *testing.T) {
		// Create a file with JPEG header but corrupted data
		path := filepath.Join(tmpDir, "corrupted.jpg")
		data := []byte{0xFF, 0xD8, 0xFF, 0xE0} // JPEG header
		data = append(data, []byte("corrupted data")...)
		if err := os.WriteFile(path, data, 0644); err != nil {
			t.Fatalf("failed to create test file: %v", err)
		}

		err := processor.Validate(ctx, path)
		if err == nil {
			t.Error("Validate() error = nil, want ErrCorruptedImage")
		}
	})

	t.Run("nonexistent_file", func(t *testing.T) {
		path := filepath.Join(tmpDir, "nonexistent.jpg")

		err := processor.Validate(ctx, path)
		if err == nil {
			t.Error("Validate() error = nil, want error")
		}
	})
}

func TestProcessor_PNG_Format(t *testing.T) {
	tmpDir := t.TempDir()

	sourcePath := createTestImage(t, 800, 600, filepath.Join(tmpDir, "source.png"))

	processor := NewProcessor(DefaultConfig())
	ctx := context.Background()

	t.Run("thumbnail_png", func(t *testing.T) {
		destPath := filepath.Join(tmpDir, "thumb.png")

		err := processor.GenerateThumbnail(ctx, sourcePath, destPath, 400, 400)
		if err != nil {
			t.Fatalf("GenerateThumbnail() error = %v", err)
		}

		// Verify it's a valid PNG
		file, err := os.Open(destPath)
		if err != nil {
			t.Fatalf("failed to open thumbnail: %v", err)
		}
		defer file.Close()

		_, format, err := image.DecodeConfig(file)
		if err != nil {
			t.Fatalf("failed to decode thumbnail: %v", err)
		}

		if format != "png" {
			t.Errorf("format = %s, want png", format)
		}
	})
}

func TestProcessor_AspectRatio(t *testing.T) {
	tmpDir := t.TempDir()
	processor := NewProcessor(DefaultConfig())
	ctx := context.Background()

	tests := []struct {
		name       string
		srcWidth   int
		srcHeight  int
		maxWidth   int
		maxHeight  int
		wantWidth  int
		wantHeight int
	}{
		{
			name:       "landscape_fit_width",
			srcWidth:   1600,
			srcHeight:  900,
			maxWidth:   800,
			maxHeight:  800,
			wantWidth:  800,
			wantHeight: 450,
		},
		{
			name:       "portrait_fit_height",
			srcWidth:   900,
			srcHeight:  1600,
			maxWidth:   800,
			maxHeight:  800,
			wantWidth:  450,
			wantHeight: 800,
		},
		{
			name:       "square_to_square",
			srcWidth:   1000,
			srcHeight:  1000,
			maxWidth:   400,
			maxHeight:  400,
			wantWidth:  400,
			wantHeight: 400,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sourcePath := createTestImage(t, tt.srcWidth, tt.srcHeight, filepath.Join(tmpDir, tt.name+"_src.jpg"))
			destPath := filepath.Join(tmpDir, tt.name+"_thumb.jpg")

			err := processor.GenerateThumbnail(ctx, sourcePath, destPath, tt.maxWidth, tt.maxHeight)
			if err != nil {
				t.Fatalf("GenerateThumbnail() error = %v", err)
			}

			width, height, err := processor.GetDimensions(ctx, destPath)
			if err != nil {
				t.Fatalf("GetDimensions() error = %v", err)
			}

			if width != tt.wantWidth || height != tt.wantHeight {
				t.Errorf("dimensions = %d x %d, want %d x %d", width, height, tt.wantWidth, tt.wantHeight)
			}
		})
	}
}

func TestDefaultConfig(t *testing.T) {
	config := DefaultConfig()

	if config.SmallSize != 150 {
		t.Errorf("SmallSize = %d, want 150", config.SmallSize)
	}
	if config.MediumSize != 400 {
		t.Errorf("MediumSize = %d, want 400", config.MediumSize)
	}
	if config.LargeSize != 800 {
		t.Errorf("LargeSize = %d, want 800", config.LargeSize)
	}
	if config.JPEGQuality != 85 {
		t.Errorf("JPEGQuality = %d, want 85", config.JPEGQuality)
	}
	if config.MinWidth != 100 {
		t.Errorf("MinWidth = %d, want 100", config.MinWidth)
	}
	if config.MinHeight != 100 {
		t.Errorf("MinHeight = %d, want 100", config.MinHeight)
	}
	if config.MaxWidth != 8192 {
		t.Errorf("MaxWidth = %d, want 8192", config.MaxWidth)
	}
	if config.MaxHeight != 8192 {
		t.Errorf("MaxHeight = %d, want 8192", config.MaxHeight)
	}
}

func TestLoadConfigFromEnv(t *testing.T) {
	// Helper to clear env vars after test
	clearEnv := func() {
		os.Unsetenv("PHOTO_THUMBNAIL_SMALL_SIZE")
		os.Unsetenv("PHOTO_THUMBNAIL_MEDIUM_SIZE")
		os.Unsetenv("PHOTO_THUMBNAIL_LARGE_SIZE")
		os.Unsetenv("PHOTO_JPEG_QUALITY")
		os.Unsetenv("PHOTO_WEBP_QUALITY")
		os.Unsetenv("PHOTO_MIN_WIDTH")
		os.Unsetenv("PHOTO_MIN_HEIGHT")
		os.Unsetenv("PHOTO_MAX_WIDTH")
		os.Unsetenv("PHOTO_MAX_HEIGHT")
	}

	t.Run("defaults_when_no_env_vars", func(t *testing.T) {
		clearEnv()

		cfg, err := LoadConfigFromEnv()
		if err != nil {
			t.Fatalf("LoadConfigFromEnv() error = %v", err)
		}

		defaults := DefaultConfig()
		if cfg.SmallSize != defaults.SmallSize {
			t.Errorf("SmallSize = %d, want %d", cfg.SmallSize, defaults.SmallSize)
		}
		if cfg.MediumSize != defaults.MediumSize {
			t.Errorf("MediumSize = %d, want %d", cfg.MediumSize, defaults.MediumSize)
		}
		if cfg.LargeSize != defaults.LargeSize {
			t.Errorf("LargeSize = %d, want %d", cfg.LargeSize, defaults.LargeSize)
		}
		if cfg.JPEGQuality != defaults.JPEGQuality {
			t.Errorf("JPEGQuality = %d, want %d", cfg.JPEGQuality, defaults.JPEGQuality)
		}
	})

	t.Run("custom_thumbnail_sizes", func(t *testing.T) {
		clearEnv()
		os.Setenv("PHOTO_THUMBNAIL_SMALL_SIZE", "100")
		os.Setenv("PHOTO_THUMBNAIL_MEDIUM_SIZE", "300")
		os.Setenv("PHOTO_THUMBNAIL_LARGE_SIZE", "600")

		cfg, err := LoadConfigFromEnv()
		if err != nil {
			t.Fatalf("LoadConfigFromEnv() error = %v", err)
		}

		if cfg.SmallSize != 100 {
			t.Errorf("SmallSize = %d, want 100", cfg.SmallSize)
		}
		if cfg.MediumSize != 300 {
			t.Errorf("MediumSize = %d, want 300", cfg.MediumSize)
		}
		if cfg.LargeSize != 600 {
			t.Errorf("LargeSize = %d, want 600", cfg.LargeSize)
		}
		clearEnv()
	})

	t.Run("custom_quality_settings", func(t *testing.T) {
		clearEnv()
		os.Setenv("PHOTO_JPEG_QUALITY", "90")
		os.Setenv("PHOTO_WEBP_QUALITY", "80")

		cfg, err := LoadConfigFromEnv()
		if err != nil {
			t.Fatalf("LoadConfigFromEnv() error = %v", err)
		}

		if cfg.JPEGQuality != 90 {
			t.Errorf("JPEGQuality = %d, want 90", cfg.JPEGQuality)
		}
		if cfg.WebPQuality != 80 {
			t.Errorf("WebPQuality = %f, want 80", cfg.WebPQuality)
		}
		clearEnv()
	})

	t.Run("custom_dimension_limits", func(t *testing.T) {
		clearEnv()
		os.Setenv("PHOTO_MIN_WIDTH", "200")
		os.Setenv("PHOTO_MIN_HEIGHT", "200")
		os.Setenv("PHOTO_MAX_WIDTH", "4096")
		os.Setenv("PHOTO_MAX_HEIGHT", "4096")

		cfg, err := LoadConfigFromEnv()
		if err != nil {
			t.Fatalf("LoadConfigFromEnv() error = %v", err)
		}

		if cfg.MinWidth != 200 {
			t.Errorf("MinWidth = %d, want 200", cfg.MinWidth)
		}
		if cfg.MinHeight != 200 {
			t.Errorf("MinHeight = %d, want 200", cfg.MinHeight)
		}
		if cfg.MaxWidth != 4096 {
			t.Errorf("MaxWidth = %d, want 4096", cfg.MaxWidth)
		}
		if cfg.MaxHeight != 4096 {
			t.Errorf("MaxHeight = %d, want 4096", cfg.MaxHeight)
		}
		clearEnv()
	})

	t.Run("invalid_small_size", func(t *testing.T) {
		clearEnv()
		os.Setenv("PHOTO_THUMBNAIL_SMALL_SIZE", "invalid")

		_, err := LoadConfigFromEnv()
		if err == nil {
			t.Error("LoadConfigFromEnv() error = nil, want error")
		}
		clearEnv()
	})

	t.Run("negative_size", func(t *testing.T) {
		clearEnv()
		os.Setenv("PHOTO_THUMBNAIL_SMALL_SIZE", "-10")

		_, err := LoadConfigFromEnv()
		if err == nil {
			t.Error("LoadConfigFromEnv() error = nil, want error")
		}
		clearEnv()
	})

	t.Run("invalid_quality_range", func(t *testing.T) {
		clearEnv()
		os.Setenv("PHOTO_JPEG_QUALITY", "101")

		_, err := LoadConfigFromEnv()
		if err == nil {
			t.Error("LoadConfigFromEnv() error = nil, want error for quality > 100")
		}
		clearEnv()
	})

	t.Run("negative_quality", func(t *testing.T) {
		clearEnv()
		os.Setenv("PHOTO_JPEG_QUALITY", "-1")

		_, err := LoadConfigFromEnv()
		if err == nil {
			t.Error("LoadConfigFromEnv() error = nil, want error for negative quality")
		}
		clearEnv()
	})

	t.Run("invalid_webp_quality", func(t *testing.T) {
		clearEnv()
		os.Setenv("PHOTO_WEBP_QUALITY", "invalid")

		_, err := LoadConfigFromEnv()
		if err == nil {
			t.Error("LoadConfigFromEnv() error = nil, want error")
		}
		clearEnv()
	})
}
