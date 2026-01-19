// photo-admin provides CLI tools for photo management.
// Commands:
//   - regenerate: Regenerate thumbnails for all photos
//   - cleanup: Remove orphaned photo files
//   - report: Show storage usage report
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/infra/imageprocessor"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "regenerate":
		regenerateCmd := flag.NewFlagSet("regenerate", flag.ExitOnError)
		workspaceID := regenerateCmd.String("workspace", "", "Workspace ID (optional, all if not specified)")
		photoID := regenerateCmd.String("photo", "", "Single photo ID (optional)")
		dryRun := regenerateCmd.Bool("dry-run", false, "Preview changes without executing")
		if err := regenerateCmd.Parse(os.Args[2:]); err != nil {
			log.Fatal(err)
		}
		runRegenerate(*workspaceID, *photoID, *dryRun)

	case "cleanup":
		cleanupCmd := flag.NewFlagSet("cleanup", flag.ExitOnError)
		dryRun := cleanupCmd.Bool("dry-run", true, "Preview changes without deleting (default: true)")
		execute := cleanupCmd.Bool("execute", false, "Actually delete orphaned files")
		if err := cleanupCmd.Parse(os.Args[2:]); err != nil {
			log.Fatal(err)
		}
		runCleanup(*dryRun && !*execute)

	case "report":
		runReport()

	case "help", "-h", "--help":
		printUsage()

	default:
		fmt.Printf("Unknown command: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`photo-admin - Photo management CLI tools

Usage:
  photo-admin <command> [options]

Commands:
  regenerate    Regenerate thumbnails for photos
    --workspace   Workspace ID (optional, regenerates all if not specified)
    --photo       Single photo ID (optional)
    --dry-run     Preview changes without executing

  cleanup       Remove orphaned photo files (files without database records)
    --dry-run     Preview changes without deleting (default: true)
    --execute     Actually delete orphaned files

  report        Show storage usage report by workspace

  help          Show this help message

Environment:
  GO_DATABASE_URL   PostgreSQL connection string (required)
  UPLOAD_DIR        Upload directory path (default: ./uploads)

Examples:
  # Regenerate all thumbnails
  photo-admin regenerate

  # Regenerate thumbnails for a specific workspace
  photo-admin regenerate --workspace 01234567-89ab-cdef-0123-456789abcdef

  # Preview orphaned files without deleting
  photo-admin cleanup --dry-run

  # Delete orphaned files
  photo-admin cleanup --execute

  # View storage usage
  photo-admin report`)
}

func getDBPool() (*pgxpool.Pool, error) {
	dbURL := os.Getenv("GO_DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("GO_DATABASE_URL environment variable is required")
	}
	return pgxpool.New(context.Background(), dbURL)
}

func getUploadDir() string {
	dir := os.Getenv("UPLOAD_DIR")
	if dir == "" {
		dir = "./uploads"
	}
	return dir
}

func runRegenerate(workspaceID, photoID string, dryRun bool) {
	ctx := context.Background()

	pool, err := getDBPool()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Load image processor config
	cfg, err := imageprocessor.LoadConfigFromEnv()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	processor := imageprocessor.NewProcessor(cfg)

	uploadDir := getUploadDir()

	// Build query
	query := `
		SELECT id, storage_path, thumbnail_path, workspace_id
		FROM warehouse.item_photos
		WHERE 1=1
	`
	args := []any{}
	argNum := 1

	if workspaceID != "" {
		wsID, err := uuid.Parse(workspaceID)
		if err != nil {
			log.Fatalf("Invalid workspace ID: %v", err)
		}
		query += fmt.Sprintf(" AND workspace_id = $%d", argNum)
		args = append(args, wsID)
		argNum++
	}

	if photoID != "" {
		pID, err := uuid.Parse(photoID)
		if err != nil {
			log.Fatalf("Invalid photo ID: %v", err)
		}
		query += fmt.Sprintf(" AND id = $%d", argNum)
		args = append(args, pID)
		argNum++
	}

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		log.Fatalf("Failed to query photos: %v", err)
	}
	defer rows.Close()

	var successCount, errorCount int

	for rows.Next() {
		var id, wsID uuid.UUID
		var storagePath, thumbnailPath string

		if err := rows.Scan(&id, &storagePath, &thumbnailPath, &wsID); err != nil {
			log.Printf("Error scanning row: %v", err)
			errorCount++
			continue
		}

		sourcePath := filepath.Join(uploadDir, storagePath)
		destPath := filepath.Join(uploadDir, thumbnailPath)

		if dryRun {
			fmt.Printf("[DRY-RUN] Would regenerate: %s -> %s\n", storagePath, thumbnailPath)
			successCount++
			continue
		}

		// Check if source exists
		if _, err := os.Stat(sourcePath); os.IsNotExist(err) {
			log.Printf("Source file not found: %s", sourcePath)
			errorCount++
			continue
		}

		// Generate thumbnail
		if err := processor.GenerateThumbnail(ctx, sourcePath, destPath, cfg.MediumSize, cfg.MediumSize); err != nil {
			log.Printf("Error regenerating %s: %v", id, err)
			errorCount++
			continue
		}

		fmt.Printf("Regenerated: %s\n", id)
		successCount++
	}

	fmt.Printf("\nCompleted: %d successful, %d errors\n", successCount, errorCount)
}

func runCleanup(dryRun bool) {
	ctx := context.Background()

	pool, err := getDBPool()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	uploadDir := getUploadDir()

	// Get all file paths from database
	rows, err := pool.Query(ctx, `
		SELECT storage_path, thumbnail_path FROM warehouse.item_photos
	`)
	if err != nil {
		log.Fatalf("Failed to query photos: %v", err)
	}
	defer rows.Close()

	knownFiles := make(map[string]bool)
	for rows.Next() {
		var storagePath, thumbnailPath string
		if err := rows.Scan(&storagePath, &thumbnailPath); err != nil {
			continue
		}
		knownFiles[storagePath] = true
		knownFiles[thumbnailPath] = true
	}

	// Walk the uploads directory and find orphaned files
	var orphanedFiles []string
	var totalOrphanedSize int64

	err = filepath.Walk(uploadDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		// Skip non-image files
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
			return nil
		}

		// Get relative path
		relPath, err := filepath.Rel(uploadDir, path)
		if err != nil {
			return nil
		}

		// Check if file is in database
		if !knownFiles[relPath] {
			orphanedFiles = append(orphanedFiles, path)
			totalOrphanedSize += info.Size()
		}

		return nil
	})

	if err != nil {
		log.Fatalf("Error walking upload directory: %v", err)
	}

	if len(orphanedFiles) == 0 {
		fmt.Println("No orphaned files found.")
		return
	}

	fmt.Printf("Found %d orphaned files (%.2f MB)\n\n", len(orphanedFiles), float64(totalOrphanedSize)/(1024*1024))

	for _, file := range orphanedFiles {
		if dryRun {
			fmt.Printf("[DRY-RUN] Would delete: %s\n", file)
		} else {
			if err := os.Remove(file); err != nil {
				log.Printf("Error deleting %s: %v", file, err)
			} else {
				fmt.Printf("Deleted: %s\n", file)
			}
		}
	}

	if dryRun {
		fmt.Println("\nRun with --execute to actually delete these files.")
	} else {
		fmt.Printf("\nDeleted %d orphaned files.\n", len(orphanedFiles))
	}
}

func runReport() {
	ctx := context.Background()

	pool, err := getDBPool()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Get storage usage by workspace
	rows, err := pool.Query(ctx, `
		SELECT
			w.id,
			w.name,
			COUNT(p.id) as photo_count,
			COALESCE(SUM(p.file_size), 0) as total_size
		FROM auth.workspaces w
		LEFT JOIN warehouse.item_photos p ON p.workspace_id = w.id
		GROUP BY w.id, w.name
		ORDER BY total_size DESC
	`)
	if err != nil {
		log.Fatalf("Failed to query storage: %v", err)
	}
	defer rows.Close()

	fmt.Println("Storage Usage Report")
	fmt.Println("====================")
	fmt.Println()
	fmt.Printf("%-40s %-12s %s\n", "Workspace", "Photos", "Size")
	fmt.Println(strings.Repeat("-", 70))

	var totalPhotos int64
	var totalSize int64

	for rows.Next() {
		var wsID uuid.UUID
		var wsName string
		var photoCount, size int64

		if err := rows.Scan(&wsID, &wsName, &photoCount, &size); err != nil {
			continue
		}

		// Truncate long names
		if len(wsName) > 38 {
			wsName = wsName[:35] + "..."
		}

		fmt.Printf("%-40s %-12d %.2f MB\n", wsName, photoCount, float64(size)/(1024*1024))
		totalPhotos += photoCount
		totalSize += size
	}

	fmt.Println(strings.Repeat("-", 70))
	fmt.Printf("%-40s %-12d %.2f MB\n\n", "TOTAL", totalPhotos, float64(totalSize)/(1024*1024))

	// Get upload directory size
	uploadDir := getUploadDir()
	var diskSize int64
	var fileCount int64

	filepath.Walk(uploadDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		diskSize += info.Size()
		fileCount++
		return nil
	})

	fmt.Printf("Disk usage: %.2f MB (%d files)\n", float64(diskSize)/(1024*1024), fileCount)

	if diskSize > totalSize {
		diff := float64(diskSize-totalSize) / (1024 * 1024)
		fmt.Printf("Potential orphaned data: %.2f MB\n", diff)
		fmt.Println("Run 'photo-admin cleanup --dry-run' to identify orphaned files.")
	}
}
