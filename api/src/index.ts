import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

type AthleteProfileInput = {
  name: string
  email: string
  goal: string
  distance: '5K' | '10K' | '21K' | '42K'
  daysPerWeek: number
  level: 'Principiante' | 'Intermedio' | 'Avanzado'
  currentVolumeKm: number
  eventName?: string
  eventDate?: string
  notes?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  })
)

app.get('/', (c) => {
  return c.json({
    ok: true,
    service: 'trAIning API',
    version: '0.2.0',
  })
})

app.get('/health', async (c) => {
  const dbOk = await c.env.DB.prepare('select 1 as ok').first().catch(() => null)

  return c.json({
    ok: true,
    db: Boolean(dbOk),
  })
})

app.post('/api/setup', async (c) => {
  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await c.env.DB.prepare(statement).run()
  }

  return c.json({
    ok: true,
    message: 'Schema created',
  })
})

app.post('/api/onboarding', async (c) => {
  try {
    const body = (await c.req.json()) as AthleteProfileInput

    validateProfile(body)

    const existingUser = await c.env.DB
      .prepare(`select id from users where email = ?1 limit 1`)
      .bind(body.email.toLowerCase())
      .first()

    if (existingUser) {
      return c.json(
        {
          ok: false,
          error: 'Ese correo ya fue registrado anteriormente',
        },
        409
      )
    }

    const userId = crypto.randomUUID()
    const profileId = crypto.randomUUID()
    const goalId = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    await c.env.DB.batch([
      c.env.DB
        .prepare(
          `insert into users (id, email, name, created_at)
           values (?1, ?2, ?3, ?4)`
        )
        .bind(userId, body.email.toLowerCase(), body.name, createdAt),

      c.env.DB
        .prepare(
          `insert into athlete_profiles (
            id, user_id, experience_level, weekly_days_available,
            current_weekly_volume, preferred_goal_type, notes, created_at
          ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
        )
        .bind(
          profileId,
          userId,
          body.level,
          body.daysPerWeek,
          body.currentVolumeKm,
          body.goal,
          body.notes ?? '',
          createdAt
        ),

      c.env.DB
        .prepare(
          `insert into goals (
            id, user_id, goal_type, target_distance, target_event_name,
            target_event_date, status, created_at
          ) values (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7)`
        )
        .bind(
          goalId,
          userId,
          body.goal,
          body.distance,
          body.eventName ?? null,
          body.eventDate ?? null,
          createdAt
        ),
    ])

    return c.json({
      ok: true,
      userId,
      profileId,
      goalId,
      message: 'Onboarding saved',
    })
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
      },
      500
    )
  }
})

function validateProfile(input: AthleteProfileInput) {
  if (!input.name?.trim()) throw new Error('Name is required')
  if (!input.email?.trim()) throw new Error('Email is required')
  if (!input.goal?.trim()) throw new Error('Goal is required')
  if (!input.distance) throw new Error('Distance is required')
  if (!input.daysPerWeek || input.daysPerWeek < 1 || input.daysPerWeek > 7) {
    throw new Error('daysPerWeek must be between 1 and 7')
  }
  if (input.currentVolumeKm < 0) {
    throw new Error('currentVolumeKm must be >= 0')
  }
}

const schemaSql = `
create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null,
  created_at text not null,
  last_login_at text
);

create table if not exists athlete_profiles (
  id text primary key,
  user_id text not null,
  experience_level text not null,
  weekly_days_available integer not null,
  current_weekly_volume real not null,
  preferred_goal_type text not null,
  notes text,
  created_at text not null
);

create table if not exists goals (
  id text primary key,
  user_id text not null,
  goal_type text not null,
  target_distance text not null,
  target_event_name text,
  target_event_date text,
  status text not null,
  created_at text not null
);

create table if not exists subscriptions (
  id text primary key,
  user_id text not null,
  plan_code text not null,
  billing_cycle text not null,
  status text not null,
  started_at text not null,
  expires_at text
);

create table if not exists training_plans (
  id text primary key,
  user_id text not null,
  version integer not null,
  status text not null,
  start_date text,
  end_date text,
  plan_summary text,
  generation_source text,
  created_at text not null
);

create table if not exists training_weeks (
  id text primary key,
  training_plan_id text not null,
  week_number integer not null,
  focus_label text,
  total_target_distance real,
  notes text
);

create table if not exists training_sessions (
  id text primary key,
  training_week_id text not null,
  day_of_week text,
  session_type text,
  title text not null,
  objective text,
  distance_target real,
  duration_target integer,
  intensity_zone text,
  warmup_text text,
  main_set_text text,
  cooldown_text text,
  estimated_load integer,
  status text not null
);
`

export default {
  fetch: app.fetch,
}