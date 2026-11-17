-- Automatic account association and resumable historical reconciliation.
BEGIN;
ALTER TABLE installations ADD COLUMN identity_match_version integer NOT NULL DEFAULT 0;
CREATE INDEX installations_identity_pending ON installations(org_id,id) WHERE identity_match_version<1;
ALTER TABLE installation_bindings DROP CONSTRAINT installation_bindings_valid_days_check;
ALTER TABLE installation_bindings ADD CONSTRAINT installation_bindings_valid_days_check CHECK (NOT isempty(valid_days) AND (lower_inf(valid_days) OR lower_inc(valid_days)) AND NOT upper_inc(valid_days));
ALTER TABLE installation_bindings DROP CONSTRAINT installation_bindings_source_check;
ALTER TABLE installation_bindings ADD CONSTRAINT installation_bindings_source_check CHECK (source IN ('manual','domain','automatic'));
UPDATE org_settings SET value=jsonb_build_object('version',COALESCE((value->>'version')::int,0)+1,'enabled',true,'auto_create',true,'rules','[]'::jsonb),revision=revision+1,updated_at=now() WHERE name='identity';
COMMIT;
