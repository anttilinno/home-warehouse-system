-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS warehouse;

-- Create ENUM types
CREATE TYPE warehouse.item_condition_enum AS ENUM (
    'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'FOR_REPAIR'
);

CREATE TYPE warehouse.item_status_enum AS ENUM (
    'AVAILABLE', 'IN_USE', 'RESERVED', 'ON_LOAN', 'IN_TRANSIT', 'DISPOSED', 'MISSING'
);

CREATE TYPE warehouse.tag_type_enum AS ENUM (
    'RFID', 'NFC', 'QR'
);

CREATE TYPE warehouse.category_type_enum AS ENUM (
    'MAIN', 'SUB'
);

CREATE TYPE warehouse.attachment_type_enum AS ENUM (
    'PHOTO', 'MANUAL', 'RECEIPT', 'WARRANTY', 'OTHER'
);

CREATE TYPE auth.resource_type_enum AS ENUM ('LOCATION', 'CATEGORY', 'ITEM');

-- Auth schema tables
CREATE TABLE auth.groups (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_superuser BOOLEAN DEFAULT false,
    group_id UUID REFERENCES auth.groups(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE auth.group_permissions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    group_id UUID NOT NULL REFERENCES auth.groups(id) ON DELETE CASCADE,
    resource_type auth.resource_type_enum NOT NULL,
    resource_id UUID NOT NULL,
    can_create BOOLEAN DEFAULT false,
    can_read BOOLEAN DEFAULT false,
    can_update BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (group_id, resource_type, resource_id)
);

CREATE INDEX ix_group_permissions_group ON auth.group_permissions(group_id);
CREATE INDEX ix_group_permissions_resource ON auth.group_permissions(resource_type, resource_id);

-- Warehouse schema tables
CREATE TABLE warehouse.categories (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(100) NOT NULL,
    category_type warehouse.category_type_enum NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_categories_name ON warehouse.categories(name);

CREATE TABLE warehouse.locations (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(100) NOT NULL,
    parent_location UUID REFERENCES warehouse.locations(id) ON DELETE SET NULL,
    zone VARCHAR(50),
    shelf VARCHAR(50),
    bin VARCHAR(50),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_locations_name ON warehouse.locations(name);
CREATE INDEX ix_locations_parent_location ON warehouse.locations(parent_location);

CREATE TABLE warehouse.containers (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(200) NOT NULL,
    location_id UUID NOT NULL REFERENCES warehouse.locations(id) ON DELETE CASCADE,
    description TEXT,
    capacity VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_containers_name ON warehouse.containers(name);
CREATE INDEX ix_containers_location_id ON warehouse.containers(location_id);

CREATE TABLE warehouse.companies (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(200) NOT NULL UNIQUE,
    website VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_companies_name ON warehouse.companies(name);

CREATE TABLE warehouse.items (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES warehouse.categories(id),
    subcategory_id UUID REFERENCES warehouse.categories(id),
    brand VARCHAR(100),
    model VARCHAR(100),
    image_url VARCHAR(500),
    serial_number VARCHAR(100),
    manufacturer VARCHAR(100),
    is_insured BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    lifetime_warranty BOOLEAN DEFAULT false,
    warranty_details TEXT,
    purchased_from UUID REFERENCES warehouse.companies(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_items_name ON warehouse.items(name);
CREATE INDEX ix_items_category_id ON warehouse.items(category_id);
CREATE INDEX ix_items_subcategory_id ON warehouse.items(subcategory_id);

CREATE TABLE warehouse.item_tags (
    item_id UUID NOT NULL REFERENCES warehouse.items(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    PRIMARY KEY (item_id, tag)
);

CREATE INDEX ix_item_tags_tag ON warehouse.item_tags(tag);

CREATE TABLE warehouse.labels (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE warehouse.item_labels (
    item_id UUID NOT NULL REFERENCES warehouse.items(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES warehouse.labels(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, label_id)
);

CREATE TABLE warehouse.files (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    original_name VARCHAR(255) NOT NULL,
    extension VARCHAR(10),
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    checksum VARCHAR(64),
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE warehouse.attachments (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    item_id UUID NOT NULL REFERENCES warehouse.items(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES warehouse.files(id) ON DELETE CASCADE,
    attachment_type warehouse.attachment_type_enum NOT NULL,
    title VARCHAR(200),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN warehouse.attachments.title IS 
    'Optional short description. Falls back to file.original_name if not provided.';

CREATE INDEX ix_attachments_item ON warehouse.attachments(item_id);
CREATE INDEX ix_attachments_file ON warehouse.attachments(file_id);

CREATE TABLE warehouse.inventory (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    item_id UUID NOT NULL REFERENCES warehouse.items(id) ON DELETE CASCADE,
    container_id UUID NOT NULL REFERENCES warehouse.containers(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    condition warehouse.item_condition_enum,
    status warehouse.item_status_enum,
    date_acquired DATE,
    purchase_price INTEGER,
    warranty_expires DATE,
    expiration_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_inventory_item_id ON warehouse.inventory(item_id);
CREATE INDEX ix_inventory_container_id ON warehouse.inventory(container_id);

CREATE TABLE warehouse.container_tags (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    container_id UUID NOT NULL REFERENCES warehouse.containers(id) ON DELETE CASCADE,
    tag_type warehouse.tag_type_enum NOT NULL,
    tag_value VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_container_tags_container_id ON warehouse.container_tags(container_id);

CREATE TABLE warehouse.borrowers (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE warehouse.loans (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    item_id UUID NOT NULL REFERENCES warehouse.items(id),
    borrower_id UUID NOT NULL REFERENCES warehouse.borrowers(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    loaned_at TIMESTAMPTZ DEFAULT now(),
    due_date DATE,
    returned_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_loans_item_id ON warehouse.loans(item_id);
CREATE INDEX ix_loans_borrower_id ON warehouse.loans(borrower_id);
