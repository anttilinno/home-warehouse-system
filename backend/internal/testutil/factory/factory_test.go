package factory_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/testutil/factory"
)

// --- Factory Base Tests ---

func TestFactory_New(t *testing.T) {
	f := factory.New()

	assert.Equal(t, factory.DefaultWorkspaceID, f.WorkspaceID())
	assert.Equal(t, factory.DefaultUserID, f.UserID())
}

func TestFactory_WithWorkspace(t *testing.T) {
	customWorkspace := uuid.New()
	f := factory.New().WithWorkspace(customWorkspace)

	assert.Equal(t, customWorkspace, f.WorkspaceID())
	assert.Equal(t, factory.DefaultUserID, f.UserID())
}

func TestFactory_WithUser(t *testing.T) {
	customUser := uuid.New()
	f := factory.New().WithUser(customUser)

	assert.Equal(t, factory.DefaultWorkspaceID, f.WorkspaceID())
	assert.Equal(t, customUser, f.UserID())
}

func TestFactory_ChainedContext(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()
	f := factory.New().WithWorkspace(workspaceID).WithUser(userID)

	assert.Equal(t, workspaceID, f.WorkspaceID())
	assert.Equal(t, userID, f.UserID())
}

// --- User Factory Tests ---

func TestFactory_User(t *testing.T) {
	f := factory.New()
	u := f.User()

	assert.NotEmpty(t, u.ID())
	assert.NotEmpty(t, u.Email())
	assert.NotEmpty(t, u.FullName())
	assert.True(t, u.IsActive())
	assert.False(t, u.IsSuperuser())
}

func TestFactory_UserWithOptions(t *testing.T) {
	f := factory.New()
	u := f.User(
		factory.WithEmail("test@example.com"),
		factory.WithFullName("John Doe"),
		factory.WithSuperuser(true),
	)

	assert.Equal(t, "test@example.com", u.Email())
	assert.Equal(t, "John Doe", u.FullName())
	assert.True(t, u.IsSuperuser())
}

func TestFactory_UserPasswordWorks(t *testing.T) {
	f := factory.New()
	u := f.User()

	// User should have a valid password hash
	assert.NotEmpty(t, u.PasswordHash())
}

// --- Workspace Factory Tests ---

func TestFactory_Workspace(t *testing.T) {
	f := factory.New()
	w := f.Workspace()

	assert.NotEmpty(t, w.ID())
	assert.NotEmpty(t, w.Name())
	assert.NotEmpty(t, w.Slug())
	assert.False(t, w.IsPersonal())
}

func TestFactory_WorkspaceWithOptions(t *testing.T) {
	f := factory.New()
	w := f.Workspace(
		factory.WithWorkspaceName("My Workspace"),
		factory.WithSlug("my-workspace"),
		factory.WithPersonal(true),
	)

	assert.Equal(t, "My Workspace", w.Name())
	assert.Equal(t, "my-workspace", w.Slug())
	assert.True(t, w.IsPersonal())
}

// --- Category Factory Tests ---

func TestFactory_Category(t *testing.T) {
	f := factory.New()
	c := f.Category()

	assert.NotEmpty(t, c.ID())
	assert.Equal(t, f.WorkspaceID(), c.WorkspaceID())
	assert.NotEmpty(t, c.Name())
	assert.Nil(t, c.ParentCategoryID())
}

func TestFactory_CategoryWithOptions(t *testing.T) {
	f := factory.New()
	parentID := uuid.New()
	c := f.Category(
		factory.WithCategoryName("Electronics"),
		factory.WithParentCategory(parentID),
		factory.WithCategoryDescription("Electronic items"),
	)

	assert.Equal(t, "Electronics", c.Name())
	assert.Equal(t, &parentID, c.ParentCategoryID())
	require.NotNil(t, c.Description())
	assert.Equal(t, "Electronic items", *c.Description())
}

func TestFactory_CategoryInheritsWorkspace(t *testing.T) {
	workspaceID := uuid.New()
	f := factory.New().WithWorkspace(workspaceID)
	c := f.Category()

	assert.Equal(t, workspaceID, c.WorkspaceID())
}

// --- Borrower Factory Tests ---

func TestFactory_Borrower(t *testing.T) {
	f := factory.New()
	b := f.Borrower()

	assert.NotEmpty(t, b.ID())
	assert.Equal(t, f.WorkspaceID(), b.WorkspaceID())
	assert.NotEmpty(t, b.Name())
	assert.NotNil(t, b.Email())
	assert.NotNil(t, b.Phone())
}

func TestFactory_BorrowerWithOptions(t *testing.T) {
	f := factory.New()
	b := f.Borrower(
		factory.WithBorrowerName("Jane Smith"),
		factory.WithBorrowerEmail("jane@example.com"),
		factory.WithBorrowerPhone("+1-555-0123"),
		factory.WithBorrowerNotes("Reliable borrower"),
	)

	assert.Equal(t, "Jane Smith", b.Name())
	require.NotNil(t, b.Email())
	assert.Equal(t, "jane@example.com", *b.Email())
	require.NotNil(t, b.Phone())
	assert.Equal(t, "+1-555-0123", *b.Phone())
	require.NotNil(t, b.Notes())
	assert.Equal(t, "Reliable borrower", *b.Notes())
}

// --- Item Factory Tests ---

func TestFactory_Item(t *testing.T) {
	f := factory.New()
	i := f.Item()

	assert.NotEmpty(t, i.ID())
	assert.Equal(t, f.WorkspaceID(), i.WorkspaceID())
	assert.NotEmpty(t, i.Name())
	assert.NotEmpty(t, i.SKU())
}

func TestFactory_ItemWithOptions(t *testing.T) {
	f := factory.New()
	categoryID := uuid.New()
	i := f.Item(
		factory.WithItemName("Power Drill"),
		factory.WithItemSKU("PD-001"),
		factory.WithItemCategory(categoryID),
		factory.WithItemBrand("DeWalt"),
		factory.WithItemModel("DCD771"),
		factory.WithItemDescription("Cordless drill/driver"),
		factory.WithItemBarcode("012345678901"),
	)

	assert.Equal(t, "Power Drill", i.Name())
	assert.Equal(t, "PD-001", i.SKU())
	assert.Equal(t, &categoryID, i.CategoryID())
	require.NotNil(t, i.Brand())
	assert.Equal(t, "DeWalt", *i.Brand())
	require.NotNil(t, i.Model())
	assert.Equal(t, "DCD771", *i.Model())
	require.NotNil(t, i.Description())
	assert.Equal(t, "Cordless drill/driver", *i.Description())
	require.NotNil(t, i.Barcode())
	assert.Equal(t, "012345678901", *i.Barcode())
}

func TestFactory_ItemInheritsWorkspace(t *testing.T) {
	workspaceID := uuid.New()
	f := factory.New().WithWorkspace(workspaceID)
	i := f.Item()

	assert.Equal(t, workspaceID, i.WorkspaceID())
}

// --- Location Factory Tests ---

func TestFactory_Location(t *testing.T) {
	f := factory.New()
	l := f.Location()

	assert.NotEmpty(t, l.ID())
	assert.Equal(t, f.WorkspaceID(), l.WorkspaceID())
	assert.NotEmpty(t, l.Name())
	assert.NotEmpty(t, l.ShortCode())
	assert.Nil(t, l.ParentLocation())
}

func TestFactory_LocationWithOptions(t *testing.T) {
	f := factory.New()
	parentID := uuid.New()
	l := f.Location(
		factory.WithLocationName("Main Storage"),
		factory.WithLocationParent(parentID),
		factory.WithLocationDescription("Primary storage area"),
		factory.WithLocationShortCode("L-MS001"),
	)

	assert.Equal(t, "Main Storage", l.Name())
	assert.Equal(t, &parentID, l.ParentLocation())
	require.NotNil(t, l.Description())
	assert.Equal(t, "Primary storage area", *l.Description())
	assert.Equal(t, "L-MS001", l.ShortCode())
}

func TestFactory_LocationInheritsWorkspace(t *testing.T) {
	workspaceID := uuid.New()
	f := factory.New().WithWorkspace(workspaceID)
	l := f.Location()

	assert.Equal(t, workspaceID, l.WorkspaceID())
}

// --- Container Factory Tests ---

func TestFactory_Container(t *testing.T) {
	f := factory.New()
	loc := f.Location()
	c := f.Container(loc.ID())

	assert.NotEmpty(t, c.ID())
	assert.Equal(t, f.WorkspaceID(), c.WorkspaceID())
	assert.Equal(t, loc.ID(), c.LocationID())
	assert.NotEmpty(t, c.Name())
	assert.NotEmpty(t, c.ShortCode())
}

func TestFactory_ContainerWithOptions(t *testing.T) {
	f := factory.New()
	loc := f.Location()
	loc2 := f.Location()
	c := f.Container(loc.ID(),
		factory.WithContainerName("Tool Box A"),
		factory.WithContainerLocation(loc2.ID()),
		factory.WithContainerDescription("Red toolbox"),
		factory.WithContainerCapacity("Large"),
		factory.WithContainerShortCode("C-TB001"),
	)

	assert.Equal(t, "Tool Box A", c.Name())
	assert.Equal(t, loc2.ID(), c.LocationID()) // Changed by option
	require.NotNil(t, c.Description())
	assert.Equal(t, "Red toolbox", *c.Description())
	require.NotNil(t, c.Capacity())
	assert.Equal(t, "Large", *c.Capacity())
	assert.Equal(t, "C-TB001", c.ShortCode())
}

func TestFactory_ContainerInheritsWorkspace(t *testing.T) {
	workspaceID := uuid.New()
	f := factory.New().WithWorkspace(workspaceID)
	loc := f.Location()
	c := f.Container(loc.ID())

	assert.Equal(t, workspaceID, c.WorkspaceID())
}

// --- Inventory Factory Tests ---

func TestFactory_Inventory(t *testing.T) {
	f := factory.New()
	item := f.Item()
	loc := f.Location()
	inv := f.Inventory(item.ID(), loc.ID())

	assert.NotEmpty(t, inv.ID())
	assert.Equal(t, f.WorkspaceID(), inv.WorkspaceID())
	assert.Equal(t, item.ID(), inv.ItemID())
	assert.Equal(t, loc.ID(), inv.LocationID())
	assert.Equal(t, 1, inv.Quantity())
	assert.Equal(t, inventory.ConditionGood, inv.Condition())
	assert.Equal(t, inventory.StatusAvailable, inv.Status())
}

func TestFactory_InventoryWithOptions(t *testing.T) {
	f := factory.New()
	item := f.Item()
	item2 := f.Item()
	loc := f.Location()
	loc2 := f.Location()
	container := f.Container(loc.ID())

	inv := f.Inventory(item.ID(), loc.ID(),
		factory.WithInventoryItem(item2.ID()),
		factory.WithInventoryLocation(loc2.ID()),
		factory.WithInventoryContainer(container.ID()),
		factory.WithInventoryCondition(inventory.ConditionNew),
		factory.WithInventoryStatus(inventory.StatusReserved),
		factory.WithInventoryQuantity(5),
		factory.WithInventoryNotes("Brand new in box"),
	)

	assert.Equal(t, item2.ID(), inv.ItemID())  // Changed by option
	assert.Equal(t, loc2.ID(), inv.LocationID())
	require.NotNil(t, inv.ContainerID())
	assert.Equal(t, container.ID(), *inv.ContainerID())
	assert.Equal(t, inventory.ConditionNew, inv.Condition())
	assert.Equal(t, inventory.StatusReserved, inv.Status())
	assert.Equal(t, 5, inv.Quantity())
	require.NotNil(t, inv.Notes())
	assert.Equal(t, "Brand new in box", *inv.Notes())
}

func TestFactory_InventoryInheritsWorkspace(t *testing.T) {
	workspaceID := uuid.New()
	f := factory.New().WithWorkspace(workspaceID)
	item := f.Item()
	loc := f.Location()
	inv := f.Inventory(item.ID(), loc.ID())

	assert.Equal(t, workspaceID, inv.WorkspaceID())
}

// --- Integration Usage Pattern Tests ---

func TestFactory_CompleteWorkflow(t *testing.T) {
	// Demonstrates the typical test setup pattern
	f := factory.New()

	// Create a category
	category := f.Category(factory.WithCategoryName("Power Tools"))

	// Create an item in that category
	item := f.Item(
		factory.WithItemName("Circular Saw"),
		factory.WithItemCategory(category.ID()),
		factory.WithItemBrand("Makita"),
	)

	// Create a location
	location := f.Location(factory.WithLocationName("Workshop"))

	// Create a container at that location
	container := f.Container(location.ID(),
		factory.WithContainerName("Tool Shelf"),
	)

	// Create inventory placing the item in the container
	inv := f.Inventory(item.ID(), location.ID(),
		factory.WithInventoryContainer(container.ID()),
		factory.WithInventoryQuantity(2),
	)

	// Verify relationships
	assert.Equal(t, category.ID(), *item.CategoryID())
	assert.Equal(t, location.ID(), container.LocationID())
	assert.Equal(t, item.ID(), inv.ItemID())
	assert.Equal(t, location.ID(), inv.LocationID())
	assert.Equal(t, container.ID(), *inv.ContainerID())

	// All entities share the same workspace
	assert.Equal(t, f.WorkspaceID(), category.WorkspaceID())
	assert.Equal(t, f.WorkspaceID(), item.WorkspaceID())
	assert.Equal(t, f.WorkspaceID(), location.WorkspaceID())
	assert.Equal(t, f.WorkspaceID(), container.WorkspaceID())
	assert.Equal(t, f.WorkspaceID(), inv.WorkspaceID())
}

func TestFactory_MultiTenantIsolation(t *testing.T) {
	// Demonstrates workspace isolation
	workspace1 := uuid.New()
	workspace2 := uuid.New()

	f1 := factory.New().WithWorkspace(workspace1)
	f2 := factory.New().WithWorkspace(workspace2)

	item1 := f1.Item(factory.WithItemName("Item in WS1"))
	item2 := f2.Item(factory.WithItemName("Item in WS2"))

	assert.Equal(t, workspace1, item1.WorkspaceID())
	assert.Equal(t, workspace2, item2.WorkspaceID())
	assert.NotEqual(t, item1.WorkspaceID(), item2.WorkspaceID())
}
