package worker

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
)

func TestParseInventoryQuantity(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want int
	}{
		{"blank defaults to 1", "", 1},
		{"zero defaults to 1", "0", 1},
		{"negative defaults to 1", "-5", 1},
		{"non-numeric defaults to 1", "abc", 1},
		{"valid positive int", "3", 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseInventoryQuantity(tt.in); got != tt.want {
				t.Errorf("parseInventoryQuantity(%q) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}

func TestParseInventoryCondition(t *testing.T) {
	tests := []struct {
		name string
		row  map[string]string
		want inventory.Condition
	}{
		{"blank defaults to good", map[string]string{}, inventory.ConditionGood},
		{"invalid defaults to good", map[string]string{"condition": "SHINY"}, inventory.ConditionGood},
		{"valid uppercase", map[string]string{"condition": "EXCELLENT"}, inventory.ConditionExcellent},
		{"valid lowercase normalized", map[string]string{"condition": "fair"}, inventory.ConditionFair},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseInventoryCondition(tt.row); got != tt.want {
				t.Errorf("parseInventoryCondition(%v) = %q, want %q", tt.row, got, tt.want)
			}
		})
	}
}

func TestParseInventoryStatus(t *testing.T) {
	tests := []struct {
		name string
		row  map[string]string
		want inventory.Status
	}{
		{"blank defaults to available", map[string]string{}, inventory.StatusAvailable},
		{"invalid defaults to available", map[string]string{"status": "LOST_IN_SPACE"}, inventory.StatusAvailable},
		{"valid uppercase", map[string]string{"status": "ON_LOAN"}, inventory.StatusOnLoan},
		{"valid lowercase normalized", map[string]string{"status": "reserved"}, inventory.StatusReserved},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseInventoryStatus(tt.row); got != tt.want {
				t.Errorf("parseInventoryStatus(%v) = %q, want %q", tt.row, got, tt.want)
			}
		})
	}
}

func TestParseInventoryPurchasePrice(t *testing.T) {
	if got := parseInventoryPurchasePrice(map[string]string{}); got != nil {
		t.Errorf("blank price = %v, want nil", got)
	}
	if got := parseInventoryPurchasePrice(map[string]string{"purchase_price": "not-a-number"}); got != nil {
		t.Errorf("non-numeric price = %v, want nil", got)
	}
	got := parseInventoryPurchasePrice(map[string]string{"purchase_price": "1999"})
	if got == nil || *got != 1999 {
		t.Errorf("purchase_price = %v, want 1999", got)
	}
}

func TestParseInventoryDateAcquired(t *testing.T) {
	if got := parseInventoryDateAcquired(map[string]string{}); got != nil {
		t.Errorf("blank date = %v, want nil", got)
	}
	if got := parseInventoryDateAcquired(map[string]string{"date_acquired": "15/01/2024"}); got != nil {
		t.Errorf("unparseable date = %v, want nil", got)
	}
	got := parseInventoryDateAcquired(map[string]string{"date_acquired": "2024-01-15"})
	want := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	if got == nil || !got.Equal(want) {
		t.Errorf("date_acquired = %v, want %v", got, want)
	}
}

func TestInventoryImportCaches_ResolveContainerID(t *testing.T) {
	loc := mustLocation(t)
	cont, err := container.NewContainer(loc.WorkspaceID(), loc.ID(), "Bin A", nil, nil, "BIN-A")
	if err != nil {
		t.Fatalf("NewContainer: %v", err)
	}
	caches := &inventoryImportCaches{
		containers: map[string]*container.Container{
			"bin a": cont,
		},
	}

	if got := caches.resolveContainerID(map[string]string{}); got != nil {
		t.Errorf("blank container ref = %v, want nil", got)
	}
	if got := caches.resolveContainerID(map[string]string{"container": "unknown"}); got != nil {
		t.Errorf("unknown container ref = %v, want nil", got)
	}
	got := caches.resolveContainerID(map[string]string{"container": "Bin A"})
	if got == nil || *got != cont.ID() {
		t.Errorf("resolveContainerID case-insensitive match = %v, want %v", got, cont.ID())
	}
}

func TestBuildInventoryCreateInput(t *testing.T) {
	workspaceID := uuid.New()
	itm, err := item.NewItem(workspaceID, "Drill", "SKU-1", 0)
	if err != nil {
		t.Fatalf("NewItem: %v", err)
	}
	loc := mustLocation(t)
	cont, err := container.NewContainer(loc.WorkspaceID(), loc.ID(), "Bin A", nil, nil, "BIN-A")
	if err != nil {
		t.Fatalf("NewContainer: %v", err)
	}
	caches := &inventoryImportCaches{
		containers: map[string]*container.Container{"bin a": cont},
	}

	row := map[string]string{
		"container":      "Bin A",
		"quantity":       "5",
		"condition":      "NEW",
		"status":         "IN_USE",
		"date_acquired":  "2024-01-15",
		"purchase_price": "2500",
		"currency_code":  "USD",
		"notes":          "handle with care",
	}

	got := buildInventoryCreateInput(workspaceID, itm, loc, caches, row)

	if got.WorkspaceID != workspaceID {
		t.Errorf("WorkspaceID = %v, want %v", got.WorkspaceID, workspaceID)
	}
	if got.ItemID != itm.ID() {
		t.Errorf("ItemID = %v, want %v", got.ItemID, itm.ID())
	}
	if got.LocationID != loc.ID() {
		t.Errorf("LocationID = %v, want %v", got.LocationID, loc.ID())
	}
	if got.ContainerID == nil || *got.ContainerID != cont.ID() {
		t.Errorf("ContainerID = %v, want %v", got.ContainerID, cont.ID())
	}
	if got.Quantity != 5 {
		t.Errorf("Quantity = %d, want 5", got.Quantity)
	}
	if got.Condition != inventory.ConditionNew {
		t.Errorf("Condition = %q, want %q", got.Condition, inventory.ConditionNew)
	}
	if got.Status != inventory.StatusInUse {
		t.Errorf("Status = %q, want %q", got.Status, inventory.StatusInUse)
	}
	if got.DateAcquired == nil || !got.DateAcquired.Equal(time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("DateAcquired = %v, want 2024-01-15", got.DateAcquired)
	}
	if got.PurchasePrice == nil || *got.PurchasePrice != 2500 {
		t.Errorf("PurchasePrice = %v, want 2500", got.PurchasePrice)
	}
	if got.CurrencyCode == nil || *got.CurrencyCode != "USD" {
		t.Errorf("CurrencyCode = %v, want USD", got.CurrencyCode)
	}
	if got.Notes == nil || *got.Notes != "handle with care" {
		t.Errorf("Notes = %v, want %q", got.Notes, "handle with care")
	}
}

func TestBuildInventoryCreateInput_Defaults(t *testing.T) {
	workspaceID := uuid.New()
	itm, err := item.NewItem(workspaceID, "Drill", "SKU-1", 0)
	if err != nil {
		t.Fatalf("NewItem: %v", err)
	}
	loc := mustLocation(t)
	caches := &inventoryImportCaches{containers: map[string]*container.Container{}}

	got := buildInventoryCreateInput(workspaceID, itm, loc, caches, map[string]string{})

	if got.ContainerID != nil {
		t.Errorf("ContainerID = %v, want nil", got.ContainerID)
	}
	if got.Quantity != 1 {
		t.Errorf("Quantity = %d, want 1", got.Quantity)
	}
	if got.Condition != inventory.ConditionGood {
		t.Errorf("Condition = %q, want %q", got.Condition, inventory.ConditionGood)
	}
	if got.Status != inventory.StatusAvailable {
		t.Errorf("Status = %q, want %q", got.Status, inventory.StatusAvailable)
	}
	if got.DateAcquired != nil {
		t.Errorf("DateAcquired = %v, want nil", got.DateAcquired)
	}
	if got.PurchasePrice != nil {
		t.Errorf("PurchasePrice = %v, want nil", got.PurchasePrice)
	}
}

func TestStrPtrFromMap(t *testing.T) {
	row := map[string]string{"present": "value", "blank": ""}
	if got := strPtrFromMap(row, "present"); got == nil || *got != "value" {
		t.Errorf("present key = %v, want \"value\"", got)
	}
	if got := strPtrFromMap(row, "blank"); got != nil {
		t.Errorf("blank value = %v, want nil", got)
	}
	if got := strPtrFromMap(row, "missing"); got != nil {
		t.Errorf("missing key = %v, want nil", got)
	}
}

func TestStringMapToAnyMap(t *testing.T) {
	in := map[string]string{"a": "1", "b": "2"}
	got := stringMapToAnyMap(in)
	if len(got) != 2 || got["a"] != "1" || got["b"] != "2" {
		t.Errorf("stringMapToAnyMap(%v) = %v", in, got)
	}
}

func mustLocation(t *testing.T) *location.Location {
	t.Helper()
	loc, err := location.NewLocation(uuid.New(), "Garage", nil, nil, "GAR")
	if err != nil {
		t.Fatalf("NewLocation: %v", err)
	}
	return loc
}
