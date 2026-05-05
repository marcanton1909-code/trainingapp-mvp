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
  SESSION_SECRET: string;
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  STRAVA_REDIRECT_URI: string;
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

type PayPalAccessTokenResponse = {
  access_token: string;
  token_type: string;
  app_id?: string;
  expires_in?: number;
  nonce?: string;
};

type PayPalProductResponse = {
  id: string;
  name?: string;
  description?: string;
  type?: string;
  category?: string;
};

type PayPalPlanResponse = {
  id: string;
  product_id?: string;
  name?: string;
  status?: string;
};

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource_type?: string;
  summary?: string;
  create_time?: string;
  resource?: {
    id?: string;
    plan_id?: string;
    status?: string;
    custom_id?: string;
    start_time?: string;
    subscriber?: {
      email_address?: string;
      payer_id?: string;
      name?: {
        given_name?: string;
        surname?: string;
      };
    };
    billing_info?: {
      next_billing_time?: string;
      last_payment?: {
        amount?: {
          currency_code?: string;
          value?: string;
        };
        time?: string;
      };
      failed_payments_count?: number;
    };
  };
};

type PayPalSubscriptionDetail = {
  id?: string;
  plan_id?: string;
  status?: string;
  custom_id?: string;
  start_time?: string;
  subscriber?: {
    email_address?: string;
    payer_id?: string;
    name?: {
      given_name?: string;
      surname?: string;
    };
  };
  billing_info?: {
    next_billing_time?: string;
    failed_payments_count?: number;
    last_payment?: {
      amount?: {
        currency_code?: string;
        value?: string;
      };
      time?: string;
    };
  };
};

type AuthRegisterInput = {
  name?: string;
  email?: string;
  password?: string;
};

type AuthLoginInput = {
  email?: string;
  password?: string;
};

type EntitlementsRow = {
  id?: string;
  user_id?: string;
  has_active_membership?: number;
  can_generate_base_plan?: number;
  can_connect_strava?: number;
  can_use_strava_metrics?: number;
  can_generate_advanced_plan?: number;
  can_regenerate_with_history?: number;
  can_use_premium_planning?: number;
  source_plan_code?: string | null;
  updated_at?: string;
};

type StravaTokenResponse = {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: {
    id: number;
    username?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  };
};

type StravaConnectionRow = {
  id: string;
  user_id: string;
  strava_athlete_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: number;
  scope?: string | null;
  status: string;
};

type StravaActivity = {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date?: string;
  start_date_local?: string;
  timezone?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  suffer_score?: number;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  visibility?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://trainingapp-mvp.pages.dev",
  "https://app.trainingapp.run",
];

const APP_URL = "https://app.trainingapp.run";
const PAYPAL_BASE_URL = "https://api-m.paypal.com";
const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

function applyCors(c: Context<{ Bindings: Bindings }>) {
  const origin = c.req.header("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[1];

  c.header("Access-Control-Allow-Origin", allowOrigin);
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-signature, x-request-id"
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
  return c.json({ ok: false, error: message }, status as any);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeDistance(distance: string) {
  const value = distance.trim().toUpperCase().replace(/\s/g, "");
  if (value === "5K") return 5;
  if (value === "10K") return 10;
  if (value === "15K") return 15;
  if (value === "21K" || value === "21.1K" || value === "HALF") return 21;
  if (value === "42K" || value === "42.2K" || value === "MARATHON") return 42;
  return 10;
}

function distanceLabel(distanceKm: number) {
  if (distanceKm === 5) return "5K";
  if (distanceKm === 10) return "10K";
  if (distanceKm === 15) return "15K";
  if (distanceKm === 21) return "21K";
  if (distanceKm === 42) return "42K";
  return `${distanceKm}K`;
}

function getAllowedDistancesByPlan(planCode: string | null) {
  if (planCode === "starter") return [5, 10, 15];
  if (planCode === "performance") return [5, 10, 15, 21, 42];
  if (planCode === "pro_coach") return [5, 10, 15, 21, 42];
  return [];
}

function getDefaultWeeksByDistance(distanceKm: number) {
  if (distanceKm <= 5) return 8;
  if (distanceKm <= 10) return 10;
  if (distanceKm <= 15) return 12;
  if (distanceKm <= 21) return 14;
  return 18;
}

function weeksUntilEvent(eventDate?: string) {
  if (!eventDate) return null;
  const target = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const diffMs = target.getTime() - today.getTime();
  const weeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));
  if (weeks < 4) return 4;
  if (weeks > 24) return 24;
  return weeks;
}

function determinePlanWeeks(distanceKm: number, eventDate?: string) {
  const defaultWeeks = getDefaultWeeksByDistance(distanceKm);
  const eventWeeks = weeksUntilEvent(eventDate);
  if (!eventWeeks) return defaultWeeks;
  return Math.max(4, Math.min(defaultWeeks, eventWeeks));
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getWeekPhase(weekNumber: number, totalWeeks: number) {
  if (weekNumber === totalWeeks) return "Semana de ajuste";
  const ratio = weekNumber / totalWeeks;
  if (ratio <= 0.25) return "Base";
  if (ratio <= 0.65) return "Construcción";
  if (ratio <= 0.85) return "Específica";
  return "Descarga";
}

function getLevelMultiplier(level: string) {
  const clean = level.toLowerCase();
  if (clean.includes("principiante")) return 0.9;
  if (clean.includes("avanzado")) return 1.12;
  return 1;
}

function estimateMinutes(distanceKm: number, sessionType: string) {
  const pace =
    sessionType === "quality"
      ? 5.8
      : sessionType === "tempo"
      ? 6.1
      : sessionType === "long_run"
      ? 6.8
      : 6.6;

  return Math.round(distanceKm * pace);
}

function buildSessionsForWeek(
  input: AthleteProfileInput,
  weekNumber: number,
  totalWeeks: number
): SessionSeed[] {
  const distance = normalizeDistance(input.distance);
  const days = clamp(Number(input.daysPerWeek || 4), 3, 6);
  const currentVolume = Math.max(5, Number(input.currentVolumeKm || 8));
  const levelMultiplier = getLevelMultiplier(input.level);
  const phase = getWeekPhase(weekNumber, totalWeeks);

  let progression = 1 + (weekNumber - 1) * 0.07;

  if (phase === "Descarga") progression *= 0.86;
  if (phase === "Semana de ajuste") progression *= 0.65;
  if (weekNumber % 4 === 0 && phase !== "Semana de ajuste") progression *= 0.88;

  const maxWeeklyByDistance =
    distance <= 5
      ? 28
      : distance <= 10
      ? 40
      : distance <= 15
      ? 52
      : distance <= 21
      ? 68
      : 86;

  const weeklyVolume = roundToHalf(
    clamp(currentVolume * progression * levelMultiplier, 8, maxWeeklyByDistance)
  );

  const longRunMax =
    distance <= 5
      ? 8
      : distance <= 10
      ? 13
      : distance <= 15
      ? 18
      : distance <= 21
      ? 24
      : 34;

  const longRunRatio =
    phase === "Semana de ajuste" ? 0.28 : distance >= 21 ? 0.34 : 0.31;

  const longRun = roundToHalf(clamp(weeklyVolume * longRunRatio, 5, longRunMax));
  const qualityRun = roundToHalf(clamp(weeklyVolume * 0.2, 3.5, 14));
  const tempoRun = roundToHalf(clamp(weeklyVolume * 0.18, 3.5, 12));
  const easyRun = roundToHalf(clamp(weeklyVolume * 0.22, 3, 14));
  const recoveryRun = roundToHalf(
    clamp(weeklyVolume - longRun - qualityRun - tempoRun - easyRun, 3, 12)
  );

  const sessions: SessionSeed[] = [];

  sessions.push({
    day_of_week: "Lunes",
    session_type: "easy_run",
    title: "Rodaje suave",
    objective: "Construir base aeróbica y mantener constancia sin fatiga excesiva.",
    distance_target: easyRun,
    duration_target: estimateMinutes(easyRun, "easy_run"),
    intensity_zone: "Z2",
    warmup_text: "10 min trote suave + movilidad articular",
    main_set_text: `Rodaje continuo a ritmo cómodo por ${easyRun} km`,
    cooldown_text: "5 min trote muy suave + estiramientos ligeros",
    estimated_load: Math.round(estimateMinutes(easyRun, "easy_run") * 0.9),
    status: "planned",
  });

  if (days >= 4) {
    sessions.push({
      day_of_week: "Miércoles",
      session_type: input.goal === "Mejorar tiempo" ? "quality" : "tempo",
      title:
        input.goal === "Mejorar tiempo"
          ? "Trabajo de calidad"
          : "Ritmo controlado",
      objective:
        input.goal === "Mejorar tiempo"
          ? "Mejorar velocidad controlada y tolerancia al esfuerzo."
          : "Mejorar economía de carrera y control del ritmo.",
      distance_target: input.goal === "Mejorar tiempo" ? qualityRun : tempoRun,
      duration_target: estimateMinutes(
        input.goal === "Mejorar tiempo" ? qualityRun : tempoRun,
        input.goal === "Mejorar tiempo" ? "quality" : "tempo"
      ),
      intensity_zone: input.goal === "Mejorar tiempo" ? "Z3-Z4" : "Z3",
      warmup_text: "12 min trote + movilidad + 4 progresiones",
      main_set_text:
        input.goal === "Mejorar tiempo"
          ? `Bloque principal dentro de ${qualityRun} km con repeticiones controladas`
          : `Rodaje sostenido dentro de ${tempoRun} km a ritmo controlado`,
      cooldown_text: "8 min trote suave",
      estimated_load: Math.round(
        estimateMinutes(
          input.goal === "Mejorar tiempo" ? qualityRun : tempoRun,
          "quality"
        ) * 1.15
      ),
      status: "planned",
    });
  }

  if (days >= 5) {
    sessions.push({
      day_of_week: "Jueves",
      session_type: "strength_mobility",
      title: "Fuerza y movilidad",
      objective:
        "Mejorar estabilidad, core y movilidad general para soportar la carga de carrera.",
      distance_target: null,
      duration_target: 30,
      intensity_zone: "Complementario",
      warmup_text: "5 min movilidad general",
      main_set_text:
        "Core, glúteo medio, estabilidad de tobillo, sentadilla controlada y trabajo de pantorrilla",
      cooldown_text: "Movilidad de cadera, flexores y respiración",
      estimated_load: 24,
      status: "planned",
    });
  }

  sessions.push({
    day_of_week: "Viernes",
    session_type: "recovery",
    title: "Rodaje de recuperación",
    objective: "Promover recuperación activa sin perder volumen semanal.",
    distance_target: recoveryRun,
    duration_target: estimateMinutes(recoveryRun, "recovery"),
    intensity_zone: "Z1-Z2",
    warmup_text: "8 min trote suave",
    main_set_text: `Rodaje regenerativo por ${recoveryRun} km`,
    cooldown_text: "Movilidad ligera y respiración",
    estimated_load: Math.round(estimateMinutes(recoveryRun, "recovery") * 0.75),
    status: "planned",
  });

  if (days >= 6) {
    const optionalRun = roundToHalf(clamp(weeklyVolume * 0.12, 3, 10));
    sessions.push({
      day_of_week: "Sábado",
      session_type: "easy_run",
      title: "Rodaje opcional",
      objective: "Sumar volumen ligero sin afectar la tirada larga.",
      distance_target: optionalRun,
      duration_target: estimateMinutes(optionalRun, "easy_run"),
      intensity_zone: "Z2",
      warmup_text: "8 min trote suave",
      main_set_text: `Rodaje cómodo por ${optionalRun} km`,
      cooldown_text: "5 min movilidad ligera",
      estimated_load: Math.round(estimateMinutes(optionalRun, "easy_run") * 0.85),
      status: "planned",
    });
  }

  sessions.push({
    day_of_week: "Domingo",
    session_type: "long_run",
    title: "Tirada larga",
    objective:
      distance >= 21
        ? "Extender resistencia específica para la distancia objetivo."
        : "Fortalecer resistencia general y confianza en la distancia.",
    distance_target: longRun,
    duration_target: estimateMinutes(longRun, "long_run"),
    intensity_zone: "Z2",
    warmup_text: "12 min trote muy suave",
    main_set_text: `Tirada larga progresiva por ${longRun} km`,
    cooldown_text: "Caminata ligera + estiramientos suaves",
    estimated_load: Math.round(estimateMinutes(longRun, "long_run") * 1.2),
    status: "planned",
  });

  return sessions;
}

function buildPlanStructure(input: AthleteProfileInput) {
  const distanceKm = normalizeDistance(input.distance);
  const totalWeeks = determinePlanWeeks(distanceKm, input.eventDate);

  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekNumber = index + 1;
    const phase = getWeekPhase(weekNumber, totalWeeks);
    const sessions = buildSessionsForWeek(input, weekNumber, totalWeeks);
    const totalTargetDistance = roundToHalf(
      sessions.reduce(
        (sum, session) => sum + Number(session.distance_target || 0),
        0
      )
    );

    return {
      week_number: weekNumber,
      focus_label:
        weekNumber === totalWeeks
          ? "Semana de carrera / ajuste final"
          : `${phase} ${distanceLabel(distanceKm)}`,
      total_target_distance: totalTargetDistance,
      notes:
        weekNumber === totalWeeks
          ? "Reduce la carga, cuida descanso e hidratación. Prioriza llegar fresco."
          : null,
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

function timingSafeEqualBase64(a: string, b: string) {
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

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Text(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64(new Uint8Array(digest));
}

async function pbkdf2Hash(password: string, saltBase64: string) {
  const salt = fromBase64(saltBase64);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return toBase64(new Uint8Array(derivedBits));
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltBase64 = toBase64(salt);
  const hashBase64 = await pbkdf2Hash(password, saltBase64);
  return `${saltBase64}:${hashBase64}`;
}

async function verifyPassword(password: string, stored: string) {
  const [saltBase64, storedHash] = stored.split(":");
  if (!saltBase64 || !storedHash) return false;
  const computed = await pbkdf2Hash(password, saltBase64);
  return timingSafeEqualBase64(computed, storedHash);
}

function createSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes);
}

function parseBearerToken(authHeader: string | undefined | null) {
  if (!authHeader) return "";
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return "";
  return token.trim();
}

function jsonToBase64Url(value: unknown) {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToJson<T>(value: string): T | null {
  try {
    let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    return JSON.parse(atob(base64)) as T;
  } catch {
    return null;
  }
}

async function createSignedState(userId: string, secret: string) {
  const payload = jsonToBase64Url({
    userId,
    ts: Date.now(),
    nonce: crypto.randomUUID(),
  });
  const sig = await sha256Text(`${payload}:${secret}`);
  return `${payload}.${sig}`;
}

async function verifySignedState(
  state: string,
  secret: string
): Promise<{ userId: string } | null> {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;

  const expected = await sha256Text(`${payload}:${secret}`);
  if (!timingSafeEqualBase64(expected, sig)) return null;

  const parsed = base64UrlToJson<{ userId?: string; ts?: number }>(payload);
  if (!parsed?.userId || !parsed.ts) return null;

  const ageMs = Date.now() - parsed.ts;
  if (ageMs > 1000 * 60 * 15) return null;

  return { userId: parsed.userId };
}

function getEntitlementsFromPlan(planCode: string | null, status: string | null) {
  const active = status === "active";

  if (!active) {
    return {
      has_active_membership: 0,
      can_generate_base_plan: 0,
      can_connect_strava: 0,
      can_use_strava_metrics: 0,
      can_generate_advanced_plan: 0,
      can_regenerate_with_history: 0,
      can_use_premium_planning: 0,
      source_plan_code: planCode,
    };
  }

  if (planCode === "starter") {
    return {
      has_active_membership: 1,
      can_generate_base_plan: 1,
      can_connect_strava: 0,
      can_use_strava_metrics: 0,
      can_generate_advanced_plan: 0,
      can_regenerate_with_history: 0,
      can_use_premium_planning: 0,
      source_plan_code: "starter",
    };
  }

  if (planCode === "performance") {
    return {
      has_active_membership: 1,
      can_generate_base_plan: 1,
      can_connect_strava: 1,
      can_use_strava_metrics: 1,
      can_generate_advanced_plan: 1,
      can_regenerate_with_history: 1,
      can_use_premium_planning: 0,
      source_plan_code: "performance",
    };
  }

  if (planCode === "pro_coach") {
    return {
      has_active_membership: 1,
      can_generate_base_plan: 1,
      can_connect_strava: 1,
      can_use_strava_metrics: 1,
      can_generate_advanced_plan: 1,
      can_regenerate_with_history: 1,
      can_use_premium_planning: 1,
      source_plan_code: "pro_coach",
    };
  }

  return {
    has_active_membership: 0,
    can_generate_base_plan: 0,
    can_connect_strava: 0,
    can_use_strava_metrics: 0,
    can_generate_advanced_plan: 0,
    can_regenerate_with_history: 0,
    can_use_premium_planning: 0,
    source_plan_code: planCode,
  };
}

async function getLatestMembership(db: D1Database, userId: string) {
  return await db
    .prepare(
      `select id, plan_code, status
       from memberships
       where user_id = ?1
       order by updated_at desc
       limit 1`
    )
    .bind(userId)
    .first<{ id: string; plan_code: string | null; status: string | null }>();
}

async function refreshUserEntitlements(db: D1Database, userId: string) {
  const membership = await getLatestMembership(db, userId);

  const values = getEntitlementsFromPlan(
    membership?.plan_code || null,
    membership?.status || null
  );

  const existing = await db
    .prepare(
      `select id
       from user_entitlements
       where user_id = ?1
       limit 1`
    )
    .bind(userId)
    .first<{ id: string }>();

  const now = new Date().toISOString();

  if (existing?.id) {
    await db
      .prepare(
        `update user_entitlements
         set has_active_membership = ?1,
             can_generate_base_plan = ?2,
             can_connect_strava = ?3,
             can_use_strava_metrics = ?4,
             can_generate_advanced_plan = ?5,
             can_regenerate_with_history = ?6,
             can_use_premium_planning = ?7,
             source_plan_code = ?8,
             updated_at = ?9
         where id = ?10`
      )
      .bind(
        values.has_active_membership,
        values.can_generate_base_plan,
        values.can_connect_strava,
        values.can_use_strava_metrics,
        values.can_generate_advanced_plan,
        values.can_regenerate_with_history,
        values.can_use_premium_planning,
        values.source_plan_code,
        now,
        existing.id
      )
      .run();
  } else {
    await db
      .prepare(
        `insert into user_entitlements (
          id, user_id, has_active_membership, can_generate_base_plan,
          can_connect_strava, can_use_strava_metrics, can_generate_advanced_plan,
          can_regenerate_with_history, can_use_premium_planning,
          source_plan_code, updated_at
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        values.has_active_membership,
        values.can_generate_base_plan,
        values.can_connect_strava,
        values.can_use_strava_metrics,
        values.can_generate_advanced_plan,
        values.can_regenerate_with_history,
        values.can_use_premium_planning,
        values.source_plan_code,
        now
      )
      .run();
  }

  return values;
}

async function getAuthenticatedUser(c: Context<{ Bindings: Bindings }>) {
  const authHeader = c.req.header("authorization");
  const rawToken = parseBearerToken(authHeader);

  if (!rawToken) return null;

  const tokenHash = await sha256Text(`${rawToken}:${c.env.SESSION_SECRET}`);

  const session = await c.env.DB
    .prepare(
      `select us.id, us.user_id, us.expires_at, us.revoked_at,
              u.email, u.name
       from user_sessions us
       inner join users u on u.id = us.user_id
       where us.token_hash = ?1
       limit 1`
    )
    .bind(tokenHash)
    .first<{
      id: string;
      user_id: string;
      expires_at: string;
      revoked_at: string | null;
      email: string;
      name: string;
    }>();

  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  return {
    sessionId: session.id,
    user: {
      id: session.user_id,
      email: session.email,
      name: session.name,
    },
  };
}

async function requireAuthenticatedUser(c: Context<{ Bindings: Bindings }>) {
  const auth = await getAuthenticatedUser(c);
  if (!auth) return null;
  return auth;
}

async function hasActiveMembership(db: D1Database, userId: string) {
  const membership = await getLatestMembership(db, userId);
  return membership?.status === "active";
}

async function validateDistanceForMembership(
  db: D1Database,
  userId: string,
  distance: string
) {
  const membership = await getLatestMembership(db, userId);
  const planCode = membership?.plan_code || null;
  const status = membership?.status || null;
  const active = status === "active";

  if (!active) {
    return {
      ok: false,
      message: "Se requiere una membresía activa para generar el plan.",
      planCode,
      allowedDistances: [],
    };
  }

  const distanceKm = normalizeDistance(distance);
  const allowedDistances = getAllowedDistancesByPlan(planCode);

  if (!allowedDistances.includes(distanceKm)) {
    return {
      ok: false,
      message:
        planCode === "starter"
          ? "Starter permite planes de 5K, 10K y 15K. Para 21K o 42K actualiza a Performance."
          : "La distancia seleccionada no está disponible para tu plan.",
      planCode,
      allowedDistances,
    };
  }

  return {
    ok: true,
    message: "OK",
    planCode,
    allowedDistances,
  };
}

async function createTrainingPlanForUser(
  db: D1Database,
  userId: string,
  input: AthleteProfileInput
) {
  const allowed = await validateDistanceForMembership(db, userId, input.distance);
  if (!allowed.ok) {
    throw new Error(allowed.message);
  }

  const planId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const weeks = buildPlanStructure(input);
  const eventDate = input.eventDate?.trim() || null;
  const startDate = createdAt.slice(0, 10);
  const distanceKm = normalizeDistance(input.distance);

  const batchStatements = [
    db
      .prepare(
        `insert into training_plans (
          id, user_id, version, status, start_date, end_date, plan_summary, generation_source, created_at
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
      )
      .bind(
        planId,
        userId,
        1,
        "active",
        startDate,
        eventDate,
        `Plan estándar ${distanceLabel(distanceKm)} - ${input.goal.trim()} - ${weeks.length} semanas`,
        `standard_${allowed.planCode || "unknown"}`,
        createdAt
      ),
  ];

  for (const week of weeks) {
    const weekId = crypto.randomUUID();

    batchStatements.push(
      db
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
        db
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

  await db.batch(batchStatements);

  return {
    planId,
    weeksCreated: weeks.length,
  };
}

async function ensurePlanForUser(db: D1Database, userId: string) {
  const existingPlan = await db
    .prepare(
      `select id
       from training_plans
       where user_id = ?1
       order by created_at desc
       limit 1`
    )
    .bind(userId)
    .first<{ id: string }>();

  if (existingPlan?.id) {
    return {
      created: false,
      planId: existingPlan.id,
      reason: "already_exists",
    };
  }

  const user = await db
    .prepare(
      `select id, name, email
       from users
       where id = ?1
       limit 1`
    )
    .bind(userId)
    .first<{ id: string; name: string; email: string }>();

  const profile = await db
    .prepare(
      `select
         experience_level,
         weekly_days_available,
         current_weekly_volume,
         preferred_goal_type,
         notes
       from athlete_profiles
       where user_id = ?1
       limit 1`
    )
    .bind(userId)
    .first<{
      experience_level: string;
      weekly_days_available: number;
      current_weekly_volume: number;
      preferred_goal_type: string;
      notes: string | null;
    }>();

  const goal = await db
    .prepare(
      `select
         goal_type,
         target_distance,
         target_event_name,
         target_event_date
       from goals
       where user_id = ?1
       order by created_at desc
       limit 1`
    )
    .bind(userId)
    .first<{
      goal_type: string;
      target_distance: string;
      target_event_name: string | null;
      target_event_date: string | null;
    }>();

  if (!user || !profile || !goal) {
    return {
      created: false,
      planId: null,
      reason: "missing_onboarding",
    };
  }

  const input: AthleteProfileInput = {
    name: user.name,
    email: user.email,
    goal: goal.goal_type || profile.preferred_goal_type,
    distance: goal.target_distance,
    daysPerWeek: Number(profile.weekly_days_available || 4),
    level: profile.experience_level,
    currentVolumeKm: Number(profile.current_weekly_volume || 0),
    eventName: goal.target_event_name || "",
    eventDate: goal.target_event_date || "",
    notes: profile.notes || "",
  };

  const createdPlan = await createTrainingPlanForUser(db, userId, input);

  return {
    created: true,
    planId: createdPlan.planId,
    reason: "generated_from_profile",
  };
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

async function getPayPalAccessToken(
  clientId: string,
  secret: string
): Promise<string> {
  const auth = btoa(`${clientId}:${secret}`);

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal OAuth error: ${errorText}`);
  }

  const data = (await response.json()) as PayPalAccessTokenResponse;
  return data.access_token;
}

async function createPayPalProduct(
  accessToken: string
): Promise<PayPalProductResponse> {
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name: "trAIning Memberships",
      description: "Planes de suscripción mensual para entrenamiento running",
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal product error: ${errorText}`);
  }

  return (await response.json()) as PayPalProductResponse;
}

async function createPayPalPlan(
  accessToken: string,
  productId: string,
  name: string,
  description: string,
  amount: string
): Promise<PayPalPlanResponse> {
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      product_id: productId,
      name,
      description,
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: amount,
              currency_code: "MXN",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal plan error: ${errorText}`);
  }

  return (await response.json()) as PayPalPlanResponse;
}

async function fetchPayPalSubscriptionDetail(
  accessToken: string,
  subscriptionId: string
): Promise<PayPalSubscriptionDetail | null> {
  if (!accessToken || !subscriptionId) return null;

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`,
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

  return (await response.json()) as PayPalSubscriptionDetail;
}

function mapPayPalPlanCode(planId: string | null) {
  if (!planId) return null;

  if (planId === "P-8NB63062HL487521UNHYRSJI") return "starter";
  if (planId === "P-4C338724PN8826316NHYRSJQ") return "performance";
  if (planId === "P-2G5092788J304935ENHYRSJQ") return "pro_coach";

  return planId;
}

function mapPayPalMembershipStatus(paypalStatus: string | null | undefined) {
  const status = (paypalStatus || "").toUpperCase();

  if (status === "ACTIVE") return "active";
  if (status === "APPROVAL_PENDING") return "pending_activation";
  if (status === "APPROVED") return "pending_activation";
  if (status === "SUSPENDED") return "suspended";
  if (status === "CANCELLED") return "cancelled";
  if (status === "EXPIRED") return "expired";

  return "received";
}

async function getStravaConnection(db: D1Database, userId: string) {
  return await db
    .prepare(
      `select
         id, user_id, strava_athlete_id, access_token, refresh_token,
         token_expires_at, scope, status
       from strava_connections
       where user_id = ?1
       limit 1`
    )
    .bind(userId)
    .first<StravaConnectionRow>();
}

async function refreshStravaTokenIfNeeded(
  db: D1Database,
  connection: StravaConnectionRow,
  clientId: string,
  clientSecret: string
) {
  const expiresAt = Number(connection.token_expires_at || 0);
  const shouldRefresh = expiresAt < Math.floor(Date.now() / 1000) + 300;

  if (!shouldRefresh) return connection;

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });

  if (!response.ok) {
    await db
      .prepare(
        `update strava_connections
         set status = 'error', updated_at = ?1
         where id = ?2`
      )
      .bind(new Date().toISOString(), connection.id)
      .run();

    throw new Error("No fue posible renovar el token de Strava");
  }

  const data = (await response.json()) as StravaTokenResponse;
  const now = new Date().toISOString();

  await db
    .prepare(
      `update strava_connections
       set access_token = ?1,
           refresh_token = ?2,
           token_expires_at = ?3,
           status = 'connected',
           updated_at = ?4
       where id = ?5`
    )
    .bind(
      data.access_token,
      data.refresh_token,
      data.expires_at,
      now,
      connection.id
    )
    .run();

  return {
    ...connection,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: data.expires_at,
    status: "connected",
  };
}

async function fetchStravaActivities(accessToken: string) {
  const after = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 90;
  const all: StravaActivity[] = [];

  for (let page = 1; page <= 3; page++) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("after", String(after));
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      let detail = "";

      try {
        detail = await response.text();
      } catch {
        detail = "No se pudo leer el detalle del error de Strava";
      }

      throw new Error(
        `Strava activities error ${response.status}: ${detail || response.statusText}`
      );
    }

    const data = (await response.json()) as StravaActivity[];
    all.push(...data);

    if (data.length < 100) break;
  }

  return all;
}

async function upsertStravaActivities(
  db: D1Database,
  userId: string,
  activities: StravaActivity[]
) {
  const syncedAt = new Date().toISOString();

  const statements = activities.map((activity) =>
    db
      .prepare(
        `insert into strava_activities (
          id, user_id, strava_activity_id, name, sport_type, type,
          start_date, start_date_local, timezone, distance_meters,
          moving_time_seconds, elapsed_time_seconds, total_elevation_gain,
          average_speed, max_speed, average_heartrate, max_heartrate,
          average_cadence, suffer_score, trainer, commute, manual, private,
          visibility, raw_payload, synced_at
        ) values (
          ?1, ?2, ?3, ?4, ?5, ?6,
          ?7, ?8, ?9, ?10,
          ?11, ?12, ?13,
          ?14, ?15, ?16, ?17,
          ?18, ?19, ?20, ?21, ?22, ?23,
          ?24, ?25, ?26
        )
        on conflict(user_id, strava_activity_id) do update set
          name = excluded.name,
          sport_type = excluded.sport_type,
          type = excluded.type,
          start_date = excluded.start_date,
          start_date_local = excluded.start_date_local,
          timezone = excluded.timezone,
          distance_meters = excluded.distance_meters,
          moving_time_seconds = excluded.moving_time_seconds,
          elapsed_time_seconds = excluded.elapsed_time_seconds,
          total_elevation_gain = excluded.total_elevation_gain,
          average_speed = excluded.average_speed,
          max_speed = excluded.max_speed,
          average_heartrate = excluded.average_heartrate,
          max_heartrate = excluded.max_heartrate,
          average_cadence = excluded.average_cadence,
          suffer_score = excluded.suffer_score,
          trainer = excluded.trainer,
          commute = excluded.commute,
          manual = excluded.manual,
          private = excluded.private,
          visibility = excluded.visibility,
          raw_payload = excluded.raw_payload,
          synced_at = excluded.synced_at`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        String(activity.id),
        activity.name || null,
        activity.sport_type || null,
        activity.type || null,
        activity.start_date || null,
        activity.start_date_local || null,
        activity.timezone || null,
        activity.distance || 0,
        activity.moving_time || 0,
        activity.elapsed_time || 0,
        activity.total_elevation_gain || 0,
        activity.average_speed || null,
        activity.max_speed || null,
        activity.average_heartrate || null,
        activity.max_heartrate || null,
        activity.average_cadence || null,
        activity.suffer_score || null,
        activity.trainer ? 1 : 0,
        activity.commute ? 1 : 0,
        activity.manual ? 1 : 0,
        activity.private ? 1 : 0,
        activity.visibility || null,
        JSON.stringify(activity),
        syncedAt
      )
  );

  if (statements.length > 0) {
    await db.batch(statements);
  }

  return statements.length;
}

async function createMetricsSnapshot(db: D1Database, userId: string, windowDays: number) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .prepare(
      `select
         distance_meters,
         moving_time_seconds,
         start_date,
         sport_type,
         type
       from strava_activities
       where user_id = ?1
         and start_date >= ?2
         and (
           lower(coalesce(sport_type, '')) like '%run%'
           or lower(coalesce(type, '')) like '%run%'
         )`
    )
    .bind(userId, since)
    .all<{
      distance_meters: number;
      moving_time_seconds: number;
      start_date: string;
      sport_type: string | null;
      type: string | null;
    }>();

  const activities = rows.results || [];

  const totalDistance = activities.reduce(
    (sum, activity) => sum + Number(activity.distance_meters || 0),
    0
  );

  const totalMovingTime = activities.reduce(
    (sum, activity) => sum + Number(activity.moving_time_seconds || 0),
    0
  );

  const activityCount = activities.length;
  const avgDistance = activityCount ? totalDistance / activityCount : 0;
  const longRun = activities.reduce(
    (max, activity) => Math.max(max, Number(activity.distance_meters || 0)),
    0
  );

  const avgPace =
    totalDistance > 0 ? totalMovingTime / (totalDistance / 1000) : 0;

  const activeDays = new Set(
    activities
      .map((activity) => (activity.start_date || "").slice(0, 10))
      .filter(Boolean)
  ).size;

  const expectedActiveDays = Math.max(1, Math.round((windowDays / 7) * 3));
  const consistencyScore = clamp((activeDays / expectedActiveDays) * 100, 0, 100);
  const trainingLoadScore = Math.round(
    totalDistance / 1000 + totalMovingTime / 3600 * 10 + activityCount * 2
  );

  const now = new Date().toISOString();

  await db
    .prepare(
      `insert into user_metrics_snapshots (
        id, user_id, window_days, total_distance_meters,
        total_moving_time_seconds, activity_count, avg_distance_meters,
        long_run_meters, avg_pace_seconds_per_km, days_active,
        consistency_score, training_load_score, snapshot_date, created_at
      ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      windowDays,
      totalDistance,
      totalMovingTime,
      activityCount,
      avgDistance,
      longRun,
      avgPace,
      activeDays,
      consistencyScore,
      trainingLoadScore,
      now.slice(0, 10),
      now
    )
    .run();

  return {
    windowDays,
    totalDistanceMeters: totalDistance,
    totalDistanceKm: roundToHalf(totalDistance / 1000),
    totalMovingTimeSeconds: totalMovingTime,
    activityCount,
    avgDistanceKm: roundToHalf(avgDistance / 1000),
    longRunKm: roundToHalf(longRun / 1000),
    avgPaceSecondsPerKm: Math.round(avgPace || 0),
    daysActive: activeDays,
    consistencyScore: Math.round(consistencyScore),
    trainingLoadScore,
  };
}

async function syncStravaForUser(db: D1Database, userId: string, env: Bindings) {
  const membership = await getLatestMembership(db, userId);
  const entitlements = getEntitlementsFromPlan(
    membership?.plan_code || null,
    membership?.status || null
  );

  if (!entitlements.can_connect_strava) {
    throw new Error("Tu plan actual no permite conectar Strava");
  }

  const connection = await getStravaConnection(db, userId);
  if (!connection) {
    throw new Error("El usuario no tiene Strava conectado");
  }

  const refreshed = await refreshStravaTokenIfNeeded(
    db,
    connection,
    env.STRAVA_CLIENT_ID,
    env.STRAVA_CLIENT_SECRET
  );

  const activities = await fetchStravaActivities(refreshed.access_token);
  const stored = await upsertStravaActivities(db, userId, activities);

  const now = new Date().toISOString();

  await db
    .prepare(
      `update strava_connections
       set last_sync_at = ?1,
           updated_at = ?2,
           status = 'connected'
       where user_id = ?3`
    )
    .bind(now, now, userId)
    .run();

  const metrics7 = await createMetricsSnapshot(db, userId, 7);
  const metrics28 = await createMetricsSnapshot(db, userId, 28);
  const metrics56 = await createMetricsSnapshot(db, userId, 56);

  return {
    stored,
    fetched: activities.length,
    metrics: {
      days7: metrics7,
      days28: metrics28,
      days56: metrics56,
    },
  };
}

async function getLatestMetrics(db: D1Database, userId: string) {
  const rows = await db
    .prepare(
      `select
         window_days,
         total_distance_meters,
         total_moving_time_seconds,
         activity_count,
         avg_distance_meters,
         long_run_meters,
         avg_pace_seconds_per_km,
         days_active,
         consistency_score,
         training_load_score,
         snapshot_date,
         created_at
       from user_metrics_snapshots
       where user_id = ?1
       order by created_at desc
       limit 12`
    )
    .bind(userId)
    .all<{
      window_days: number;
      total_distance_meters: number;
      total_moving_time_seconds: number;
      activity_count: number;
      avg_distance_meters: number;
      long_run_meters: number;
      avg_pace_seconds_per_km: number;
      days_active: number;
      consistency_score: number;
      training_load_score: number;
      snapshot_date: string;
      created_at: string;
    }>();

  const latestByWindow = new Map<number, any>();

  for (const row of rows.results || []) {
    if (!latestByWindow.has(row.window_days)) {
      latestByWindow.set(row.window_days, {
        windowDays: row.window_days,
        totalDistanceKm: roundToHalf(Number(row.total_distance_meters || 0) / 1000),
        totalMovingTimeSeconds: Number(row.total_moving_time_seconds || 0),
        activityCount: Number(row.activity_count || 0),
        avgDistanceKm: roundToHalf(Number(row.avg_distance_meters || 0) / 1000),
        longRunKm: roundToHalf(Number(row.long_run_meters || 0) / 1000),
        avgPaceSecondsPerKm: Math.round(Number(row.avg_pace_seconds_per_km || 0)),
        daysActive: Number(row.days_active || 0),
        consistencyScore: Math.round(Number(row.consistency_score || 0)),
        trainingLoadScore: Math.round(Number(row.training_load_score || 0)),
        snapshotDate: row.snapshot_date,
        createdAt: row.created_at,
      });
    }
  }

  return {
    days7: latestByWindow.get(7) || null,
    days28: latestByWindow.get(28) || null,
    days56: latestByWindow.get(56) || null,
  };
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

app.get("/api/paypal/config", (c) => {
  return c.json({
    ok: true,
    clientId: c.env.PAYPAL_CLIENT_ID || "",
  });
});

app.post("/api/auth/register", async (c) => {
  try {
    const body = (await c.req.json()) as AuthRegisterInput;

    const name = body.name?.trim() || "";
    const email = normalizeEmail(body.email || "");
    const password = body.password || "";

    if (!name) return jsonError(c, "El nombre es obligatorio");
    if (!email) return jsonError(c, "El correo es obligatorio");
    if (!email.includes("@")) return jsonError(c, "El correo no es válido");
    if (!password || password.length < 8) {
      return jsonError(c, "La contraseña debe tener al menos 8 caracteres");
    }

    const existing = await c.env.DB
      .prepare(`select id from users where email = ?1 limit 1`)
      .bind(email)
      .first<{ id: string }>();

    if (existing?.id) {
      return jsonError(c, "Ese correo ya está registrado", 409);
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await c.env.DB.batch([
      c.env.DB
        .prepare(
          `insert into users (
            id, email, name, password_hash, auth_provider, is_active, created_at, updated_at
          ) values (?1, ?2, ?3, ?4, 'email', 1, ?5, ?6)`
        )
        .bind(userId, email, name, passwordHash, now, now),
      c.env.DB
        .prepare(
          `insert into user_entitlements (
            id, user_id, has_active_membership, can_generate_base_plan,
            can_connect_strava, can_use_strava_metrics, can_generate_advanced_plan,
            can_regenerate_with_history, can_use_premium_planning, source_plan_code, updated_at
          ) values (?1, ?2, 0, 0, 0, 0, 0, 0, 0, null, ?3)`
        )
        .bind(crypto.randomUUID(), userId, now),
    ]);

    const rawToken = createSessionToken();
    const tokenHash = await sha256Text(`${rawToken}:${c.env.SESSION_SECRET}`);
    const expiresAt = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * 30
    ).toISOString();

    await c.env.DB
      .prepare(
        `insert into user_sessions (
          id, user_id, token_hash, expires_at, created_at, revoked_at, user_agent, ip_address
        ) values (?1, ?2, ?3, ?4, ?5, null, ?6, ?7)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        tokenHash,
        expiresAt,
        now,
        c.req.header("user-agent") || null,
        c.req.header("cf-connecting-ip") || null
      )
      .run();

    return c.json({
      ok: true,
      token: rawToken,
      user: {
        id: userId,
        email,
        name,
      },
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible registrar al usuario",
      },
      500
    );
  }
});

app.post("/api/auth/login", async (c) => {
  try {
    const body = (await c.req.json()) as AuthLoginInput;
    const email = normalizeEmail(body.email || "");
    const password = body.password || "";

    if (!email) return jsonError(c, "El correo es obligatorio");
    if (!password) return jsonError(c, "La contraseña es obligatoria");

    const user = await c.env.DB
      .prepare(
        `select id, email, name, password_hash, is_active
         from users
         where email = ?1
         limit 1`
      )
      .bind(email)
      .first<{
        id: string;
        email: string;
        name: string;
        password_hash: string | null;
        is_active: number;
      }>();

    if (!user?.id || !user.password_hash) {
      return jsonError(c, "Credenciales inválidas", 401);
    }

    if (!user.is_active) {
      return jsonError(c, "La cuenta está desactivada", 403);
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return jsonError(c, "Credenciales inválidas", 401);
    }

    const now = new Date().toISOString();
    const rawToken = createSessionToken();
    const tokenHash = await sha256Text(`${rawToken}:${c.env.SESSION_SECRET}`);
    const expiresAt = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * 30
    ).toISOString();

    await c.env.DB.batch([
      c.env.DB
        .prepare(
          `insert into user_sessions (
            id, user_id, token_hash, expires_at, created_at, revoked_at, user_agent, ip_address
          ) values (?1, ?2, ?3, ?4, ?5, null, ?6, ?7)`
        )
        .bind(
          crypto.randomUUID(),
          user.id,
          tokenHash,
          expiresAt,
          now,
          c.req.header("user-agent") || null,
          c.req.header("cf-connecting-ip") || null
        ),
      c.env.DB
        .prepare(
          `update users set last_login_at = ?1, updated_at = ?2 where id = ?3`
        )
        .bind(now, now, user.id),
    ]);

    await refreshUserEntitlements(c.env.DB, user.id);

    return c.json({
      ok: true,
      token: rawToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible iniciar sesión",
      },
      500
    );
  }
});

app.get("/api/auth/me", async (c) => {
  try {
    const auth = await getAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const entitlements = await c.env.DB
      .prepare(
        `select
          has_active_membership,
          can_generate_base_plan,
          can_connect_strava,
          can_use_strava_metrics,
          can_generate_advanced_plan,
          can_regenerate_with_history,
          can_use_premium_planning,
          source_plan_code,
          updated_at
         from user_entitlements
         where user_id = ?1
         limit 1`
      )
      .bind(auth.user.id)
      .first<EntitlementsRow>();

    const membership = await getLatestMembership(c.env.DB, auth.user.id);
    const strava = await getStravaConnection(c.env.DB, auth.user.id);

    return c.json({
      ok: true,
      user: auth.user,
      membership: membership || null,
      entitlements: entitlements || null,
      strava: strava
        ? {
            connected: true,
            status: strava.status,
            scope: strava.scope || null,
            athleteId: strava.strava_athlete_id,
          }
        : {
            connected: false,
            status: "not_connected",
          },
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar la sesión",
      },
      500
    );
  }
});

app.post("/api/auth/logout", async (c) => {
  try {
    const auth = await getAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const now = new Date().toISOString();

    await c.env.DB
      .prepare(
        `update user_sessions
         set revoked_at = ?1
         where id = ?2`
      )
      .bind(now, auth.sessionId)
      .run();

    return c.json({ ok: true, loggedOut: true });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible cerrar sesión",
      },
      500
    );
  }
});

app.get("/api/entitlements/me", async (c) => {
  try {
    const auth = await getAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const entitlements = await c.env.DB
      .prepare(
        `select
          has_active_membership,
          can_generate_base_plan,
          can_connect_strava,
          can_use_strava_metrics,
          can_generate_advanced_plan,
          can_regenerate_with_history,
          can_use_premium_planning,
          source_plan_code,
          updated_at
         from user_entitlements
         where user_id = ?1
         limit 1`
      )
      .bind(auth.user.id)
      .first<EntitlementsRow>();

    return c.json({
      ok: true,
      entitlements: entitlements || null,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar permisos",
      },
      500
    );
  }
});

app.post("/api/paypal/bootstrap-plans", async (c) => {
  try {
    const clientId = c.env.PAYPAL_CLIENT_ID || "";
    const secret = c.env.PAYPAL_SECRET || "";

    if (!clientId || !secret) {
      return jsonError(c, "Faltan credenciales de PayPal", 500);
    }

    const accessToken = await getPayPalAccessToken(clientId, secret);
    const product = await createPayPalProduct(accessToken);

    const starterPlan = await createPayPalPlan(
      accessToken,
      product.id,
      "Starter",
      "Plan mensual Starter trAIning",
      "149"
    );

    const performancePlan = await createPayPalPlan(
      accessToken,
      product.id,
      "Performance",
      "Plan mensual Performance trAIning",
      "249"
    );

    const proCoachPlan = await createPayPalPlan(
      accessToken,
      product.id,
      "Pro Coach",
      "Plan mensual Pro Coach trAIning",
      "449"
    );

    return c.json({
      ok: true,
      environment: "sandbox",
      product,
      plans: {
        starter: starterPlan,
        performance: performancePlan,
        proCoach: proCoachPlan,
      },
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "PayPal bootstrap error",
      },
      500
    );
  }
});

app.post("/api/onboarding", async (c) => {
  try {
    const body = (await c.req.json()) as AthleteProfileInput & {
      userId?: string;
    };

    validateProfile(body);

    if (!body.userId?.trim()) {
      return jsonError(c, "El userId es obligatorio");
    }

    const existingUser = await c.env.DB
      .prepare(`select id from users where id = ?1 limit 1`)
      .bind(body.userId)
      .first<{ id: string }>();

    if (!existingUser?.id) {
      return jsonError(c, "Usuario no encontrado", 404);
    }

    const membership = await getLatestMembership(c.env.DB, body.userId);
    if (membership?.status === "active") {
      const allowed = await validateDistanceForMembership(
        c.env.DB,
        body.userId,
        body.distance
      );

      if (!allowed.ok) {
        return c.json(
          {
            ok: false,
            error: allowed.message,
            planCode: allowed.planCode,
            allowedDistances: allowed.allowedDistances,
          },
          403
        );
      }
    }

    const existingProfile = await c.env.DB
      .prepare(`select id from athlete_profiles where user_id = ?1 limit 1`)
      .bind(body.userId)
      .first<{ id: string }>();

    const existingGoal = await c.env.DB
      .prepare(`select id from goals where user_id = ?1 limit 1`)
      .bind(body.userId)
      .first<{ id: string }>();

    const createdAt = new Date().toISOString();

    if (existingProfile?.id) {
      const batch = [
        c.env.DB
          .prepare(
            `update users
             set name = ?1, updated_at = ?2
             where id = ?3`
          )
          .bind(body.name.trim(), createdAt, body.userId),
        c.env.DB
          .prepare(
            `update athlete_profiles
             set experience_level = ?1,
                 weekly_days_available = ?2,
                 current_weekly_volume = ?3,
                 preferred_goal_type = ?4,
                 notes = ?5
             where user_id = ?6`
          )
          .bind(
            body.level.trim(),
            body.daysPerWeek,
            body.currentVolumeKm,
            body.goal.trim(),
            body.notes?.trim() || "",
            body.userId
          ),
      ];

      if (existingGoal?.id) {
        batch.push(
          c.env.DB
            .prepare(
              `update goals
               set goal_type = ?1,
                   target_distance = ?2,
                   target_event_name = ?3,
                   target_event_date = ?4,
                   status = 'active'
               where id = ?5`
            )
            .bind(
              body.goal.trim(),
              body.distance.trim(),
              body.eventName?.trim() || null,
              body.eventDate?.trim() || null,
              existingGoal.id
            )
        );
      } else {
        batch.push(
          c.env.DB
            .prepare(
              `insert into goals (
                id, user_id, goal_type, target_distance, target_event_name,
                target_event_date, status, created_at
              ) values (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7)`
            )
            .bind(
              crypto.randomUUID(),
              body.userId,
              body.goal.trim(),
              body.distance.trim(),
              body.eventName?.trim() || null,
              body.eventDate?.trim() || null,
              createdAt
            )
        );
      }

      await c.env.DB.batch(batch);

      return c.json({
        ok: true,
        userId: body.userId,
        updated: true,
        message: "Onboarding actualizado",
      });
    }

    const profileId = crypto.randomUUID();
    const goalId = crypto.randomUUID();

    await c.env.DB.batch([
      c.env.DB
        .prepare(
          `update users
           set name = ?1, updated_at = ?2
           where id = ?3`
        )
        .bind(body.name.trim(), createdAt, body.userId),

      c.env.DB
        .prepare(
          `insert into athlete_profiles (
            id, user_id, experience_level, weekly_days_available,
            current_weekly_volume, preferred_goal_type, notes, created_at
          ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
        )
        .bind(
          profileId,
          body.userId,
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
          body.userId,
          body.goal.trim(),
          body.distance.trim(),
          body.eventName?.trim() || null,
          body.eventDate?.trim() || null,
          createdAt
        ),
    ]);

    return c.json({
      ok: true,
      userId: body.userId,
      profileId,
      goalId,
      message: "Onboarding guardado",
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
      .first<{ id: string; email: string; name: string }>();

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

    const entitlements = getEntitlementsFromPlan(
      (membership as any)?.plan_code || null,
      (membership as any)?.status || null
    );

    return c.json({
      ok: true,
      foundUser: true,
      user,
      membership: membership || null,
      accessGranted: (membership as any)?.status === "active",
      entitlements,
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
    const body = (await c.req.json()) as AthleteProfileInput & {
      userId?: string;
    };

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

    const active = await hasActiveMembership(c.env.DB, body.userId);
    if (!active) {
      return jsonError(
        c,
        "Se requiere una membresía activa para generar el plan",
        403
      );
    }

    const createdPlan = await createTrainingPlanForUser(
      c.env.DB,
      body.userId,
      body
    );

    return c.json({
      ok: true,
      planId: createdPlan.planId,
      weeksCreated: createdPlan.weeksCreated,
      created: true,
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

    let plan = await c.env.DB
      .prepare(
        `select
           id, user_id, version, status, start_date, end_date, plan_summary, generation_source, created_at
         from training_plans
         where user_id = ?1
         order by created_at desc
         limit 1`
      )
      .bind(userId)
      .first<{
        id: string;
        user_id: string;
        version: number;
        status: string;
        start_date: string | null;
        end_date: string | null;
        plan_summary: string | null;
        generation_source: string | null;
        created_at: string;
      }>();

    let autoPlan: {
      created: boolean;
      planId: string | null;
      reason: string;
    } | null = null;

    if (!plan) {
      const active = await hasActiveMembership(c.env.DB, userId);

      if (!active) {
        return c.json(
          {
            ok: false,
            error: "El usuario no tiene una membresía activa.",
          },
          403
        );
      }

      autoPlan = await ensurePlanForUser(c.env.DB, userId);

      if (autoPlan.created || autoPlan.reason === "already_exists") {
        plan = await c.env.DB
          .prepare(
            `select
               id, user_id, version, status, start_date, end_date, plan_summary, generation_source, created_at
             from training_plans
             where user_id = ?1
             order by created_at desc
             limit 1`
          )
          .bind(userId)
          .first<{
            id: string;
            user_id: string;
            version: number;
            status: string;
            start_date: string | null;
            end_date: string | null;
            plan_summary: string | null;
            generation_source: string | null;
            created_at: string;
          }>();
      }
    }

    if (!plan) {
      return c.json(
        {
          ok: false,
          error:
            autoPlan?.reason === "missing_onboarding"
              ? "No se encontró onboarding completo para generar el plan. Completa el onboarding primero."
              : "No se encontró un plan para ese usuario.",
          autoPlan,
        },
        404
      );
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
      const weekAny = week as any;
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
        .bind(weekAny.id)
        .all();

      weeks.push({
        id: weekAny.id,
        week_number: weekAny.week_number,
        focus_label: weekAny.focus_label,
        total_target_distance: weekAny.total_target_distance,
        notes: weekAny.notes,
        sessions: sessionRows.results || [],
      });
    }

    return c.json({
      ok: true,
      plan,
      weeks,
      autoPlan,
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

app.get("/api/strava/connect-url", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const membership = await getLatestMembership(c.env.DB, auth.user.id);
    const entitlements = getEntitlementsFromPlan(
      membership?.plan_code || null,
      membership?.status || null
    );

    if (!entitlements.can_connect_strava) {
      return jsonError(
        c,
        "Tu plan actual no permite conectar Strava. Actualiza a Performance o Pro Coach.",
        403
      );
    }

    if (!c.env.STRAVA_CLIENT_ID || !c.env.STRAVA_REDIRECT_URI) {
      return jsonError(c, "Falta configuración de Strava", 500);
    }

    const state = await createSignedState(auth.user.id, c.env.SESSION_SECRET);

    const url = new URL(STRAVA_AUTHORIZE_URL);
    url.searchParams.set("client_id", c.env.STRAVA_CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", c.env.STRAVA_REDIRECT_URI);
    url.searchParams.set("approval_prompt", "auto");
    url.searchParams.set("scope", "read,activity:read");
    url.searchParams.set("state", state);

    return c.json({
      ok: true,
      url: url.toString(),
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible generar URL de Strava",
      },
      500
    );
  }
});

app.get("/api/strava/callback", async (c) => {
  try {
    const code = c.req.query("code") || "";
    const state = c.req.query("state") || "";
    const scope = c.req.query("scope") || "";
    const error = c.req.query("error") || "";

    if (error) {
      return c.redirect(`${APP_URL}?strava=denied`);
    }

    if (!code || !state) {
      return c.redirect(`${APP_URL}?strava=missing_code`);
    }

    const verifiedState = await verifySignedState(state, c.env.SESSION_SECRET);
    if (!verifiedState?.userId) {
      return c.redirect(`${APP_URL}?strava=invalid_state`);
    }

    const membership = await getLatestMembership(c.env.DB, verifiedState.userId);
    const entitlements = getEntitlementsFromPlan(
      membership?.plan_code || null,
      membership?.status || null
    );

    if (!entitlements.can_connect_strava) {
      return c.redirect(`${APP_URL}?strava=plan_blocked`);
    }

    const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: c.env.STRAVA_CLIENT_ID,
        client_secret: c.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      return c.redirect(`${APP_URL}?strava=token_error`);
    }

    const tokenData = (await tokenResponse.json()) as StravaTokenResponse;

    if (!tokenData.access_token || !tokenData.refresh_token || !tokenData.athlete?.id) {
      return c.redirect(`${APP_URL}?strava=invalid_response`);
    }

    const now = new Date().toISOString();

    const existing = await c.env.DB
      .prepare(
        `select id
         from strava_connections
         where user_id = ?1
         limit 1`
      )
      .bind(verifiedState.userId)
      .first<{ id: string }>();

    if (existing?.id) {
      await c.env.DB
        .prepare(
          `update strava_connections
           set strava_athlete_id = ?1,
               athlete_username = ?2,
               athlete_firstname = ?3,
               athlete_lastname = ?4,
               athlete_city = ?5,
               athlete_state = ?6,
               athlete_country = ?7,
               access_token = ?8,
               refresh_token = ?9,
               token_expires_at = ?10,
               scope = ?11,
               status = 'connected',
               updated_at = ?12
           where id = ?13`
        )
        .bind(
          String(tokenData.athlete.id),
          tokenData.athlete.username || null,
          tokenData.athlete.firstname || null,
          tokenData.athlete.lastname || null,
          tokenData.athlete.city || null,
          tokenData.athlete.state || null,
          tokenData.athlete.country || null,
          tokenData.access_token,
          tokenData.refresh_token,
          tokenData.expires_at,
          scope || null,
          now,
          existing.id
        )
        .run();
    } else {
      await c.env.DB
        .prepare(
          `insert into strava_connections (
            id, user_id, strava_athlete_id, athlete_username, athlete_firstname,
            athlete_lastname, athlete_city, athlete_state, athlete_country,
            access_token, refresh_token, token_expires_at, scope, status,
            connected_at, last_sync_at, updated_at
          ) values (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8, ?9,
            ?10, ?11, ?12, ?13, 'connected',
            ?14, null, ?15
          )`
        )
        .bind(
          crypto.randomUUID(),
          verifiedState.userId,
          String(tokenData.athlete.id),
          tokenData.athlete.username || null,
          tokenData.athlete.firstname || null,
          tokenData.athlete.lastname || null,
          tokenData.athlete.city || null,
          tokenData.athlete.state || null,
          tokenData.athlete.country || null,
          tokenData.access_token,
          tokenData.refresh_token,
          tokenData.expires_at,
          scope || null,
          now,
          now
        )
        .run();
    }

    try {
      await syncStravaForUser(c.env.DB, verifiedState.userId, c.env);
    } catch {
      // La conexión queda guardada aunque la primera sincronización falle.
    }

    return c.redirect(`${APP_URL}?strava=connected`);
  } catch {
    return c.redirect(`${APP_URL}?strava=error`);
  }
});

app.get("/api/strava/status", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const connection = await getStravaConnection(c.env.DB, auth.user.id);

    if (!connection) {
      return c.json({
        ok: true,
        connected: false,
        status: "not_connected",
      });
    }

    return c.json({
      ok: true,
      connected: true,
      status: connection.status,
      athleteId: connection.strava_athlete_id,
      scope: connection.scope || null,
      tokenExpiresAt: connection.token_expires_at,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar Strava",
      },
      500
    );
  }
});

app.post("/api/strava/sync", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const result = await syncStravaForUser(c.env.DB, auth.user.id, c.env);

    return c.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible sincronizar Strava",
      },
      500
    );
  }
});

app.post("/api/strava/disconnect", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    await c.env.DB
      .prepare(
        `update strava_connections
         set status = 'revoked',
             updated_at = ?1
         where user_id = ?2`
      )
      .bind(new Date().toISOString(), auth.user.id)
      .run();

    return c.json({
      ok: true,
      disconnected: true,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible desconectar Strava",
      },
      500
    );
  }
});

app.get("/api/metrics/me", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const metrics = await getLatestMetrics(c.env.DB, auth.user.id);

    return c.json({
      ok: true,
      metrics,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No fue posible consultar métricas",
      },
      500
    );
  }
});

app.post("/api/checkins/weekly", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const membership = await getLatestMembership(c.env.DB, auth.user.id);
    if (membership?.plan_code !== "pro_coach" || membership?.status !== "active") {
      return jsonError(c, "El check-in semanal está disponible en Pro Coach", 403);
    }

    const body = (await c.req.json()) as {
      trainingPlanId?: string;
      weekNumber?: number;
      energyScore?: number;
      fatigueScore?: number;
      sorenessScore?: number;
      sleepQualityScore?: number;
      notes?: string;
    };

    const energy = clamp(Number(body.energyScore || 0), 1, 5);
    const fatigue = clamp(Number(body.fatigueScore || 0), 1, 5);
    const soreness = clamp(Number(body.sorenessScore || 0), 1, 5);
    const sleep = clamp(Number(body.sleepQualityScore || 0), 1, 5);

    let recommendation = "Mantén el plan de la semana.";
    if (fatigue >= 4 || soreness >= 4 || sleep <= 2) {
      recommendation =
        "Reduce intensidad 15-25% esta semana y prioriza recuperación.";
    } else if (energy >= 4 && fatigue <= 2 && soreness <= 2) {
      recommendation =
        "Puedes mantener el plan y cuidar que las sesiones suaves sigan siendo suaves.";
    }

    const now = new Date().toISOString();

    await c.env.DB
      .prepare(
        `insert into weekly_checkins (
          id, user_id, training_plan_id, week_number, energy_score,
          fatigue_score, soreness_score, sleep_quality_score,
          notes, recommendation, created_at
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      )
      .bind(
        crypto.randomUUID(),
        auth.user.id,
        body.trainingPlanId || null,
        Number(body.weekNumber || 1),
        energy,
        fatigue,
        soreness,
        sleep,
        body.notes?.trim() || null,
        recommendation,
        now
      )
      .run();

    return c.json({
      ok: true,
      recommendation,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "No fue posible guardar check-in",
      },
      500
    );
  }
});

app.post("/api/paypal/link-subscription", async (c) => {
  try {
    const body = (await c.req.json()) as {
      userId?: string;
      subscriptionId?: string;
    };

    const userId = body.userId?.trim() || "";
    const subscriptionId = body.subscriptionId?.trim() || "";

    if (!userId) return jsonError(c, "userId es obligatorio");
    if (!subscriptionId) return jsonError(c, "subscriptionId es obligatorio");

    const user = await c.env.DB
      .prepare(`select id from users where id = ?1 limit 1`)
      .bind(userId)
      .first<{ id: string }>();

    if (!user?.id) {
      return jsonError(c, "Usuario no encontrado", 404);
    }

    const clientId = c.env.PAYPAL_CLIENT_ID || "";
    const secret = c.env.PAYPAL_SECRET || "";

    if (!clientId || !secret) {
      return jsonError(c, "Faltan credenciales de PayPal", 500);
    }

    const accessToken = await getPayPalAccessToken(clientId, secret);
    const subscriptionDetail = await fetchPayPalSubscriptionDetail(
      accessToken,
      subscriptionId
    );

    if (!subscriptionDetail?.id) {
      return jsonError(c, "No se pudo consultar la suscripción en PayPal", 404);
    }

    const createdAt = new Date().toISOString();
    const planId = subscriptionDetail.plan_id || null;
    const planCode = mapPayPalPlanCode(planId);
    const membershipStatus = mapPayPalMembershipStatus(
      subscriptionDetail.status
    );
    const payerEmail = normalizeEmail(
      subscriptionDetail.subscriber?.email_address || ""
    );

    const existingMembership = await c.env.DB
      .prepare(
        `select id
         from memberships
         where provider = ?1 and provider_subscription_id = ?2
         limit 1`
      )
      .bind("paypal", subscriptionId)
      .first<{ id: string }>();

    if (existingMembership?.id) {
      await c.env.DB
        .prepare(
          `update memberships
           set user_id = ?1,
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
          userId,
          planCode,
          membershipStatus,
          payerEmail || null,
          subscriptionDetail.custom_id || null,
          subscriptionDetail.start_time || null,
          subscriptionDetail.billing_info?.next_billing_time || null,
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
          userId,
          "paypal",
          subscriptionId,
          planCode,
          membershipStatus,
          payerEmail || null,
          subscriptionDetail.custom_id || null,
          subscriptionDetail.start_time || null,
          subscriptionDetail.billing_info?.next_billing_time || null,
          createdAt,
          createdAt,
          createdAt
        )
        .run();
    }

    await refreshUserEntitlements(c.env.DB, userId);

    let autoPlan: {
      created: boolean;
      planId: string | null;
      reason: string;
    } | null = null;

    if (membershipStatus === "active") {
      try {
        autoPlan = await ensurePlanForUser(c.env.DB, userId);
      } catch (error) {
        autoPlan = {
          created: false,
          planId: null,
          reason: error instanceof Error ? error.message : "plan_error",
        };
      }
    }

    return c.json({
      ok: true,
      linked: true,
      userId,
      subscriptionId,
      planCode,
      membershipStatus,
      payerEmail: payerEmail || null,
      autoPlan,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible enlazar la suscripción",
      },
      500
    );
  }
});

app.post("/api/paypal/webhook", async (c) => {
  try {
    const rawBody = await c.req.text();
    const createdAt = new Date().toISOString();

    let parsedBody: PayPalWebhookEvent = {};

    try {
      parsedBody = JSON.parse(rawBody) as PayPalWebhookEvent;
    } catch {
      parsedBody = {};
    }

    const paypalEventId = parsedBody.id || crypto.randomUUID();
    const eventType = parsedBody.event_type || null;
    const resourceId = parsedBody.resource?.id || null;

    await c.env.DB
      .prepare(
        `insert into webhook_events (
          id, provider, event_type, external_id, request_id,
          signature_present, payload, created_at
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(
        crypto.randomUUID(),
        "paypal",
        eventType,
        resourceId,
        paypalEventId,
        0,
        rawBody,
        createdAt
      )
      .run();

    const clientId = c.env.PAYPAL_CLIENT_ID || "";
    const secret = c.env.PAYPAL_SECRET || "";

    if (!clientId || !secret) {
      return c.json({
        ok: true,
        stored: true,
        processed: false,
        reason: "PayPal credentials missing",
      });
    }

    const subscriptionId = parsedBody.resource?.id || null;
    let subscriptionDetail: PayPalSubscriptionDetail | null = null;

    if (subscriptionId) {
      const accessToken = await getPayPalAccessToken(clientId, secret);
      subscriptionDetail = await fetchPayPalSubscriptionDetail(
        accessToken,
        subscriptionId
      );
    }

    const planId =
      subscriptionDetail?.plan_id || parsedBody.resource?.plan_id || null;

    const planCode = mapPayPalPlanCode(planId);
    const payerEmail = normalizeEmail(
      subscriptionDetail?.subscriber?.email_address ||
        parsedBody.resource?.subscriber?.email_address ||
        ""
    );

    const externalReference =
      subscriptionDetail?.custom_id || parsedBody.resource?.custom_id || null;

    const membershipStatus = mapPayPalMembershipStatus(
      subscriptionDetail?.status || parsedBody.resource?.status || null
    );

    let linkedUserId: string | null = null;

    if (externalReference) {
      const matchedUserByReference = await c.env.DB
        .prepare(`select id from users where id = ?1 limit 1`)
        .bind(externalReference)
        .first<{ id: string }>();

      if (matchedUserByReference?.id) {
        linkedUserId = matchedUserByReference.id;
      }
    }

    if (!linkedUserId && payerEmail) {
      const matchedUser = await c.env.DB
        .prepare(`select id from users where email = ?1 limit 1`)
        .bind(payerEmail)
        .first<{ id: string }>();

      if (matchedUser?.id) {
        linkedUserId = matchedUser.id;
      }
    }

    if (subscriptionId) {
      const existingMembership = await c.env.DB
        .prepare(
          `select id
           from memberships
           where provider = ?1 and provider_subscription_id = ?2
           limit 1`
        )
        .bind("paypal", subscriptionId)
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
            subscriptionDetail?.start_time ||
              parsedBody.resource?.start_time ||
              null,
            subscriptionDetail?.billing_info?.next_billing_time || null,
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
            "paypal",
            subscriptionId,
            planCode,
            membershipStatus,
            payerEmail || null,
            externalReference,
            subscriptionDetail?.start_time ||
              parsedBody.resource?.start_time ||
              null,
            subscriptionDetail?.billing_info?.next_billing_time || null,
            createdAt,
            createdAt,
            createdAt
          )
          .run();
      }
    }

    let autoPlan: {
      created: boolean;
      planId: string | null;
      reason: string;
    } | null = null;

    if (linkedUserId) {
      await refreshUserEntitlements(c.env.DB, linkedUserId);

      if (membershipStatus === "active") {
        try {
          autoPlan = await ensurePlanForUser(c.env.DB, linkedUserId);
        } catch (error) {
          autoPlan = {
            created: false,
            planId: null,
            reason: error instanceof Error ? error.message : "plan_error",
          };
        }
      }
    }

    return c.json({
      ok: true,
      stored: true,
      processed: true,
      provider: "paypal",
      eventType,
      subscriptionId,
      linkedUserId,
      payerEmail: payerEmail || null,
      planId,
      planCode,
      membershipStatus,
      externalReference,
      autoPlan,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "PayPal webhook error",
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
      mpSubscription = await fetchMercadoPagoPreapproval(accessToken, externalId);
    }

    const payerEmail = normalizeEmail(mpSubscription?.payer_email || "");
    const externalReference = mpSubscription?.external_reference || null;
    const planCode =
      mpSubscription?.preapproval_plan_id ||
      inferPlanCodeFromEvent(externalId, eventType);
    const membershipStatus = signatureValid
      ? mpSubscription?.status || inferMembershipStatus(signatureValid, eventType)
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

    let autoPlan: {
      created: boolean;
      planId: string | null;
      reason: string;
    } | null = null;

    if (linkedUserId) {
      await refreshUserEntitlements(c.env.DB, linkedUserId);

      if (membershipStatus === "active") {
        try {
          autoPlan = await ensurePlanForUser(c.env.DB, linkedUserId);
        } catch (error) {
          autoPlan = {
            created: false,
            planId: null,
            reason: error instanceof Error ? error.message : "plan_error",
          };
        }
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
      autoPlan,
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