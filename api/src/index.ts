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

type GeneratePlanInput = AthleteProfileInput & {
  userId: string
}

type TrainingSession = {
  day: string
  title: string
  objective: string
  distanceKm?: number
  durationMin?: number
  zone: string
  warmup: string
  mainSet: string
  cooldown: string
  estimatedLoad: number
}

type TrainingWeek = {
  weekNumber: number
  focus: string
  targetDistanceKm: number
  sessions: TrainingSession[]
}

type TrainingPlan = {
  summary: string
  weeks: TrainingWeek[]
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
    version: '0.3.0',
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

app.post('/api/plan/generate', async (c) => {
  try {
    const body = (await c.req.json()) as GeneratePlanInput

    validateProfile(body)

    if (!body.userId?.trim()) {
      return c.json({ ok: false, error: 'userId es requerido' }, 400)
    }

    const existingUser = await c.env.DB
      .prepare(`select id from users where id = ?1 limit 1`)
      .bind(body.userId)
      .first()

    if (!existingUser) {
      return c.json({ ok: false, error: 'Usuario no encontrado' }, 404)
    }

    const plan = generateFallbackPlan(body)
    const planId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const startDate = new Date().toISOString().slice(0, 10)

    await c.env.DB
      .prepare(
        `insert into training_plans (
          id, user_id, version, status, start_date, end_date, plan_summary, generation_source, created_at
        ) values (?1, ?2, 1, 'active', ?3, ?4, ?5, ?6, ?7)`
      )
      .bind(
        planId,
        body.userId,
        startDate,
        addDaysIso(28),
        plan.summary,
        'fallback',
        createdAt
      )
      .run()

    for (const week of plan.weeks) {
      const weekId = crypto.randomUUID()

      await c.env.DB
        .prepare(
          `insert into training_weeks (
            id, training_plan_id, week_number, focus_label, total_target_distance, notes
          ) values (?1, ?2, ?3, ?4, ?5, ?6)`
        )
        .bind(
          weekId,
          planId,
          week.weekNumber,
          week.focus,
          week.targetDistanceKm,
          ''
        )
        .run()

      for (const session of week.sessions) {
        await c.env.DB
          .prepare(
            `insert into training_sessions (
              id, training_week_id, day_of_week, session_type, title, objective,
              distance_target, duration_target, intensity_zone, warmup_text,
              main_set_text, cooldown_text, estimated_load, status
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'planned')`
          )
          .bind(
            crypto.randomUUID(),
            weekId,
            session.day,
            normalizeSessionType(session.title),
            session.title,
            session.objective,
            session.distanceKm ?? null,
            session.durationMin ?? null,
            session.zone,
            session.warmup,
            session.mainSet,
            session.cooldown,
            session.estimatedLoad
          )
          .run()
      }
    }

    return c.json({
      ok: true,
      planId,
      plan,
      message: 'Plan generado correctamente',
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

app.get('/api/plan/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')

    const plan = await c.env.DB
      .prepare(
        `select id, plan_summary, start_date, end_date, created_at
         from training_plans
         where user_id = ?1 and status = 'active'
         order by created_at desc
         limit 1`
      )
      .bind(userId)
      .first()

    if (!plan) {
      return c.json({ ok: false, error: 'No active plan found' }, 404)
    }

    const weeks = await c.env.DB
      .prepare(
        `select id, week_number, focus_label, total_target_distance
         from training_weeks
         where training_plan_id = ?1
         order by week_number asc`
      )
      .bind(plan.id)
      .all()

    const hydratedWeeks = []

    for (const week of weeks.results ?? []) {
      const sessions = await c.env.DB
        .prepare(
          `select id, day_of_week, title, objective, distance_target, duration_target,
                  intensity_zone, warmup_text, main_set_text, cooldown_text, estimated_load, status
           from training_sessions
           where training_week_id = ?1
           order by rowid asc`
        )
        .bind(week.id)
        .all()

      hydratedWeeks.push({
        ...week,
        sessions: sessions.results ?? [],
      })
    }

    return c.json({
      ok: true,
      plan,
      weeks: hydratedWeeks,
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

function normalizeSessionType(title: string) {
  const t = title.toLowerCase()
  if (t.includes('tempo')) return 'tempo'
  if (t.includes('interval')) return 'intervals'
  if (t.includes('larga')) return 'long_run'
  if (t.includes('suave')) return 'easy'
  return 'general'
}

function generateFallbackPlan(profile: AthleteProfileInput): TrainingPlan {
  const weeklyTarget = Math.max(profile.currentVolumeKm + 6, 20)

  return {
    summary: `Plan inicial de ${profile.distance} para ${profile.name}, enfocado en ${profile.goal.toLowerCase()}.`,
    weeks: [1, 2, 3, 4].map((weekNumber) => ({
      weekNumber,
      focus:
        weekNumber < 3
          ? 'Construcción de base'
          : weekNumber === 3
            ? 'Carga controlada'
            : 'Consolidación',
      targetDistanceKm: weeklyTarget + (weekNumber - 1) * 3,
      sessions: buildSessions(profile, weekNumber),
    })),
  }
}

function buildSessions(profile: AthleteProfileInput, weekNumber: number): TrainingSession[] {
  const easyKm = Math.max(
    5,
    Math.round((profile.currentVolumeKm / Math.max(profile.daysPerWeek, 1)) * 0.8)
  )
  const tempoKm = easyKm + 2
  const longKm =
    profile.distance === '5K'
      ? 8
      : profile.distance === '10K'
        ? 12
        : profile.distance === '21K'
          ? 16 + weekNumber
          : 22 + weekNumber

  const sessions: TrainingSession[] = [
    {
      day: 'Lunes',
      title: 'Rodaje suave',
      objective: 'Construir base aeróbica y mantener continuidad.',
      distanceKm: easyKm,
      durationMin: 45,
      zone: 'Z2',
      warmup: '10 min trote suave',
      mainSet: `${easyKm - 2} km a ritmo conversacional`,
      cooldown: '5 min trote suave',
      estimatedLoad: 35,
    },
    {
      day: 'Miércoles',
      title: 'Tempo progresivo',
      objective: 'Mejorar ritmo controlado y tolerancia al esfuerzo.',
      distanceKm: tempoKm,
      durationMin: 60,
      zone: 'Z3-Z4',
      warmup: '15 min suaves + movilidad',
      mainSet: '3 bloques progresivos de 8 min con recuperación corta',
      cooldown: '10 min suaves',
      estimatedLoad: 62,
    },
    {
      day: 'Sábado',
      title: 'Tirada larga',
      objective: 'Desarrollar resistencia específica para el objetivo.',
      distanceKm: longKm,
      durationMin: 90,
      zone: 'Z2',
      warmup: '10 min suaves',
      mainSet: `${longKm - 2} km constantes`,
      cooldown: '5 min caminata + movilidad',
      estimatedLoad: 78,
    },
  ]

  if (profile.daysPerWeek >= 4) {
    sessions.splice(1, 0, {
      day: 'Martes',
      title: 'Fuerza y técnica',
      objective: 'Mejorar economía de carrera y prevenir lesiones.',
      durationMin: 35,
      zone: 'Complementario',
      warmup: 'Activación general',
      mainSet: 'Circuito de fuerza de pierna y core + drills',
      cooldown: 'Movilidad de cadera y tobillo',
      estimatedLoad: 28,
    })
  }

  if (profile.daysPerWeek >= 5) {
    sessions.push({
      day: 'Domingo',
      title: 'Recuperación activa',
      objective: 'Facilitar recuperación sin perder continuidad.',
      distanceKm: 4,
      durationMin: 30,
      zone: 'Z1-Z2',
      warmup: '5 min suaves',
      mainSet: 'Rodaje ligero o caminata rápida',
      cooldown: 'Movilidad ligera',
      estimatedLoad: 18,
    })
  }

  return sessions
}

function addDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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