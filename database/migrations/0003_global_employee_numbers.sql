-- Employee numbers are unique within an organization, across all allowed domains.
BEGIN;
ALTER TABLE employee_domain_accounts DROP CONSTRAINT employee_domain_accounts_org_id_employee_id_key;
UPDATE org_settings SET value=jsonb_set(value, '{rules}', COALESCE((SELECT jsonb_agg(rule - 'employee_prefix') FROM jsonb_array_elements(value->'rules') AS rule), '[]'::jsonb)), updated_at=now() WHERE name='identity';
COMMIT;
