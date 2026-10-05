-- Append new mappings of the same preserved import; old records/sessions remain immutable.
ALTER TABLE researched.mcf_import_mappings DROP CONSTRAINT mcf_import_mappings_import_id_key;
ALTER TABLE researched.mcf_import_mappings ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE researched.mcf_import_mappings ADD COLUMN previous_id uuid REFERENCES researched.mcf_import_mappings(id);
ALTER TABLE researched.mcf_import_mappings ADD CONSTRAINT mcf_mapping_version UNIQUE(import_id,version);
CREATE INDEX mcf_mapping_latest ON researched.mcf_import_mappings(import_id,version DESC);
