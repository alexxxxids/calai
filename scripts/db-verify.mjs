/**
 * Reference-only verification of supabase/migrations. NOT part of the textbook.
 *
 * PGlite (Postgres compiled to WebAssembly) plays the Supabase database: the
 * script recreates what Supabase provides before the first migration (API
 * roles, auth.users + auth.uid(), storage.buckets/objects, the extensions
 * schema), applies every migration file unchanged in file name order, and
 * then attacks the schema as several users. One PASS/FAIL line per check;
 * any FAIL exits with code 1.
 *
 * Usage: node scripts/db-verify.mjs [migrations-dir]
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const migrationsDir = path.resolve(
  process.argv[2] ?? fileURLToPath(new URL('../supabase/migrations/', import.meta.url)),
);

// ---------------------------------------------------------------------------
// Supabase emulation
// ---------------------------------------------------------------------------

// What Supabase provides before our first migration, reduced to what the
// migrations and the checks touch. Role names and grants follow Supabase.
const SUPABASE_EMULATION = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  -- The role of the Auth service: it inserts and deletes auth.users rows.
  create role supabase_auth_admin nologin noinherit;

  grant usage on schema public to anon, authenticated, service_role;

  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role, supabase_auth_admin;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  grant select, insert, update, delete on table auth.users to supabase_auth_admin;

  -- PostgREST puts the verified JWT claims into request.jwt.claims.
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select auth.jwt() ->> 'role'
  $$;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid,
    created_at timestamptz default now()
  );
  alter table storage.buckets enable row level security;
  alter table storage.objects enable row level security;
  grant all on table storage.buckets, storage.objects to anon, authenticated, service_role;
  -- 'a/b/c.pdf' -> {a,b}: the folders of a path, without the file name.
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
`;

// Default privileges for what the migrations (run as postgres) create in public.
const DEFAULT_PRIVILEGES = {
  // Projects created since 2026-05-30: nothing on tables and sequences.
  // Functions were not part of that change: they still get EXECUTE.
  current: `
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`,
  // Older projects: everything to everyone.
  legacy: `
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`,
};

async function bootDatabase(defaults) {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(SUPABASE_EMULATION);
  await db.exec(DEFAULT_PRIVILEGES[defaults]);
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`migration ${file} failed: ${error.message}`, { cause: error });
    }
  }
  return { db, files };
}

// ---------------------------------------------------------------------------
// Acting as someone
// ---------------------------------------------------------------------------

const USERS = {
  A: { name: 'A', id: '00000000-0000-4000-8000-00000000000a' },
  B: { name: 'B', id: '00000000-0000-4000-8000-00000000000b' },
  // Deleted in the account deletion check.
  C: { name: 'C', id: '00000000-0000-4000-8000-00000000000c' },
  // Spends the whole AI quota.
  Q: { name: 'Q', id: '00000000-0000-4000-8000-00000000000f' },
};

const asUser = (user) => ({
  role: 'authenticated',
  claims: { sub: user.id, role: 'authenticated' },
});
const ANON = { role: 'anon', claims: { role: 'anon' } };
// The secret key: cron jobs and the iCal feed.
const SERVICE = { role: 'service_role', claims: { role: 'service_role' } };
// Supabase Auth itself: signs users up and deletes them.
const AUTH_SERVICE = { role: 'supabase_auth_admin', claims: {} };
// Only for looking across users when checking results; never under test.
const SUPERUSER = { role: 'postgres', claims: {} };

// The same two steps PostgREST takes for every request.
async function become(tx, actor) {
  await tx.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(actor.claims),
  ]);
  await tx.exec(`set local role ${actor.role}`);
}

/** Runs `work` as `actor` in a transaction that commits, like one API request. */
function run(db, actor, work) {
  return db.transaction(async (tx) => {
    await become(tx, actor);
    return work(tx);
  });
}

/** Like run(), but returns { value } or { error } instead of throwing. */
async function tryRun(db, actor, work) {
  try {
    return { value: await run(db, actor, work) };
  } catch (error) {
    return { error };
  }
}

/** Runs `work` as `actor` and always rolls back: attempts leave no trace. */
async function attempt(db, actor, work) {
  try {
    const value = await db.transaction(async (tx) => {
      await become(tx, actor);
      const result = await work(tx);
      await tx.rollback();
      return result;
    });
    return { value };
  } catch (error) {
    return { error };
  }
}

async function rows(tx, sql, params = []) {
  return (await tx.query(sql, params)).rows;
}

async function scalar(tx, sql, params = []) {
  const [first] = await rows(tx, sql, params);
  return first === undefined ? undefined : Object.values(first)[0];
}

async function affected(tx, sql, params = []) {
  return (await tx.query(sql, params)).affectedRows ?? 0;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

class CheckFailure extends Error {}

const outcomes = [];

/** Runs one check, prints PASS/FAIL, returns whether it passed. */
async function check(group, title, body) {
  try {
    await body();
    outcomes.push(true);
    console.log(`PASS  ${group}  ${title}`);
    return true;
  } catch (error) {
    outcomes.push(false);
    const reason = error instanceof CheckFailure ? error.message : `crashed: ${error.stack}`;
    console.log(`FAIL  ${group}  ${title}\n        ${reason}`);
    return false;
  }
}

/**
 * Runs a group of checks. If the group's own setup breaks (say, a migration
 * change makes its fixture data invalid), that is one FAIL, and the other
 * groups still run.
 */
async function group(name, body) {
  try {
    await body();
  } catch (error) {
    outcomes.push(false);
    console.log(`FAIL  ${name}  (setup of this group crashed)\n        ${error.message}`);
  }
}

function printSummary() {
  const failed = outcomes.filter((passed) => !passed).length;
  console.log(`\n${outcomes.length - failed} passed, ${failed} failed`);
  process.exitCode = failed === 0 ? 0 : 1;
}

function assert(condition, message) {
  if (!condition) {
    throw new CheckFailure(message);
  }
}

function describe(outcome) {
  return outcome.error ? `${outcome.error.code} ${outcome.error.message}` : 'success';
}

/** `codes`: one SQLSTATE or a list of acceptable ones. */
function expectError(outcome, codes, what, messagePart = '') {
  const accepted = [codes].flat();
  assert(
    accepted.includes(outcome.error?.code) && outcome.error.message.includes(messagePart),
    `${what}: expected error ${accepted.join(' or ')} ${messagePart}, got ${describe(outcome)}`,
  );
}

// "on delete restrict" violations: 23503 up to Postgres 17 (Supabase), 23001
// (restrict_violation) since Postgres 18 (PGlite 0.5).
const RESTRICT_VIOLATION = ['23503', '23001'];

function expectSuccess(outcome, what) {
  assert(!outcome.error, `${what}: expected success, got ${describe(outcome)}`);
  return outcome.value;
}

/** Blocked = refused by a missing grant (42501) or no row visible to change. */
function expectBlocked(outcome, what) {
  const refused = outcome.error?.code === '42501';
  const touchedNothing = !outcome.error && outcome.value === 0;
  assert(
    refused || touchedNothing,
    `${what}: expected 42501 or 0 rows, got ${outcome.error ? describe(outcome) : `${outcome.value} rows`}`,
  );
}

function expectEqual(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${what}: expected ${e}, got ${a}`);
}

// ---------------------------------------------------------------------------
// Seed: one row in every table, written as the user through RLS where possible
// ---------------------------------------------------------------------------

function signUp(db, user) {
  return run(db, AUTH_SERVICE, (tx) =>
    tx.query('insert into auth.users (id, email) values ($1, $2)', [
      user.id,
      `${user.name.toLowerCase()}@example.com`,
    ]),
  );
}

/**
 * The seed writes rows directly, never through the RPC functions: a broken
 * function must fail its own check (f, i, n, q), not crash the shared setup.
 * push_subscriptions has no insert right for users by design, so that one
 * row is written by the superuser.
 */
async function seedUser(db, user) {
  const rowsOfUser = await seedUserRows(db, user);
  const pushId = await run(db, SUPERUSER, (tx) =>
    scalar(
      tx,
      `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret)
       values ($1, $2, 'key', 'secret') returning id`,
      [user.id, `https://push.example.com/${user.name}`],
    ),
  );
  return { ...rowsOfUser, pushId };
}

function seedUserRows(db, user) {
  return run(db, asUser(user), async (tx) => {
    const typeId = await scalar(
      tx,
      "insert into public.task_types (name, energy) values ('Nauka', 3) returning id",
    );
    const taskId = await scalar(
      tx,
      'insert into public.tasks (type_id, estimate_minutes) values ($1, 120) returning id',
      [typeId],
    );
    const blockId = await scalar(
      tx,
      `insert into public.blocks (task_id, starts_at, ends_at, work_minutes)
       values ($1, '2026-11-02T09:00Z', '2026-11-02T10:00Z', 60) returning id`,
      [taskId],
    );
    const recurringEventId = await scalar(
      tx,
      `insert into public.recurring_events (type_id, title, weekday, start_time, end_time, valid_from)
       values ($1, 'Lekcja', 2, '08:00', '08:45', '2026-09-01') returning id`,
      [typeId],
    );
    const habitId = await scalar(
      tx,
      "insert into public.habits (name) values ('Woda') returning id",
    );
    await tx.query("insert into public.habit_checks (habit_id, day) values ($1, '2026-11-02')", [
      habitId,
    ]);
    const weeklyId = await scalar(
      tx,
      `insert into public.weekly_reflections (week_start, fatigue, stress, focus, distractions)
       values ('2026-11-02', 3, 3, 3, 3) returning id`,
    );
    const monthlyId = await scalar(
      tx,
      "insert into public.monthly_reflections (month, went_well) values ('2026-11-01', 'Plan') returning id",
    );
    const aiRequestId = await scalar(
      tx,
      "insert into public.ai_requests (kind) values ('decompose') returning id",
    );
    const feedToken = await scalar(
      tx,
      'insert into public.calendar_feeds default values returning token',
    );
    const subscriptionId = await scalar(
      tx,
      "insert into public.calendar_subscriptions (name, url, type_id) values ('Szkola', $1, $2) returning id",
      [`https://calendar.example.com/${user.name}.ics`, typeId],
    );
    const externalEventId = await scalar(
      tx,
      `insert into public.external_events (user_id, subscription_id, uid, starts_at, ends_at, title)
       values ($1, $2, 'lesson-1', '2026-11-03T07:00Z', '2026-11-03T07:45Z', 'Matematyka') returning id`,
      [user.id, subscriptionId],
    );
    const objectName = `${user.id}/notes.pdf`;
    await tx.query("insert into storage.objects (bucket_id, name) values ('ai-uploads', $1)", [
      objectName,
    ]);
    return {
      userId: user.id,
      typeId,
      taskId,
      blockId,
      recurringEventId,
      habitId,
      weeklyId,
      monthlyId,
      aiRequestId,
      feedToken,
      subscriptionId,
      externalEventId,
      objectName,
    };
  });
}

// ---------------------------------------------------------------------------
// (b) Isolation matrix: for every table, what the owner may do and what the
// other user must not do. `forge` inserts a row owned by A while acting as B,
// pointing only at A's own parents: RLS alone has to stop it.
// ---------------------------------------------------------------------------

const TABLES = [
  {
    table: 'profiles',
    row: (a) => ['id = $1', [a.userId]],
    change: "display_name = 'Hacker'",
    ownerMay: { update: true, delete: false },
    forge: (a) => ['insert into public.profiles (id) values ($1)', [a.userId]],
  },
  {
    table: 'task_types',
    row: (a) => ['id = $1', [a.typeId]],
    change: "color = '#000000'",
    // A's type is in use (restrict), so the owner deletes a fresh one instead.
    ownerMay: { update: true, delete: true },
    ownerDeleteFresh: "insert into public.task_types (name) values ('Tmp') returning id",
    forge: (a) => [
      "insert into public.task_types (user_id, name) values ($1, 'Forged')",
      [a.userId],
    ],
  },
  {
    table: 'tasks',
    row: (a) => ['id = $1', [a.taskId]],
    change: 'priority = 1',
    ownerMay: { update: true, delete: true },
    forge: (a) => [
      'insert into public.tasks (user_id, type_id) values ($1, $2)',
      [a.userId, a.typeId],
    ],
  },
  {
    table: 'blocks',
    row: (a) => ['id = $1', [a.blockId]],
    change: 'pinned = true',
    ownerMay: { update: true, delete: true },
    forge: (a) => [
      `insert into public.blocks (user_id, task_id, starts_at, ends_at, work_minutes)
       values ($1, $2, '2026-12-01T09:00Z', '2026-12-01T10:00Z', 60)`,
      [a.userId, a.taskId],
    ],
  },
  {
    table: 'recurring_events',
    row: (a) => ['id = $1', [a.recurringEventId]],
    change: "title = 'Hacked'",
    ownerMay: { update: true, delete: true },
    forge: (a) => [
      `insert into public.recurring_events (user_id, type_id, title, weekday, start_time, end_time, valid_from)
       values ($1, $2, 'Forged', 1, '08:00', '09:00', '2026-09-01')`,
      [a.userId, a.typeId],
    ],
  },
  {
    table: 'habits',
    row: (a) => ['id = $1', [a.habitId]],
    change: "name = 'Hacked'",
    ownerMay: { update: true, delete: true },
    forge: (a) => ["insert into public.habits (user_id, name) values ($1, 'Forged')", [a.userId]],
  },
  {
    table: 'habit_checks',
    row: (a) => ['habit_id = $1', [a.habitId]],
    change: "day = '2026-11-05'",
    ownerMay: { update: false, delete: true },
    forge: (a) => [
      "insert into public.habit_checks (user_id, habit_id, day) values ($1, $2, '2026-12-01')",
      [a.userId, a.habitId],
    ],
  },
  {
    table: 'weekly_reflections',
    row: (a) => ['id = $1', [a.weeklyId]],
    change: 'fatigue = 5',
    ownerMay: { update: true, delete: false },
    forge: (a) => [
      `insert into public.weekly_reflections (user_id, week_start, fatigue, stress, focus, distractions)
       values ($1, '2026-11-09', 1, 1, 1, 1)`,
      [a.userId],
    ],
  },
  {
    table: 'monthly_reflections',
    row: (a) => ['id = $1', [a.monthlyId]],
    change: "went_badly = 'Hacked'",
    ownerMay: { update: true, delete: false },
    forge: (a) => [
      "insert into public.monthly_reflections (user_id, month) values ($1, '2026-12-01')",
      [a.userId],
    ],
  },
  {
    table: 'ai_requests',
    row: (a) => ['id = $1', [a.aiRequestId]],
    change: "status = 'failed'",
    ownerMay: { update: true, delete: false },
    forge: (a) => [
      "insert into public.ai_requests (user_id, kind) values ($1, 'decompose')",
      [a.userId],
    ],
  },
  {
    table: 'push_subscriptions',
    row: (a) => ['id = $1', [a.pushId]],
    change: "user_agent = 'Hacked'",
    ownerMay: { update: false, delete: true },
    forge: (a) => [
      "insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret) values ($1, 'https://push.example.com/forged', 'k', 's')",
      [a.userId],
    ],
  },
  {
    table: 'calendar_feeds',
    row: (a) => ['user_id = $1', [a.userId]],
    change: "token = 'guessable'",
    ownerMay: { update: false, delete: true },
    forge: (a) => ['insert into public.calendar_feeds (user_id) values ($1)', [a.userId]],
  },
  {
    table: 'calendar_subscriptions',
    row: (a) => ['id = $1', [a.subscriptionId]],
    change: "url = 'https://evil.example.com/x.ics'",
    ownerMay: { update: true, delete: true },
    forge: (a) => [
      "insert into public.calendar_subscriptions (user_id, name, url, type_id) values ($1, 'Forged', 'https://x.example.com/f.ics', $2)",
      [a.userId, a.typeId],
    ],
  },
  {
    table: 'external_events',
    row: (a) => ['id = $1', [a.externalEventId]],
    change: "title = 'Hacked'",
    ownerMay: { update: false, delete: true },
    forge: (a) => [
      `insert into public.external_events (user_id, subscription_id, uid, starts_at, ends_at, title)
       values ($1, $2, 'forged', '2026-12-01T09:00Z', '2026-12-01T10:00Z', 'Forged')`,
      [a.userId, a.subscriptionId],
    ],
  },
];

async function checkTableIsolation(db, spec, a) {
  const [where, params] = spec.row(a);
  const table = `public.${spec.table}`;
  const count = (actor) =>
    attempt(db, actor, (tx) =>
      scalar(tx, `select count(*)::int from ${table} where ${where}`, params),
    );
  const update = (actor) =>
    attempt(db, actor, (tx) =>
      affected(tx, `update ${table} set ${spec.change} where ${where}`, params),
    );
  const remove = (actor) =>
    attempt(db, actor, (tx) => affected(tx, `delete from ${table} where ${where}`, params));

  expectEqual(expectSuccess(await count(asUser(USERS.A)), 'A reads own row'), 1, 'rows A sees');
  expectEqual(
    expectSuccess(await count(asUser(USERS.B)), "B reads A's row"),
    0,
    'rows of A that B sees',
  );
  expectBlocked(await update(asUser(USERS.B)), "B updates A's row");
  expectBlocked(await remove(asUser(USERS.B)), "B deletes A's row");
  const [forgeSql, forgeParams] = spec.forge(a);
  expectError(
    await attempt(db, asUser(USERS.B), (tx) => tx.query(forgeSql, forgeParams)),
    '42501',
    'B inserts a row owned by A',
  );

  // Owner's rights: exactly what the migration grants, no more, no less.
  const ownUpdate = await update(asUser(USERS.A));
  if (spec.ownerMay.update) {
    expectEqual(expectSuccess(ownUpdate, 'A updates own row'), 1, 'rows A updated');
  } else {
    expectError(ownUpdate, '42501', 'A updates own row (not granted)');
  }
  const ownDelete = spec.ownerDeleteFresh
    ? await attempt(db, asUser(USERS.A), async (tx) => {
        const id = await scalar(tx, spec.ownerDeleteFresh);
        return affected(tx, `delete from ${table} where id = $1`, [id]);
      })
    : await remove(asUser(USERS.A));
  if (spec.ownerMay.delete) {
    expectEqual(expectSuccess(ownDelete, 'A deletes own row'), 1, 'rows A deleted');
  } else {
    expectError(ownDelete, '42501', 'A deletes own row (not granted)');
  }
}

// ---------------------------------------------------------------------------
// (c) Composite foreign keys: B points a new row of B's own at A's parent row.
// The id is known to B; only the (id, user_id) pair can refuse it.
// ---------------------------------------------------------------------------

const COMPOSITE_FKS = [
  {
    name: 'tasks.type_id -> task_types',
    sql: 'insert into public.tasks (type_id) values ($1)',
    params: (parent) => [parent.typeId],
  },
  {
    name: 'blocks.task_id -> tasks',
    sql: "insert into public.blocks (task_id, starts_at, ends_at, work_minutes) values ($1, '2026-12-02T09:00Z', '2026-12-02T10:00Z', 60)",
    params: (parent) => [parent.taskId],
  },
  {
    name: 'recurring_events.type_id -> task_types',
    sql: `insert into public.recurring_events (type_id, title, weekday, start_time, end_time, valid_from)
          values ($1, 'X', 1, '08:00', '09:00', '2026-09-01')`,
    params: (parent) => [parent.typeId],
  },
  {
    name: 'habit_checks.habit_id -> habits',
    sql: "insert into public.habit_checks (habit_id, day) values ($1, '2026-12-02')",
    params: (parent) => [parent.habitId],
  },
  {
    name: 'calendar_subscriptions.type_id -> task_types',
    sql: "insert into public.calendar_subscriptions (name, url, type_id) values ('X', 'https://x.example.com/x.ics', $1)",
    params: (parent) => [parent.typeId],
  },
  {
    name: 'external_events.subscription_id -> calendar_subscriptions',
    sql: `insert into public.external_events (user_id, subscription_id, uid, starts_at, ends_at, title)
          values ($2, $1, 'x', '2026-12-02T09:00Z', '2026-12-02T10:00Z', 'X')`,
    params: (parent) => [parent.subscriptionId, USERS.B.id],
  },
];

// ---------------------------------------------------------------------------
// Other checks
// ---------------------------------------------------------------------------

const PUBLIC_TABLES = TABLES.map((spec) => spec.table);

const RPC_CALLS = [
  "select public.apply_plan('{}'::uuid[], '[]'::jsonb)",
  "select * from public.type_stats('2026-01-01', '2027-01-01')",
  "select public.start_ai_request('decompose')",
  'select public.rotate_calendar_feed()',
  "select public.replace_external_events(gen_random_uuid(), '[]'::jsonb)",
  "select public.claim_push_subscription('https://push.example.com/x', 'k', 's', null)",
];

function countOwnedRows(db, userId) {
  return run(db, SUPERUSER, async (tx) => {
    const counts = {};
    for (const table of PUBLIC_TABLES) {
      const owner = table === 'profiles' ? 'id' : 'user_id';
      counts[table] = await scalar(
        tx,
        `select count(*)::int from public.${table} where ${owner} = $1`,
        [userId],
      );
    }
    return counts;
  });
}

/** Every privilege of the API roles on public tables, columns and functions. */
async function privilegeMatrix(db) {
  const { rows: tableRows } = await db.query(`
    select format('%s %s %s', c.relname, r.name, p.name)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    cross join (values ('anon'), ('authenticated'), ('service_role')) as r (name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p (name)
    where c.relkind = 'r' and has_table_privilege(r.name, c.oid, p.name)
    union all
    select format('%s.%s %s %s', c.relname, a.attname, r.name, p.name)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    cross join (values ('anon'), ('authenticated'), ('service_role')) as r (name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) as p (name)
    where c.relkind = 'r' and has_column_privilege(r.name, c.oid, a.attnum, p.name)
    union all
    select format('%s %s EXECUTE', p.oid::regprocedure, r.name)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    cross join (values ('anon'), ('authenticated'), ('service_role')) as r (name)
    where has_function_privilege(r.name, p.oid, 'EXECUTE')
    order by 1`);
  return tableRows.map((row) => Object.values(row)[0]);
}

// ---------------------------------------------------------------------------
// Check groups, in the order they run
// ---------------------------------------------------------------------------

// (a) Sign-up: the Auth role inserts into auth.users, the trigger does the rest.
// Returns false if nobody could sign up: then nothing else can be checked.
async function checkSignUp(db) {
  const signedUp = await check(
    'a',
    'sign-up creates a default profile (trigger as definer)',
    async () => {
      for (const user of Object.values(USERS)) {
        await signUp(db, user);
      }
      const profiles = await run(db, asUser(USERS.A), (tx) =>
        rows(
          tx,
          'select timezone, reflection_level, day_start, day_end, daily_energy_limit from public.profiles',
        ),
      );
      expectEqual(
        profiles,
        [
          {
            timezone: 'Europe/Warsaw',
            reflection_level: 'basic',
            day_start: '08:00:00',
            day_end: '22:00:00',
            daily_energy_limit: 20,
          },
        ],
        'profiles A sees',
      );
    },
  );
  await check('a', 'handle_new_user() not callable via the API', async () => {
    expectError(
      await attempt(db, asUser(USERS.A), (tx) => tx.query('select public.handle_new_user()')),
      '42501',
      'call',
    );
  });
  return signedUp;
}

// (b) Every table: B can't touch A's rows; the owner has exactly the granted rights.
async function checkIsolation(db, { a }) {
  for (const spec of TABLES) {
    await check('b', `${spec.table}: isolated from B; owner rights exact`, () =>
      checkTableIsolation(db, spec, a),
    );
  }
}

// (c) Composite foreign keys.
async function checkCompositeKeys(db, { a, b }) {
  for (const fk of COMPOSITE_FKS) {
    await check('c', `${fk.name}: A's row refused, own accepted`, async () => {
      expectError(
        await attempt(db, asUser(USERS.B), (tx) => tx.query(fk.sql, fk.params(a))),
        '23503',
        "pointing at A's row",
      );
      expectSuccess(
        await attempt(db, asUser(USERS.B), (tx) => tx.query(fk.sql, fk.params(b))),
        "pointing at B's own row",
      );
    });
  }
}

// (d) blocks_no_overlap.
async function checkNoOverlap(db, { a, b }) {
  const block = (task, from, to, status = 'planned') => [
    `insert into public.blocks (task_id, starts_at, ends_at, work_minutes, status, actual_minutes, closed_at)
     values ($1, $2, $3, 30, $4, $5, $6)`,
    [
      task,
      `2026-11-10T${from}Z`,
      `2026-11-10T${to}Z`,
      status,
      status === 'done' ? 30 : null,
      status === 'planned' ? null : '2026-11-10T20:00Z',
    ],
  ];
  const secondAfterFirst = (first, second) =>
    attempt(db, asUser(USERS.A), async (tx) => {
      await tx.query(...first);
      return affected(tx, ...second);
    });

  await check('d', 'overlapping planned/done blocks rejected', async () => {
    expectError(
      await secondAfterFirst(block(a.taskId, '10:00', '11:00'), block(a.taskId, '10:30', '11:30')),
      '23P01',
      'planned over planned',
      'blocks_no_overlap',
    );
    expectError(
      await secondAfterFirst(
        block(a.taskId, '10:00', '11:00'),
        block(a.taskId, '10:15', '10:45', 'done'),
      ),
      '23P01',
      'done over planned',
      'blocks_no_overlap',
    );
  });
  await check('d', 'touching [10:00,11:00)+[11:00,12:00) allowed', async () => {
    const outcome = await secondAfterFirst(
      block(a.taskId, '10:00', '11:00'),
      block(a.taskId, '11:00', '12:00'),
    );
    expectEqual(expectSuccess(outcome, 'touching'), 1, 'inserted');
  });
  await check('d', 'a missed block may overlap', async () => {
    const outcome = await secondAfterFirst(
      block(a.taskId, '10:00', '11:00'),
      block(a.taskId, '10:15', '10:45', 'missed'),
    );
    expectEqual(expectSuccess(outcome, 'missed'), 1, 'inserted');
  });
  await check('d', "other users' blocks don't conflict", async () => {
    await run(db, asUser(USERS.A), (tx) => tx.query(...block(a.taskId, '14:00', '15:00')));
    const outcome = await attempt(db, asUser(USERS.B), (tx) =>
      affected(tx, ...block(b.taskId, '14:00', '15:00')),
    );
    expectEqual(expectSuccess(outcome, "B's block at A's time"), 1, 'inserted');
  });
}

// (e) Check constraints: every rejected value sits next to an accepted one.
async function checkConstraints(db, { a }) {
  const updateProfile = (assignment) =>
    attempt(db, asUser(USERS.A), (tx) =>
      affected(tx, `update public.profiles set ${assignment} where id = $1`, [USERS.A.id]),
    );

  await check(
    'e',
    'timezone: Mars/Olympus, PST, ABC3, Factory rejected; America/New_York ok',
    async () => {
      for (const zone of ['Mars/Olympus', 'PST', 'ABC3', 'Factory']) {
        expectError(
          await updateProfile(`timezone = '${zone}'`),
          '23514',
          zone,
          'profiles_timezone_check',
        );
      }
      expectEqual(
        expectSuccess(await updateProfile("timezone = 'America/New_York'"), 'New York'),
        1,
        'updated',
      );
    },
  );
  await check('e', 'color: #FFF, #1E90FF rejected; #1e90ff ok', async () => {
    const insertType = (color) =>
      attempt(db, asUser(USERS.A), (tx) =>
        affected(tx, "insert into public.task_types (name, color) values ('Kolor', $1)", [color]),
      );
    expectError(await insertType('#FFF'), '23514', '#FFF', 'task_types_color_check');
    expectError(await insertType('#1E90FF'), '23514', '#1E90FF', 'task_types_color_check');
    expectEqual(expectSuccess(await insertType('#1e90ff'), '#1e90ff'), 1, 'inserted');
  });
  await check('e', 'day_end <= day_start rejected; 07:00-23:00 ok', async () => {
    expectError(
      await updateProfile("day_start = '22:00', day_end = '08:00'"),
      '23514',
      'reversed',
      'profiles_day_window',
    );
    expectError(
      await updateProfile("day_start = '10:00', day_end = '10:00'"),
      '23514',
      'empty',
      'profiles_day_window',
    );
    expectEqual(
      expectSuccess(await updateProfile("day_start = '07:00', day_end = '23:00'"), 'valid'),
      1,
      'updated',
    );
  });
  await check('e', 'week_start on a Tuesday rejected; Monday ok', async () => {
    const insertWeek = (day) =>
      attempt(db, asUser(USERS.A), (tx) =>
        affected(
          tx,
          'insert into public.weekly_reflections (week_start, fatigue, stress, focus, distractions) values ($1, 2, 2, 2, 2)',
          [day],
        ),
      );
    expectError(
      await insertWeek('2026-11-10'),
      '23514',
      'Tuesday',
      'weekly_reflections_week_start_check',
    );
    expectEqual(expectSuccess(await insertWeek('2026-11-09'), 'Monday'), 1, 'inserted');
  });
  await check('e', 'session_minutes: 29, 190, 50 rejected; 45, 180 ok', async () => {
    const setSession = (minutes) =>
      attempt(db, asUser(USERS.A), (tx) =>
        affected(tx, 'update public.tasks set session_minutes = $1 where id = $2', [
          minutes,
          a.taskId,
        ]),
      );
    for (const minutes of [29, 190, 50]) {
      expectError(await setSession(minutes), '23514', `${minutes}`, 'tasks_session_minutes_check');
    }
    for (const minutes of [45, 180]) {
      expectEqual(expectSuccess(await setSession(minutes), `${minutes}`), 1, 'updated');
    }
  });
}

// (f) AI quota. Every call is its own committed transaction, like the real requests.
async function checkAiQuota(db) {
  const startAi = (user) =>
    tryRun(db, asUser(user), (tx) => scalar(tx, "select public.start_ai_request('decompose')"));

  await check('f', '20 AI requests pass, the 21st: ai_daily_limit_reached', async () => {
    for (let i = 1; i <= 20; i += 1) {
      expectSuccess(await startAi(USERS.Q), `request ${i}`);
    }
    expectError(await startAi(USERS.Q), 'P0001', 'request 21', 'ai_daily_limit_reached');
  });
  await check('f', 'quota is per user: B still can', async () => {
    expectSuccess(await startAi(USERS.B), "B's request");
  });
  await check('f', 'backdating created_at is refused; quota holds', async () => {
    const backdate = await attempt(db, asUser(USERS.Q), (tx) =>
      affected(tx, "update public.ai_requests set created_at = now() - interval '2 days'"),
    );
    expectError(backdate, '42501', 'backdating', 'permission denied');
    expectError(
      await startAi(USERS.Q),
      'P0001',
      'request after the attempt',
      'ai_daily_limit_reached',
    );
  });
}

// (g) apply_plan on 2026-11-16: pinned, done, missed and two planner blocks.
async function checkApplyPlan(db, { a }) {
  const day = '2026-11-16';
  const ids = await run(db, asUser(USERS.A), async (tx) => {
    const insert = (
      from,
      to,
      { source = 'planner', pinned = false, status = 'planned', actual = null } = {},
    ) =>
      scalar(
        tx,
        `insert into public.blocks (task_id, starts_at, ends_at, work_minutes, source, pinned, status, actual_minutes, closed_at)
       values ($1, $2, $3, 60, $4, $5, $6, $7, $8) returning id`,
        [
          a.taskId,
          `${day}T${from}Z`,
          `${day}T${to}Z`,
          source,
          pinned,
          status,
          actual,
          status === 'planned' ? null : `${day}T20:00Z`,
        ],
      );
    return {
      pinned: await insert('14:00', '15:00', { source: 'manual', pinned: true }),
      done: await insert('07:00', '08:00', { status: 'done', actual: 60 }),
      missed: await insert('08:00', '09:00', { status: 'missed' }),
      old1: await insert('09:00', '10:00'),
      old2: await insert('10:00', '11:00'),
    };
  });
  const newBlock = (from, to) => ({
    task_id: a.taskId,
    starts_at: `${day}T${from}Z`,
    ends_at: `${day}T${to}Z`,
    work_minutes: 60,
    source: 'planner',
  });
  const applyPlan = (user, removeIds, blocks) =>
    tryRun(db, asUser(user), (tx) =>
      scalar(tx, 'select public.apply_plan($1, $2)', [removeIds, JSON.stringify(blocks)]),
    );
  const blocksOfDay = () =>
    run(db, asUser(USERS.A), (tx) =>
      rows(
        tx,
        `select id, to_char(starts_at at time zone 'UTC', 'HH24:MI') as at, source, pinned
     from public.blocks where starts_at >= $1 and starts_at < $2 order by starts_at`,
        [`${day}T00:00Z`, `${day}T23:59Z`],
      ),
    );
  const startTimes = async () => (await blocksOfDay()).map((row) => row.at);

  await check('g', 'plan overlapping a pinned block fails whole; old blocks stay', async () => {
    const outcome = await applyPlan(
      USERS.A,
      [ids.old1, ids.old2],
      [newBlock('12:00', '13:00'), newBlock('14:30', '15:30')],
    );
    expectError(outcome, '23P01', 'plan', 'blocks_no_overlap');
    expectEqual(
      await startTimes(),
      ['07:00', '08:00', '09:00', '10:00', '14:00'],
      'blocks of the day',
    );
  });
  await check('g', 'valid plan replaces old planner blocks', async () => {
    const outcome = await applyPlan(
      USERS.A,
      [ids.old1, ids.old2],
      [newBlock('12:00', '13:00'), newBlock('13:00', '14:00')],
    );
    expectEqual(expectSuccess(outcome, 'plan'), 2, 'inserted');
    const after = await blocksOfDay();
    expectEqual(
      after.map((row) => row.at),
      ['07:00', '08:00', '12:00', '13:00', '14:00'],
      'blocks of the day',
    );
    const fresh = after.filter((row) => ['12:00', '13:00'].includes(row.at));
    assert(
      fresh.every((row) => row.source === 'planner' && row.pinned === false),
      'new blocks are unpinned planner blocks',
    );
  });
  await check('g', 'never removes pinned/done/missed blocks, whatever ids', async () => {
    expectEqual(
      expectSuccess(await applyPlan(USERS.A, [ids.pinned, ids.done, ids.missed], []), 'plan'),
      0,
      'inserted',
    );
    expectEqual(
      await startTimes(),
      ['07:00', '08:00', '12:00', '13:00', '14:00'],
      'blocks of the day',
    );
  });
  await check('g', "B's plan with A's block ids removes nothing", async () => {
    const idsOfA = (await blocksOfDay()).map((row) => row.id);
    expectSuccess(await applyPlan(USERS.B, idsOfA, []), "B's plan");
    expectEqual(
      await startTimes(),
      ['07:00', '08:00', '12:00', '13:00', '14:00'],
      "A's blocks of the day",
    );
  });
}

// (h) type_stats for the week of 2026-11-23.
async function checkTypeStats(db, { a, b }) {
  const sportTypeId = await run(db, asUser(USERS.A), async (tx) => {
    const typeId = await scalar(
      tx,
      "insert into public.task_types (name, energy) values ('Sport', 1) returning id",
    );
    const sportTask = await scalar(
      tx,
      'insert into public.tasks (type_id) values ($1) returning id',
      [typeId],
    );
    const insert = (task, from, to, status, actual) =>
      tx.query(
        `insert into public.blocks (task_id, starts_at, ends_at, work_minutes, status, actual_minutes, closed_at)
       values ($1, $2, $3, 60, $4, $5, $6)`,
        [task, from, to, status, actual, status === 'planned' ? null : '2026-11-29T20:00Z'],
      );
    await insert(a.taskId, '2026-11-23T09:00Z', '2026-11-23T10:30Z', 'done', 100);
    await insert(a.taskId, '2026-11-24T09:00Z', '2026-11-24T10:00Z', 'missed', null);
    await insert(a.taskId, '2026-11-25T09:00Z', '2026-11-25T10:00Z', 'planned', null);
    await insert(sportTask, '2026-11-23T17:00Z', '2026-11-23T18:00Z', 'done', 45);
    return typeId;
  });
  await run(db, asUser(USERS.B), (tx) =>
    tx.query(
      `insert into public.blocks (task_id, starts_at, ends_at, work_minutes, status, actual_minutes, closed_at)
     values ($1, '2026-11-23T09:00Z', '2026-11-23T10:00Z', 60, 'done', 60, '2026-11-29T20:00Z')`,
      [b.taskId],
    ),
  );
  const stats = (user) =>
    run(db, asUser(user), (tx) =>
      rows(
        tx,
        `select type_id, type_name, planned_minutes::int as planned, actual_minutes::int as actual,
            done_blocks::int as done, missed_blocks::int as missed
     from public.type_stats('2026-11-23', '2026-11-30')`,
      ),
    );

  await check('h', "type_stats: caller's blocks only, hand-computed totals", async () => {
    // Nauka: done 90 min (actual 100) + missed 60 min; the planned block is not counted.
    expectEqual(
      await stats(USERS.A),
      [
        { type_id: a.typeId, type_name: 'Nauka', planned: 150, actual: 100, done: 1, missed: 1 },
        { type_id: sportTypeId, type_name: 'Sport', planned: 60, actual: 45, done: 1, missed: 0 },
      ],
      "A's stats",
    );
    expectEqual(
      await stats(USERS.B),
      [{ type_id: b.typeId, type_name: 'Nauka', planned: 60, actual: 60, done: 1, missed: 0 }],
      "B's stats",
    );
  });
}

// (i) replace_external_events on a dedicated subscription of A.
async function checkExternalEvents(db, { a }) {
  const subscriptionId = await run(db, asUser(USERS.A), (tx) =>
    scalar(
      tx,
      "insert into public.calendar_subscriptions (name, url, type_id) values ('Szkola 2', 'https://calendar.example.com/a2.ics', $1) returning id",
      [a.typeId],
    ),
  );
  const event = (uid, day) => ({
    uid,
    starts_at: `2026-11-${day}T07:00Z`,
    ends_at: `2026-11-${day}T07:45Z`,
    title: 'Lekcja',
  });
  const replaceEvents = (actor, events) =>
    tryRun(db, actor, (tx) =>
      scalar(tx, 'select public.replace_external_events($1, $2)', [
        subscriptionId,
        JSON.stringify(events),
      ]),
    );
  const storedEvents = () =>
    run(db, SUPERUSER, (tx) =>
      rows(
        tx,
        'select uid, user_id from public.external_events where subscription_id = $1 order by uid',
        [subscriptionId],
      ),
    );
  const storedUids = async () => (await storedEvents()).map((row) => row.uid);

  await check('i', 'A replaces own events; last_synced_at set', async () => {
    expectEqual(
      expectSuccess(
        await replaceEvents(asUser(USERS.A), [event('e1', '03'), event('e2', '04')]),
        'first sync',
      ),
      2,
      'inserted',
    );
    expectEqual(
      expectSuccess(await replaceEvents(asUser(USERS.A), [event('e3', '05')]), 'second sync'),
      1,
      'inserted',
    );
    expectEqual(await storedUids(), ['e3'], 'events');
    const synced = await run(db, asUser(USERS.A), (tx) =>
      scalar(
        tx,
        'select last_synced_at is not null and last_error is null from public.calendar_subscriptions where id = $1',
        [subscriptionId],
      ),
    );
    expectEqual(synced, true, 'sync recorded');
  });
  await check('i', "B cannot replace A's events", async () => {
    expectError(
      await replaceEvents(asUser(USERS.B), [event('evil', '06')]),
      'P0002',
      'B',
      'subscription_not_found',
    );
    expectEqual(await storedUids(), ['e3'], "A's events");
  });
  await check('i', "cron (service_role) syncs A's events, owned by A", async () => {
    expectEqual(
      expectSuccess(
        await replaceEvents(SERVICE, [event('e4', '10'), event('e5', '11')]),
        'cron sync',
      ),
      2,
      'inserted',
    );
    expectEqual(
      await storedEvents(),
      [
        { uid: 'e4', user_id: USERS.A.id },
        { uid: 'e5', user_id: USERS.A.id },
      ],
      'events',
    );
  });
  await check('i', 'sync with an invalid event changes nothing', async () => {
    const broken = {
      uid: 'bad',
      starts_at: '2026-11-12T08:00Z',
      ends_at: '2026-11-12T07:00Z',
      title: 'Broken',
    };
    expectError(
      await replaceEvents(asUser(USERS.A), [event('e6', '12'), broken]),
      '23514',
      'sync',
      'external_events_time_order',
    );
    expectEqual(await storedUids(), ['e4', 'e5'], 'events');
  });
}

// (j) Storage: the ai-uploads bucket and its three policies.
async function checkStorage(db, { a, b }) {
  await check('j', 'ai-uploads bucket: private, 20 MB, PDF/JPEG/PNG/WebP/HEIC/HEIF', async () => {
    const buckets = await run(db, SUPERUSER, (tx) =>
      rows(
        tx,
        "select public, file_size_limit::int as size, allowed_mime_types as types from storage.buckets where id = 'ai-uploads'",
      ),
    );
    expectEqual(
      buckets,
      [
        {
          public: false,
          size: 20971520,
          types: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
          ],
        },
      ],
      'bucket',
    );
  });
  await check('j', "uploads only into one's own folder", async () => {
    const upload = (name) =>
      attempt(db, asUser(USERS.A), (tx) =>
        affected(tx, "insert into storage.objects (bucket_id, name) values ('ai-uploads', $1)", [
          name,
        ]),
      );
    expectEqual(expectSuccess(await upload(`${USERS.A.id}/plan.pdf`), 'own folder'), 1, 'uploaded');
    expectError(
      await upload(`${USERS.B.id}/evil.pdf`),
      '42501',
      "B's folder",
      'row-level security',
    );
  });
  await check('j', "B can't read/delete A's file; anon sees none", async () => {
    const visible = async (actor) =>
      (
        await run(db, actor, (tx) => rows(tx, 'select name from storage.objects order by name'))
      ).map((row) => row.name);
    expectEqual(await visible(asUser(USERS.B)), [b.objectName], 'files B sees');
    expectBlocked(
      await attempt(db, asUser(USERS.B), (tx) =>
        affected(tx, 'delete from storage.objects where name = $1', [a.objectName]),
      ),
      "B deletes A's file",
    );
    expectEqual(await visible(ANON), [], 'files anon sees');
  });
}

// (k) Anonymous visitors (publishable key, no session).
async function checkAnon(db) {
  await check('k', `anon reads none of ${PUBLIC_TABLES.length} tables`, async () => {
    for (const table of PUBLIC_TABLES) {
      expectError(
        await attempt(db, ANON, (tx) => tx.query(`select * from public.${table}`)),
        '42501',
        table,
        'permission denied',
      );
    }
  });
  await check('k', `anon calls none of ${RPC_CALLS.length} RPCs`, async () => {
    for (const call of RPC_CALLS) {
      expectError(
        await attempt(db, ANON, (tx) => tx.query(call)),
        '42501',
        call,
        'permission denied',
      );
    }
  });
}

// (l) Account deletion (spec FR-06) and "on delete restrict".
async function checkAccountDeletion(db, { a }) {
  await check('l', "account deletion erases own rows, nobody else's", async () => {
    const others = async () => ({
      A: await countOwnedRows(db, USERS.A.id),
      B: await countOwnedRows(db, USERS.B.id),
    });
    const before = await others();
    const seeded = await countOwnedRows(db, USERS.C.id);
    assert(
      Object.values(seeded).every((n) => n >= 1),
      `C has rows in every table: ${JSON.stringify(seeded)}`,
    );
    await run(db, AUTH_SERVICE, (tx) =>
      tx.query('delete from auth.users where id = $1', [USERS.C.id]),
    );
    const left = await countOwnedRows(db, USERS.C.id);
    assert(
      Object.values(left).every((n) => n === 0),
      `C's rows left: ${JSON.stringify(left)}`,
    );
    expectEqual(await others(), before, 'rows of A and B');
  });
  await check('l', 'type in use undeletable; unused type deletable', async () => {
    expectError(
      await attempt(db, asUser(USERS.A), (tx) =>
        tx.query('delete from public.task_types where id = $1', [a.typeId]),
      ),
      RESTRICT_VIOLATION,
      'type in use',
      'tasks_type_same_user',
    );
    const unused = await attempt(db, asUser(USERS.A), async (tx) => {
      const id = await scalar(
        tx,
        "insert into public.task_types (name) values ('Unused') returning id",
      );
      return affected(tx, 'delete from public.task_types where id = $1', [id]);
    });
    expectEqual(expectSuccess(unused, 'unused type'), 1, 'deleted');
  });
}

// (m) Server-side jobs with the secret key.
async function checkServiceRole(db, { a }) {
  await check('m', 'service_role: reads blocks, updates only notified_at', async () => {
    const owners = await attempt(db, SERVICE, (tx) =>
      scalar(tx, 'select count(distinct user_id)::int from public.blocks'),
    );
    expectEqual(expectSuccess(owners, 'read blocks'), 2, 'users with blocks');
    const stamp = await attempt(db, SERVICE, (tx) =>
      affected(tx, 'update public.blocks set notified_at = now() where id = $1', [a.blockId]),
    );
    expectEqual(expectSuccess(stamp, 'notified_at'), 1, 'updated');
    expectError(
      await attempt(db, SERVICE, (tx) =>
        tx.query("update public.blocks set status = 'missed' where id = $1", [a.blockId]),
      ),
      '42501',
      'status',
      'permission denied',
    );
    expectError(
      await attempt(db, SERVICE, (tx) => tx.query('delete from public.tasks')),
      '42501',
      'delete tasks',
      'permission denied',
    );
  });
  await check('m', 'service_role: feed token lookup; drops push subscription', async () => {
    const owner = await attempt(db, SERVICE, (tx) =>
      scalar(tx, 'select user_id from public.calendar_feeds where token = $1', [a.feedToken]),
    );
    expectEqual(expectSuccess(owner, 'token lookup'), USERS.A.id, 'owner');
    const dropped = await attempt(db, SERVICE, (tx) =>
      affected(tx, 'delete from public.push_subscriptions where id = $1', [a.pushId]),
    );
    expectEqual(expectSuccess(dropped, 'drop subscription'), 1, 'deleted');
  });
}

// (n) rotate_calendar_feed.
async function checkFeedRotation(db, { a, b }) {
  await check('n', 'rotate_calendar_feed: new 64-hex token; B untouched', async () => {
    const tokenOf = (user) =>
      run(db, SUPERUSER, (tx) =>
        scalar(tx, 'select token from public.calendar_feeds where user_id = $1', [user.id]),
      );
    const newToken = await run(db, asUser(USERS.A), (tx) =>
      scalar(tx, 'select public.rotate_calendar_feed()'),
    );
    assert(/^[0-9a-f]{64}$/.test(newToken) && newToken !== a.feedToken, `new token: ${newToken}`);
    expectEqual(await tokenOf(USERS.A), newToken, "A's stored token");
    expectEqual(await tokenOf(USERS.B), b.feedToken, "B's token");
  });
}

// (o) updated_at trigger.
async function checkUpdatedAt(db, { a }) {
  await check('o', 'set_updated_at() stamps updates', async () => {
    await run(db, asUser(USERS.A), (tx) =>
      tx.query('update public.tasks set notes = $1 where id = $2', ['Rozdzial 3', a.taskId]),
    );
    const moved = await run(db, asUser(USERS.A), (tx) =>
      scalar(tx, 'select updated_at > created_at from public.tasks where id = $1', [a.taskId]),
    );
    expectEqual(moved, true, 'updated_at moved');
  });
}

// (p) The migrations must not depend on the project's default privileges.
async function checkDefaultPrivileges(db) {
  await check('p', 'rights identical in pre/post-2026-05-30 projects', async () => {
    const legacy = await bootDatabase('legacy');
    const current = await privilegeMatrix(db);
    const old = await privilegeMatrix(legacy.db);
    await legacy.db.close();
    const onlyNew = current.filter((entry) => !old.includes(entry));
    const onlyOld = old.filter((entry) => !current.includes(entry));
    assert(
      onlyNew.length === 0 && onlyOld.length === 0,
      `only in new projects: ${JSON.stringify(onlyNew)}; only in old ones: ${JSON.stringify(onlyOld)}`,
    );
  });
}

// (q) claim_push_subscription: one browser, used first by A, then by B.
async function checkPushClaim(db) {
  const sharedBrowser = 'https://push.example.com/shared-browser';
  const laptopOfA = 'https://push.example.com/laptop-of-a';
  const claim = (actor, endpoint) =>
    tryRun(db, actor, (tx) =>
      scalar(tx, "select public.claim_push_subscription($1, 'key', 'secret', 'Firefox')", [
        endpoint,
      ]),
    );
  const endpointsOf = async (user) =>
    (
      await run(db, asUser(user), (tx) =>
        rows(tx, 'select endpoint from public.push_subscriptions'),
      )
    )
      .map((row) => row.endpoint)
      .sort();
  const endpointsOfA = ['https://push.example.com/A', laptopOfA];

  await check('q', 'B claims the browser A used: it moves to B', async () => {
    const idOfA = expectSuccess(await claim(asUser(USERS.A), sharedBrowser), 'A subscribes');
    expectSuccess(await claim(asUser(USERS.A), laptopOfA), "A's second browser");
    const idOfB = expectSuccess(await claim(asUser(USERS.B), sharedBrowser), 'B claims');
    assert(idOfB !== idOfA, 'B gets a fresh row, not the old id');
    const holders = await run(db, SUPERUSER, (tx) =>
      rows(tx, 'select id, user_id from public.push_subscriptions where endpoint = $1', [
        sharedBrowser,
      ]),
    );
    expectEqual(holders, [{ id: idOfB, user_id: USERS.B.id }], 'rows of the shared endpoint');
    expectEqual(await endpointsOf(USERS.A), endpointsOfA, "A's endpoints");
  });
  await check('q', "B still sees none of A's other subscriptions", async () => {
    expectEqual(
      await endpointsOf(USERS.B),
      ['https://push.example.com/B', sharedBrowser],
      "B's endpoints",
    );
  });
  await check('q', 'anon, no-user session and direct insert refused', async () => {
    expectError(await claim(ANON, laptopOfA), '42501', 'anon', 'permission denied');
    const noUser = { role: 'authenticated', claims: { role: 'authenticated' } };
    expectError(await claim(noUser, laptopOfA), '42501', 'no user', 'not_authenticated');
    const direct = await attempt(db, asUser(USERS.A), (tx) =>
      tx.query(
        "insert into public.push_subscriptions (endpoint, p256dh, auth_secret) values ('https://push.example.com/direct', 'k', 's')",
      ),
    );
    expectError(direct, '42501', 'direct insert', 'permission denied');
    expectEqual(await endpointsOf(USERS.A), endpointsOfA, "A's endpoints");
  });
  await check('q', 'a non-https endpoint is refused', async () => {
    const plain = await claim(asUser(USERS.A), 'http://push.example.com/plain');
    expectError(plain, '22023', 'http endpoint', 'invalid_endpoint');
  });
}

async function main() {
  const { db, files } = await bootDatabase('current');
  const version = await scalar(db, 'show server_version');
  console.log(`PostgreSQL ${version} (PGlite): ${files.length} migrations applied\n`);

  if (!(await checkSignUp(db))) {
    console.log('\nStopped: without users there is nothing else to check.');
    printSummary();
    return;
  }
  const seeds = { a: await seedUser(db, USERS.A), b: await seedUser(db, USERS.B) };
  await seedUser(db, USERS.C);

  await group('b', () => checkIsolation(db, seeds));
  await group('c', () => checkCompositeKeys(db, seeds));
  await group('d', () => checkNoOverlap(db, seeds));
  await group('e', () => checkConstraints(db, seeds));
  await group('f', () => checkAiQuota(db));
  await group('g', () => checkApplyPlan(db, seeds));
  await group('h', () => checkTypeStats(db, seeds));
  await group('i', () => checkExternalEvents(db, seeds));
  await group('j', () => checkStorage(db, seeds));
  await group('k', () => checkAnon(db));
  await group('l', () => checkAccountDeletion(db, seeds));
  await group('m', () => checkServiceRole(db, seeds));
  await group('n', () => checkFeedRotation(db, seeds));
  await group('o', () => checkUpdatedAt(db, seeds));
  await group('p', () => checkDefaultPrivileges(db));
  await group('q', () => checkPushClaim(db));
  await db.close();
  printSummary();
}

main().catch((error) => {
  console.error(`FAIL  the run crashed: ${error.stack}`);
  process.exitCode = 1;
});
