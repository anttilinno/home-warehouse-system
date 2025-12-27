-- migrate:up
ALTER TABLE warehouse.items
ADD COLUMN obsidian_vault_path VARCHAR(500),
ADD COLUMN obsidian_note_path VARCHAR(500);

COMMENT ON COLUMN warehouse.items.obsidian_vault_path IS 'Local path to Obsidian vault';
COMMENT ON COLUMN warehouse.items.obsidian_note_path IS 'Relative path to note within vault';

-- migrate:down
ALTER TABLE warehouse.items
DROP COLUMN obsidian_vault_path,
DROP COLUMN obsidian_note_path;

