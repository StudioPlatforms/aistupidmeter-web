import Database from 'better-sqlite3';

/**
 * The single place the identity/forum database is opened.
 *
 * WHY THIS EXISTS
 * ---------------
 * This server runs two SQLite files, and both contain a `router_users` table
 * with an `email` column:
 *
 *   /root/data/stupid_meter.db            identity + forum. 1,476 real users,
 *                                         `forum_username`, all `forum_*` tables.
 *                                         No benchmark rows.
 *
 *   /root/apps/api/data/stupid_meter.db   benchmarks + router telemetry. Its
 *                                         `router_users` is a SHADOW table: the
 *                                         API inserts an id-only stub on first
 *                                         router access purely so its foreign
 *                                         keys resolve, with a placeholder
 *                                         address like user1473@oauth.local.
 *                                         It has no `forum_username` and is not
 *                                         an identity store.
 *
 * That split is deliberate - the API never needs to know who anyone is - but it
 * means a query aimed at the wrong file does not fail. It returns hundreds of
 * plausible-looking user rows with fabricated emails, which is the worst
 * possible failure mode: silent and confident.
 *
 * Ten call sites each carried their own copy of
 * `process.env.DATABASE_URL || '/root/data/stupid_meter.db'`. Two hazards
 * followed. A single wrong `DATABASE_URL` silently repointed all ten at once,
 * and `/root/.env` already defines `DATABASE_URL=./data/stupid_meter.db` - a
 * RELATIVE path that, if this app ever loaded that file, would resolve against
 * the web app's working directory and quietly create an empty database rather
 * than failing.
 *
 * So: one accessor, an absolute path required, and a check that the file we
 * opened is the one we meant.
 */

/** Where identity lives when nothing overrides it. */
const DEFAULT_IDENTITY_DB = '/root/data/stupid_meter.db';

/**
 * Tables that exist only in the benchmark database. Finding any of these means
 * we opened the wrong file. Kept as a list rather than a single sentinel so
 * that dropping one table later does not silently disable the check.
 */
const BENCHMARK_ONLY_TABLES = [
  'tool_sessions',
  'tool_executions',
  'change_points',
  'incidents',
  'reliability_metrics',
  'adversarial_results',
  'data_api_keys',
] as const;

export type DbRole = 'identity' | 'benchmark';

/** Verified paths, so the checks below run once per path per process. */
const verified = new Set<string>();

export function identityDbPath(): string {
  const configured = process.env.DATABASE_URL;
  if (!configured) return DEFAULT_IDENTITY_DB;

  // A relative DATABASE_URL is always a mistake here: it resolves against
  // whatever directory the Next server happens to run from, and better-sqlite3
  // would create an empty file there rather than reporting the problem.
  if (!configured.startsWith('/')) {
    throw new Error(
      `DATABASE_URL must be an absolute path, received "${configured}". ` +
        `The identity database is ${DEFAULT_IDENTITY_DB}. Note that /root/.env ` +
        `defines a relative DATABASE_URL for the API, which is not this app.`,
    );
  }
  return configured;
}

/**
 * Confirm the open handle is the identity database, and record the answer in
 * the file itself so the next process does not have to infer it again.
 */
function assertIsIdentityDb(db: Database.Database, path: string): void {
  const stamped = readRole(db);

  if (stamped === 'benchmark') {
    throw new Error(
      `Refusing to use ${path} as the identity database: it is stamped as the ` +
        `benchmark database. Its router_users table holds id-only stubs with ` +
        `placeholder emails, not real accounts. Identity lives in ${DEFAULT_IDENTITY_DB}.`,
    );
  }

  if (stamped === 'identity') return;

  // Unstamped: infer, then stamp. Inference must tolerate a brand-new identity
  // database, because forum-db-init.ts creates the forum tables on first run -
  // so their absence proves nothing. The presence of a benchmark-only table
  // does prove the opposite.
  const found = BENCHMARK_ONLY_TABLES.filter((t) => tableExists(db, t));
  if (found.length > 0) {
    throw new Error(
      `Refusing to use ${path} as the identity database: it contains ` +
        `benchmark-only table(s) [${found.join(', ')}], so this is the API's ` +
        `database. Its router_users rows are id-only stubs with placeholder ` +
        `emails. Identity lives in ${DEFAULT_IDENTITY_DB}.`,
    );
  }

  stampRole(db, 'identity', 'Identity and forum store. Source of truth for accounts.');
}

function tableExists(db: Database.Database, name: string): boolean {
  return !!db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`)
    .get(name);
}

export function readRole(db: Database.Database): DbRole | null {
  if (!tableExists(db, 'db_role')) return null;
  const row = db.prepare(`SELECT role FROM db_role LIMIT 1`).get() as { role?: string } | undefined;
  return (row?.role as DbRole) ?? null;
}

export function stampRole(db: Database.Database, role: DbRole, description: string): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS db_role (
        role        TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        stamped_at  TEXT NOT NULL
      )
    `);
    db.prepare(
      `INSERT OR REPLACE INTO db_role (role, description, stamped_at) VALUES (?, ?, ?)`,
    ).run(role, description, new Date().toISOString());
  } catch {
    // A read-only handle or a race with another process must not take the app
    // down: the inference above already established the answer for this call.
  }
}

/**
 * Open the identity/forum database.
 *
 * Drop-in replacement for `new Database(DB_PATH)`. Callers keep owning the
 * handle and are still responsible for closing it.
 */
export function openIdentityDb(options?: Database.Options): Database.Database {
  const path = identityDbPath();
  const db = new Database(path, options);

  /**
   * The same pragmas the API's accessor sets. This side had none, which cost
   * two things quietly:
   *
   * - `busy_timeout`: the API writes to this file concurrently. Without a
   *   timeout a write that collides returns SQLITE_BUSY immediately instead of
   *   waiting the moment it takes for the other writer to commit.
   * - `foreign_keys`: SQLite defaults this OFF, which makes every ON DELETE
   *   CASCADE in the schema inert and lets a row reference a parent that does
   *   not exist. SCIM and SSO both insert organisation members from here, so
   *   this side needs the constraint just as much as the API side does.
   *
   * WAL is a persistent property of the file rather than the connection; it is
   * set anyway so that whichever process opens it first gets it right.
   */
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  if (!verified.has(path)) {
    try {
      assertIsIdentityDb(db, path);
      verified.add(path);
    } catch (err) {
      db.close();
      throw err;
    }
  }
  return db;
}
