package imageprocessor

import (
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"os"

	"github.com/corona10/goimagehash"
	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp"
)

// Hasher provides perceptual hashing for images using dHash (difference hash).
// dHash produces a 64-bit hash that's robust to scaling, aspect ratio changes,
// and minor color adjustments.
type Hasher struct {
	// SimilarityThreshold is the maximum Hamming distance to consider images similar.
	// Lower values are more strict. Default: 10
	SimilarityThreshold int
}

// NewHasher creates a new Hasher with default settings.
func NewHasher() *Hasher {
	return &Hasher{
		SimilarityThreshold: 10,
	}
}

// NewHasherWithThreshold creates a new Hasher with a custom similarity threshold.
func NewHasherWithThreshold(threshold int) *Hasher {
	return &Hasher{
		SimilarityThreshold: threshold,
	}
}

// GenerateHash computes a perceptual hash for an image file.
// Returns the hash as an int64, or an error if the image cannot be processed.
func (h *Hasher) GenerateHash(ctx context.Context, imagePath string) (int64, error) {
	// Open and decode image
	file, err := os.Open(imagePath)
	if err != nil {
		return 0, fmt.Errorf("failed to open image: %w", err)
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return 0, fmt.Errorf("failed to decode image: %w", err)
	}

	// Generate difference hash
	hash, err := goimagehash.DifferenceHash(img)
	if err != nil {
		return 0, fmt.Errorf("failed to generate hash: %w", err)
	}

	return int64(hash.GetHash()), nil
}

// GenerateHashFromImage computes a perceptual hash from an in-memory image.
func (h *Hasher) GenerateHashFromImage(ctx context.Context, img image.Image) (int64, error) {
	hash, err := goimagehash.DifferenceHash(img)
	if err != nil {
		return 0, fmt.Errorf("failed to generate hash: %w", err)
	}
	return int64(hash.GetHash()), nil
}

// GenerateHashFromReader reads and hashes an image from a reader.
// Useful for processing uploads without writing to disk first.
func (h *Hasher) GenerateHashFromReader(ctx context.Context, path string) (int64, error) {
	// Use imaging library which handles EXIF orientation
	img, err := imaging.Open(path, imaging.AutoOrientation(true))
	if err != nil {
		return 0, fmt.Errorf("failed to open image: %w", err)
	}
	return h.GenerateHashFromImage(ctx, img)
}

// CompareHashes computes the Hamming distance between two hashes.
// Returns true if the distance is within the similarity threshold.
func (h *Hasher) CompareHashes(hash1, hash2 int64) (bool, int) {
	distance := hammingDistance(uint64(hash1), uint64(hash2))
	return distance <= h.SimilarityThreshold, distance
}

// IsSimilar checks if two hashes represent similar images.
func (h *Hasher) IsSimilar(hash1, hash2 int64) bool {
	similar, _ := h.CompareHashes(hash1, hash2)
	return similar
}

// GetDistance returns the Hamming distance between two hashes.
func (h *Hasher) GetDistance(hash1, hash2 int64) int {
	return hammingDistance(uint64(hash1), uint64(hash2))
}

// hammingDistance counts the number of differing bits between two hashes.
func hammingDistance(hash1, hash2 uint64) int {
	xor := hash1 ^ hash2
	count := 0
	for xor != 0 {
		count++
		xor &= xor - 1 // Clear the least significant set bit
	}
	return count
}

// HashResult represents the result of a hash comparison.
type HashResult struct {
	Hash      int64
	Distance  int
	IsSimilar bool
}

// FindSimilar finds all images with hashes similar to the given hash.
// Returns results sorted by similarity (lowest distance first).
func (h *Hasher) FindSimilar(targetHash int64, existingHashes map[int64][]string) []SimilarImage {
	var results []SimilarImage

	for hash, photoIDs := range existingHashes {
		similar, distance := h.CompareHashes(targetHash, hash)
		if similar {
			for _, photoID := range photoIDs {
				results = append(results, SimilarImage{
					PhotoID:  photoID,
					Hash:     hash,
					Distance: distance,
				})
			}
		}
	}

	// Sort by distance (most similar first)
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Distance < results[i].Distance {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	return results
}

// SimilarImage represents a potentially duplicate image.
type SimilarImage struct {
	PhotoID  string
	Hash     int64
	Distance int
}
