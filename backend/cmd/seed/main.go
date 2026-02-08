package main

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Seed types
const (
	SeedExpiring     = "expiring"
	SeedWarranty     = "warranty"
	SeedLowStock     = "low-stock"
	SeedOverdueLoans = "overdue-loans"
	SeedLocations    = "locations"
	SeedConditions   = "conditions"
	SeedChanges      = "changes"
	SeedAll          = "all"
)

var validSeedTypes = []string{SeedExpiring, SeedWarranty, SeedLowStock, SeedOverdueLoans, SeedLocations, SeedConditions, SeedChanges, SeedAll}

// Sample data for realistic seeding
var (
	itemNames = []string{
		"Power Drill", "Hammer", "Screwdriver Set", "Wrench Set", "Measuring Tape",
		"Level", "Pliers", "Socket Set", "Saw", "Sander",
		"Paint Brush Set", "Ladder", "Extension Cord", "Work Light", "Tool Box",
		"Drill Bits", "Safety Glasses", "Work Gloves", "Dust Mask", "Ear Protection",
		"Flashlight", "Batteries", "Duct Tape", "WD-40", "Super Glue",
		"First Aid Kit", "Fire Extinguisher", "Smoke Detector", "Carbon Monoxide Detector", "Surge Protector",
		"Camping Tent", "Sleeping Bag", "Camping Stove", "Cooler", "Folding Chair",
		"Bicycle", "Helmet", "Bike Lock", "Tire Pump", "Repair Kit",
		"Garden Hose", "Sprinkler", "Lawn Mower", "Rake", "Shovel",
		"Snow Blower", "Ice Scraper", "Salt Spreader", "Snow Shovel", "Winter Boots",
	}

	brands = []string{
		"DeWalt", "Makita", "Bosch", "Milwaukee", "Black & Decker",
		"Stanley", "Craftsman", "Ryobi", "Kobalt", "Husky",
		"Coleman", "REI", "Patagonia", "The North Face", "Osprey",
		"Trek", "Specialized", "Giant", "Cannondale", "Scott",
		"Honda", "Toro", "Husqvarna", "John Deere", "Stihl",
	}

	locations = []string{
		"Garage", "Basement", "Attic", "Shed", "Storage Room",
		"Kitchen", "Living Room", "Bedroom", "Bathroom", "Office",
		"Workshop", "Utility Room", "Laundry Room", "Closet", "Pantry",
	}

	subLocations = []string{
		"Shelf A", "Shelf B", "Shelf C", "Cabinet 1", "Cabinet 2",
		"Drawer 1", "Drawer 2", "Bin 1", "Bin 2", "Box 1",
		"Hook", "Wall Mount", "Floor", "Corner", "Workbench",
	}

	borrowerNames = []string{
		"John Smith", "Jane Doe", "Bob Johnson", "Alice Williams", "Charlie Brown",
		"David Miller", "Eva Davis", "Frank Wilson", "Grace Moore", "Henry Taylor",
	}

	conditions = []string{"NEW", "EXCELLENT", "GOOD", "FAIR", "POOR", "DAMAGED", "FOR_REPAIR"}
	statuses   = []string{"AVAILABLE", "IN_USE", "RESERVED", "IN_TRANSIT", "DISPOSED", "MISSING"}

	// Categories with subcategories
	categoryTree = map[string][]string{
		"Tools": {"Power Tools", "Hand Tools", "Measuring Tools", "Safety Equipment"},
		"Outdoor": {"Garden", "Camping", "Sports", "Winter"},
		"Home": {"Kitchen", "Bathroom", "Cleaning", "Storage"},
		"Electronics": {"Cables", "Batteries", "Lighting", "Audio"},
		"Automotive": {"Maintenance", "Emergency", "Accessories"},
	}

	// Companies/stores
	companyNames = []string{
		"Amazon", "Home Depot", "Lowe's", "IKEA", "Walmart",
		"Target", "Costco", "Best Buy", "Harbor Freight", "Ace Hardware",
		"REI", "Bass Pro Shops", "Northern Tool", "Grainger", "Menards",
	}

	// Labels with colors
	labelData = []struct {
		name  string
		color string
	}{
		{"Fragile", "#EF4444"},
		{"Heavy", "#F97316"},
		{"Valuable", "#EAB308"},
		{"Urgent", "#DC2626"},
		{"Seasonal", "#3B82F6"},
		{"Borrowed", "#8B5CF6"},
		{"New", "#22C55E"},
		{"To Repair", "#F59E0B"},
		{"To Sell", "#EC4899"},
		{"Archive", "#6B7280"},
	}
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	seedType := strings.ToLower(os.Args[1])
	if !isValidSeedType(seedType) {
		fmt.Printf("Error: Invalid seed type '%s'\n\n", seedType)
		printUsage()
		os.Exit(1)
	}

	// Get database URL
	dbURL := os.Getenv("GO_DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://wh:wh@localhost:5432/warehouse_dev?sslmode=disable"
	}

	ctx := context.Background()

	// Connect to database
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Printf("Error connecting to database: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		fmt.Printf("Error pinging database: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Connected to database\n")

	// Get or create test workspace and user
	workspaceID, userID, err := ensureTestWorkspace(ctx, pool)
	if err != nil {
		fmt.Printf("Error ensuring test workspace: %v\n", err)
		os.Exit(1)
	}

	seeder := &Seeder{
		pool:        pool,
		workspaceID: workspaceID,
		userID:      userID,
		rng:         rand.New(rand.NewSource(time.Now().UnixNano())),
	}

	// Run seeder based on type
	switch seedType {
	case SeedAll:
		if err := seeder.seedAll(ctx); err != nil {
			fmt.Printf("Error seeding all: %v\n", err)
			os.Exit(1)
		}
	case SeedExpiring:
		if err := seeder.seedExpiring(ctx); err != nil {
			fmt.Printf("Error seeding expiring items: %v\n", err)
			os.Exit(1)
		}
	case SeedWarranty:
		if err := seeder.seedWarranty(ctx); err != nil {
			fmt.Printf("Error seeding warranty items: %v\n", err)
			os.Exit(1)
		}
	case SeedLowStock:
		if err := seeder.seedLowStock(ctx); err != nil {
			fmt.Printf("Error seeding low stock items: %v\n", err)
			os.Exit(1)
		}
	case SeedOverdueLoans:
		if err := seeder.seedOverdueLoans(ctx); err != nil {
			fmt.Printf("Error seeding overdue loans: %v\n", err)
			os.Exit(1)
		}
	case SeedLocations:
		if err := seeder.seedLocations(ctx); err != nil {
			fmt.Printf("Error seeding locations: %v\n", err)
			os.Exit(1)
		}
	case SeedConditions:
		if err := seeder.seedConditions(ctx); err != nil {
			fmt.Printf("Error seeding conditions: %v\n", err)
			os.Exit(1)
		}
	case SeedChanges:
		if err := seeder.seedChanges(ctx); err != nil {
			fmt.Printf("Error seeding changes: %v\n", err)
			os.Exit(1)
		}
	}

	fmt.Println("\nSeeding completed successfully!")
}

func printUsage() {
	fmt.Println("Database Seeder - Generate test data for development")
	fmt.Println()
	fmt.Println("Usage: seed <type>")
	fmt.Println()
	fmt.Println("Available seed types:")
	fmt.Println("  expiring      - Items with expiration dates (some expiring soon)")
	fmt.Println("  warranty      - Items with warranty expiration (some expiring soon)")
	fmt.Println("  low-stock     - Items with low or zero stock levels")
	fmt.Println("  overdue-loans - Loans that are past their due date")
	fmt.Println("  locations     - Hierarchical location structure")
	fmt.Println("  conditions    - Items with all conditions and statuses")
	fmt.Println("  changes       - Pending change requests (all statuses and actions)")
	fmt.Println("  all           - Run all seed types")
	fmt.Println()
	fmt.Println("Example: mise run seed expiring")
}

func isValidSeedType(seedType string) bool {
	for _, valid := range validSeedTypes {
		if seedType == valid {
			return true
		}
	}
	return false
}

// Seeder handles database seeding operations
type Seeder struct {
	pool        *pgxpool.Pool
	workspaceID uuid.UUID
	userID      uuid.UUID
	rng         *rand.Rand
}

func ensureTestWorkspace(ctx context.Context, pool *pgxpool.Pool) (uuid.UUID, uuid.UUID, error) {
	// Check if test workspace exists
	var workspaceID uuid.UUID
	err := pool.QueryRow(ctx, `
		SELECT id FROM auth.workspaces WHERE slug = 'seed-test'
	`).Scan(&workspaceID)

	if err == pgx.ErrNoRows {
		// Create test workspace
		workspaceID = uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.workspaces (id, name, slug, description)
			VALUES ($1, 'Seed Test Workspace', 'seed-test', 'Workspace for seeded test data')
		`, workspaceID)
		if err != nil {
			return uuid.Nil, uuid.Nil, fmt.Errorf("creating workspace: %w", err)
		}
		fmt.Println("Created test workspace: seed-test")
	} else if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("checking workspace: %w", err)
	} else {
		fmt.Println("Using existing test workspace: seed-test")
	}

	// Check if test user exists
	var userID uuid.UUID
	err = pool.QueryRow(ctx, `
		SELECT id FROM auth.users WHERE email = 'seeder@test.local'
	`).Scan(&userID)

	if err == pgx.ErrNoRows {
		// Create test user
		userID = uuid.New()
		// Password: password123
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash)
			VALUES ($1, 'seeder@test.local', 'Test Seeder', '$2a$10$OedVwpGWe4iRJxl4AO7qIOj3u19vhdgQNvhAk3GdSFb2B72zvPJ1i')
		`, userID)
		if err != nil {
			return uuid.Nil, uuid.Nil, fmt.Errorf("creating user: %w", err)
		}

		// Add user as workspace owner
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.workspace_members (workspace_id, user_id, role)
			VALUES ($1, $2, 'owner')
		`, workspaceID, userID)
		if err != nil {
			return uuid.Nil, uuid.Nil, fmt.Errorf("adding workspace member: %w", err)
		}
		fmt.Println("Created test user: seeder@test.local (password: password123)")
	} else if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("checking user: %w", err)
	} else {
		fmt.Println("Using existing test user: seeder@test.local (password: password123)")
	}

	return workspaceID, userID, nil
}

func (s *Seeder) seedAll(ctx context.Context) error {
	fmt.Println("\n=== Seeding all data types ===")

	if err := s.seedCategories(ctx); err != nil {
		return err
	}
	if err := s.seedCompanies(ctx); err != nil {
		return err
	}
	if err := s.seedLabels(ctx); err != nil {
		return err
	}
	if err := s.seedLocations(ctx); err != nil {
		return err
	}
	if err := s.seedConditions(ctx); err != nil {
		return err
	}
	if err := s.seedExpiring(ctx); err != nil {
		return err
	}
	if err := s.seedWarranty(ctx); err != nil {
		return err
	}
	if err := s.seedLowStock(ctx); err != nil {
		return err
	}
	if err := s.seedOverdueLoans(ctx); err != nil {
		return err
	}
	if err := s.seedChanges(ctx); err != nil {
		return err
	}

	return nil
}

func (s *Seeder) seedCategories(ctx context.Context) error {
	fmt.Println("\n--- Seeding categories ---")

	for parentName, children := range categoryTree {
		// Check if parent category already exists
		var parentID uuid.UUID
		err := s.pool.QueryRow(ctx, `
			SELECT id FROM warehouse.categories WHERE workspace_id = $1 AND name = $2 AND parent_category_id IS NULL
		`, s.workspaceID, parentName).Scan(&parentID)

		if err == pgx.ErrNoRows {
			parentID = uuid.New()
			_, err = s.pool.Exec(ctx, `
				INSERT INTO warehouse.categories (id, workspace_id, name, description)
				VALUES ($1, $2, $3, $4)
			`, parentID, s.workspaceID, parentName, fmt.Sprintf("Category for %s", parentName))
			if err != nil {
				return fmt.Errorf("creating category %s: %w", parentName, err)
			}
			fmt.Printf("  Created category: %s\n", parentName)
		} else if err != nil {
			return fmt.Errorf("checking category %s: %w", parentName, err)
		} else {
			fmt.Printf("  Existing category: %s\n", parentName)
		}

		// Create child categories
		for _, childName := range children {
			var childID uuid.UUID
			err := s.pool.QueryRow(ctx, `
				SELECT id FROM warehouse.categories WHERE workspace_id = $1 AND name = $2 AND parent_category_id = $3
			`, s.workspaceID, childName, parentID).Scan(&childID)

			if err == pgx.ErrNoRows {
				childID = uuid.New()
				_, err = s.pool.Exec(ctx, `
					INSERT INTO warehouse.categories (id, workspace_id, name, parent_category_id, description)
					VALUES ($1, $2, $3, $4, $5)
				`, childID, s.workspaceID, childName, parentID, fmt.Sprintf("Subcategory of %s", parentName))
				if err != nil {
					return fmt.Errorf("creating subcategory %s > %s: %w", parentName, childName, err)
				}
				fmt.Printf("    Created subcategory: %s > %s\n", parentName, childName)
			} else if err != nil {
				return fmt.Errorf("checking subcategory %s > %s: %w", parentName, childName, err)
			}
		}
	}

	fmt.Println("  Categories seeding complete")
	return nil
}

func (s *Seeder) seedCompanies(ctx context.Context) error {
	fmt.Println("\n--- Seeding companies ---")

	for _, name := range companyNames {
		companyID := uuid.New()
		website := fmt.Sprintf("https://www.%s.com", strings.ToLower(strings.ReplaceAll(name, " ", "")))
		_, err := s.pool.Exec(ctx, `
			INSERT INTO warehouse.companies (id, workspace_id, name, website, notes)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (workspace_id, name) DO NOTHING
		`, companyID, s.workspaceID, name, website, fmt.Sprintf("Retail store: %s", name))
		if err != nil {
			continue
		}
		fmt.Printf("  Created company: %s\n", name)
	}

	fmt.Println("  Companies seeding complete")
	return nil
}

func (s *Seeder) seedLabels(ctx context.Context) error {
	fmt.Println("\n--- Seeding labels ---")

	for _, label := range labelData {
		labelID := uuid.New()
		_, err := s.pool.Exec(ctx, `
			INSERT INTO warehouse.labels (id, workspace_id, name, color, description)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (workspace_id, name) DO NOTHING
		`, labelID, s.workspaceID, label.name, label.color, fmt.Sprintf("Label: %s", label.name))
		if err != nil {
			continue
		}
		fmt.Printf("  Created label: %s (%s)\n", label.name, label.color)
	}

	fmt.Println("  Labels seeding complete")
	return nil
}

func (s *Seeder) seedLocations(ctx context.Context) error {
	fmt.Println("\n--- Seeding locations ---")

	// Create hierarchical locations
	for _, loc := range locations[:5] { // Create 5 top-level locations
		locID := uuid.New()
		shortCode := s.generateShortCode()

		_, err := s.pool.Exec(ctx, `
			INSERT INTO warehouse.locations (id, workspace_id, name, short_code, description)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (workspace_id, short_code) DO NOTHING
		`, locID, s.workspaceID, loc, shortCode, fmt.Sprintf("Main %s area", loc))
		if err != nil {
			return fmt.Errorf("creating location %s: %w", loc, err)
		}
		fmt.Printf("  Created location: %s\n", loc)

		// Create sub-locations
		for _, subLoc := range subLocations[:3] { // 3 sub-locations each
			subLocID := uuid.New()
			subShortCode := s.generateShortCode()

			_, err := s.pool.Exec(ctx, `
				INSERT INTO warehouse.locations (id, workspace_id, name, parent_location, short_code, description)
				VALUES ($1, $2, $3, $4, $5, $6)
				ON CONFLICT (workspace_id, short_code) DO NOTHING
			`, subLocID, s.workspaceID, subLoc, locID, subShortCode, fmt.Sprintf("%s in %s", subLoc, loc))
			if err != nil {
				// Ignore duplicates
				continue
			}
			fmt.Printf("    Created sub-location: %s > %s\n", loc, subLoc)

			// Create containers in some sub-locations
			if s.rng.Float32() < 0.5 {
				containerID := uuid.New()
				containerShortCode := s.generateShortCode()
				containerName := fmt.Sprintf("Box %d", s.rng.Intn(100)+1)

				_, err := s.pool.Exec(ctx, `
					INSERT INTO warehouse.containers (id, workspace_id, name, location_id, short_code, description)
					VALUES ($1, $2, $3, $4, $5, $6)
					ON CONFLICT (workspace_id, short_code) DO NOTHING
				`, containerID, s.workspaceID, containerName, subLocID, containerShortCode, fmt.Sprintf("Storage container in %s", subLoc))
				if err != nil {
					continue
				}
				fmt.Printf("      Created container: %s\n", containerName)
			}
		}
	}

	fmt.Println("  Locations seeding complete")
	return nil
}

func (s *Seeder) seedConditions(ctx context.Context) error {
	fmt.Println("\n--- Seeding items with all conditions and statuses ---")

	locationID, err := s.getOrCreateLocation(ctx)
	if err != nil {
		return err
	}

	// Create inventory items for each condition
	fmt.Println("  Creating items for each condition:")
	for i, condition := range conditions {
		brand := brands[s.rng.Intn(len(brands))]
		itemName := fmt.Sprintf("%s %s (%s condition)", brand, itemNames[s.rng.Intn(len(itemNames))], condition)
		itemID, err := s.createItemWithBrand(ctx, itemName, fmt.Sprintf("COND-%03d", i+1), brand)
		if err != nil {
			return err
		}

		purchasePrice := int32((s.rng.Intn(50) + 1) * 1000) // $10-$500 in cents
		_, err = s.pool.Exec(ctx, `
			INSERT INTO warehouse.inventory (workspace_id, item_id, location_id, quantity, condition, status, purchase_price, currency_code)
			VALUES ($1, $2, $3, $4, $5, 'AVAILABLE', $6, 'EUR')
		`, s.workspaceID, itemID, locationID, s.rng.Intn(5)+1, condition, purchasePrice)
		if err != nil {
			return fmt.Errorf("creating inventory for condition %s: %w", condition, err)
		}
		fmt.Printf("    Created: %s\n", itemName)
	}

	// Create inventory items for each status (except ON_LOAN which is handled by loans)
	fmt.Println("  Creating items for each status:")
	for i, status := range statuses {
		brand := brands[s.rng.Intn(len(brands))]
		itemName := fmt.Sprintf("%s %s (%s status)", brand, itemNames[s.rng.Intn(len(itemNames))], status)
		itemID, err := s.createItemWithBrand(ctx, itemName, fmt.Sprintf("STAT-%03d", i+1), brand)
		if err != nil {
			return err
		}

		// Pick a random condition for variety
		condition := conditions[s.rng.Intn(len(conditions))]
		purchasePrice := int32((s.rng.Intn(50) + 1) * 1000)
		_, err = s.pool.Exec(ctx, `
			INSERT INTO warehouse.inventory (workspace_id, item_id, location_id, quantity, condition, status, purchase_price, currency_code)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'EUR')
		`, s.workspaceID, itemID, locationID, s.rng.Intn(5)+1, condition, status, purchasePrice)
		if err != nil {
			return fmt.Errorf("creating inventory for status %s: %w", status, err)
		}
		fmt.Printf("    Created: %s\n", itemName)
	}

	fmt.Println("  Conditions and statuses seeding complete")
	return nil
}

func (s *Seeder) seedChanges(ctx context.Context) error {
	fmt.Println("\n--- Seeding pending changes ---")

	// Create or get a member user for the pending changes
	memberID, err := s.ensureMemberUser(ctx)
	if err != nil {
		return err
	}

	// Get some existing entities to reference in changes
	var itemID, locationID, categoryID uuid.UUID
	_ = s.pool.QueryRow(ctx, `SELECT id FROM warehouse.items WHERE workspace_id = $1 LIMIT 1`, s.workspaceID).Scan(&itemID)
	_ = s.pool.QueryRow(ctx, `SELECT id FROM warehouse.locations WHERE workspace_id = $1 LIMIT 1`, s.workspaceID).Scan(&locationID)
	_ = s.pool.QueryRow(ctx, `SELECT id FROM warehouse.categories WHERE workspace_id = $1 LIMIT 1`, s.workspaceID).Scan(&categoryID)

	// Define change requests with various statuses, actions, and entity types
	// For updates, payload includes both old_values and new_values for proper diff display
	changes := []struct {
		entityType  string
		entityID    *uuid.UUID
		action      string
		status      string
		payload     string
		desc        string
		requesterID uuid.UUID // Who submitted the change
	}{
		// Pending changes from member user (for Approvals page)
		{"item", nil, "create", "pending", `{"name": "New Power Drill", "sku": "PEND-001", "brand": "DeWalt"}`, "Create new item (pending)", memberID},
		{"item", &itemID, "update", "pending", `{"old_values": {"name": "Original Item Name", "brand": "Generic"}, "new_values": {"name": "Updated Item Name", "brand": "Makita"}}`, "Update item (pending)", memberID},
		{"location", nil, "create", "pending", `{"name": "New Storage Room", "description": "Additional storage space"}`, "Create location (pending)", memberID},
		{"category", nil, "create", "pending", `{"name": "New Category", "description": "A new category for items"}`, "Create category (pending)", memberID},
		{"container", nil, "create", "pending", `{"name": "Box 99", "description": "New storage container"}`, "Create container (pending)", memberID},

		// Approved changes from member user
		{"item", nil, "create", "approved", `{"name": "Approved Hammer", "sku": "APPR-001", "brand": "Stanley"}`, "Create item (approved)", memberID},
		{"location", &locationID, "update", "approved", `{"old_values": {"name": "Old Location", "description": null}, "new_values": {"name": "Updated Location", "description": "Reorganized storage"}}`, "Update location (approved)", memberID},

		// Rejected changes from member user
		{"item", nil, "create", "rejected", `{"name": "Rejected Item", "sku": "REJ-001"}`, "Create item (rejected - duplicate SKU)", memberID},
		{"item", &itemID, "delete", "rejected", `{}`, "Delete item (rejected - still in use)", memberID},

		// Changes from owner/admin user (for My Changes page when logged in as admin)
		{"borrower", nil, "create", "pending", `{"name": "Alice Johnson", "email": "alice@example.com", "phone": "+1234567890"}`, "Create borrower (my pending)", s.userID},
		{"item", nil, "create", "pending", `{"name": "Cordless Screwdriver", "sku": "MY-001", "brand": "Bosch", "description": "18V cordless screwdriver with case"}`, "Create item (my pending)", s.userID},
		{"container", nil, "create", "pending", `{"name": "Tool Cabinet", "description": "Large metal cabinet for power tools"}`, "Create container (my pending)", s.userID},
		{"item", &itemID, "update", "approved", `{"old_values": {"description": null}, "new_values": {"description": "Added detailed description"}}`, "Update item description (my approved)", s.userID},
		{"location", nil, "create", "approved", `{"name": "Workshop Corner", "description": "Dedicated workspace area"}`, "Create location (my approved)", s.userID},
		{"category", nil, "create", "rejected", `{"name": "Duplicate Category"}`, "Create category (my rejected - already exists)", s.userID},
		{"location", &locationID, "delete", "rejected", `{}`, "Delete location (my rejected - has inventory)", s.userID},
	}

	for i, change := range changes {
		changeID := uuid.New()

		// Set reviewed_by and reviewed_at for non-pending changes
		var reviewedBy *uuid.UUID
		var reviewedAt *time.Time
		var rejectionReason *string

		if change.status != "pending" {
			reviewedBy = &s.userID
			now := time.Now().Add(-time.Duration(s.rng.Intn(7*24)) * time.Hour) // Random time in last week
			reviewedAt = &now
		}

		if change.status == "rejected" {
			// Use translation keys that frontend will translate
			reasons := []string{
				"rejectionReasons.duplicateEntry",
				"rejectionReasons.itemInUse",
				"rejectionReasons.locationHasItems",
				"rejectionReasons.categoryHasItems",
				"rejectionReasons.insufficientJustification",
			}
			reason := reasons[i%len(reasons)]
			rejectionReason = &reason
		}

		// Calculate created_at (before reviewed_at if applicable)
		createdAt := time.Now().Add(-time.Duration(s.rng.Intn(14*24)+24) * time.Hour)
		if reviewedAt != nil && createdAt.After(*reviewedAt) {
			createdAt = reviewedAt.Add(-time.Duration(s.rng.Intn(48)+1) * time.Hour)
		}

		_, err := s.pool.Exec(ctx, `
			INSERT INTO warehouse.pending_changes (id, workspace_id, requester_id, entity_type, entity_id, action, payload, status, reviewed_by, reviewed_at, rejection_reason, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			ON CONFLICT DO NOTHING
		`, changeID, s.workspaceID, change.requesterID, change.entityType, change.entityID, change.action, change.payload, change.status, reviewedBy, reviewedAt, rejectionReason, createdAt)
		if err != nil {
			return fmt.Errorf("creating pending change: %w", err)
		}
		fmt.Printf("  Created: %s\n", change.desc)
	}

	fmt.Println("  Pending changes seeding complete")
	return nil
}

func (s *Seeder) ensureMemberUser(ctx context.Context) (uuid.UUID, error) {
	// Check if member user exists
	var memberID uuid.UUID
	err := s.pool.QueryRow(ctx, `
		SELECT id FROM auth.users WHERE email = 'member@test.local'
	`).Scan(&memberID)

	if err == pgx.ErrNoRows {
		// Create member user
		memberID = uuid.New()
		// Password: password123
		_, err = s.pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash)
			VALUES ($1, 'member@test.local', 'Test Member', '$2a$10$OedVwpGWe4iRJxl4AO7qIOj3u19vhdgQNvhAk3GdSFb2B72zvPJ1i')
		`, memberID)
		if err != nil {
			return uuid.Nil, fmt.Errorf("creating member user: %w", err)
		}

		// Add user as workspace member
		_, err = s.pool.Exec(ctx, `
			INSERT INTO auth.workspace_members (workspace_id, user_id, role)
			VALUES ($1, $2, 'member')
		`, s.workspaceID, memberID)
		if err != nil {
			return uuid.Nil, fmt.Errorf("adding workspace member: %w", err)
		}
		fmt.Println("  Created member user: member@test.local (password: password123)")
	} else if err != nil {
		return uuid.Nil, fmt.Errorf("checking member user: %w", err)
	} else {
		fmt.Println("  Using existing member user: member@test.local")
	}

	return memberID, nil
}

func (s *Seeder) seedExpiring(ctx context.Context) error {
	fmt.Println("\n--- Seeding expiring items ---")

	locationID, err := s.getOrCreateLocation(ctx)
	if err != nil {
		return err
	}

	// Create items with various expiration dates
	expirations := []struct {
		days int
		desc string
	}{
		{-7, "expired 1 week ago"},
		{-1, "expired yesterday"},
		{0, "expires today"},
		{1, "expires tomorrow"},
		{7, "expires in 1 week"},
		{14, "expires in 2 weeks"},
		{30, "expires in 1 month"},
		{90, "expires in 3 months"},
		{365, "expires in 1 year"},
	}

	for i, exp := range expirations {
		itemName := fmt.Sprintf("Consumable Item %d (%s)", i+1, exp.desc)
		itemID, err := s.createItem(ctx, itemName, fmt.Sprintf("CONS-%03d", i+1))
		if err != nil {
			return err
		}

		expirationDate := time.Now().AddDate(0, 0, exp.days)
		_, err = s.pool.Exec(ctx, `
			INSERT INTO warehouse.inventory (workspace_id, item_id, location_id, quantity, condition, status, expiration_date)
			VALUES ($1, $2, $3, $4, 'GOOD', 'AVAILABLE', $5)
		`, s.workspaceID, itemID, locationID, s.rng.Intn(10)+1, expirationDate)
		if err != nil {
			return fmt.Errorf("creating inventory for expiring item: %w", err)
		}
		fmt.Printf("  Created: %s (expires: %s)\n", itemName, expirationDate.Format("2006-01-02"))
	}

	fmt.Println("  Expiring items seeding complete")
	return nil
}

func (s *Seeder) seedWarranty(ctx context.Context) error {
	fmt.Println("\n--- Seeding warranty items ---")

	locationID, err := s.getOrCreateLocation(ctx)
	if err != nil {
		return err
	}

	// Create items with various warranty expiration dates
	warranties := []struct {
		days int
		desc string
	}{
		{-30, "warranty expired 1 month ago"},
		{-7, "warranty expired 1 week ago"},
		{7, "warranty expires in 1 week"},
		{14, "warranty expires in 2 weeks"},
		{30, "warranty expires in 1 month"},
		{60, "warranty expires in 2 months"},
		{180, "warranty expires in 6 months"},
		{365, "warranty expires in 1 year"},
		{730, "warranty expires in 2 years"},
	}

	for i, w := range warranties {
		brand := brands[s.rng.Intn(len(brands))]
		itemName := fmt.Sprintf("%s %s", brand, itemNames[s.rng.Intn(len(itemNames))])
		itemID, err := s.createItemWithBrand(ctx, itemName, fmt.Sprintf("WARR-%03d", i+1), brand)
		if err != nil {
			return err
		}

		warrantyDate := time.Now().AddDate(0, 0, w.days)
		purchasePrice := int32((s.rng.Intn(50) + 1) * 1000) // $10-$500 in cents
		_, err = s.pool.Exec(ctx, `
			INSERT INTO warehouse.inventory (workspace_id, item_id, location_id, quantity, condition, status, warranty_expires, purchase_price, currency_code)
			VALUES ($1, $2, $3, 1, 'GOOD', 'AVAILABLE', $4, $5, 'EUR')
		`, s.workspaceID, itemID, locationID, warrantyDate, purchasePrice)
		if err != nil {
			return fmt.Errorf("creating inventory for warranty item: %w", err)
		}
		fmt.Printf("  Created: %s (warranty: %s)\n", itemName, warrantyDate.Format("2006-01-02"))
	}

	fmt.Println("  Warranty items seeding complete")
	return nil
}

func (s *Seeder) seedLowStock(ctx context.Context) error {
	fmt.Println("\n--- Seeding low stock items ---")

	locationID, err := s.getOrCreateLocation(ctx)
	if err != nil {
		return err
	}

	// Create items with various stock levels
	stockLevels := []struct {
		quantity     int
		minStock     int
		desc         string
	}{
		{0, 5, "out of stock"},
		{1, 10, "critically low"},
		{2, 5, "low stock"},
		{3, 5, "at minimum"},
		{5, 5, "exactly at threshold"},
		{10, 5, "above threshold"},
	}

	for i, stock := range stockLevels {
		itemName := fmt.Sprintf("Consumable Supply %d (%s)", i+1, stock.desc)
		itemID, err := s.createItemWithMinStock(ctx, itemName, fmt.Sprintf("STCK-%03d", i+1), int32(stock.minStock))
		if err != nil {
			return err
		}

		_, err = s.pool.Exec(ctx, `
			INSERT INTO warehouse.inventory (workspace_id, item_id, location_id, quantity, condition, status)
			VALUES ($1, $2, $3, $4, 'GOOD', 'AVAILABLE')
		`, s.workspaceID, itemID, locationID, stock.quantity)
		if err != nil {
			return fmt.Errorf("creating inventory for low stock item: %w", err)
		}
		fmt.Printf("  Created: %s (qty: %d, min: %d)\n", itemName, stock.quantity, stock.minStock)
	}

	fmt.Println("  Low stock items seeding complete")
	return nil
}

func (s *Seeder) seedOverdueLoans(ctx context.Context) error {
	fmt.Println("\n--- Seeding overdue loans ---")

	locationID, err := s.getOrCreateLocation(ctx)
	if err != nil {
		return err
	}

	// Create borrowers
	borrowerIDs := make([]uuid.UUID, 0, 5)
	for i := 0; i < 5; i++ {
		name := borrowerNames[i]
		email := fmt.Sprintf("%s@example.com", strings.ToLower(strings.ReplaceAll(name, " ", ".")))

		var borrowerID uuid.UUID
		err := s.pool.QueryRow(ctx, `
			SELECT id FROM warehouse.borrowers WHERE workspace_id = $1 AND name = $2
		`, s.workspaceID, name).Scan(&borrowerID)

		if err == pgx.ErrNoRows {
			borrowerID = uuid.New()
			_, err = s.pool.Exec(ctx, `
				INSERT INTO warehouse.borrowers (id, workspace_id, name, email)
				VALUES ($1, $2, $3, $4)
			`, borrowerID, s.workspaceID, name, email)
			if err != nil {
				return fmt.Errorf("creating borrower %s: %w", name, err)
			}
			fmt.Printf("  Created borrower: %s\n", name)
		} else if err != nil {
			return fmt.Errorf("checking borrower %s: %w", name, err)
		} else {
			fmt.Printf("  Existing borrower: %s\n", name)
		}
		borrowerIDs = append(borrowerIDs, borrowerID)
	}

	// Create loans with various due dates
	loans := []struct {
		daysOverdue int
		desc        string
	}{
		{30, "1 month overdue"},
		{14, "2 weeks overdue"},
		{7, "1 week overdue"},
		{3, "3 days overdue"},
		{1, "1 day overdue"},
		{0, "due today"},
		{-1, "due tomorrow"},
		{-7, "due in 1 week"},
	}

	for i, loan := range loans {
		brand := brands[s.rng.Intn(len(brands))]
		itemName := fmt.Sprintf("%s %s", brand, itemNames[s.rng.Intn(len(itemNames))])
		itemID, err := s.createItemWithBrand(ctx, itemName, fmt.Sprintf("LOAN-%03d", i+1), brand)
		if err != nil {
			return err
		}

		// Create inventory
		inventoryID := uuid.New()
		_, err = s.pool.Exec(ctx, `
			INSERT INTO warehouse.inventory (id, workspace_id, item_id, location_id, quantity, condition, status)
			VALUES ($1, $2, $3, $4, 1, 'GOOD', 'ON_LOAN')
		`, inventoryID, s.workspaceID, itemID, locationID)
		if err != nil {
			return fmt.Errorf("creating inventory for loan: %w", err)
		}

		// Create loan
		dueDate := time.Now().AddDate(0, 0, -loan.daysOverdue)
		loanedAt := dueDate.AddDate(0, 0, -14) // Loaned 2 weeks before due date
		borrowerID := borrowerIDs[i%len(borrowerIDs)]

		_, err = s.pool.Exec(ctx, `
			INSERT INTO warehouse.loans (workspace_id, inventory_id, borrower_id, quantity, loaned_at, due_date, notes)
			VALUES ($1, $2, $3, 1, $4, $5, $6)
		`, s.workspaceID, inventoryID, borrowerID, loanedAt, dueDate, loan.desc)
		if err != nil {
			return fmt.Errorf("creating loan: %w", err)
		}
		fmt.Printf("  Created loan: %s (%s)\n", itemName, loan.desc)
	}

	fmt.Println("  Overdue loans seeding complete")
	return nil
}

// Helper functions

func (s *Seeder) getOrCreateLocation(ctx context.Context) (uuid.UUID, error) {
	// Try to get existing location
	var locationID uuid.UUID
	err := s.pool.QueryRow(ctx, `
		SELECT id FROM warehouse.locations WHERE workspace_id = $1 LIMIT 1
	`, s.workspaceID).Scan(&locationID)

	if err == pgx.ErrNoRows {
		// Create a default location
		locationID = uuid.New()
		shortCode := s.generateShortCode()
		_, err = s.pool.Exec(ctx, `
			INSERT INTO warehouse.locations (id, workspace_id, name, short_code, description)
			VALUES ($1, $2, 'Default Storage', $3, 'Default location for seeded items')
		`, locationID, s.workspaceID, shortCode)
		if err != nil {
			return uuid.Nil, fmt.Errorf("creating default location: %w", err)
		}
	} else if err != nil {
		return uuid.Nil, fmt.Errorf("getting location: %w", err)
	}

	return locationID, nil
}

func (s *Seeder) createItem(ctx context.Context, name, sku string) (uuid.UUID, error) {
	return s.createItemWithBrand(ctx, name, sku, "")
}

func (s *Seeder) createItemWithBrand(ctx context.Context, name, sku, brand string) (uuid.UUID, error) {
	itemID := uuid.New()
	shortCode := s.generateShortCode()

	var brandPtr *string
	if brand != "" {
		brandPtr = &brand
	}

	// Get a random category
	categoryID := s.getRandomCategory(ctx)

	// Get a random company
	companyID := s.getRandomCompany(ctx)

	_, err := s.pool.Exec(ctx, `
		INSERT INTO warehouse.items (id, workspace_id, sku, name, brand, short_code, category_id, purchased_from)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (workspace_id, sku) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, itemID, s.workspaceID, sku, name, brandPtr, shortCode, categoryID, companyID)
	if err != nil {
		// If conflict, get the existing item
		err = s.pool.QueryRow(ctx, `
			SELECT id FROM warehouse.items WHERE workspace_id = $1 AND sku = $2
		`, s.workspaceID, sku).Scan(&itemID)
		if err != nil {
			return uuid.Nil, fmt.Errorf("getting existing item: %w", err)
		}
	}

	// Add random labels to item
	s.addRandomLabels(ctx, itemID)

	return itemID, nil
}

func (s *Seeder) createItemWithMinStock(ctx context.Context, name, sku string, minStock int32) (uuid.UUID, error) {
	itemID := uuid.New()
	shortCode := s.generateShortCode()

	_, err := s.pool.Exec(ctx, `
		INSERT INTO warehouse.items (id, workspace_id, sku, name, short_code, min_stock_level)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (workspace_id, sku) DO UPDATE SET name = EXCLUDED.name, min_stock_level = EXCLUDED.min_stock_level
		RETURNING id
	`, itemID, s.workspaceID, sku, name, shortCode, minStock)
	if err != nil {
		// If conflict, get the existing item
		err = s.pool.QueryRow(ctx, `
			SELECT id FROM warehouse.items WHERE workspace_id = $1 AND sku = $2
		`, s.workspaceID, sku).Scan(&itemID)
		if err != nil {
			return uuid.Nil, fmt.Errorf("getting existing item: %w", err)
		}
	}

	return itemID, nil
}

func (s *Seeder) generateShortCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, 6)
	for i := range code {
		code[i] = chars[s.rng.Intn(len(chars))]
	}
	return string(code)
}

func (s *Seeder) getRandomCategory(ctx context.Context) *uuid.UUID {
	var categoryID uuid.UUID
	// Get a random subcategory (not parent) for more specificity
	err := s.pool.QueryRow(ctx, `
		SELECT id FROM warehouse.categories
		WHERE workspace_id = $1 AND parent_category_id IS NOT NULL
		ORDER BY RANDOM() LIMIT 1
	`, s.workspaceID).Scan(&categoryID)
	if err != nil {
		return nil
	}
	return &categoryID
}

func (s *Seeder) getRandomCompany(ctx context.Context) *uuid.UUID {
	var companyID uuid.UUID
	err := s.pool.QueryRow(ctx, `
		SELECT id FROM warehouse.companies
		WHERE workspace_id = $1
		ORDER BY RANDOM() LIMIT 1
	`, s.workspaceID).Scan(&companyID)
	if err != nil {
		return nil
	}
	return &companyID
}

func (s *Seeder) addRandomLabels(ctx context.Context, itemID uuid.UUID) {
	// 70% chance to add labels
	if s.rng.Float32() > 0.7 {
		return
	}

	// Get all labels
	rows, err := s.pool.Query(ctx, `
		SELECT id FROM warehouse.labels WHERE workspace_id = $1
	`, s.workspaceID)
	if err != nil {
		return
	}
	defer rows.Close()

	var labelIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err == nil {
			labelIDs = append(labelIDs, id)
		}
	}

	if len(labelIDs) == 0 {
		return
	}

	// Add 1-3 random labels
	numLabels := s.rng.Intn(3) + 1
	if numLabels > len(labelIDs) {
		numLabels = len(labelIDs)
	}

	// Shuffle and pick first N
	s.rng.Shuffle(len(labelIDs), func(i, j int) {
		labelIDs[i], labelIDs[j] = labelIDs[j], labelIDs[i]
	})

	for i := 0; i < numLabels; i++ {
		_, _ = s.pool.Exec(ctx, `
			INSERT INTO warehouse.item_labels (item_id, label_id)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, itemID, labelIDs[i])
	}
}
