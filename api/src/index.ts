import { Hono } from "hono";
import type { Context } from "hono";

type Bindings = {
  DB: D1Database;
  MP_WEBHOOK_SECRET: string;
  MP_ACCESS_TOKEN: string;
  CONEKTA_PRIVATE_KEY: string;
  CONEKTA_PUBLIC_KEY: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_SECRET: string;
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
  session_type: string;
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
};

type MercadoPagoPreapproval = {
  id?: string;
  status?: string;
  reason?: string;
  external_reference?: string | null;
  payer_email?: string | null;
  preapproval_plan_id?: string | null;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    start_date?: string;
    end_date?: string;
    currency_id?: string;
    transaction_amount?: number;
  } | null;
  date_created?: string;
  last_modified?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://trainingapp-mvp.pages.dev",
];

function applyCors(c: Context<{ Bindings: Bindings }>) {
  const origin = c.req.header("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[1];

  c.header("Access-Control-Allow-Origin", allowOrigin);
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, x-signature, x-request-id"
  );
  c.header("Access-Control-Max-Age", "86400");
}

app.use("*", async (c, next) => {
  applyCors(c);

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();
  applyCors(c);
});

function jsonError(
  c: Context<{ Bindings: Bindings }>,
  message: string,
  status = 400
) {
  return c.json({ ok: false, error: message }, status);
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
  if (
    !Number.isFinite(body.daysPerWeek) ||
    body.daysPerWeek < 1 ||
    body.daysPerWeek > 7
  ) {
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

function buildSessionsForWeek(
  input: AthleteProfileInput,
  weekNumber: number
): SessionSeed[] {
  const distance = normalizeDistance(input.distance);
  const baseVolume = Math.max(6, input.currentVolumeKm || 8);
  const growthFactor = weekNumber === 4 ? 0.82 : 1 + (weekNumber - 1) * 0.08;
  const weeklyVolume = roundToHalf(baseVolume * growthFactor);

  const easyRun = roundToHalf(Math.max(3, weeklyVolume * 0.28));
  const qualityRun = roundToHalf(Math.max(4, weeklyVolume * 0.22));
  const longRun = roundToHalf(
    Math.min(
      distance >= 21
        ? Math.max(8, weeklyVolume * 0.42)
        : Math.max(6, weeklyVolume * 0.36),
      distance >= 42 ? 28 : distance >= 21 ? 18 : distance >= 10 ? 12 : 10
    )
  );

  const recoveryRun = roundToHalf(
    Math.max(3, weeklyVolume - easyRun - qualityRun - longRun)
  );
  const sessions: SessionSeed[] = [];

  const easyDuration = Math.round(easyRun * 6.5);
  const qualityDuration = Math.round(qualityRun * 6);
  const longDuration = Math.round(longRun * 6.7);
  const recoveryDuration = Math.round(recoveryRun * 6.8);

  sessions.push({
    day_of_week: "Lunes",
    session_type: "easy_run",
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
  });

  sessions.push({
    day_of_week: "Miércoles",
    session_type: input.goal === "Mejorar tiempo" ? "quality" : "tempo",
    title:
      input.goal === "Mejorar tiempo" ? "Trabajo de calidad" : "Ritmo controlado",
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
  });

  sessions.push({
    day_of_week: "Viernes",
    session_type: "recovery",
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
  });

  sessions.push({
    day_of_week: "Domingo",
    session_type: "long_run",
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

  return [1, 2, 3, 4].map((weekNumber) => {
    const sessions = buildSessionsForWeek(input, weekNumber);
    const totalTargetDistance = roundToHalf(
      sessions.reduce((sum, s) => sum + Number(s.distance_target || 0), 0)
    );

    return {
      week_number: weekNumber,
      focus_label: weekLabels[weekNumber - 1] || "Bloque de entrenamiento",
      total_target_distance: totalTargetDistance,
      notes: null as string | null,
      sessions,
    };
  });
}

function timingSafeEqualHex(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractTsAndV1(signatureHeader: string) {
  const parts = signatureHeader.split(",");
  let ts = "";
  let v1 = "";

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (part.startsWith("ts=")) ts = part.slice(3);
    if (part.startsWith("v1=")) v1 = part.slice(3);
  }

  return { ts, v1 };
}

async function validateMercadoPagoSignature(
  secret: string,
  signatureHeader: string,
  requestId: string,
  rawBody: string
) {
  if (!secret || !signatureHeader || !requestId || !rawBody) {
    return false;
  }

  const { ts, v1 } = extractTsAndV1(signatureHeader);
  if (!ts || !v1) return false;

  const manifest = `id:${requestId};request-id:${requestId};ts:${ts};`;
  const payloadToSign = manifest + rawBody + secret;
  const calculated = await sha256Hex(payloadToSign);

  return timingSafeEqualHex(calculated, v1);
}

function inferPlanCodeFromEvent(
  externalId: string | null,
  eventType: string | null
) {
  if (!externalId) return null;
  if (eventType === "subscription_preapproval") return "pending_plan";
  if (eventType === "subscription_authorized_payment")
    return "authorized_payment";
  return "mercadopago_plan";
}

function inferMembershipStatus(
  signatureValid: boolean,
  eventType: string | null
) {
  if (!signatureValid) return "webhook_unverified";
  if (eventType === "subscription_preapproval") return "pending_activation";
  if (eventType === "subscription_authorized_payment") return "active";
  return "received";
}

async function fetchMercadoPagoPreapproval(
  accessToken: string,
  preapprovalId: string
): Promise<MercadoPagoPreapproval | null> {
  if (!accessToken || !preapprovalId) return null;

  const response = await fetch(
    `https://api.mercadopago.com/preapproval/${preapprovalId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MercadoPagoPreapproval;
}

app.get("/", (c) => {
  return c.json({ ok: true, service: "trainingapp-api" });
});

app.get("/api/health", (c) => {
  return c.json({ ok: true, status: "healthy" });
});

app.get("/api/conekta/config", (c) => {
  return c.json({
    ok: true,
    publicKey: c.env.CONEKTA_PUBLIC_KEY || "",
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
        { ok: false, error: "Ese correo ya fue registrado anteriormente" },
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
        error:
          error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
});

app.post("/api/user/find", async (c) => {
  try {
    const body = (await c.req.json()) as { email?: string };
    const email = normalizeEmail(body.email || "");

    if (!email) return jsonError(c, "El correo es obligatorio");

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

    return c.json({ ok: true, user });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
});

app.post("/api/membership/status", async (c) => {
  try {
    const body = (await c.req.json()) as { email?: string };
    const email = normalizeEmail(body.email || "");

    if (!email) return jsonError(c, "El correo es obligatorio");

    const user = await c.env.DB
      .prepare(
        `select id, email, name
         from users
         where email = ?1
         limit 1`
      )
      .bind(email)
      .first();

    if (!user) {
      return c.json({
        ok: true,
        foundUser: false,
        membership: null,
      });
    }

    const membership = await c.env.DB
      .prepare(
        `select
           id, user_id, provider, provider_subscription_id, plan_code,
           status, payer_email, external_reference, started_at,
           current_period_end, last_event_at, created_at, updated_at
         from memberships
         where user_id = ?1
         order by updated_at desc
         limit 1`
      )
      .bind(user.id)
      .first();

    return c.json({
      ok: true,
      foundUser: true,
      user,
      membership: membership || null,
      accessGranted: membership?.status === "active",
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Internal Server Error",
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
    const eventDate = body.eventDate?.trim() || null;
    const startDate = createdAt.slice(0, 10);

    const batchStatements = [
      c.env.DB
        .prepare(
          `insert into training_plans (
            id, user_id, version, status, start_date, end_date, plan_summary, generation_source, created_at
          ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
        )
        .bind(
          planId,
          body.userId,
          1,
          "active",
          startDate,
          eventDate,
          `Plan ${body.distance.trim()} - ${body.goal.trim()}`,
          "trainingapp-api",
          createdAt
        ),
    ];

    for (const week of weeks) {
      const weekId = crypto.randomUUID();

      batchStatements.push(
        c.env.DB
          .prepare(
            `insert into training_weeks (
              id, training_plan_id, week_number, focus_label, total_target_distance, notes
            ) values (?1, ?2, ?3, ?4, ?5, ?6)`
          )
          .bind(
            weekId,
            planId,
            week.week_number,
            week.focus_label,
            week.total_target_distance,
            week.notes
          )
      );

      for (const session of week.sessions) {
        const sessionId = crypto.randomUUID();

        batchStatements.push(
          c.env.DB
            .prepare(
              `insert into training_sessions (
                id, training_week_id, day_of_week, session_type, title, objective,
                distance_target, duration_target, intensity_zone,
                warmup_text, main_set_text, cooldown_text,
                estimated_load, status
              ) values (
                ?1, ?2, ?3, ?4, ?5, ?6,
                ?7, ?8, ?9,
                ?10, ?11, ?12,
                ?13, ?14
              )`
            )
            .bind(
              sessionId,
              weekId,
              session.day_of_week,
              session.session_type,
              session.title,
              session.objective,
              session.distance_target,
              session.duration_target,
              session.intensity_zone,
              session.warmup_text,
              session.main_set_text,
              session.cooldown_text,
              session.estimated_load,
              session.status
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
        error:
          error instanceof Error ? error.message : "Internal Server Error",
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
        `select
           id, user_id, version, status, start_date, end_date, plan_summary, generation_source, created_at
         from training_plans
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
        `select id, week_number, focus_label, total_target_distance, notes
         from training_weeks
         where training_plan_id = ?1
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
             id, day_of_week, session_type, title, objective,
             distance_target, duration_target, intensity_zone,
             warmup_text, main_set_text, cooldown_text,
             estimated_load, status
           from training_sessions
           where training_week_id = ?1
           order by rowid asc`
        )
        .bind(week.id)
        .all();

      weeks.push({
        id: week.id,
        week_number: week.week_number,
        focus_label: week.focus_label,
        total_target_distance: week.total_target_distance,
        notes: week.notes,
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
        error:
          error instanceof Error ? error.message : "Internal Server Error",
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
    const webhookSecret = c.env.MP_WEBHOOK_SECRET || "";
    const accessToken = c.env.MP_ACCESS_TOKEN || "";

    let parsedBody: { type?: string; data?: { id?: string } } = {};

    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = {};
    }

    const signatureValid = await validateMercadoPagoSignature(
      webhookSecret,
      xSignature,
      xRequestId,
      rawBody
    );

    const eventId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const eventType = parsedBody.type || null;
    const externalId = parsedBody.data?.id || null;

    await c.env.DB
      .prepare(
        `insert into webhook_events (
          id, provider, event_type, external_id, request_id,
          signature_present, payload, created_at
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(
        eventId,
        "mercadopago",
        eventType,
        externalId,
        xRequestId || null,
        xSignature ? 1 : 0,
        rawBody,
        createdAt
      )
      .run();

    let mpSubscription: MercadoPagoPreapproval | null = null;
    if (externalId && accessToken) {
      mpSubscription = await fetchMercadoPagoPreapproval(
        accessToken,
        externalId
      );
    }

    const payerEmail = normalizeEmail(mpSubscription?.payer_email || "");
    const externalReference = mpSubscription?.external_reference || null;
    const planCode =
      mpSubscription?.preapproval_plan_id ||
      inferPlanCodeFromEvent(externalId, eventType);
    const membershipStatus = signatureValid
      ? mpSubscription?.status ||
        inferMembershipStatus(signatureValid, eventType)
      : inferMembershipStatus(signatureValid, eventType);

    let linkedUserId: string | null = null;

    if (payerEmail) {
      const matchedUser = await c.env.DB
        .prepare(`select id from users where email = ?1 limit 1`)
        .bind(payerEmail)
        .first<{ id: string }>();

      if (matchedUser?.id) {
        linkedUserId = matchedUser.id;
      }
    }

    if (!linkedUserId && externalReference) {
      const matchedUserByReference = await c.env.DB
        .prepare(`select id from users where id = ?1 limit 1`)
        .bind(externalReference)
        .first<{ id: string }>();

      if (matchedUserByReference?.id) {
        linkedUserId = matchedUserByReference.id;
      }
    }

    if (externalId) {
      const existingMembership = await c.env.DB
        .prepare(
          `select id
           from memberships
           where provider = ?1 and provider_subscription_id = ?2
           limit 1`
        )
        .bind("mercadopago", externalId)
        .first<{ id: string }>();

      if (existingMembership?.id) {
        await c.env.DB
          .prepare(
            `update memberships
             set user_id = coalesce(?1, user_id),
                 plan_code = ?2,
                 status = ?3,
                 payer_email = coalesce(?4, payer_email),
                 external_reference = coalesce(?5, external_reference),
                 started_at = coalesce(?6, started_at),
                 current_period_end = ?7,
                 last_event_at = ?8,
                 updated_at = ?9
             where id = ?10`
          )
          .bind(
            linkedUserId,
            planCode,
            membershipStatus,
            payerEmail || null,
            externalReference,
            mpSubscription?.date_created || null,
            mpSubscription?.auto_recurring?.end_date || null,
            createdAt,
            createdAt,
            existingMembership.id
          )
          .run();
      } else {
        await c.env.DB
          .prepare(
            `insert into memberships (
              id, user_id, provider, provider_subscription_id, plan_code, status,
              payer_email, external_reference, started_at, current_period_end,
              last_event_at, created_at, updated_at
            ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
          )
          .bind(
            crypto.randomUUID(),
            linkedUserId,
            "mercadopago",
            externalId,
            planCode,
            membershipStatus,
            payerEmail || null,
            externalReference,
            mpSubscription?.date_created || null,
            mpSubscription?.auto_recurring?.end_date || null,
            createdAt,
            createdAt,
            createdAt
          )
          .run();
      }
    }

    return c.json({
      ok: true,
      received: true,
      stored: true,
      hasSignature: Boolean(xSignature),
      hasRequestId: Boolean(xRequestId),
      hasSecret: Boolean(webhookSecret),
      hasAccessToken: Boolean(accessToken),
      hasConektaPrivateKey: Boolean(c.env.CONEKTA_PRIVATE_KEY),
      hasConektaPublicKey: Boolean(c.env.CONEKTA_PUBLIC_KEY),
      hasPaypalClientId: Boolean(c.env.PAYPAL_CLIENT_ID),
      hasPaypalSecret: Boolean(c.env.PAYPAL_SECRET),
      signatureValid,
      eventId,
      eventType,
      externalId,
      linkedUserId,
      payerEmail: payerEmail || null,
      externalReference,
      mercadoPagoStatus: mpSubscription?.status || null,
      mercadoPagoPlanId: mpSubscription?.preapproval_plan_id || null,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Internal Server Error",
      },
      500
    );
  }
});

export default app;