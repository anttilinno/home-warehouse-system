package imageprocessor_test

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/antti/home-warehouse/go-backend/internal/infra/imageprocessor"
)

// Example demonstrates basic usage of the image processor
func Example() {
	// Create processor with default configuration
	processor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())
	ctx := context.Background()

	// Example image path (would be from an upload in real usage)
	imagePath := "/tmp/example.jpg"

	// 1. Validate the image
	err := processor.Validate(ctx, imagePath)
	if err != nil {
		log.Printf("Image validation failed: %v", err)
		return
	}

	// 2. Get image dimensions
	width, height, err := processor.GetDimensions(ctx, imagePath)
	if err != nil {
		log.Printf("Failed to get dimensions: %v", err)
		return
	}
	fmt.Printf("Image dimensions: %dx%d\n", width, height)

	// 3. Generate all thumbnail sizes
	basePath := "/tmp/thumbnails/example.jpg"
	thumbnails, err := processor.GenerateAllThumbnails(ctx, imagePath, basePath)
	if err != nil {
		log.Printf("Failed to generate thumbnails: %v", err)
		return
	}

	// Print generated thumbnail paths
	for size, path := range thumbnails {
		fmt.Printf("Thumbnail %s: %s\n", size, path)
	}
}

// ExampleProcessor_GenerateThumbnail demonstrates single thumbnail generation
func ExampleProcessor_GenerateThumbnail() {
	processor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())
	ctx := context.Background()

	err := processor.GenerateThumbnail(
		ctx,
		"/path/to/photo.jpg",
		"/path/to/thumbnail.jpg",
		400, // max width
		400, // max height
	)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Thumbnail generated successfully")
}

// ExampleProcessor_GenerateAllThumbnails demonstrates generating all size variants
func ExampleProcessor_GenerateAllThumbnails() {
	processor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())
	ctx := context.Background()

	paths, err := processor.GenerateAllThumbnails(
		ctx,
		"/path/to/photo.jpg",
		"/path/to/base.jpg",
	)
	if err != nil {
		log.Fatal(err)
	}

	// Access specific sizes
	smallPath := paths[imageprocessor.ThumbnailSizeSmall]
	mediumPath := paths[imageprocessor.ThumbnailSizeMedium]
	largePath := paths[imageprocessor.ThumbnailSizeLarge]

	fmt.Printf("Small: %s\n", smallPath)
	fmt.Printf("Medium: %s\n", mediumPath)
	fmt.Printf("Large: %s\n", largePath)
}

// ExampleProcessor_Validate demonstrates image validation
func ExampleProcessor_Validate() {
	processor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())
	ctx := context.Background()

	err := processor.Validate(ctx, "/path/to/photo.jpg")
	switch {
	case err == nil:
		fmt.Println("Image is valid")
	case err == imageprocessor.ErrInvalidFormat:
		fmt.Println("Unsupported image format")
	case err == imageprocessor.ErrInvalidDimensions:
		fmt.Println("Image dimensions out of acceptable range")
	case err == imageprocessor.ErrCorruptedImage:
		fmt.Println("Image file is corrupted")
	default:
		fmt.Printf("Validation error: %v\n", err)
	}
}

// ExampleProcessor_Optimize demonstrates image optimization
func ExampleProcessor_Optimize() {
	processor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())
	ctx := context.Background()

	// Optimize image with 75% quality
	err := processor.Optimize(
		ctx,
		"/path/to/original.jpg",
		"/path/to/optimized.jpg",
		75,
	)
	if err != nil {
		log.Fatal(err)
	}

	// Compare file sizes
	originalInfo, _ := os.Stat("/path/to/original.jpg")
	optimizedInfo, _ := os.Stat("/path/to/optimized.jpg")

	fmt.Printf("Original: %d bytes\n", originalInfo.Size())
	fmt.Printf("Optimized: %d bytes\n", optimizedInfo.Size())
	fmt.Printf("Saved: %.1f%%\n",
		float64(originalInfo.Size()-optimizedInfo.Size())/float64(originalInfo.Size())*100)
}

// ExampleConfig demonstrates custom configuration
func ExampleConfig() {
	// Create custom configuration
	config := imageprocessor.Config{
		SmallSize:   100,  // Smaller thumbnails
		MediumSize:  300,
		LargeSize:   600,
		JPEGQuality: 90,   // Higher quality
		MinWidth:    200,  // Stricter minimum
		MinHeight:   200,
		MaxWidth:    4096, // Lower maximum
		MaxHeight:   4096,
	}

	processor := imageprocessor.NewProcessor(config)

	// Use the processor with custom config
	_ = processor
	fmt.Println("Processor created with custom configuration")
}

// ExampleNewProcessor demonstrates creating a processor with default config
func ExampleNewProcessor() {
	processor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())

	// The processor is now ready to use
	_ = processor
	fmt.Println("Image processor ready")
	// Output: Image processor ready
}
