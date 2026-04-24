import { Hono } from "hono";
import type { Context } from "hono";

type Bindings = {
  DB: D1Database;
  MP_WEBHOOK_SECRET: string;
};

type AthleteProfileInput = {
  name: string;
  email: string;
  goal: string;
  distance: string;
  daysPerWeek: number;
  level: string;
  currentVolumeKm: number;
  eventName?: string;
  eventDate?: string;
  notes?: string;
};

type SessionSeed = {
  day_of_week: string;
  title: string;
  objective: string;
  distance_target: number | null;
  duration_target: number | null;
  intensity_zone: string;
  warmup_text: string;
  main_set_text: string;
  cooldown_text: string;
  estimated_load: number;
  status: string;
  sort_order: number;
};

const app = new Hono<{ Bindings: Bindings }>();

function jsonError(c: Context<{ Bindings: Bindings }>, message: string, status = 400) {
  return c.json(
    {
      ok: false,
      error: message,
    },
    status
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeDistance(distance: string) {
  const value = distance.trim().toUpperCase();
  if (value === "5K") return 5;
  if (value === "10K") return 10;
  if (value === "21K") return 21;
  if (value === "42K") return 42;
  return 10;
}

function validateProfile(body: AthleteProfileInput) {
  if (!body.name?.trim()) throw new Error("El nombre es obligatorio");
  if (!body.email?.trim()) throw new Error("El correo es obligatorio");
  if (!body.email.includes("@")) throw new Error("El correo no es válido");
  if (!body.goal?.trim()) throw new Error("El objetivo es obligatorio");
  if (!body.distance?.trim()) throw new Error("La distancia es obligatoria");
  if (!Number.isFinite(body.daysPerWeek) || body.daysPerWeek < 1 || body.daysPerWeek > 7) {
    throw new Error("Los días por semana deben estar entre 1 y 7");
  }
  if (!body.level?.trim()) throw new Error("El nivel es obligatorio");
  if (!Number.isFinite(body.currentVolumeKm) || body.currentVolumeKm < 0) {
    throw new Error("El volumen actual debe ser 0 o mayor");
  }
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function buildSessionsForWeek(input: AthleteProfileInput, weekNumber: number): SessionSeed[] {
  const distance = normalizeDistance(input.distance);
  const baseVolume = Math.max(6, input.currentVolumeKm || 8);
  const growthFactor = weekNumber === 4 ? 0.82 : 1 + (weekNumber - 1) * 0.08;
  const weeklyVolume = roundToHalf(baseVolume * growthFactor);

  const easyRun = roundToHalf(Math.max(3, weeklyVolume * 0.28));
  const qualityRun = roundToHalf(Math.max(4, weeklyVolume * 0.22));
  const longRun = roundToHalf(
    Math.min(
      distance >= 21 ? Math.max(8, weeklyVolume * 0.42) : Math.max(6, weeklyVolume * 0.36),
      distance >= 42 ? 28 : distance >= 21 ? 18 : distance >= 10 ? 12 : 10
    )
  );

  const recoveryRun = roundToHalf(Math.max(3, weeklyVolume - easyRun - qualityRun - longRun));
  const sessions: SessionSeed[] = [];

  const easyDuration = Math.round(easyRun * 6.5);
  const qualityDuration = Math.round(qualityRun * 6);
  const longDuration = Math.round(longRun * 6.7);
  const recoveryDuration = Math.round(recoveryRun * 6.8);

  sessions.push({
    day_of_week: "Lunes",
    title: "Rodaje suave",
    objective: "Construir base aeróbica y mantener constancia sin fatiga excesiva.",
    distance_target: easyRun,
    duration_target: easyDuration,
    intensity_zone: "Z2",
    warmup_text: "10 min trote suave + movilidad articular",
    main_set_text: `Rodaje continuo a ritmo cómodo por ${easyRun} km`,
    cooldown_text: "5 min trote muy suave + estiramientos ligeros",
    estimated_load: Math.round(easyDuration * 0.9),
    status: "planned",
    sort_order: 1,
  });

  sessions.push({
    day_of_week: "Miércoles",
    title: input.goal === "Mejorar tiempo" ? "Trabajo de calidad" : "Ritmo controlado",
    objective:
      input.goal === "Mejorar tiempo"
        ? "Desarrollar velocidad controlada y tolerancia al esfuerzo."
        : "Mejorar economía de carrera y control del ritmo.",
    distance_target: qualityRun,
    duration_target: qualityDuration,
    intensity_zone: input.goal === "Mejorar tiempo" ? "Z3-Z4" : "Z3",
    warmup_text: "12 min trote + movilidad + 4 progresiones",
    main_set_text:
      input.goal === "Mejorar tiempo"
        ? `Bloque principal dentro de ${qualityRun} km con repeticiones controladas`
        : `Rodaje sostenido dentro de ${qualityRun} km a ritmo controlado`,
    cooldown_text: "8 min trote suave",
    estimated_load: Math.round(qualityDuration * 1.15),
    status: "planned",
    sort_order: 2,
  });

  sessions.push({
    day_of_week: "Viernes",
    title: "Rodaje de recuperación",
    objective: "Promover recuperación activa sin perder volumen semanal.",
    distance_target: recoveryRun,
    duration_target: recoveryDuration,
    intensity_zone: "Z1-Z2",
    warmup_text: "8 min trote suave",
    main_set_text: `Rodaje regenerativo por ${recoveryRun} km`,
    cooldown_text: "Movilidad ligera y respiración",
    estimated_load: Math.round(recoveryDuration * 0.75),
    status: "planned",
    sort_order: 3,
  });

  sessions.push({
    day_of_week: "Domingo",
    title: "Tirada larga",
    objective:
      distance >= 21
        ? "Extender resistencia específica para la distancia objetivo."
        : "Fortalecer resistencia general y confianza en la distancia.",
    distance_target: longRun,
    duration_target: longDuration,
    intensity_zone: "Z2",
    warmup_text: "12 min trote muy suave",
    main_set_text: `Tirada larga progresiva por ${longRun} km`,
    cooldown_text: "Caminata ligera + estiramientos suaves",
    estimated_load: Math.round(longDuration * 1.2),
    status: "planned",
    sort_order: 4,
  });

  return sessions;
}

function buildPlanStructure(input: AthleteProfileInput) {
  const weekLabels = [
    "Base y adaptación",
    "Construcción",
    "Consolidación",
    "Ajuste y descarga",
  ];

  const weeks = [1, 2, 3, 4].map((weekNumber) => {
    const sessions = buildSessionsForWeek(input, weekNumber);
    const totalTargetDistance = roundToHalf(
      sessions.reduce((sum, s) => sum + Number(s.distance_target || 0), 0)
    );

    return {
      week_number: weekNumber,
      focus_label: weekLabels[weekNumber - 1] || "Bloque de entrenamiento",
      total_target_distance: totalTargetDistance,
      sessions,
    };
  });

  return weeks;
}

app.get("/", (c) => {
  return c.json({
    ok: true,
    service: "trainingapp-api",
  });
});

app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    status: "healthy",
  });
});

app.post("/api/onboarding", async (c) => {
  try {
    const body = (await c.req.json()) as AthleteProfileInput;

    validateProfile(body);

    const existingUser = await c.env.DB
      .prepare(`select id from users where email = ?1 limit 1`)
      .bind(normalizeEmail(body.email))
      .first();

    if (existingUser) {
      return c.json(
        {
          ok: false,
          error: "Ese correo ya fue registrado anteriormente",
        },
        409
      );
    }

    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const goalId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await c.env.DB.batch([
      c.env.DB
        .prepare(
          `insert into users (id, email, name, created_at)
           values (?1, ?2, ?3, ?4)`
        )
        .bind(userId, normalizeEmail(body.email), body.name.trim(), createdAt),

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
          body.level.trim(),
          body.daysPerWeek,
          body.currentVolumeKm,
          body.goal.trim(),
          body.notes?.trim() || "",
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
          body.goal.trim(),
          body.distance.trim(),
          body.eventName?.trim() || null,
          body.eventDate?.trim() || null,
          createdAt
        ),
    ]);

    return c.json({
      ok: true,
      userId,
      profileId,
      goalId,
      message: "Onboarding saved",
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
});

app.post("/api/user/find", async (c) => {
  try {
    const body = (await c.req.json()) as { email?: string };
    const email = normalizeEmail(body.email || "");

    if (!email) {
      return jsonError(c, "El correo es obligatorio");
    }

    const user = await c.env.DB
      .prepare(
        `select id, email, name, created_at
         from users
         where email = ?1
         limit 1`
      )
      .bind(email)
      .first();

    if (!user) {
      return jsonError(c, "No se encontró un usuario con ese correo", 404);
    }

    return c.json({
      ok: true,
      user,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
});

app.post("/api/plan/generate", async (c) => {
  try {
    const body = (await c.req.json()) as AthleteProfileInput & { userId?: string };

    if (!body.userId?.trim()) {
      return jsonError(c, "El userId es obligatorio");
    }

    validateProfile(body);

    const user = await c.env.DB
      .prepare(`select id from users where id = ?1 limit 1`)
      .bind(body.userId)
      .first();

    if (!user) {
      return jsonError(c, "Usuario no encontrado", 404);
    }

    const planId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const weeks = buildPlanStructure(body);

    const batchStatements = [
      c.env.DB
        .prepare(
          `insert into plans (id, user_id, name, status, created_at)
           values (?1, ?2, ?3, 'active', ?4)`
        )
        .bind(planId, body.userId, `Plan ${body.distance.trim()} - ${body.goal.trim()}`, createdAt),
    ];

    for (const week of weeks) {
      const weekId = crypto.randomUUID();

      batchStatements.push(
        c.env.DB
          .prepare(
            `insert into plan_weeks (
              id, plan_id, week_number, focus_label, total_target_distance, created_at
            ) values (?1, ?2, ?3, ?4, ?5, ?6)`
          )
          .bind(
            weekId,
            planId,
            week.week_number,
            week.focus_label,
            week.total_target_distance,
            createdAt
          )
      );

      for (const session of week.sessions) {
        const sessionId = crypto.randomUUID();

        batchStatements.push(
          c.env.DB
            .prepare(
              `insert into plan_sessions (
                id, week_id, day_of_week, title, objective,
                distance_target, duration_target, intensity_zone,
                warmup_text, main_set_text, cooldown_text,
                estimated_load, status, sort_order, created_at
              ) values (
                ?1, ?2, ?3, ?4, ?5,
                ?6, ?7, ?8,
                ?9, ?10, ?11,
                ?12, ?13, ?14, ?15
              )`
            )
            .bind(
              sessionId,
              weekId,
              session.day_of_week,
              session.title,
              session.objective,
              session.distance_target,
              session.duration_target,
              session.intensity_zone,
              session.warmup_text,
              session.main_set_text,
              session.cooldown_text,
              session.estimated_load,
              session.status,
              session.sort_order,
              createdAt
            )
        );
      }
    }

    await c.env.DB.batch(batchStatements);

    return c.json({
      ok: true,
      planId,
      weeksCreated: weeks.length,
      message: "Plan generado correctamente",
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
});

app.get("/api/plan/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");

    const plan = await c.env.DB
      .prepare(
        `select id, user_id, name, status, created_at
         from plans
         where user_id = ?1
         order by created_at desc
         limit 1`
      )
      .bind(userId)
      .first();

    if (!plan) {
      return jsonError(c, "No se encontró un plan para ese usuario", 404);
    }

    const weekRows = await c.env.DB
      .prepare(
        `select id, week_number, focus_label, total_target_distance
         from plan_weeks
         where plan_id = ?1
         order by week_number asc`
      )
      .bind(plan.id)
      .all();

    const weeks = [];
    const rows = weekRows.results || [];

    for (const week of rows) {
      const sessionRows = await c.env.DB
        .prepare(
          `select
             id, day_of_week, title, objective,
             distance_target, duration_target, intensity_zone,
             warmup_text, main_set_text, cooldown_text,
             estimated_load, status, sort_order
           from plan_sessions
           where week_id = ?1
           order by sort_order asc, created_at asc`
        )
        .bind(week.id)
        .all();

      weeks.push({
        id: week.id,
        week_number: week.week_number,
        focus_label: week.focus_label,
        total_target_distance: week.total_target_distance,
        sessions: sessionRows.results || [],
      });
    }

    return c.json({
      ok: true,
      plan,
      weeks,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
});

app.post("/api/mercadopago/webhook", async (c) => {
  try {
    const rawBody = await c.req.text();
    const xSignature = c.req.header("x-signature") || "";
    const xRequestId = c.req.header("x-request-id") || "";
    const secret = c.env.MP_WEBHOOK_SECRET || "";

    return c.json({
      ok: true,
      received: true,
      hasSignature: Boolean(xSignature),
      hasRequestId: Boolean(xRequestId),
      hasSecret: Boolean(secret),
      bodyLength: rawBody.length,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Webhook processing error",
      },
      500
    );
  }
});

export default app;