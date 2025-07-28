-- Add backup metadata table for tracking database backups
CREATE TABLE IF NOT EXISTS backup_metadata (
    backup_id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    compressed BOOLEAN NOT NULL DEFAULT false,
    encrypted BOOLEAN NOT NULL DEFAULT false,
    checksum TEXT NOT NULL,
    backup_type TEXT NOT NULL DEFAULT 'Manual'
);

-- Add index for faster backup lookups
CREATE INDEX IF NOT EXISTS idx_backup_metadata_created_at ON backup_metadata(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_backup_type ON backup_metadata(backup_type);