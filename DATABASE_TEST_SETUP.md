# Database Test Setup

## Environment Used

This sprint used project-local `embedded-postgres` on Windows.

- Package: `embedded-postgres`
- Client: `pg`
- Host: `127.0.0.1`
- Port: `55432`
- Database: ephemeral local PostgreSQL cluster
- Data directory: `tmp/database-validation/pgdata-*`
- Output: `tmp/database-validation/database-validation-output.json`

No production database was used. No external credentials were written to source files.

## Command

```bash
npm run test:db
```

The command starts a real PostgreSQL instance, creates test databases, applies the baseline schema plus repository migrations, runs concurrency and RLS checks, writes JSON output, then stops the embedded server.

## Important Scope Note

The repository does not contain a `01` base schema migration. The validation harness therefore creates a minimal pre-existing SkillFi schema that matches the tables referenced by `02_privy_identity_migration.sql` and `03_two_player_challenge_flow.sql`.

Embedded PostgreSQL validates SQL, constraints, RLS, grants, and real database concurrency. It does not provide Supabase PostgREST/Auth APIs, so HTTP API integration against `/api/*` still requires a Supabase development project or Supabase local stack.
