-- Generated additive identity migration.
BEGIN;
ALTER TABLE installation_bindings ADD COLUMN source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','domain'));
CREATE TABLE installation_identities (
  org_id uuid NOT NULL REFERENCES organizations(id),
  installation_id uuid NOT NULL,
  claim jsonb NOT NULL,
  state varchar(40) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id,installation_id),
  FOREIGN KEY (org_id, installation_id) REFERENCES installations(org_id, id)
);
CREATE TABLE employee_domain_accounts (
  org_id uuid NOT NULL REFERENCES organizations(id),
  domain varchar(128) NOT NULL,
  account_name varchar(128) NOT NULL,
  employee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id,domain,account_name),
  UNIQUE (org_id,employee_id),
  FOREIGN KEY (org_id, employee_id) REFERENCES employees(org_id, id)
);
ALTER TABLE org_settings DROP CONSTRAINT org_settings_name_check;
ALTER TABLE org_settings ADD CONSTRAINT org_settings_name_check CHECK (name IN ('sync','retention','identity'));
COMMIT;
