-- migrate:up

-- Add search_vector column to borrowers table
ALTER TABLE warehouse.borrowers
ADD COLUMN search_vector TSVECTOR;

-- Create index on search_vector
CREATE INDEX ix_borrowers_search ON warehouse.borrowers USING gin(search_vector);

-- Create function to update search_vector for borrowers
CREATE OR REPLACE FUNCTION warehouse.update_borrower_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.email, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.phone, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector
CREATE TRIGGER trgr_borrowers_search_vector
BEFORE INSERT OR UPDATE ON warehouse.borrowers
FOR EACH ROW
EXECUTE FUNCTION warehouse.update_borrower_search_vector();

-- Populate search_vector for existing rows
UPDATE warehouse.borrowers
SET name = name; -- This triggers the update_borrower_search_vector function

-- migrate:down

-- Drop trigger
DROP TRIGGER IF EXISTS trgr_borrowers_search_vector ON warehouse.borrowers;

-- Drop function
DROP FUNCTION IF EXISTS warehouse.update_borrower_search_vector();

-- Drop index
DROP INDEX IF EXISTS warehouse.ix_borrowers_search;

-- Drop column
ALTER TABLE warehouse.borrowers
DROP COLUMN IF EXISTS search_vector;
