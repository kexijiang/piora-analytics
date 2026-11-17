# Piora Analytics

This repository ships an API, aggregation worker, dashboard, contracts and design documentation.
Do not describe mock data, SQL checks, or a successful UI build as production ingestion.

- Source contracts: scripts/generate-contract.mjs -> contracts/openapi.yaml -> generated types and API reference.
- Source database model: scripts/generate-db.mjs -> database/schema.sql and field dictionary. Before the first intranet deployment, maintain one fresh-install schema; do not add upgrade migrations or legacy-data backfills. Setup must preserve an already initialized database.
- Regenerate artifacts after changing either source. Run npm run check, npm run typecheck, npm test, npm run build.
- Run PostgreSQL validation against a disposable database only. Run browser checks for UI changes.
- Fetch before each commit and push. Preserve remote changes. Use codex/ branches for follow-up changes.
- Never commit actual staff records, keys, deployment secrets, or local production endpoints.
- Screenshots in docs/ui/screenshots are synthetic prototype evidence, not production statistics.
- Keep docs/implementation-status.md and docs/verification.md honest about test fixtures, deployment and real-device coverage.
