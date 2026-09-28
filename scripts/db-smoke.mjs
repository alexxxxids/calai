/**
 * RLS smoke test for the DEV Supabase project (docs/coding-standards.md §10.3).
 *
 * Creates two throwaway users, A and B. Signing up gives A a profile; then A
 * writes one row into every other table through the normal API, so RLS
 * applies exactly as in the app. Then, as B, it tries to read, change, delete
 * and forge A's data, and it tries the same as an anonymous visitor. At the
 * end it deletes both users, and with them every row they created.
 *
 * Run:  npm run db:smoke   (settings come from .env.local)
 */
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// 1. Safety: this script creates and deletes users, so it runs only on dev.
// ---------------------------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

function refuse(reason) {
  console.error(`Refusing to run: ${reason}`);
  process.exit(1);
}

if (!url || !publishableKey || !secretKey) {
  refuse(
    'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY must be set (see .env.example).',
  );
}
if (!secretKey.startsWith('sb_secret_')) {
  refuse(
    'SUPABASE_SECRET_KEY must be a secret key (sb_secret_...), from Project Settings -> API Keys.',
  );
}
if (process.env.SMOKE_ALLOW !== 'dev') {
  refuse(
    `this script creates and deletes users in ${url}.\n` +
      'Nothing in a URL tells a dev project from a production one, so you have to confirm it yourself.\n' +
      'If this is your DEV project, run it again with SMOKE_ALLOW=dev:\n' +
      '  PowerShell: $env:SMOKE_ALLOW="dev"; npm run db:smoke\n' +
      '  Git Bash:   SMOKE_ALLOW=dev npm run db:smoke\n' +
      'Never run it against production: it would create users there.',
  );
}

// Scripts must not keep a session on disk or refresh tokens in the background.
const NO_SESSION = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
// The secret key bypasses RLS: here it only creates and deletes the test users.
const admin = createClient(url, secretKey, NO_SESSION);

// ---------------------------------------------------------------------------
// 2. A tiny test report
// ---------------------------------------------------------------------------

let failures = 0;

function check(name, passed, details = '') {
  if (passed) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}${details ? `\n        ${details}` : ''}`);
  }
}

/** What a Supabase response contained, for FAIL messages. */
function describe({ data, error }) {
  return error ? `error ${error.code}: ${error.message}` : `data: ${JSON.stringify(data)}`;
}

/** Refused by a missing right (42501) or nothing visible to touch. */
function isBlocked(result) {
  return result.error?.code === '42501' || (!result.error && result.data.length === 0);
}

// ---------------------------------------------------------------------------
// 3. Throwaway users
// ---------------------------------------------------------------------------

const RUN_ID = randomUUID().slice(0, 8);
// Random, and with every character class, so any password policy accepts it.
const PASSWORD = `${randomUUID()}Aa1!`;

async function createTestUser(label) {
  // example.com is fine: email_confirm skips the confirmation email, so no
  // mail is sent at all.
  const email = `smoke-${RUN_ID}-${label.toLowerCase()}@example.com`;
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error) {
    throw new Error(`could not create user ${label}: ${created.error.message}`);
  }
  // Each user gets their own client with the publishable key, exactly like the browser.
  const client = createClient(url, publishableKey, NO_SESSION);
  const signedIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signedIn.error) {
    throw new Error(`could not sign in as ${label}: ${signedIn.error.message}`);
  }
  return { label, id: created.data.user.id, email, client };
}

async function deleteTestUser(user) {
  // Deleting the user deletes all their rows too (on delete cascade).
  const { error } = await admin.auth.admin.deleteUser(user.id);
  check(
    `cleanup: user ${user.label} deleted`,
    !error,
    error ? `${error.message}. Delete ${user.email} by hand: Authentication -> Users.` : '',
  );
}

// ---------------------------------------------------------------------------
// 4. As A: one row in every table
// ---------------------------------------------------------------------------

// A date far in the future, so the test rows never mix with real planning.
const DAY = '2030-01-07'; // a Monday
// The smallest valid PNG (1x1 pixel): the bucket accepts only real file types.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function insertRow(client, table, values, columns = 'id') {
  const { data, error } = await client.from(table).insert(values).select(columns).single();
  if (error) {
    throw new Error(`insert into ${table} failed: ${error.message}`);
  }
  return data;
}

async function callRpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw new Error(`rpc ${name} failed: ${error.message}`);
  }
  return data;
}

/** Writes one row into every table as `user`; user_id is never sent (the database fills it in). */
async function createRowsAs(user) {
  const { client } = user;
  const type = await insertRow(client, 'task_types', { name: 'Smoke type', energy: 2 });
  const task = await insertRow(client, 'tasks', { type_id: type.id, estimate_minutes: 60 });
  const block = await insertRow(client, 'blocks', {
    task_id: task.id,
    starts_at: `${DAY}T09:00:00Z`,
    ends_at: `${DAY}T10:00:00Z`,
    work_minutes: 60,
  });
  const recurringEvent = await insertRow(client, 'recurring_events', {
    type_id: type.id,
    title: 'Smoke event',
    weekday: 1,
    start_time: '08:00',
    end_time: '09:00',
    valid_from: DAY,
  });
  const habit = await insertRow(client, 'habits', { name: 'Smoke habit' });
  await insertRow(client, 'habit_checks', { habit_id: habit.id, day: DAY }, 'habit_id');
  const weekly = await insertRow(client, 'weekly_reflections', {
    week_start: DAY,
    fatigue: 3,
    stress: 3,
    focus: 3,
    distractions: 3,
  });
  const monthly = await insertRow(client, 'monthly_reflections', {
    month: '2030-01-01',
    went_well: 'Smoke',
  });
  const aiRequestId = await callRpc(client, 'start_ai_request', { p_kind: 'decompose' });
  // Push subscriptions have no insert right: they come in through this function.
  const pushId = await callRpc(client, 'claim_push_subscription', {
    p_endpoint: `https://push.example.com/smoke-${RUN_ID}`,
    p_p256dh: 'smoke',
    p_auth_secret: 'smoke',
    p_user_agent: 'db-smoke',
  });
  await callRpc(client, 'rotate_calendar_feed');
  const subscription = await insertRow(client, 'calendar_subscriptions', {
    name: 'Smoke calendar',
    url: 'https://calendar.example.com/smoke.ics',
    type_id: type.id,
  });
  await callRpc(client, 'replace_external_events', {
    p_subscription_id: subscription.id,
    p_events: [
      {
        uid: 'smoke-1',
        starts_at: `${DAY}T07:00:00Z`,
        ends_at: `${DAY}T07:45:00Z`,
        title: 'Smoke lesson',
      },
    ],
  });
  const event = await client
    .from('external_events')
    .select('id')
    .eq('subscription_id', subscription.id)
    .single();
  if (event.error) {
    throw new Error(`reading the imported event failed: ${event.error.message}`);
  }
  const filePath = `${user.id}/smoke-${RUN_ID}.png`;
  const upload = await client.storage
    .from('ai-uploads')
    .upload(filePath, PNG, { contentType: 'image/png' });
  if (upload.error) {
    throw new Error(`upload to ai-uploads failed: ${upload.error.message}`);
  }
  return {
    typeId: type.id,
    taskId: task.id,
    blockId: block.id,
    recurringEventId: recurringEvent.id,
    habitId: habit.id,
    weeklyId: weekly.id,
    monthlyId: monthly.id,
    aiRequestId,
    pushId,
    subscriptionId: subscription.id,
    eventId: event.data.id,
    filePath,
  };
}

// ---------------------------------------------------------------------------
// 5. As B: attack A's rows
// ---------------------------------------------------------------------------

/**
 * For every table: how to find A's row, a change B will try, and a row
 * "owned by A" that B will try to insert (it points only at A's own rows,
 * so only RLS can stop it).
 */
function tableCases(a, rows) {
  const forgedTime = { starts_at: '2030-01-08T09:00:00Z', ends_at: '2030-01-08T10:00:00Z' };
  return [
    {
      table: 'profiles',
      match: { id: a.id },
      change: { display_name: 'Hacked' },
      forged: { id: a.id },
    },
    {
      table: 'task_types',
      match: { id: rows.typeId },
      change: { name: 'Hacked' },
      forged: { user_id: a.id, name: 'Forged' },
    },
    {
      table: 'tasks',
      match: { id: rows.taskId },
      change: { notes: 'Hacked' },
      forged: { user_id: a.id, type_id: rows.typeId },
    },
    {
      table: 'blocks',
      match: { id: rows.blockId },
      change: { pinned: true },
      forged: { user_id: a.id, task_id: rows.taskId, work_minutes: 60, ...forgedTime },
    },
    {
      table: 'recurring_events',
      match: { id: rows.recurringEventId },
      change: { title: 'Hacked' },
      forged: {
        user_id: a.id,
        type_id: rows.typeId,
        title: 'Forged',
        weekday: 2,
        start_time: '08:00',
        end_time: '09:00',
        valid_from: DAY,
      },
    },
    {
      table: 'habits',
      match: { id: rows.habitId },
      change: { name: 'Hacked' },
      forged: { user_id: a.id, name: 'Forged' },
    },
    {
      table: 'habit_checks',
      match: { habit_id: rows.habitId, day: DAY },
      change: { day: '2030-01-09' },
      forged: { user_id: a.id, habit_id: rows.habitId, day: '2030-01-08' },
    },
    {
      table: 'weekly_reflections',
      match: { id: rows.weeklyId },
      change: { note: 'Hacked' },
      forged: {
        user_id: a.id,
        week_start: '2030-01-14',
        fatigue: 1,
        stress: 1,
        focus: 1,
        distractions: 1,
      },
    },
    {
      table: 'monthly_reflections',
      match: { id: rows.monthlyId },
      change: { went_well: 'Hacked' },
      forged: { user_id: a.id, month: '2030-02-01' },
    },
    {
      table: 'ai_requests',
      match: { id: rows.aiRequestId },
      change: { model: 'Hacked' },
      forged: { user_id: a.id, kind: 'decompose' },
    },
    {
      table: 'push_subscriptions',
      match: { id: rows.pushId },
      change: { user_agent: 'Hacked' },
      forged: {
        user_id: a.id,
        endpoint: `https://push.example.com/forged-${RUN_ID}`,
        p256dh: 'x',
        auth_secret: 'x',
      },
    },
    {
      table: 'calendar_feeds',
      match: { user_id: a.id },
      change: { token: 'Hacked' },
      forged: { user_id: a.id },
    },
    {
      table: 'calendar_subscriptions',
      match: { id: rows.subscriptionId },
      change: { name: 'Hacked' },
      forged: {
        user_id: a.id,
        name: 'Forged',
        url: 'https://calendar.example.com/forged.ics',
        type_id: rows.typeId,
      },
    },
    {
      table: 'external_events',
      match: { id: rows.eventId },
      change: { title: 'Hacked' },
      forged: {
        user_id: a.id,
        subscription_id: rows.subscriptionId,
        uid: 'forged',
        title: 'Forged',
        ...forgedTime,
      },
    },
  ];
}

async function attackTable(b, { table, match, change, forged }) {
  // .select(column) after update/delete returns the rows that were really hit.
  const [column] = Object.keys(change);
  const seen = await b.client.from(table).select(column).match(match);
  check(`${table}: B cannot see A's row`, !seen.error && seen.data.length === 0, describe(seen));

  const updated = await b.client.from(table).update(change).match(match).select(column);
  check(`${table}: B cannot change A's row`, isBlocked(updated), describe(updated));

  const deleted = await b.client.from(table).delete().match(match).select(column);
  check(`${table}: B cannot delete A's row`, isBlocked(deleted), describe(deleted));

  const inserted = await b.client.from(table).insert(forged).select(column);
  check(
    `${table}: B cannot add a row owned by A`,
    inserted.error?.code === '42501',
    describe(inserted),
  );
}

/** After B's attacks, A must still see its row, unchanged. */
async function checkRowIntact(a, { table, match, change }) {
  const [column] = Object.keys(change);
  const own = await a.client.from(table).select(column).match(match);
  const intact = !own.error && own.data.length === 1 && own.data[0][column] !== change[column];
  check(`${table}: A's row is still there, unchanged`, intact, describe(own));
}

/**
 * B knows the id of A's row and points a new row of its OWN at it. A plain
 * foreign key would accept that; the composite (id, user_id) key must refuse.
 */
async function attackForeignKeys(b, rows) {
  const time = { starts_at: '2030-01-09T09:00:00Z', ends_at: '2030-01-09T10:00:00Z' };
  const cases = [
    { table: 'tasks', row: { type_id: rows.typeId } },
    { table: 'blocks', row: { task_id: rows.taskId, work_minutes: 60, ...time } },
    {
      table: 'recurring_events',
      row: {
        type_id: rows.typeId,
        title: 'Stolen',
        weekday: 3,
        start_time: '08:00',
        end_time: '09:00',
        valid_from: DAY,
      },
    },
    { table: 'habit_checks', row: { habit_id: rows.habitId, day: '2030-01-09' } },
    {
      table: 'calendar_subscriptions',
      row: { type_id: rows.typeId, name: 'Stolen', url: 'https://calendar.example.com/stolen.ics' },
    },
    {
      table: 'external_events',
      row: {
        user_id: b.id,
        subscription_id: rows.subscriptionId,
        uid: 'stolen',
        title: 'Stolen',
        ...time,
      },
    },
  ];
  for (const { table, row } of cases) {
    const result = await b.client.from(table).insert(row).select();
    check(
      `${table}: B cannot attach its row to A's data`,
      result.error?.code === '23503',
      describe(result),
    );
  }
}

async function attackFunctions(a, b, rows) {
  const replaced = await b.client.rpc('replace_external_events', {
    p_subscription_id: rows.subscriptionId,
    p_events: [],
  });
  check(
    "replace_external_events: B cannot replace A's events",
    Boolean(replaced.error),
    describe(replaced),
  );

  // B's call itself may succeed: what matters is that A's block survives it.
  const planned = await b.client.rpc('apply_plan', {
    p_remove_ids: [rows.blockId],
    p_new_blocks: [],
  });
  const block = await a.client.from('blocks').select('id').eq('id', rows.blockId);
  check(
    "apply_plan: B cannot remove A's block",
    block.data?.length === 1,
    `B's call: ${describe(planned)}; A's block: ${describe(block)}`,
  );

  const stats = await b.client.rpc('type_stats', {
    p_from: '2000-01-01T00:00:00Z',
    p_to: '2100-01-01T00:00:00Z',
  });
  const leaked = (stats.data ?? []).some((row) => row.type_id === rows.typeId);
  check("type_stats: B sees none of A's types", !stats.error && !leaked, describe(stats));
}

async function attackStorage(a, b, rows) {
  const bucket = (user) => user.client.storage.from('ai-uploads');
  const download = await bucket(b).download(rows.filePath);
  check("storage: B cannot download A's file", Boolean(download.error), 'the download succeeded');

  const listed = await bucket(b).list(a.id);
  check(
    "storage: B cannot list A's folder",
    !listed.error && listed.data.length === 0,
    describe(listed),
  );

  await bucket(b).remove([rows.filePath]);
  const stillThere = await bucket(a).download(rows.filePath);
  check(
    "storage: B cannot delete A's file",
    !stillThere.error,
    'A can no longer download its file',
  );

  const upload = await bucket(b).upload(`${a.id}/planted-${RUN_ID}.png`, PNG, {
    contentType: 'image/png',
  });
  check("storage: B cannot upload into A's folder", Boolean(upload.error), 'the upload succeeded');
}

// ---------------------------------------------------------------------------
// 6. An anonymous visitor (publishable key, not signed in)
// ---------------------------------------------------------------------------

async function checkAnonymous(tables) {
  const anon = createClient(url, publishableKey, NO_SESSION);
  const readable = [];
  for (const table of tables) {
    const { error } = await anon.from(table).select('*').limit(1);
    if (error?.code !== '42501') {
      readable.push(table);
    }
  }
  check('anon: no table can be read', readable.length === 0, `readable: ${readable.join(', ')}`);

  const { error } = await anon.rpc('rotate_calendar_feed');
  check(
    'anon: RPC functions cannot be called',
    error?.code === '42501',
    `rotate_calendar_feed: ${error?.message ?? 'succeeded'}`,
  );
}

// ---------------------------------------------------------------------------
// 7. Run
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Smoke test ${RUN_ID} against ${url}\n`);
  const users = [];
  try {
    const a = await createTestUser('A');
    users.push(a);
    const b = await createTestUser('B');
    users.push(b);

    const rowsOfA = await createRowsAs(a);
    console.log('A has a profile and one row in every other table, plus a file. Now B attacks.\n');

    const cases = tableCases(a, rowsOfA);
    for (const testCase of cases) {
      await attackTable(b, testCase);
    }
    for (const testCase of cases) {
      await checkRowIntact(a, testCase);
    }
    await attackForeignKeys(b, rowsOfA);
    await attackFunctions(a, b, rowsOfA);
    await attackStorage(a, b, rowsOfA);
    await checkAnonymous(cases.map((testCase) => testCase.table));
  } catch (error) {
    check('the smoke test ran to the end', false, error.message);
  } finally {
    console.log('');
    // Files are not rows: they do not go away with the user, so remove them
    // first (including one B might have planted if the upload check failed).
    const leftovers = users.flatMap((user) => [
      `${user.id}/smoke-${RUN_ID}.png`,
      `${user.id}/planted-${RUN_ID}.png`,
    ]);
    if (leftovers.length > 0) {
      await admin.storage.from('ai-uploads').remove(leftovers);
    }
    for (const user of users) {
      await deleteTestUser(user);
    }
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
