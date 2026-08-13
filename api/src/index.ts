import { Hono } from "hono";
import type { Context } from "hono";

type Bindings = {
  DB: D1Database;
  AI: {
    run(model: string, inputs: any): Promise<any>;
  };
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
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  AI_ENABLED?: string;
  CLOUDFLARE_AI_MODEL?: string;
};

type AthleteProfileInput = {
  name: string;
  email: string;
  goal: string;
  distance: string;
  daysPerWeek: number;
  preferredTrainingDays?: unknown;
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

type WorkoutLibraryItem = {
  id: string;
  level_key: string;
  level_label?: string | null;
  day_slot: number;
  session_type: string;
  title: string;
  objective?: string | null;
  intensity_zone?: string | null;
  main_set_template: string;
  library_block?: string | null;
  min_days_per_week?: number | null;
  max_days_per_week?: number | null;
  sort_order?: number | null;
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
  deviceId?: string;
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
  if (!isRecoverFitnessGoal(body.goal) && !String(body.distance || "").trim()) {
    throw new Error("La distancia es obligatoria");
  }
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

function getRecoveryFactor(weekNumber: number, totalWeeks: number) {
  const taperWeeks = totalWeeks >= 14 ? 3 : totalWeeks >= 10 ? 2 : 1;
  const isTaper = weekNumber > totalWeeks - taperWeeks;

  if (weekNumber === totalWeeks) return 0.52;
  if (isTaper) return weekNumber === totalWeeks - 1 ? 0.68 : 0.78;
  if (weekNumber % 4 === 0) return 0.82;
  return 1;
}

function getPlanDistanceConfig(distanceKm: number) {
  if (distanceKm <= 5) {
    return {
      minStart: 8,
      defaultPeak: 24,
      absolutePeak: 32,
      longRunStart: 4,
      longRunPeak: 8,
      qualityCap: 7,
      tempoCap: 6,
    };
  }

  if (distanceKm <= 10) {
    return {
      minStart: 12,
      defaultPeak: 36,
      absolutePeak: 44,
      longRunStart: 6,
      longRunPeak: 14,
      qualityCap: 10,
      tempoCap: 9,
    };
  }

  if (distanceKm <= 15) {
    return {
      minStart: 16,
      defaultPeak: 46,
      absolutePeak: 56,
      longRunStart: 8,
      longRunPeak: 18,
      qualityCap: 12,
      tempoCap: 11,
    };
  }

  if (distanceKm <= 21) {
    return {
      minStart: 20,
      defaultPeak: 58,
      absolutePeak: 72,
      longRunStart: 10,
      longRunPeak: 24,
      qualityCap: 14,
      tempoCap: 13,
    };
  }

  return {
    minStart: 26,
    defaultPeak: 76,
    absolutePeak: 92,
    longRunStart: 12,
    longRunPeak: 32,
    qualityCap: 16,
    tempoCap: 15,
  };
}

function getLevelPeakMultiplier(level: string) {
  const clean = level.toLowerCase();
  if (clean.includes("principiante")) return 0.86;
  if (clean.includes("avanzado")) return 1.12;
  return 1;
}

function getWeekProgressRatio(weekNumber: number, totalWeeks: number) {
  if (totalWeeks <= 1) return 1;
  return clamp((weekNumber - 1) / Math.max(1, totalWeeks - 1), 0, 1);
}

function getWeeklyTargetVolume(input: AthleteProfileInput, weekNumber: number, totalWeeks: number) {
  const distanceKm = normalizeDistance(input.distance);
  const config = getPlanDistanceConfig(distanceKm);
  const currentVolume = Number(input.currentVolumeKm || 0);
  const levelMultiplier = getLevelPeakMultiplier(input.level);
  const startVolume = clamp(
    Math.max(config.minStart, currentVolume || config.minStart),
    config.minStart,
    config.absolutePeak * 0.72
  );
  const peakVolume = clamp(
    Math.max(startVolume * 1.25, config.defaultPeak * levelMultiplier),
    startVolume,
    config.absolutePeak
  );

  const ratio = getWeekProgressRatio(weekNumber, totalWeeks);
  const recoveryFactor = getRecoveryFactor(weekNumber, totalWeeks);
  const progressive = startVolume + (peakVolume - startVolume) * Math.pow(ratio, 0.9);

  return roundToHalf(clamp(progressive * recoveryFactor, config.minStart * 0.7, config.absolutePeak));
}

function getLongRunTarget(input: AthleteProfileInput, weekNumber: number, totalWeeks: number, weeklyVolume: number) {
  const distanceKm = normalizeDistance(input.distance);
  const config = getPlanDistanceConfig(distanceKm);
  const ratio = getWeekProgressRatio(weekNumber, totalWeeks);
  const recoveryFactor = getRecoveryFactor(weekNumber, totalWeeks);

  let longRun = config.longRunStart + (config.longRunPeak - config.longRunStart) * Math.pow(ratio, 0.92);

  if (weekNumber % 4 === 0 && weekNumber < totalWeeks - 1) {
    longRun *= 0.78;
  }

  if (weekNumber > totalWeeks - (totalWeeks >= 14 ? 3 : totalWeeks >= 10 ? 2 : 1)) {
    longRun *= recoveryFactor;
  }

  const maxByWeeklyVolume = weeklyVolume * (distanceKm >= 21 ? 0.42 : 0.36);
  return roundToHalf(clamp(longRun, 3.5, Math.min(config.longRunPeak, maxByWeeklyVolume)));
}

function normalizeWorkoutLibraryLevel(level: string) {
  const normalized = String(level || "").toLowerCase().trim();

  if (
    normalized.includes("básico") ||
    normalized.includes("basico") ||
    normalized.includes("principiante") ||
    normalized === "basic"
  ) {
    return "basic";
  }

  if (normalized.includes("intermedio") || normalized === "intermediate") {
    return "intermediate";
  }

  if (normalized === "medio" || normalized === "medium") {
    return "medium";
  }

  if (
    normalized.includes("avanzado") ||
    normalized.includes("avanzando") ||
    normalized === "advanced"
  ) {
    return "advanced";
  }

  if (normalized.includes("experto") || normalized === "expert") {
    return "expert";
  }

  return "intermediate";
}

function getWorkoutLibraryLevelFallbacks(level: string) {
  const key = normalizeWorkoutLibraryLevel(level);
  const fallbackMap: Record<string, string[]> = {
    basic: ["basic", "intermediate"],
    intermediate: ["intermediate", "medium", "basic"],
    medium: ["medium", "intermediate", "advanced"],
    advanced: ["advanced", "medium", "expert"],
    expert: ["expert", "advanced", "medium"],
  };

  return fallbackMap[key] || ["intermediate", "medium"];
}

function getPreferredLibraryTypes(sessionType: string) {
  const normalized = String(sessionType || "").toLowerCase();

  if (normalized.includes("easy") || normalized.includes("recovery")) {
    return ["easy_run", "continuous_run"];
  }

  if (normalized.includes("long")) {
    return ["long_run", "easy_run", "continuous_run"];
  }

  if (normalized.includes("tempo")) {
    return ["tempo", "progression", "continuous_run"];
  }

  if (normalized.includes("quality")) {
    return ["intervals", "fartlek", "tempo", "quality", "progression"];
  }

  return [normalized, "quality", "tempo", "easy_run"];
}

function chooseWorkoutLibraryItem(
  library: WorkoutLibraryItem[],
  input: AthleteProfileInput,
  session: SessionSeed,
  daySlot: number,
  weekNumber: number,
  daysPerWeek: number
) {
  if (!library.length) return null;

  const levelFallbacks = getWorkoutLibraryLevelFallbacks(input.level);
  const preferredTypes = getPreferredLibraryTypes(session.session_type);

  const isAllowedForDays = (item: WorkoutLibraryItem) => {
    const minDays = Number(item.min_days_per_week || 3);
    const maxDays = Number(item.max_days_per_week || 6);
    return daysPerWeek >= minDays && daysPerWeek <= maxDays;
  };

  const matchScore = (item: WorkoutLibraryItem) => {
    let score = 0;
    const levelIndex = levelFallbacks.indexOf(item.level_key);
    if (levelIndex >= 0) score += 100 - levelIndex * 12;
    if (Number(item.day_slot) === daySlot) score += 35;
    const typeIndex = preferredTypes.indexOf(item.session_type);
    if (typeIndex >= 0) score += 45 - typeIndex * 8;
    if (isAllowedForDays(item)) score += 10;
    return score;
  };

  const candidates = library
    .filter((item) => levelFallbacks.includes(item.level_key))
    .filter((item) => preferredTypes.includes(item.session_type) || Number(item.day_slot) === daySlot)
    .sort((a, b) => {
      const byScore = matchScore(b) - matchScore(a);
      if (byScore !== 0) return byScore;
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });

  if (!candidates.length) return null;

  const topScore = matchScore(candidates[0]);
  const best = candidates.filter((item) => matchScore(item) === topScore);
  return best[(weekNumber - 1) % best.length] || candidates[0];
}


function cleanVisibleMainSetText(text: string | null | undefined) {
  const value = String(text || "").trim();
  if (!value) return "";

  const firstDot = value.indexOf(".");
  if (firstDot <= 0) return value;

  const lead = value.slice(0, firstDot).trim();
  const rest = value.slice(firstDot + 1).trim();

  if (!rest) return value;

  const normalizedLead = lead
    .replace(/[0-9]/g, "")
    .replace(/[ÁÉÍÓÚÜÑ]/g, "A")
    .replace(/[^A-Z\s\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const looksLikeLibraryLabel =
    lead.length <= 40 &&
    normalizedLead.length >= 4 &&
    normalizedLead === normalizedLead.toUpperCase();

  return looksLikeLibraryLabel ? rest : value;
}

function applyWorkoutLibraryReference(
  session: SessionSeed,
  input: AthleteProfileInput,
  library: WorkoutLibraryItem[],
  sessionIndex: number,
  weekNumber: number,
  daysPerWeek: number
) {
  if (!library.length) return session;

  const isLongRun = session.session_type === "long_run";
  const daySlot = isLongRun ? 5 : Math.min(sessionIndex + 1, 5);
  const item = chooseWorkoutLibraryItem(
    library,
    input,
    session,
    daySlot,
    weekNumber,
    daysPerWeek
  );

  if (!item) return session;

  const rawBlock = String(item.main_set_template || item.library_block || "").trim();
  const block = cleanVisibleMainSetText(rawBlock);
  const distanceText = session.distance_target
    ? ` Distancia asignada: ${session.distance_target} km objetivo.`
    : "";

  const shouldKeepLongRunText =
    isLongRun && rawBlock.toUpperCase().includes("DISTANCIA DEPENDIENDO OBJETIVO");

  const composedMainSet = distanceText
    ? `${block}${block.endsWith(".") ? "" : "."} ${distanceText.trim()}`
    : block;

  return {
    ...session,
    session_type: item.session_type || session.session_type,
    title: shouldKeepLongRunText ? session.title : item.title || session.title,
    objective: item.objective || session.objective,
    intensity_zone: item.intensity_zone || session.intensity_zone,
    main_set_text: shouldKeepLongRunText
      ? cleanVisibleMainSetText(session.main_set_text)
      : composedMainSet,
  };
}

async function fetchWorkoutLibrary(db: D1Database) {
  try {
    const result = await db
      .prepare(
        `select id, level_key, level_label, day_slot, session_type, title, objective,
                intensity_zone, main_set_template, library_block,
                min_days_per_week, max_days_per_week, sort_order
         from training_workout_library
         where is_active = 1
         order by level_key, day_slot, sort_order`
      )
      .all<WorkoutLibraryItem>();

    return result.results || [];
  } catch (error) {
    console.warn("Workout library not available, using default generator", error);
    return [];
  }
}

function makeSession(seed: SessionSeed): SessionSeed {
  return seed;
}


type PaceEngineContext = {
  baselineSecondsPerKm: number;
  recentMedianSecondsPerKm: number | null;
  completedSessions: number;
  missedSessions: number;
  completionRate: number;
  fatigueScore: number;
  sorenessScore: number;
  sleepQualityScore: number;
  aiDeltaSeconds: number;
  aiReason: string;
  source: "history_ai" | "history_rules" | "level_ai" | "level_rules";
};

type PaceAiAdjustment = {
  delta_seconds: number;
  reason: string;
};

function clampPace(value: number, min = 210, max = 720) {
  return Math.round(Math.max(min, Math.min(max, value)));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function formatPace(secondsPerKm: number) {
  const safe = clampPace(secondsPerKm);
  const minutes = Math.floor(safe / 60);
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getLevelBaselinePace(level: string, currentVolumeKm: number) {
  const normalized = normalizeGoalText(level);
  let baseline = normalized.includes("avanz") || normalized.includes("expert")
    ? 320
    : normalized.includes("inter") || normalized.includes("medio")
    ? 365
    : 420;

  if (currentVolumeKm >= 45) baseline -= 15;
  else if (currentVolumeKm >= 30) baseline -= 8;
  else if (currentVolumeKm > 0 && currentVolumeKm < 12) baseline += 15;

  return clampPace(baseline);
}

async function fetchPaceEngineContext(
  db: D1Database,
  userId: string,
  input: AthleteProfileInput
): Promise<Omit<PaceEngineContext, "aiDeltaSeconds" | "aiReason" | "source">> {
  const progress = await db
    .prepare(
      `select is_completed, actual_pace_seconds_per_km, source, updated_at
       from training_session_progress
       where user_id = ?1
       order by updated_at desc
       limit 20`
    )
    .bind(userId)
    .all<any>();

  const rows = progress.results || [];
  const validPaces = rows
    .filter((row: any) => Number(row.is_completed) === 1)
    .map((row: any) => Number(row.actual_pace_seconds_per_km || 0))
    .filter((pace: number) => pace >= 210 && pace <= 720)
    .slice(0, 10);

  const completedSessions = rows.filter(
    (row: any) => Number(row.is_completed) === 1
  ).length;
  const missedSessions = rows.filter(
    (row: any) => Number(row.is_completed) !== 1 &&
      String(row.source || "").includes("missed")
  ).length;
  const decidedSessions = completedSessions + missedSessions;
  const completionRate = decidedSessions
    ? completedSessions / decidedSessions
    : 0;

  let latestCheckin: any = null;
  try {
    latestCheckin = await db
      .prepare(
        `select fatigue_score, soreness_score, sleep_quality_score, created_at
         from weekly_checkins
         where user_id = ?1
         order by created_at desc
         limit 1`
      )
      .bind(userId)
      .first<any>();
  } catch {
    latestCheckin = null;
  }

  const recentMedianSecondsPerKm = median(validPaces);
  const levelBaseline = getLevelBaselinePace(
    input.level,
    Number(input.currentVolumeKm || 0)
  );

  // El historial manda, pero se limita para evitar que una sesión aislada
  // convierta el ritmo de competencia en ritmo fácil.
  const baselineSecondsPerKm = recentMedianSecondsPerKm
    ? clampPace(
        recentMedianSecondsPerKm * 0.72 + levelBaseline * 0.28,
        levelBaseline - 55,
        levelBaseline + 65
      )
    : levelBaseline;

  return {
    baselineSecondsPerKm,
    recentMedianSecondsPerKm,
    completedSessions,
    missedSessions,
    completionRate,
    fatigueScore: Number(latestCheckin?.fatigue_score || 0),
    sorenessScore: Number(latestCheckin?.soreness_score || 0),
    sleepQualityScore: Number(latestCheckin?.sleep_quality_score || 0),
  };
}

async function getAiPaceAdjustment(
  env: Pick<Bindings, "OPENAI_API_KEY" | "OPENAI_MODEL" | "AI_ENABLED"> | undefined,
  input: AthleteProfileInput,
  context: Omit<PaceEngineContext, "aiDeltaSeconds" | "aiReason" | "source">
): Promise<PaceAiAdjustment> {
  const aiEnabled = String(env?.AI_ENABLED || "false").toLowerCase() === "true";
  if (!aiEnabled || !env?.OPENAI_API_KEY) {
    return { delta_seconds: 0, reason: "Ajuste por reglas internas" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "Actúa como coach de running prudente. Decide solamente un ajuste de ritmo en segundos por km entre -20 y 20. Un número positivo hace el ritmo más lento y uno negativo más rápido. Si hay fatiga alta, molestias, mal sueño, baja adherencia o el objetivo es recuperar condición, no aceleres. No diagnostiques ni prescribas tratamiento.",
          },
          {
            role: "user",
            content: JSON.stringify({
              goal: input.goal,
              level: input.level,
              daysPerWeek: input.daysPerWeek,
              currentVolumeKm: input.currentVolumeKm,
              ...context,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "pace_adjustment",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["delta_seconds", "reason"],
              properties: {
                delta_seconds: { type: "integer", minimum: -20, maximum: 20 },
                reason: { type: "string", maxLength: 180 },
              },
            },
          },
        },
      }),
    });

    const data = (await response.json()) as any;
    if (!response.ok) throw new Error(data?.error?.message || "AI pace error");
    const text = extractOpenAiOutputText(data);
    const parsed = JSON.parse(text) as PaceAiAdjustment;
    return {
      delta_seconds: Math.max(-20, Math.min(20, Number(parsed.delta_seconds || 0))),
      reason: String(parsed.reason || "Ajuste inteligente conservador"),
    };
  } catch (error) {
    console.warn("AI pace adjustment unavailable; using rules", error);
    return { delta_seconds: 0, reason: "Ajuste por reglas internas" };
  }
}

function getSessionPacePrescription(
  session: SessionSeed,
  weekNumber: number,
  totalWeeks: number,
  context: PaceEngineContext
) {
  const type = normalizeGoalText(session.session_type);
  const recoveryWeek = weekNumber % 4 === 0 && weekNumber < totalWeeks;
  const phaseProgress = totalWeeks > 1 ? (weekNumber - 1) / (totalWeeks - 1) : 0;
  const progression = Math.round(Math.min(14, phaseProgress * 14));

  let offset = 20;
  let width = 20;
  let rpe = "3/10";
  let difficulty = "Fácil";
  let feeling = "Cómodo y conversacional; debes poder hablar en frases completas.";

  if (type.includes("recover") || type.includes("regener")) {
    offset = 45;
    width = 25;
    rpe = "2/10";
    difficulty = "Muy fácil";
    feeling = "Muy relajado; termina con sensación de poder continuar.";
  } else if (type.includes("long")) {
    offset = 28;
    width = 22;
    rpe = "3-4/10";
    difficulty = "Fácil";
    feeling = "Constante y controlado; evita perseguir velocidad al final.";
  } else if (type.includes("tempo") || type.includes("threshold")) {
    offset = -22;
    width = 14;
    rpe = "6-7/10";
    difficulty = "Exigente controlado";
    feeling = "Fuerte pero sostenible; sin llegar a esfuerzo máximo.";
  } else if (type.includes("interval")) {
    offset = -38;
    width = 15;
    rpe = "7-8/10";
    difficulty = "Exigente";
    feeling = "Rápido con técnica estable; recupera lo suficiente para repetir bien.";
  } else if (type.includes("fartlek")) {
    offset = -28;
    width = 18;
    rpe = "6/10 en tramos vivos";
    difficulty = "Moderada";
    feeling = "Los cambios son vivos, no máximos; las recuperaciones deben ser suaves.";
  } else if (type.includes("progress")) {
    offset = 8;
    width = 24;
    rpe = "3-6/10";
    difficulty = "Moderada";
    feeling = "Empieza cómodo y acelera gradualmente sin perder control.";
  }

  let safetyDelta = 0;
  if (context.fatigueScore >= 4 || context.sorenessScore >= 4) safetyDelta += 20;
  if (context.sleepQualityScore > 0 && context.sleepQualityScore <= 2) safetyDelta += 10;
  if (context.missedSessions >= 2 || (context.completedSessions >= 3 && context.completionRate < 0.6)) {
    safetyDelta += 10;
  }
  if (recoveryWeek) safetyDelta += 10;

  const center = clampPace(
    context.baselineSecondsPerKm + offset - progression + safetyDelta + context.aiDeltaSeconds
  );
  const minSeconds = clampPace(center - Math.floor(width / 2));
  const maxSeconds = clampPace(center + Math.ceil(width / 2));

  return {
    minSeconds,
    maxSeconds,
    rpe,
    difficulty,
    feeling,
  };
}

function stripInternalWorkoutReferences(text: string) {
  return String(text || "")
    .replace(/Referencia\s+(?:de\s+la\s+)?biblioteca\s+Peak\s+Pulse:\s*/gi, "")
    .replace(/Biblioteca\s+Peak\s+Pulse:\s*/gi, "")
    .replace(/Referencia\s+de\s+biblioteca:\s*/gi, "")
    .replace(/Ajuste\s+para\s+este\s+plan:\s*/gi, "Distancia asignada: ")
    .trim();
}

function enrichPlanWithPaces(
  weeks: any[],
  context: PaceEngineContext
) {
  const totalWeeks = weeks.length;
  return weeks.map((week: any) => ({
    ...week,
    sessions: (week.sessions || []).map((session: SessionSeed) => {
      const prescription = getSessionPacePrescription(
        session,
        Number(week.week_number || 1),
        totalWeeks,
        context
      );
      const cleanMainSet = stripInternalWorkoutReferences(session.main_set_text);
      const paceText = `Ritmo recomendado: ${formatPace(prescription.minSeconds)}–${formatPace(prescription.maxSeconds)} min/km.`;
      const effortText = `Esfuerzo: RPE ${prescription.rpe} · Dificultad: ${prescription.difficulty}.`;
      const feelingText = `Sensación esperada: ${prescription.feeling}`;

      return {
        ...session,
        main_set_text: [cleanMainSet, paceText, effortText, feelingText]
          .filter(Boolean)
          .join(" "),
      };
    }),
  }));
}

function applyPreferredDaysToWeeks(input: AthleteProfileInput, weeks: any[]) {
  return weeks.map((week: any) => ({
    ...week,
    sessions: applyPreferredTrainingDaysToSessions(input, week.sessions || []),
  }));
}

function buildQualityMainSet(distanceKm: number, weekNumber: number, qualityKm: number, goal: string) {
  const wantsTime = goal.toLowerCase().includes("tiempo") || goal.toLowerCase().includes("mejorar");
  const cycle = weekNumber % 3;

  if (cycle === 1) {
    const reps = distanceKm <= 10 ? 6 : distanceKm <= 21 ? 5 : 4;
    const interval = distanceKm <= 10 ? "400 m" : distanceKm <= 21 ? "800 m" : "1 km";
    return wantsTime
      ? `${reps} x ${interval} a esfuerzo controlado dentro de ${qualityKm} km totales, recuperando trote suave`
      : `${reps - 1} x ${interval} a ritmo alegre pero sostenible dentro de ${qualityKm} km totales`;
  }

  if (cycle === 2) {
    return `Cambios de ritmo tipo fartlek dentro de ${qualityKm} km: alterna bloques vivos y recuperación suave`;
  }

  return `Repeticiones en subida o progresiones controladas dentro de ${qualityKm} km, cuidando técnica y postura`;
}




const TRAINING_DAY_ORDER = [

  "Lunes",

  "Martes",

  "Miércoles",

  "Jueves",

  "Viernes",

  "Sábado",

  "Domingo",

];

function normalizePreferredTrainingDays(value: unknown, daysPerWeek: number) {

  const target = Math.max(3, Math.min(6, Number(daysPerWeek || 4)));

  const rawDays = Array.isArray(value)

    ? value

    : typeof value === "string"

    ? value.split(",")

    : [];

  const selected = rawDays

    .map((day) => String(day || "").trim())

    .filter((day) => TRAINING_DAY_ORDER.includes(day))

    .filter((day, index, arr) => arr.indexOf(day) === index)

    .slice(0, target);

  for (const day of TRAINING_DAY_ORDER) {

    if (selected.length >= target) break;

    if (!selected.includes(day)) selected.push(day);

  }

  return selected;

}

function applyPreferredTrainingDaysToSessions<T extends { day_of_week?: string }>(

  input: { preferredTrainingDays?: unknown; daysPerWeek?: number },

  sessions: T[]

) {

  const preferredDays = normalizePreferredTrainingDays(

    input.preferredTrainingDays,

    Number(input.daysPerWeek || sessions.length || 4)

  );

  return sessions.map((session, index) => ({

    ...session,

    day_of_week: preferredDays[index % preferredDays.length] || session.day_of_week,

  }));

}

function applyPreferredTrainingDaysToPlanStructure(input: any, planStructure: any) {

  if (!planStructure?.weeks || !Array.isArray(planStructure.weeks)) {

    return planStructure;

  }

  return {

    ...planStructure,

    weeks: planStructure.weeks.map((week: any) => ({

      ...week,

      sessions: Array.isArray(week.sessions)

        ? applyPreferredTrainingDaysToSessions(input, week.sessions)

        : week.sessions,

    })),

  };

}


function normalizeGoalText(goal: string) {
  return String(goal || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isRecoverFitnessGoal(goal: string) {
  const clean = normalizeGoalText(goal);
  return (
    clean === "recover_fitness" ||
    clean.includes("recuperar condicion") ||
    clean.includes("recuperar base") ||
    clean.includes("volver a entrenar")
  );
}

function getRecoverFitnessWeeks() {
  return 8;
}

function getRecoverFitnessLevelKey(level: string) {
  const clean = normalizeGoalText(level);

  if (
    clean.includes("basico") ||
    clean.includes("principiante") ||
    clean.includes("basic")
  ) {
    return "basic";
  }

  if (
    clean.includes("avanzado") ||
    clean.includes("advanced") ||
    clean.includes("experto")
  ) {
    return "advanced";
  }

  return "intermediate";
}

function getRecoverFitnessVolumeRange(level: string, daysPerWeek: number) {
  const days = clamp(Number(daysPerWeek || 4), 3, 6);
  const levelKey = getRecoverFitnessLevelKey(level);

  const ranges: Record<string, Record<number, { min: number; max: number }>> = {
    basic: {
      3: { min: 8, max: 12 },
      4: { min: 12, max: 16 },
      5: { min: 15, max: 22 },
      6: { min: 18, max: 26 },
    },
    intermediate: {
      3: { min: 15, max: 20 },
      4: { min: 20, max: 28 },
      5: { min: 25, max: 35 },
      6: { min: 30, max: 42 },
    },
    advanced: {
      3: { min: 22, max: 30 },
      4: { min: 30, max: 40 },
      5: { min: 38, max: 50 },
      6: { min: 42, max: 58 },
    },
  };

  return ranges[levelKey][days] || ranges.intermediate[4];
}

function getRecoverFitnessWeeklyVolume(
  input: AthleteProfileInput,
  weekNumber: number,
  totalWeeks: number
) {
  const days = clamp(Number(input.daysPerWeek || 4), 3, 6);
  const range = getRecoverFitnessVolumeRange(input.level, days);
  const currentVolume = Number(input.currentVolumeKm || 0);

  const safeStart =
    currentVolume > 0
      ? clamp(currentVolume * 0.65, range.min, range.max * 0.82)
      : range.min;

  const ratio = getWeekProgressRatio(weekNumber, totalWeeks);
  let target = safeStart + (range.max - safeStart) * Math.pow(ratio, 0.85);

  if (weekNumber % 4 === 0 && weekNumber < totalWeeks) {
    target *= 0.85;
  }

  return roundToHalf(clamp(target, range.min * 0.8, range.max));
}

function getRecoverFitnessProgressionType(weekNumber: number, level: string) {
  const levelKey = getRecoverFitnessLevelKey(level);

  if (weekNumber <= 2) return "strides";
  if (levelKey === "basic") return weekNumber >= 5 ? "progression" : "strides";
  if (levelKey === "advanced") return weekNumber >= 4 ? "controlled_fartlek" : "progression";

  return weekNumber >= 4 ? "progression" : "strides";
}

function buildRecoverFitnessSessionsForWeek(
  input: AthleteProfileInput,
  weekNumber: number,
  totalWeeks: number,
  workoutLibrary: WorkoutLibraryItem[] = []
): SessionSeed[] {
  const days = clamp(Number(input.daysPerWeek || 4), 3, 6);
  const weeklyVolume = getRecoverFitnessWeeklyVolume(input, weekNumber, totalWeeks);
  const isRecoveryWeek = weekNumber % 4 === 0 && weekNumber < totalWeeks;
  const progressionType = getRecoverFitnessProgressionType(weekNumber, input.level);

  const distributionMap: Record<number, number[]> = {
    3: [0.32, 0.25, 0.43],
    4: [0.27, 0.22, 0.18, 0.33],
    5: [0.22, 0.18, 0.16, 0.18, 0.26],
    6: [0.19, 0.16, 0.14, 0.16, 0.12, 0.23],
  };

  const distribution = distributionMap[days] || distributionMap[4];
  const km = distribution.map((factor) =>
    roundToHalf(clamp(weeklyVolume * factor, 3, 18))
  );

  const sessions: SessionSeed[] = [];

  sessions.push(
    makeSession({
      day_of_week: days === 3 ? "Martes" : "Lunes",
      session_type: "easy_run",
      title: "Rodaje suave de regreso",
      objective: "Recuperar base aeróbica sin acumular fatiga.",
      distance_target: km[0],
      duration_target: estimateMinutes(km[0], "easy_run"),
      intensity_zone: "Z1-Z2",
      warmup_text: "8-10 min trote muy suave + movilidad articular",
      main_set_text: `Rodaje cómodo por ${km[0]} km. Debe sentirse fácil y conversacional.`,
      cooldown_text: "5 min caminata o trote muy suave + movilidad",
      estimated_load: Math.round(estimateMinutes(km[0], "easy_run") * 0.82),
      status: "planned",
    })
  );

  sessions.push(
    makeSession({
      day_of_week: days === 3 ? "Jueves" : "Martes",
      session_type: "easy_run",
      title: "Easy pace + técnica",
      objective: "Mejorar sensación de carrera, movilidad y eficiencia sin intensidad alta.",
      distance_target: km[1],
      duration_target: estimateMinutes(km[1], "easy_run"),
      intensity_zone: "Z2",
      warmup_text: "10 min trote suave + movilidad de tobillo, cadera y pantorrilla",
      main_set_text:
        progressionType === "strides"
          ? `Rodaje easy por ${km[1]} km + 4 progresiones de 15-20 segundos muy controladas.`
          : `Rodaje easy por ${km[1]} km con cierre ligeramente progresivo, sin pasar de esfuerzo cómodo.`,
      cooldown_text: "5 min trote suave + respiración",
      estimated_load: Math.round(estimateMinutes(km[1], "easy_run") * 0.9),
      status: "planned",
    })
  );

  if (days >= 4) {
    sessions.push(
      makeSession({
        day_of_week: "Miércoles",
        session_type: "recovery",
        title: isRecoveryWeek ? "Recuperación activa de descarga" : "Recuperación activa",
        objective: "Sumar continuidad sin castigar piernas ni sistema cardiovascular.",
        distance_target: km[2],
        duration_target: estimateMinutes(km[2], "recovery"),
        intensity_zone: "Z1-Z2",
        warmup_text: "8 min trote muy suave",
        main_set_text: `Trote regenerativo por ${km[2]} km. Si te sientes pesado, baja ritmo o camina tramos cortos.`,
        cooldown_text: "Movilidad ligera de cadera, tobillo y pantorrilla",
        estimated_load: Math.round(estimateMinutes(km[2], "recovery") * 0.72),
        status: "planned",
      })
    );
  }

  if (days >= 5) {
    const controlledText =
      progressionType === "controlled_fartlek"
        ? `Fartlek controlado dentro de ${km[3]} km: alterna 1 min vivo / 2 min suave, sin llegar al máximo.`
        : `Rodaje progresivo suave por ${km[3]} km: inicia fácil y termina moderado, siempre con control.`;

    sessions.push(
      makeSession({
        day_of_week: "Jueves",
        session_type: progressionType === "controlled_fartlek" ? "fartlek" : "progression",
        title:
          progressionType === "controlled_fartlek"
            ? "Fartlek controlado"
            : "Progresivo suave",
        objective: "Reactivar cambios de ritmo sin convertir la sesión en entrenamiento fuerte.",
        distance_target: km[3],
        duration_target: estimateMinutes(km[3], "tempo"),
        intensity_zone: "Z2-Z3",
        warmup_text: "10-12 min trote suave + movilidad + 3 progresiones cortas",
        main_set_text: controlledText,
        cooldown_text: "8 min trote suave",
        estimated_load: Math.round(estimateMinutes(km[3], "tempo") * 1.0),
        status: "planned",
      })
    );
  }

  if (days >= 6) {
    sessions.push(
      makeSession({
        day_of_week: "Sábado",
        session_type: "easy_run",
        title: "Rodaje corto opcional",
        objective: "Agregar volumen ligero solo si la recuperación va bien.",
        distance_target: km[4],
        duration_target: estimateMinutes(km[4], "easy_run"),
        intensity_zone: "Z1-Z2",
        warmup_text: "8 min trote suave",
        main_set_text: `Rodaje muy cómodo por ${km[4]} km. Si hay fatiga, cambia por movilidad.`,
        cooldown_text: "5 min caminata + movilidad",
        estimated_load: Math.round(estimateMinutes(km[4], "easy_run") * 0.75),
        status: "planned",
      })
    );
  }

  const longRunIndex = days === 3 ? 2 : days === 4 ? 3 : days === 5 ? 4 : 5;
  const longRunKm = km[longRunIndex];

  sessions.push(
    makeSession({
      day_of_week: "Domingo",
      session_type: "long_run",
      title: "Tirada cómoda para recuperar condición",
      objective: "Reconstruir resistencia general sin forzar ritmo ni distancia.",
      distance_target: longRunKm,
      duration_target: estimateMinutes(longRunKm, "long_run"),
      intensity_zone: "Z2",
      warmup_text: "10-12 min trote muy suave",
      main_set_text: `Tirada cómoda por ${longRunKm} km. Mantén esfuerzo conversacional; no busques ritmo objetivo.`,
      cooldown_text: "Caminata ligera + movilidad y recuperación",
      estimated_load: Math.round(estimateMinutes(longRunKm, "long_run") * 1.05),
      status: "planned",
    })
  );

  const selectedSessions = sessions.slice(0, days);

  return selectedSessions.map((session, index) =>
    applyWorkoutLibraryReference(
      session,
      input,
      workoutLibrary,
      index,
      weekNumber,
      days
    )
  );
}


function buildTempoMainSet(distanceKm: number, weekNumber: number, tempoKm: number) {
  if (weekNumber % 3 === 0) {
    return `Rodaje progresivo dentro de ${tempoKm} km: inicia cómodo y termina cerca de ritmo objetivo`;
  }

  if (distanceKm >= 21) {
    return `Bloques de ritmo controlado dentro de ${tempoKm} km: 2 a 3 segmentos sostenidos sin llegar al máximo`;
  }

  return `Ritmo controlado dentro de ${tempoKm} km, manteniendo respiración estable y buena técnica`;
}

function buildSessionsForWeek(
  input: AthleteProfileInput,
  weekNumber: number,
  totalWeeks: number,
  workoutLibrary: WorkoutLibraryItem[] = []
): SessionSeed[] {
  if (isRecoverFitnessGoal(input.goal)) {
    return buildRecoverFitnessSessionsForWeek(input, weekNumber, totalWeeks, workoutLibrary);
  }

  const distanceKm = normalizeDistance(input.distance);
  const days = clamp(Number(input.daysPerWeek || 4), 3, 6);
  const phase = getWeekPhase(weekNumber, totalWeeks);
  const config = getPlanDistanceConfig(distanceKm);
  const weeklyVolume = getWeeklyTargetVolume(input, weekNumber, totalWeeks);
  const longRun = getLongRunTarget(input, weekNumber, totalWeeks, weeklyVolume);
  const isTaperWeek = weekNumber > totalWeeks - (totalWeeks >= 14 ? 3 : totalWeeks >= 10 ? 2 : 1);
  const isRecoveryWeek = weekNumber % 4 === 0 && !isTaperWeek;

  const qualityRun = roundToHalf(
    clamp(weeklyVolume * (isRecoveryWeek || isTaperWeek ? 0.14 : 0.18), 3, config.qualityCap)
  );
  const tempoRun = roundToHalf(
    clamp(weeklyVolume * (distanceKm >= 21 ? 0.16 : 0.18), 3, config.tempoCap)
  );
  const recoveryRun = roundToHalf(clamp(weeklyVolume * 0.12, 3, 10));
  const easyRun = roundToHalf(
    clamp(weeklyVolume - longRun - qualityRun - (days >= 5 ? tempoRun : 0) - recoveryRun, 3, 16)
  );
  const optionalRun = roundToHalf(clamp(weeklyVolume * 0.1, 3, 10));

  const sessions: SessionSeed[] = [];

  sessions.push(
    makeSession({
      day_of_week: days === 3 ? "Martes" : "Lunes",
      session_type: "easy_run",
      title: isRecoveryWeek ? "Rodaje suave de descarga" : "Rodaje suave",
      objective: isRecoveryWeek
        ? "Bajar carga para absorber el entrenamiento previo sin perder continuidad."
        : "Construir base aeróbica y mantener constancia sin fatiga excesiva.",
      distance_target: easyRun,
      duration_target: estimateMinutes(easyRun, "easy_run"),
      intensity_zone: "Z2",
      warmup_text: "10 min trote suave + movilidad articular",
      main_set_text: `Rodaje cómodo por ${easyRun} km. Mantén sensación conversacional y técnica relajada.`,
      cooldown_text: "5 min trote muy suave + movilidad ligera",
      estimated_load: Math.round(estimateMinutes(easyRun, "easy_run") * 0.9),
      status: "planned",
    })
  );

  sessions.push(
    makeSession({
      day_of_week: days === 3 ? "Jueves" : "Miércoles",
      session_type: input.goal === "Mejorar tiempo" ? "quality" : "tempo",
      title: input.goal === "Mejorar tiempo" ? "Calidad controlada" : "Ritmo controlado",
      objective: input.goal === "Mejorar tiempo"
        ? "Mejorar velocidad controlada sin comprometer la recuperación."
        : "Mejorar economía de carrera y control del esfuerzo.",
      distance_target: input.goal === "Mejorar tiempo" ? qualityRun : tempoRun,
      duration_target: estimateMinutes(
        input.goal === "Mejorar tiempo" ? qualityRun : tempoRun,
        input.goal === "Mejorar tiempo" ? "quality" : "tempo"
      ),
      intensity_zone: input.goal === "Mejorar tiempo" ? "Z3-Z4" : "Z3",
      warmup_text: "12 min trote + movilidad + 4 progresiones suaves",
      main_set_text:
        input.goal === "Mejorar tiempo"
          ? buildQualityMainSet(distanceKm, weekNumber, qualityRun, input.goal)
          : buildTempoMainSet(distanceKm, weekNumber, tempoRun),
      cooldown_text: "8 min trote suave + respiración",
      estimated_load: Math.round(
        estimateMinutes(input.goal === "Mejorar tiempo" ? qualityRun : tempoRun, "quality") * 1.15
      ),
      status: "planned",
    })
  );

  if (days >= 4) {
    sessions.push(
      makeSession({
        day_of_week: "Viernes",
        session_type: "recovery",
        title: "Rodaje de recuperación",
        objective: "Promover recuperación activa y llegar fresco a la tirada larga.",
        distance_target: recoveryRun,
        duration_target: estimateMinutes(recoveryRun, "recovery"),
        intensity_zone: "Z1-Z2",
        warmup_text: "8 min trote suave",
        main_set_text: `Rodaje regenerativo por ${recoveryRun} km. Debe sentirse fácil de principio a fin.`,
        cooldown_text: "Movilidad ligera de cadera, tobillos y pantorrilla",
        estimated_load: Math.round(estimateMinutes(recoveryRun, "recovery") * 0.75),
        status: "planned",
      })
    );
  }

  if (days >= 5) {
    const addStrength = weekNumber % 2 === 0;
    sessions.push(
      makeSession({
        day_of_week: "Jueves",
        session_type: addStrength ? "strength_mobility" : "tempo",
        title: addStrength ? "Fuerza y movilidad" : "Ritmo progresivo",
        objective: addStrength
          ? "Fortalecer core, glúteos, pantorrilla y estabilidad para tolerar mejor la carga."
          : "Sumar trabajo específico sin convertirlo en una sesión máxima.",
        distance_target: addStrength ? null : tempoRun,
        duration_target: addStrength ? 30 : estimateMinutes(tempoRun, "tempo"),
        intensity_zone: addStrength ? "Complementario" : "Z2-Z3",
        warmup_text: addStrength ? "5 min movilidad general" : "10 min trote suave",
        main_set_text: addStrength
          ? "Core, puente de glúteo, sentadilla controlada, pantorrilla, estabilidad de tobillo y movilidad de cadera"
          : buildTempoMainSet(distanceKm, weekNumber, tempoRun),
        cooldown_text: "Movilidad suave y respiración",
        estimated_load: addStrength ? 24 : Math.round(estimateMinutes(tempoRun, "tempo") * 1.05),
        status: "planned",
      })
    );
  }

  if (days >= 6) {
    sessions.push(
      makeSession({
        day_of_week: "Sábado",
        session_type: "easy_run",
        title: "Rodaje corto opcional",
        objective: "Sumar volumen ligero sin afectar la tirada larga.",
        distance_target: optionalRun,
        duration_target: estimateMinutes(optionalRun, "easy_run"),
        intensity_zone: "Z1-Z2",
        warmup_text: "8 min trote suave",
        main_set_text: `Rodaje muy cómodo por ${optionalRun} km. Si hay fatiga, sustituye por movilidad.`,
        cooldown_text: "5 min movilidad ligera",
        estimated_load: Math.round(estimateMinutes(optionalRun, "easy_run") * 0.8),
        status: "planned",
      })
    );
  }

  sessions.push(
    makeSession({
      day_of_week: "Domingo",
      session_type: "long_run",
      title: isTaperWeek ? "Tirada larga reducida" : "Tirada larga",
      objective: distanceKm >= 21
        ? "Desarrollar resistencia específica y confianza para la distancia objetivo."
        : "Fortalecer resistencia general y control de esfuerzo.",
      distance_target: longRun,
      duration_target: estimateMinutes(longRun, "long_run"),
      intensity_zone: isTaperWeek ? "Z1-Z2" : "Z2",
      warmup_text: "12 min trote muy suave",
      main_set_text: isTaperWeek
        ? `Tirada reducida por ${longRun} km. Prioriza frescura y buena sensación.`
        : `Tirada larga por ${longRun} km. Mantén esfuerzo cómodo; últimas semanas pueden incluir cierre progresivo suave.`,
      cooldown_text: "Caminata ligera + movilidad y recuperación",
      estimated_load: Math.round(estimateMinutes(longRun, "long_run") * (isTaperWeek ? 0.95 : 1.2)),
      status: "planned",
    })
  );

  const selectedSessions = sessions.slice(0, days);

  return selectedSessions.map((session, index) =>
    applyWorkoutLibraryReference(
      session,
      input,
      workoutLibrary,
      index,
      weekNumber,
      days
    )
  );
}

function buildPlanStructure(
  input: AthleteProfileInput,
  workoutLibrary: WorkoutLibraryItem[] = []
) {
  const isRecoveryConditionPlan = isRecoverFitnessGoal(input.goal);
  const distanceKm = isRecoveryConditionPlan
    ? 0
    : normalizeDistance(input.distance);
  const totalWeeks = isRecoveryConditionPlan
    ? getRecoverFitnessWeeks()
    : determinePlanWeeks(distanceKm, input.eventDate);

  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekNumber = index + 1;
    const phase = getWeekPhase(weekNumber, totalWeeks);
    const sessions = buildSessionsForWeek(input, weekNumber, totalWeeks, workoutLibrary);
    const totalTargetDistance = roundToHalf(
      sessions.reduce(
        (sum, session) => sum + Number(session.distance_target || 0),
        0
      )
    );
    const recovery = weekNumber % 4 === 0 && weekNumber < totalWeeks - 1;

    return {
      week_number: weekNumber,
      focus_label: isRecoveryConditionPlan
        ? weekNumber === totalWeeks
          ? "Consolidación de condición"
          : recovery
          ? "Descarga activa para recuperar condición"
          : `${phase} - Recuperar condición`
        : weekNumber === totalWeeks
        ? "Semana de carrera / ajuste final"
        : recovery
        ? `Descarga activa ${distanceLabel(distanceKm)}`
        : `${phase} ${distanceLabel(distanceKm)}`,
      total_target_distance: totalTargetDistance,
      notes: isRecoveryConditionPlan
        ? weekNumber === totalWeeks
          ? "Semana para consolidar condición: mantén esfuerzos cómodos y evalúa sensaciones antes de aumentar objetivo."
          : recovery
          ? "Semana de descarga: baja fatiga y conserva continuidad."
          : "Plan de recuperación de condición: prioriza constancia, técnica y esfuerzo conversacional."
        : weekNumber === totalWeeks
        ? "Reduce la carga, cuida descanso e hidratación. Prioriza llegar fresco."
        : recovery
        ? "Semana de descarga: el objetivo es recuperar, no acumular fatiga."
        : "Carga progresiva: respeta zonas de esfuerzo y evita correr todos los días fuerte.",
      sessions,
    };
  });
}

// TRAININGAPP_ADAPTIVE_SUNDAY_ENGINE_V1
// Motor determinístico: decide carga y ritmos con datos reales.
// Cloudflare AI se conserva para explicar el análisis semanal, no para decidir la carga.
type AdaptiveWeekAction = "increase" | "maintain" | "reduce";

type AdaptiveWeekMetrics = {
  plannedSessions: number;
  completedSessions: number;
  missedSessions: number;
  completionRate: number;
  plannedDistanceKm: number;
  actualDistanceKm: number;
  distanceCompletionRate: number;
  recentMedianPaceSecondsPerKm: number | null;
  averageEffortScore: number | null;
  fatigueScore: number;
  sorenessScore: number;
  sleepQualityScore: number;
  hasProgressData: boolean;
};

type AdaptiveWeekDecision = {
  action: AdaptiveWeekAction;
  riskLevel: "low" | "medium" | "high";
  volumeFactor: number;
  paceDeltaSeconds: number;
  reason: string;
};

type AdaptivePlanRow = {
  id: string;
  user_id: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type AdaptiveWeekRow = {
  id: string;
  week_number: number;
  focus_label: string | null;
  total_target_distance: number | null;
  notes: string | null;
};

type AdaptiveSessionRow = SessionSeed & {
  id: string;
  training_week_id: string;
};

function getAdaptiveMonterreyParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function adaptivePartsToUtcDate(parts: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}) {
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour || 0,
      parts.minute || 0,
      parts.second || 0
    )
  );
}

function getAdaptiveMonday(date: Date) {
  const result = new Date(date);
  const weekDay = result.getUTCDay();
  const daysFromMonday = weekDay === 0 ? 6 : weekDay - 1;
  result.setUTCDate(result.getUTCDate() - daysFromMonday);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function getAdaptivePlanStartMonday(plan: AdaptivePlanRow) {
  const rawDate = plan.start_date || plan.created_at;

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(rawDate || ""))) {
    const [year, month, day] = String(rawDate).split("-").map(Number);
    return getAdaptiveMonday(new Date(Date.UTC(year, month - 1, day)));
  }

  const parsed = new Date(rawDate || plan.created_at);
  if (Number.isNaN(parsed.getTime())) return getAdaptiveMonday(new Date());

  const parts = getAdaptiveMonterreyParts(parsed);
  return getAdaptiveMonday(adaptivePartsToUtcDate(parts));
}

function getAdaptiveTargetMonday(scheduledAt: Date) {
  const parts = getAdaptiveMonterreyParts(scheduledAt);
  const localDate = adaptivePartsToUtcDate(parts);

  // El cron corre el domingo a las 22:00 de Monterrey.
  // Desde ese momento se prepara la semana que inicia el lunes siguiente.
  if (localDate.getUTCDay() === 0 && parts.hour >= 22) {
    localDate.setUTCDate(localDate.getUTCDate() + 1);
  }

  return getAdaptiveMonday(localDate);
}

function getAdaptiveTargetWeekNumber(
  plan: AdaptivePlanRow,
  scheduledAt: Date,
  maximumWeek: number
) {
  const planStart = getAdaptivePlanStartMonday(plan);
  const targetMonday = getAdaptiveTargetMonday(scheduledAt);
  const elapsed = targetMonday.getTime() - planStart.getTime();
  const weekNumber = Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.min(Math.max(weekNumber, 1), maximumWeek + 1);
}

function averageAdaptive(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getAdaptiveDecision(
  metrics: AdaptiveWeekMetrics,
  targetWeekNumber: number,
  maximumWeek: number
): AdaptiveWeekDecision {
  const poorSleep =
    metrics.sleepQualityScore > 0 && metrics.sleepQualityScore <= 2;
  const highRecoveryRisk =
    metrics.fatigueScore >= 4 ||
    metrics.sorenessScore >= 4 ||
    poorSleep ||
    Number(metrics.averageEffortScore || 0) >= 8.5;

  const isRecoveryWeek =
    targetWeekNumber % 4 === 0 && targetWeekNumber < maximumWeek - 1;
  const isTaperOrFinal = targetWeekNumber >= maximumWeek - 1;

  if (!metrics.hasProgressData) {
    return {
      action: "maintain",
      riskLevel: "medium",
      volumeFactor: 1,
      paceDeltaSeconds: 5,
      reason:
        "No hubo registros suficientes de la semana anterior; se conserva la carga y se mantiene un ritmo prudente.",
    };
  }

  if (highRecoveryRisk) {
    return {
      action: "reduce",
      riskLevel: "high",
      volumeFactor: 0.8,
      paceDeltaSeconds: 15,
      reason:
        "Se detectaron señales de fatiga, molestias, recuperación limitada o esfuerzo excesivo; se reduce la carga y se elimina intensidad innecesaria.",
    };
  }

  if (
    metrics.completionRate < 0.5 ||
    metrics.distanceCompletionRate < 0.55
  ) {
    return {
      action: "reduce",
      riskLevel: "medium",
      volumeFactor: 0.85,
      paceDeltaSeconds: 10,
      reason:
        "La adherencia o la distancia completada fue baja; se reduce moderadamente la carga para recuperar continuidad.",
    };
  }

  const goodAdherence =
    metrics.completionRate >= 0.85 &&
    metrics.distanceCompletionRate >= 0.85;
  const controlledEffort =
    metrics.averageEffortScore === null || metrics.averageEffortScore <= 6.5;
  const recovered =
    metrics.fatigueScore <= 2 &&
    metrics.sorenessScore <= 2 &&
    !poorSleep;

  if (
    goodAdherence &&
    controlledEffort &&
    recovered &&
    !isRecoveryWeek &&
    !isTaperOrFinal
  ) {
    return {
      action: "increase",
      riskLevel: "low",
      volumeFactor: 1.05,
      paceDeltaSeconds: -5,
      reason:
        "La semana se completó con buena adherencia y esfuerzo controlado; se aplica una progresión conservadora.",
    };
  }

  return {
    action: "maintain",
    riskLevel: goodAdherence ? "low" : "medium",
    volumeFactor: 1,
    paceDeltaSeconds: metrics.completionRate < 0.75 ? 5 : 0,
    reason: isRecoveryWeek
      ? "La semana programada es de descarga; se conserva su estructura para facilitar la recuperación."
      : isTaperOrFinal
      ? "El plan está en fase final; se evita aumentar la carga y se conserva la estructura prevista."
      : "La respuesta al entrenamiento fue estable; se mantiene la carga prevista para consolidar adaptación.",
  };
}

function stripAdaptivePrescription(text: string) {
  return stripInternalWorkoutReferences(String(text || ""))
    .replace(
      /\s*Ritmo recomendado:\s*\d+:\d{2}\s*[–-]\s*\d+:\d{2}\s*min\/km\./gi,
      ""
    )
    .replace(
      /\s*Esfuerzo:\s*RPE\s*.*?·\s*Dificultad:\s*.*?\./gi,
      ""
    )
    .replace(/\s*Sensación esperada:\s*.*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function replaceAdaptiveDistance(
  text: string,
  previousDistance: number,
  nextDistance: number
) {
  if (!text || !previousDistance || previousDistance === nextDistance) return text;

  const next = String(nextDistance);
  return text
    .replace(
      /Distancia asignada:\s*\d+(?:\.\d+)?\s*km\s*objetivo\.?/gi,
      `Distancia asignada: ${next} km objetivo.`
    )
    .replace(/por\s+\d+(?:\.\d+)?\s*km/gi, `por ${next} km`)
    .replace(/dentro de\s+\d+(?:\.\d+)?\s*km/gi, `dentro de ${next} km`)
    .replace(/\d+(?:\.\d+)?\s*km\s*totales/gi, `${next} km totales`);
}

function buildAdaptiveRunningInstruction(
  session: AdaptiveSessionRow,
  distanceKm: number,
  convertedToEasy: boolean
) {
  const type = String(session.session_type || "").toLowerCase();

  if (convertedToEasy) {
    return `Rodaje aeróbico controlado por ${distanceKm} km. Mantén esfuerzo conversacional y termina con sensación de reserva.`;
  }

  if (type.includes("recovery")) {
    return `Rodaje regenerativo por ${distanceKm} km. Debe sentirse fácil de principio a fin.`;
  }

  if (type.includes("long")) {
    return `Tirada larga por ${distanceKm} km. Mantén esfuerzo cómodo y evita perseguir velocidad al final.`;
  }

  if (type.includes("easy")) {
    return `Rodaje cómodo por ${distanceKm} km. Mantén respiración controlada y técnica relajada.`;
  }

  const clean = stripAdaptivePrescription(session.main_set_text);
  return replaceAdaptiveDistance(
    clean,
    Number(session.distance_target || 0),
    distanceKm
  );
}

function adaptTrainingSession(
  session: AdaptiveSessionRow,
  decision: AdaptiveWeekDecision,
  paceContext: PaceEngineContext,
  targetWeekNumber: number,
  maximumWeek: number
) {
  const previousDistance = Number(session.distance_target || 0);
  const originalType = String(session.session_type || "").toLowerCase();
  const hasRunningDistance = previousDistance > 0;
  const highIntensity =
    originalType.includes("quality") ||
    originalType.includes("tempo") ||
    originalType.includes("interval") ||
    originalType.includes("fartlek") ||
    originalType.includes("threshold") ||
    originalType.includes("progress");
  const convertedToEasy = decision.action === "reduce" && highIntensity;

  if (!hasRunningDistance) {
    return {
      ...session,
      changed: false,
    };
  }

  let sessionFactor = decision.volumeFactor;
  if (decision.action === "increase" && highIntensity) sessionFactor = 1;
  if (decision.action === "increase" && originalType.includes("recovery")) {
    sessionFactor = 1;
  }

  const nextDistance = roundToHalf(
    clamp(previousDistance * sessionFactor, 3, previousDistance * 1.08)
  );
  const nextType = convertedToEasy ? "easy_run" : session.session_type;
  const nextTitle = convertedToEasy
    ? "Rodaje aeróbico controlado"
    : session.title;
  const nextObjective = convertedToEasy
    ? "Reducir fatiga y mantener continuidad sin añadir intensidad."
    : session.objective;
  const nextZone = convertedToEasy ? "Z2" : session.intensity_zone;
  const nextDuration = estimateMinutes(nextDistance, nextType);
  const previousLoad = Number(session.estimated_load || 0);
  const loadRatio = previousDistance > 0 ? nextDistance / previousDistance : 1;
  const nextLoad = Math.max(
    1,
    Math.round(previousLoad * loadRatio * (convertedToEasy ? 0.82 : 1))
  );

  const adaptedSeed: SessionSeed = {
    ...session,
    session_type: nextType,
    title: nextTitle,
    objective: nextObjective,
    distance_target: nextDistance,
    duration_target: nextDuration,
    intensity_zone: nextZone,
    estimated_load: nextLoad,
  };

  const prescription = getSessionPacePrescription(
    adaptedSeed,
    targetWeekNumber,
    maximumWeek,
    paceContext
  );

  const instruction = buildAdaptiveRunningInstruction(
    session,
    nextDistance,
    convertedToEasy
  );
  const paceText = `Ritmo recomendado: ${formatPace(
    prescription.minSeconds
  )}–${formatPace(prescription.maxSeconds)} min/km.`;
  const effortText = `Esfuerzo: RPE ${prescription.rpe} · Dificultad: ${prescription.difficulty}.`;
  const feelingText = `Sensación esperada: ${prescription.feeling}`;

  return {
    ...session,
    session_type: nextType,
    title: nextTitle,
    objective: nextObjective,
    distance_target: nextDistance,
    duration_target: nextDuration,
    intensity_zone: nextZone,
    main_set_text: [instruction, paceText, effortText, feelingText]
      .filter(Boolean)
      .join(" "),
    estimated_load: nextLoad,
    changed: true,
  };
}

async function getAdaptiveWeekMetrics(
  db: D1Database,
  userId: string,
  planId: string,
  sourceWeek: AdaptiveWeekRow
): Promise<AdaptiveWeekMetrics> {
  const sessionsResult = await db
    .prepare(
      `select id, distance_target
       from training_sessions
       where training_week_id = ?1
       order by rowid asc`
    )
    .bind(sourceWeek.id)
    .all<any>();

  const sessions = sessionsResult.results || [];
  const progressResult = await db
    .prepare(
      `select session_index, is_completed, actual_distance_km,
              actual_pace_seconds_per_km, effort_score, source
       from training_session_progress
       where user_id = ?1
         and week_number = ?2
         and (training_plan_id = ?3 or training_plan_id is null)
       order by session_index asc`
    )
    .bind(userId, sourceWeek.week_number, planId)
    .all<any>();

  const progress = progressResult.results || [];
  const completedRows = progress.filter(
    (row: any) => Number(row.is_completed) === 1
  );
  const plannedSessions = sessions.length;
  const completedSessions = completedRows.length;
  const missedSessions = Math.max(0, plannedSessions - completedSessions);
  const completionRate = plannedSessions
    ? completedSessions / plannedSessions
    : 0;
  const plannedDistanceKm = sessions.reduce(
    (sum: number, session: any) => sum + Number(session.distance_target || 0),
    0
  );

  const actualDistanceKm = completedRows.reduce((sum: number, row: any) => {
    const actual = Number(row.actual_distance_km || 0);
    if (actual > 0) return sum + actual;

    const session = sessions[Number(row.session_index || 0)];
    return sum + Number(session?.distance_target || 0);
  }, 0);

  const distanceCompletionRate = plannedDistanceKm
    ? clamp(actualDistanceKm / plannedDistanceKm, 0, 1.25)
    : completionRate;
  const paces = completedRows
    .map((row: any) => Number(row.actual_pace_seconds_per_km || 0))
    .filter((pace: number) => pace >= 210 && pace <= 720);
  const efforts = completedRows
    .map((row: any) => Number(row.effort_score || 0))
    .filter((effort: number) => effort >= 1 && effort <= 10);

  let checkin: any = null;
  try {
    checkin = await db
      .prepare(
        `select fatigue_score, soreness_score, sleep_quality_score
         from weekly_checkins
         where user_id = ?1
           and week_number = ?2
           and (training_plan_id = ?3 or training_plan_id is null)
         order by created_at desc
         limit 1`
      )
      .bind(userId, sourceWeek.week_number, planId)
      .first<any>();
  } catch {
    checkin = null;
  }

  return {
    plannedSessions,
    completedSessions,
    missedSessions,
    completionRate,
    plannedDistanceKm: roundToHalf(plannedDistanceKm),
    actualDistanceKm: roundToHalf(actualDistanceKm),
    distanceCompletionRate,
    recentMedianPaceSecondsPerKm: median(paces),
    averageEffortScore: averageAdaptive(efforts),
    fatigueScore: Number(checkin?.fatigue_score || 0),
    sorenessScore: Number(checkin?.soreness_score || 0),
    sleepQualityScore: Number(checkin?.sleep_quality_score || 0),
    hasProgressData: progress.length > 0 || Boolean(checkin),
  };
}

async function applyAdaptiveWeekForPlan(
  env: Bindings,
  plan: AdaptivePlanRow,
  scheduledAt: Date
) {
  const access = await getEffectiveAccess(env.DB, plan.user_id);
  if (
    access.status !== "active" ||
    !["performance", "pro_coach"].includes(String(access.planCode || ""))
  ) {
    return { status: "skipped", reason: "access_not_eligible" };
  }

  const maximumResult = await env.DB
    .prepare(
      `select max(week_number) as maximum_week
       from training_weeks
       where training_plan_id = ?1`
    )
    .bind(plan.id)
    .first<{ maximum_week: number | null }>();

  const maximumWeek = Number(maximumResult?.maximum_week || 0);
  if (!maximumWeek) return { status: "skipped", reason: "plan_without_weeks" };

  const targetWeekNumber = getAdaptiveTargetWeekNumber(
    plan,
    scheduledAt,
    maximumWeek
  );
  const sourceWeekNumber = targetWeekNumber - 1;

  if (targetWeekNumber > maximumWeek) {
    return { status: "skipped", reason: "plan_finished" };
  }
  if (sourceWeekNumber < 1) {
    return { status: "skipped", reason: "first_week_has_no_history" };
  }

  const previousAdjustment = await env.DB
    .prepare(
      `select id
       from adaptive_week_adjustments
       where training_plan_id = ?1
         and target_week_number = ?2
       limit 1`
    )
    .bind(plan.id, targetWeekNumber)
    .first<{ id: string }>();

  if (previousAdjustment?.id) {
    return { status: "skipped", reason: "already_adjusted" };
  }

  const targetProgress = await env.DB
    .prepare(
      `select count(*) as total
       from training_session_progress
       where user_id = ?1
         and week_number = ?2
         and (training_plan_id = ?3 or training_plan_id is null)`
    )
    .bind(plan.user_id, targetWeekNumber, plan.id)
    .first<{ total: number }>();

  if (Number(targetProgress?.total || 0) > 0) {
    return { status: "skipped", reason: "target_week_already_started" };
  }

  const weeksResult = await env.DB
    .prepare(
      `select id, week_number, focus_label, total_target_distance, notes
       from training_weeks
       where training_plan_id = ?1
         and week_number in (?2, ?3)
       order by week_number asc`
    )
    .bind(plan.id, sourceWeekNumber, targetWeekNumber)
    .all<AdaptiveWeekRow>();

  const weekRows = weeksResult.results || [];
  const sourceWeek = weekRows.find(
    (week) => Number(week.week_number) === sourceWeekNumber
  );
  const targetWeek = weekRows.find(
    (week) => Number(week.week_number) === targetWeekNumber
  );

  if (!sourceWeek || !targetWeek) {
    return { status: "skipped", reason: "source_or_target_week_missing" };
  }

  const metrics = await getAdaptiveWeekMetrics(
    env.DB,
    plan.user_id,
    plan.id,
    sourceWeek
  );
  const decision = getAdaptiveDecision(
    metrics,
    targetWeekNumber,
    maximumWeek
  );

  const sessionsResult = await env.DB
    .prepare(
      `select id, training_week_id, day_of_week, session_type, title, objective,
              distance_target, duration_target, intensity_zone,
              warmup_text, main_set_text, cooldown_text,
              estimated_load, status
       from training_sessions
       where training_week_id = ?1
       order by rowid asc`
    )
    .bind(targetWeek.id)
    .all<AdaptiveSessionRow>();

  const profile = await env.DB
    .prepare(
      `select experience_level, current_weekly_volume
       from athlete_profiles
       where user_id = ?1
       limit 1`
    )
    .bind(plan.user_id)
    .first<any>();

  const levelBaseline = getLevelBaselinePace(
    String(profile?.experience_level || "Intermedio"),
    Number(profile?.current_weekly_volume || 0)
  );
  const historyPace = metrics.recentMedianPaceSecondsPerKm;
  const baselineSecondsPerKm = historyPace
    ? clampPace(historyPace * 0.72 + levelBaseline * 0.28)
    : levelBaseline;

  const paceContext: PaceEngineContext = {
    baselineSecondsPerKm,
    recentMedianSecondsPerKm: historyPace,
    completedSessions: metrics.completedSessions,
    missedSessions: metrics.missedSessions,
    completionRate: metrics.completionRate,
    fatigueScore: metrics.fatigueScore,
    sorenessScore: metrics.sorenessScore,
    sleepQualityScore: metrics.sleepQualityScore,
    aiDeltaSeconds: decision.paceDeltaSeconds,
    aiReason: decision.reason,
    source: historyPace ? "history_rules" : "level_rules",
  };

  const adaptedSessions = (sessionsResult.results || []).map((session) =>
    adaptTrainingSession(
      session,
      decision,
      paceContext,
      targetWeekNumber,
      maximumWeek
    )
  );
  const totalTargetDistance = roundToHalf(
    adaptedSessions.reduce(
      (sum, session) => sum + Number(session.distance_target || 0),
      0
    )
  );
  const now = new Date().toISOString();
  const actionLabel =
    decision.action === "increase"
      ? "progresión conservadora"
      : decision.action === "reduce"
      ? "reducción de carga"
      : "carga mantenida";
  const originalNotes = String(targetWeek.notes || "").trim();
  const adaptiveNote = `Ajuste automático del domingo: ${actionLabel}. ${decision.reason}`;
  const nextNotes = [originalNotes, adaptiveNote].filter(Boolean).join(" ");

  const statements = adaptedSessions
    .filter((session) => session.changed)
    .map((session) =>
      env.DB
        .prepare(
          `update training_sessions
           set session_type = ?1,
               title = ?2,
               objective = ?3,
               distance_target = ?4,
               duration_target = ?5,
               intensity_zone = ?6,
               main_set_text = ?7,
               estimated_load = ?8
           where id = ?9`
        )
        .bind(
          session.session_type,
          session.title,
          session.objective,
          session.distance_target,
          session.duration_target,
          session.intensity_zone,
          session.main_set_text,
          session.estimated_load,
          session.id
        )
    );

  statements.push(
    env.DB
      .prepare(
        `update training_weeks
         set total_target_distance = ?1,
             notes = ?2
         where id = ?3`
      )
      .bind(totalTargetDistance, nextNotes, targetWeek.id)
  );

  statements.push(
    env.DB
      .prepare(
        `insert or ignore into adaptive_week_adjustments (
          id, training_plan_id, user_id, source_week_number,
          target_week_number, status, action, risk_level,
          volume_factor, pace_delta_seconds, completion_rate,
          distance_completion_rate, planned_distance_km,
          actual_distance_km, average_pace_seconds_per_km,
          average_effort_score, fatigue_score, soreness_score,
          sleep_quality_score, reason, source, scheduled_for,
          applied_at, created_at
        ) values (
          ?1, ?2, ?3, ?4, ?5, 'applied', ?6, ?7,
          ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
          ?16, ?17, ?18, ?19, 'rules-v1', ?20, ?21, ?22
        )`
      )
      .bind(
        crypto.randomUUID(),
        plan.id,
        plan.user_id,
        sourceWeekNumber,
        targetWeekNumber,
        decision.action,
        decision.riskLevel,
        decision.volumeFactor,
        decision.paceDeltaSeconds,
        metrics.completionRate,
        metrics.distanceCompletionRate,
        metrics.plannedDistanceKm,
        metrics.actualDistanceKm,
        metrics.recentMedianPaceSecondsPerKm,
        metrics.averageEffortScore,
        metrics.fatigueScore,
        metrics.sorenessScore,
        metrics.sleepQualityScore,
        decision.reason,
        scheduledAt.toISOString(),
        now,
        now
      )
  );

  await env.DB.batch(statements);

  return {
    status: "applied",
    planId: plan.id,
    userId: plan.user_id,
    sourceWeekNumber,
    targetWeekNumber,
    action: decision.action,
    totalTargetDistance,
  };
}

async function runAdaptiveSundayEngine(env: Bindings, scheduledAt: Date) {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  await env.DB
    .prepare(
      `insert into adaptive_engine_runs (
        id, scheduled_at, started_at, status,
        plans_seen, applied_count, skipped_count, error_count
      ) values (?1, ?2, ?3, 'running', 0, 0, 0, 0)`
    )
    .bind(runId, scheduledAt.toISOString(), startedAt)
    .run();

  const plansResult = await env.DB
    .prepare(
      `select tp.id, tp.user_id, tp.start_date, tp.end_date, tp.created_at
       from training_plans tp
       where tp.status = 'active'
         and tp.created_at = (
           select max(tp2.created_at)
           from training_plans tp2
           where tp2.user_id = tp.user_id
         )
       order by tp.created_at asc`
    )
    .all<AdaptivePlanRow>();

  const plans = plansResult.results || [];
  let appliedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const results: any[] = [];

  for (const plan of plans) {
    try {
      const result = await applyAdaptiveWeekForPlan(env, plan, scheduledAt);
      results.push(result);
      if (result.status === "applied") appliedCount += 1;
      else skippedCount += 1;
    } catch (error) {
      errorCount += 1;
      results.push({
        status: "error",
        planId: plan.id,
        userId: plan.user_id,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("Adaptive Sunday Engine plan error", plan.id, error);
    }
  }

  const completedAt = new Date().toISOString();
  await env.DB
    .prepare(
      `update adaptive_engine_runs
       set completed_at = ?1,
           status = ?2,
           plans_seen = ?3,
           applied_count = ?4,
           skipped_count = ?5,
           error_count = ?6,
           result_json = ?7
       where id = ?8`
    )
    .bind(
      completedAt,
      errorCount > 0 ? "completed_with_errors" : "completed",
      plans.length,
      appliedCount,
      skippedCount,
      errorCount,
      JSON.stringify(results).slice(0, 50000),
      runId
    )
    .run();

  return {
    runId,
    plansSeen: plans.length,
    appliedCount,
    skippedCount,
    errorCount,
  };
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


type TrialRow = {
  id: string;
  user_id: string;
  campaign_id: string;
  plan_code: string;
  status: string;
  started_at: string;
  expires_at: string;
  converted_at?: string | null;
  expired_at?: string | null;
};

async function getUserTrial(db: D1Database, userId: string) {
  const trial = await db
    .prepare(
      `select id, user_id, campaign_id, plan_code, status, started_at, expires_at,
              converted_at, expired_at
       from user_trials
       where user_id = ?1
       limit 1`
    )
    .bind(userId)
    .first<TrialRow>();

  if (!trial) return null;

  if (
    trial.status === "active" &&
    new Date(trial.expires_at).getTime() <= Date.now()
  ) {
    const now = new Date().toISOString();
    await db
      .prepare(
        `update user_trials
         set status = 'expired', expired_at = coalesce(expired_at, ?1), updated_at = ?2
         where id = ?3 and status = 'active'`
      )
      .bind(now, now, trial.id)
      .run();

    return {
      ...trial,
      status: "expired",
      expired_at: trial.expired_at || now,
    };
  }

  return trial;
}

async function getEffectiveAccess(db: D1Database, userId: string) {
  const membership = await getLatestMembership(db, userId);

  if (membership?.status === "active") {
    return {
      source: "membership" as const,
      planCode: membership.plan_code || null,
      status: "active",
      membership,
      trial: await getUserTrial(db, userId),
    };
  }

  const trial = await getUserTrial(db, userId);
  if (trial?.status === "active") {
    return {
      source: "trial" as const,
      planCode: trial.plan_code || "performance",
      status: "active",
      membership: null,
      trial,
    };
  }

  return {
    source: "none" as const,
    planCode: null,
    status: "inactive",
    membership: membership || null,
    trial,
  };
}

async function markTrialConverted(db: D1Database, userId: string) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `update user_trials
       set status = 'converted', converted_at = coalesce(converted_at, ?1), updated_at = ?2
       where user_id = ?3 and status in ('active', 'expired')`
    )
    .bind(now, now, userId)
    .run();
}

async function refreshUserEntitlements(db: D1Database, userId: string) {
  const access = await getEffectiveAccess(db, userId);

  const values = getEntitlementsFromPlan(
    access.planCode,
    access.status
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
  const access = await getEffectiveAccess(db, userId);
  return access.status === "active";
}

async function validateDistanceForMembership(
  db: D1Database,
  userId: string,
  distance: string
) {
  const access = await getEffectiveAccess(db, userId);
  const planCode = access.planCode;
  const active = access.status === "active";

  if (!active) {
    return {
      ok: false,
      message: access.trial?.status === "expired"
        ? "Tu prueba gratuita terminó. Suscríbete a Performance para continuar."
        : "Se requiere una membresía activa para generar el plan.",
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

async function isUxFeedbackUser(db: D1Database, userId: string) {
  const row = await db
    .prepare(
      `select id
       from memberships
       where user_id = ?1
         and provider = 'manual'
         and external_reference = 'ux-feedback'
         and plan_code = 'pro_coach'
         and status = 'active'
       limit 1`
    )
    .bind(userId)
    .first<{ id: string }>();

  return Boolean(row?.id);
}

async function validatePlanChangeAllowance(db: D1Database, userId: string) {
  const uxUser = await isUxFeedbackUser(db, userId);

  if (uxUser) {
    return {
      ok: true,
      isUxUser: true,
      message: "Usuario UX sin límite de cambios.",
    };
  }

  const existingPlans = await db
    .prepare(
      `select count(*) as total
       from training_plans
       where user_id = ?1`
    )
    .bind(userId)
    .first<{ total: number }>();

  const totalPlans = Number(existingPlans?.total || 0);

  if (totalPlans === 0) {
    return {
      ok: true,
      isUxUser: false,
      message: "Primer plan permitido.",
    };
  }

  const limit = await db
    .prepare(
      `select change_count, max_changes_allowed
       from plan_change_limits
       where user_id = ?1
       limit 1`
    )
    .bind(userId)
    .first<{
      change_count: number;
      max_changes_allowed: number;
    }>();

  const changeCount = Number(limit?.change_count || 0);
  const maxAllowed = Number(limit?.max_changes_allowed || 1);

  if (changeCount >= maxAllowed) {
    return {
      ok: false,
      isUxUser: false,
      message:
        "Ya usaste el cambio disponible de plan. Para modificarlo nuevamente, contacta soporte.",
    };
  }

  return {
    ok: true,
    isUxUser: false,
    message: "Cambio de plan permitido.",
  };
}

async function registerPlanChangeUsage(db: D1Database, userId: string) {
  const uxUser = await isUxFeedbackUser(db, userId);

  if (uxUser) return;

  const now = new Date().toISOString();

  const existingPlans = await db
    .prepare(
      `select count(*) as total
       from training_plans
       where user_id = ?1`
    )
    .bind(userId)
    .first<{ total: number }>();

  const totalPlans = Number(existingPlans?.total || 0);

  const existingLimit = await db
    .prepare(
      `select id, change_count
       from plan_change_limits
       where user_id = ?1
       limit 1`
    )
    .bind(userId)
    .first<{ id: string; change_count: number }>();

  if (!existingLimit?.id) {
    await db
      .prepare(
        `insert into plan_change_limits (
          id, user_id, initial_plan_created_at, change_count,
          max_changes_allowed, updated_at
        ) values (?1, ?2, ?3, ?4, 1, ?5)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        now,
        totalPlans > 0 ? 1 : 0,
        now
      )
      .run();

    return;
  }

  if (totalPlans > 0) {
    await db
      .prepare(
        `update plan_change_limits
         set change_count = change_count + 1,
             updated_at = ?1
         where user_id = ?2`
      )
      .bind(now, userId)
      .run();
  }
}



async function refreshExistingPlanFromCurrentWeek(
  db: D1Database,
  userId: string,
  input: AthleteProfileInput,
  aiEnv?: Pick<
    Bindings,
    "OPENAI_API_KEY" | "OPENAI_MODEL" | "AI_ENABLED"
  >
) {
  /*
   * IMPORTANTE:
   * se recupera el plan actual.
   * NO se crea un training_plan nuevo.
   */
  const plan = await db
    .prepare(
      `select
         id,
         start_date,
         end_date,
         version,
         created_at
       from training_plans
       where user_id = ?1
       order by created_at desc
       limit 1`
    )
    .bind(userId)
    .first<any>();

  if (!plan?.id) {
    return {
      updated: false,
      reason: "no_existing_plan",
      currentWeekNumber: 1,
    };
  }

  /*
   * Obtener semanas actualmente existentes.
   */
  const weeksResult = await db
    .prepare(
      `select
         id,
         week_number,
         focus_label,
         total_target_distance,
         notes
       from training_weeks
       where training_plan_id = ?1
       order by week_number asc`
    )
    .bind(plan.id)
    .all<any>();

  const existingWeeks = weeksResult.results || [];

  if (!existingWeeks.length) {
    return {
      updated: false,
      reason: "no_existing_weeks",
      currentWeekNumber: 1,
    };
  }

  /*
   * Determinar la semana REAL según start_date.
   *
   * Esto es lo que impide volver a semana 1.
   */
  const calendar = getTrainingPlanCalendar(
    plan.start_date,
    existingWeeks.length
  );

  const currentWeekNumber =
    Number(calendar.currentWeekNumber || 1);

  /*
   * Crear nueva estructura sólo EN MEMORIA.
   */
  const workoutLibrary =
    await fetchWorkoutLibrary(db);

  const paceBaseContext =
    await fetchPaceEngineContext(
      db,
      userId,
      input
    );

  const aiPaceAdjustment =
    await getAiPaceAdjustment(
      aiEnv,
      input,
      paceBaseContext
    );

  const paceContext: PaceEngineContext = {
    ...paceBaseContext,

    aiDeltaSeconds:
      aiPaceAdjustment.delta_seconds,

    aiReason:
      aiPaceAdjustment.reason,

    source:
      paceBaseContext.recentMedianSecondsPerKm
        ? (
            aiPaceAdjustment.reason ===
            "Ajuste por reglas internas"
              ? "history_rules"
              : "history_ai"
          )
        : (
            aiPaceAdjustment.reason ===
            "Ajuste por reglas internas"
              ? "level_rules"
              : "level_ai"
          ),
  };

  let generatedWeeks =
    buildPlanStructure(
      input,
      workoutLibrary
    );

  generatedWeeks =
    applyPreferredDaysToWeeks(
      input,
      generatedWeeks
    );

  generatedWeeks =
    enrichPlanWithPaces(
      generatedWeeks,
      paceContext
    );

  /*
   * Procesamos únicamente semana actual y futuras.
   *
   * week 1 .. currentWeek-1:
   * NO SE TOCAN.
   */
  const lastWeekNumber = Math.max(
    existingWeeks.length,
    generatedWeeks.length
  );

  for (
    let weekNumber = currentWeekNumber;
    weekNumber <= lastWeekNumber;
    weekNumber++
  ) {
    const generatedWeek =
      generatedWeeks.find(
        (week: any) =>
          Number(week.week_number) === weekNumber
      );

    /*
     * Si la nueva estructura no tiene esa semana,
     * dejamos la existente intacta.
     */
    if (!generatedWeek) {
      continue;
    }

    let existingWeek =
      existingWeeks.find(
        (week: any) =>
          Number(week.week_number) === weekNumber
      );

    /*
     * Si es una semana futura que todavía no existe,
     * la creamos dentro DEL MISMO PLAN.
     */
    if (!existingWeek) {
      const weekId = crypto.randomUUID();

      await db
        .prepare(
          `insert into training_weeks (
             id,
             training_plan_id,
             week_number,
             focus_label,
             total_target_distance,
             notes
           ) values (
             ?1, ?2, ?3, ?4, ?5, ?6
           )`
        )
        .bind(
          weekId,
          plan.id,
          weekNumber,
          generatedWeek.focus_label,
          generatedWeek.total_target_distance,
          generatedWeek.notes
        )
        .run();

      existingWeek = {
        id: weekId,
        week_number: weekNumber,
      };
    } else {
      await db
        .prepare(
          `update training_weeks
           set focus_label = ?1,
               total_target_distance = ?2,
               notes = ?3
           where id = ?4`
        )
        .bind(
          generatedWeek.focus_label,
          generatedWeek.total_target_distance,
          generatedWeek.notes,
          existingWeek.id
        )
        .run();
    }

    /*
     * Conservar registros de progreso.
     *
     * Sólo quitamos la referencia al training_session
     * que vamos a sustituir.
     */
    try {
      await db
        .prepare(
          `update training_session_progress
           set training_session_id = null,
               updated_at = ?1
           where user_id = ?2
             and week_number = ?3`
        )
        .bind(
          new Date().toISOString(),
          userId,
          weekNumber
        )
        .run();
    } catch (error) {
      console.warn(
        "No fue posible separar session progress:",
        error
      );
    }

    /*
     * Borrar solamente sesiones de la semana
     * actual/futura.
     */
    await db
      .prepare(
        `delete from training_sessions
         where training_week_id = ?1`
      )
      .bind(existingWeek.id)
      .run();

    /*
     * Insertar nuevas sesiones según:
     *
     * - nuevo objetivo
     * - nivel
     * - volumen
     * - días seleccionados
     * - ritmos calculados
     */
    for (const session of generatedWeek.sessions || []) {
      await db
        .prepare(
          `insert into training_sessions (
             id,
             training_week_id,
             day_of_week,
             session_type,
             title,
             objective,
             distance_target,
             duration_target,
             intensity_zone,
             warmup_text,
             main_set_text,
             cooldown_text,
             estimated_load,
             status
           ) values (
             ?1, ?2, ?3, ?4, ?5, ?6,
             ?7, ?8, ?9, ?10, ?11,
             ?12, ?13, ?14
           )`
        )
        .bind(
          crypto.randomUUID(),
          existingWeek.id,
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
        .run();
    }
  }

  /*
   * Actualizar metadata DEL MISMO PLAN.
   *
   * NO modificamos:
   *
   * plan.id
   * plan.start_date
   * plan.created_at
   * plan.version
   */
  const distanceKm =
    normalizeDistance(input.distance);

  await db
    .prepare(
      `update training_plans
       set end_date = ?1,
           plan_summary = ?2,
           generation_source = ?3
       where id = ?4`
    )
    .bind(
      input.eventDate?.trim() || null,
      isRecoverFitnessGoal(input.goal)
        ? `Plan actualizado para recuperar condición - ${input.level.trim()} - ${input.daysPerWeek} días/semana`
        : `Plan actualizado ${distanceLabel(distanceKm)} - ${input.goal.trim()} - ${input.daysPerWeek} días/semana`,
      "profile_refresh_current_week",
      plan.id
    )
    .run();

  return {
    updated: true,
    planId: plan.id,
    currentWeekNumber,
    weeksUpdatedFrom: currentWeekNumber,
  };
}


async function createTrainingPlanForUser(
  db: D1Database,
  userId: string,
  input: AthleteProfileInput,
  aiEnv?: Pick<Bindings, "OPENAI_API_KEY" | "OPENAI_MODEL" | "AI_ENABLED">
) {
  const allowed = await validateDistanceForMembership(db, userId, input.distance);
  if (!allowed.ok) {
    throw new Error(allowed.message);
  }

  const changeAllowance = await validatePlanChangeAllowance(db, userId);

  if (!changeAllowance.ok) {
    throw new Error(changeAllowance.message);
  }

  const planId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const workoutLibrary = await fetchWorkoutLibrary(db);
  const paceBaseContext = await fetchPaceEngineContext(db, userId, input);
  const aiPaceAdjustment = await getAiPaceAdjustment(aiEnv, input, paceBaseContext);
  const paceContext: PaceEngineContext = {
    ...paceBaseContext,
    aiDeltaSeconds: aiPaceAdjustment.delta_seconds,
    aiReason: aiPaceAdjustment.reason,
    source: paceBaseContext.recentMedianSecondsPerKm
      ? aiPaceAdjustment.reason === "Ajuste por reglas internas"
        ? "history_rules"
        : "history_ai"
      : aiPaceAdjustment.reason === "Ajuste por reglas internas"
      ? "level_rules"
      : "level_ai",
  };
  let weeks = buildPlanStructure(input, workoutLibrary);
  weeks = applyPreferredDaysToWeeks(input, weeks);
  weeks = enrichPlanWithPaces(weeks, paceContext);
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
        isRecoverFitnessGoal(input.goal)
          ? `Plan para recuperar condición - ${input.level.trim()} - ${input.daysPerWeek} días/semana - ${weeks.length} semanas`
          : `Plan estándar ${distanceLabel(distanceKm)} - ${input.goal.trim()} - ${weeks.length} semanas`,
        isRecoverFitnessGoal(input.goal)
          ? workoutLibrary.length
            ? `recover_fitness_library_${allowed.planCode || "unknown"}`
            : `recover_fitness_${allowed.planCode || "unknown"}`
          : workoutLibrary.length
          ? `standard_library_${allowed.planCode || "unknown"}`
          : `standard_${allowed.planCode || "unknown"}`,
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

  await registerPlanChangeUsage(db, userId);

  return {
    planId,
    weeksCreated: weeks.length,
  };
}



// TRAININGAPP_PLAN_ANCHOR_HELPER_V1
function getPlanAnchorMondayDayNumber(
  startDate?: string | null
) {
  /*
   * training_plans.start_date viene como YYYY-MM-DD.
   * Convertimos esa fecha a un número entero de días UTC
   * y después obtenemos el lunes de esa misma semana.
   *
   * Este cálculo evita problemas de timezone al interpretar
   * directamente "YYYY-MM-DD" con new Date().
   */
  const match = String(startDate || "").match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) {
    /*
     * Fallback únicamente para planes antiguos sin fecha válida.
     * El rolling plan normalmente nunca llega aquí porque
     * exige plan.start_date.
     */
    const now = new Date();

    const todayDayNumber = Math.floor(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      ) / 86400000
    );

    const weekday = new Date(
      todayDayNumber * 86400000
    ).getUTCDay();

    const daysSinceMonday =
      (weekday + 6) % 7;

    return todayDayNumber - daysSinceMonday;
  }

  const dayNumber = Math.floor(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    ) / 86400000
  );

  const date = new Date(
    dayNumber * 86400000
  );

  const weekday =
    date.getUTCDay();

  const daysSinceMonday =
    (weekday + 6) % 7;

  return dayNumber - daysSinceMonday;
}




// TRAININGAPP_CALENDAR_HELPERS_RESTORED_V1

function formatTrainingDayNumber(
  dayNumber: number
) {
  return new Date(
    dayNumber * 86400000
  )
    .toISOString()
    .slice(0, 10);
}


function parseTrainingDateToDayNumber(
  value?: string | null
) {
  const match = String(
    value || ""
  ).match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (!match) {
    return null;
  }

  const dayNumber = Math.floor(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    ) / 86400000
  );

  return Number.isFinite(dayNumber)
    ? dayNumber
    : null;
}


function getMondayForDayNumber(
  dayNumber: number
) {
  const date = new Date(
    dayNumber * 86400000
  );

  const weekday =
    date.getUTCDay();

  const daysSinceMonday =
    (weekday + 6) % 7;

  return (
    dayNumber -
    daysSinceMonday
  );
}


function getLogicalTrainingMondayDayNumber(
  date = new Date()
) {
  /*
   * TrainingApp usa Monterrey.
   *
   * La semana cambia el domingo
   * a las 22:00 hora local.
   *
   * Sumamos 2 horas al reloj local
   * para convertir ese corte en
   * lunes 00:00 lógico.
   */
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Monterrey",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",

        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",

        hourCycle: "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const values:
    Record<string, number> = {};

  for (const part of parts) {
    if (
      part.type !== "literal"
    ) {
      values[part.type] =
        Number(part.value);
    }
  }

  const localAsUtc =
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second
    );

  const shifted =
    new Date(
      localAsUtc +
      2 * 60 * 60 * 1000
    );

  const shiftedDayNumber =
    Math.floor(
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate()
      ) / 86400000
    );

  return getMondayForDayNumber(
    shiftedDayNumber
  );
}


function getTrainingWeekDateRange(
  startDate:
    | string
    | null
    | undefined,

  weekNumber: number
) {
  const anchorMonday =
    getPlanAnchorMondayDayNumber(
      startDate
    );

  const safeWeekNumber =
    Math.max(
      1,
      Math.floor(
        Number(
          weekNumber || 1
        )
      )
    );

  const startDayNumber =
    anchorMonday +
    (
      safeWeekNumber - 1
    ) * 7;

  return {
    weekStartDate:
      formatTrainingDayNumber(
        startDayNumber
      ),

    weekEndDate:
      formatTrainingDayNumber(
        startDayNumber + 6
      ),

    startDayNumber,
  };
}


function getTrainingPlanCalendar(
  startDate:
    | string
    | null
    | undefined,

  totalWeeks: number,

  now = new Date()
) {
  const safeTotalWeeks =
    Math.max(
      1,
      Number(
        totalWeeks || 1
      )
    );

  const anchorMonday =
    getPlanAnchorMondayDayNumber(
      startDate
    );

  const logicalMonday =
    getLogicalTrainingMondayDayNumber(
      now
    );

  const rawWeekNumber =
    Math.floor(
      (
        logicalMonday -
        anchorMonday
      ) / 7
    ) + 1;

  const currentWeekNumber =
    Math.min(
      safeTotalWeeks,
      Math.max(
        1,
        rawWeekNumber
      )
    );

  const currentRange =
    getTrainingWeekDateRange(
      startDate,
      currentWeekNumber
    );

  return {
    currentWeekNumber,

    currentWeekStartDate:
      currentRange.weekStartDate,

    currentWeekEndDate:
      currentRange.weekEndDate,

    timeZone:
      "America/Monterrey",
  };
}


// TRAININGAPP_ROLLING_PLAN_COVERAGE_V1
//
// Mantiene el plan vivo conforme avanza el calendario.
//
// No crea un training_plan nuevo.
// No modifica semanas históricas.
// No cambia start_date.
// Sólo agrega semanas faltantes al plan existente.
//
async function ensureRollingTrainingPlanCoverage(
  db: D1Database,
  userId: string,
  plan: {
    id: string;
    start_date: string | null;
  }
) {
  if (!plan?.id || !plan.start_date) {
    return {
      extended: false,
      reason: "missing_plan_start_date",
    };
  }

  /*
   * Semana REAL según calendario.
   *
   * A diferencia de getTrainingPlanCalendar(),
   * aquí NO se limita por las semanas existentes.
   */
  const anchorMonday =
    getPlanAnchorMondayDayNumber(
      plan.start_date
    );

  const logicalMonday =
    getLogicalTrainingMondayDayNumber(
      new Date()
    );

  const rawCurrentWeek =
    Math.max(
      1,
      Math.floor(
        (logicalMonday - anchorMonday) / 7
      ) + 1
    );

  /*
   * Mantener además preparada la siguiente
   * semana para que el cambio dominical
   * sea inmediato.
   */
  const desiredMaxWeek =
    rawCurrentWeek + 1;

  const existingInfo = await db
    .prepare(
      `select
         coalesce(max(week_number), 0) as max_week
       from training_weeks
       where training_plan_id = ?1`
    )
    .bind(plan.id)
    .first<any>();

  const existingMaxWeek =
    Number(existingInfo?.max_week || 0);

  if (
    existingMaxWeek >= desiredMaxWeek
  ) {
    return {
      extended: false,
      currentWeekNumber: rawCurrentWeek,
      maxWeekNumber: existingMaxWeek,
      reason: "coverage_ok",
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
    .first<any>();

  const profile = await db
    .prepare(
      `select
         experience_level,
         weekly_days_available,
         preferred_training_days,
         current_weekly_volume,
         preferred_goal_type,
         notes
       from athlete_profiles
       where user_id = ?1
       limit 1`
    )
    .bind(userId)
    .first<any>();

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
    .first<any>();

  if (!user || !profile || !goal) {
    return {
      extended: false,
      currentWeekNumber: rawCurrentWeek,
      maxWeekNumber: existingMaxWeek,
      reason: "missing_profile",
    };
  }

  const daysPerWeek =
    Number(
      profile.weekly_days_available || 4
    );

  const input: AthleteProfileInput = {
    name: user.name,
    email: user.email,

    goal:
      goal.goal_type ||
      profile.preferred_goal_type,

    distance:
      goal.target_distance,

    daysPerWeek,

    preferredTrainingDays:
      profile.preferred_training_days ||
      undefined,

    level:
      profile.experience_level,

    currentVolumeKm:
      Number(
        profile.current_weekly_volume || 0
      ),

    eventName:
      goal.target_event_name || "",

    eventDate:
      goal.target_event_date || "",

    notes:
      profile.notes || "",
  };

  const workoutLibrary =
    await fetchWorkoutLibrary(db);

  const paceBaseContext =
    await fetchPaceEngineContext(
      db,
      userId,
      input
    );

  const paceContext: PaceEngineContext = {
    ...paceBaseContext,

    aiDeltaSeconds: 0,

    aiReason:
      "Continuidad automática del plan",

    source:
      paceBaseContext
        .recentMedianSecondsPerKm
        ? "history_rules"
        : "level_rules",
  };

  const statements: D1PreparedStatement[] =
    [];

  let createdWeeks = 0;

  for (
    let weekNumber =
      existingMaxWeek + 1;

    weekNumber <= desiredMaxWeek;

    weekNumber++
  ) {

    /*
     * Siempre dejamos margen por delante
     * para que una semana de continuidad
     * NO se convierta artificialmente
     * en "semana de carrera".
     */
    const planningHorizon =
      weekNumber + 4;

    const isRecoveryConditionPlan =
      isRecoverFitnessGoal(
        input.goal
      );

    const distanceKm =
      isRecoveryConditionPlan
        ? 0
        : normalizeDistance(
            input.distance
          );

    const recovery =
      weekNumber % 4 === 0;

    const phase =
      getWeekPhase(
        weekNumber,
        planningHorizon
      );

    let sessions =
      buildSessionsForWeek(
        input,
        weekNumber,
        planningHorizon,
        workoutLibrary
      );

    let generatedWeek: any = {
      week_number:
        weekNumber,

      focus_label:
        isRecoveryConditionPlan
          ? recovery
            ? "Descarga activa para recuperar condición"
            : "Continuidad para recuperar condición"
          : recovery
          ? `Descarga activa ${distanceLabel(
              distanceKm
            )}`
          : `${phase} ${distanceLabel(
              distanceKm
            )}`,

      total_target_distance:
        roundToHalf(
          sessions.reduce(
            (
              sum: number,
              session: any
            ) =>
              sum +
              Number(
                session.distance_target ||
                  0
              ),
            0
          )
        ),

      notes:
        recovery
          ? "Semana de descarga para controlar fatiga y mantener continuidad."
          : "Semana de continuidad generada automáticamente según el progreso del atleta.",

      sessions,
    };

    /*
     * Aplicar exactamente los días
     * seleccionados por el corredor.
     */
    generatedWeek =
      applyPreferredDaysToWeeks(
        input,
        [generatedWeek]
      )[0];

    /*
     * Agregar prescripción de ritmo
     * usando historial real.
     */
    generatedWeek.sessions =
      (
        generatedWeek.sessions || []
      ).map(
        (session: SessionSeed) => {

          const prescription =
            getSessionPacePrescription(
              session,
              weekNumber,
              planningHorizon,
              paceContext
            );

          const cleanMainSet =
            stripInternalWorkoutReferences(
              session.main_set_text
            );

          const paceText =
            `Ritmo recomendado: ` +
            `${formatPace(
              prescription.minSeconds
            )}–${formatPace(
              prescription.maxSeconds
            )} min/km.`;

          const effortText =
            `Esfuerzo: RPE ` +
            `${prescription.rpe} · ` +
            `Dificultad: ` +
            `${prescription.difficulty}.`;

          const feelingText =
            `Sensación esperada: ` +
            `${prescription.feeling}`;

          return {
            ...session,

            main_set_text: [
              cleanMainSet,
              paceText,
              effortText,
              feelingText,
            ]
              .filter(Boolean)
              .join(" "),
          };
        }
      );

    const candidateWeekId =
      crypto.randomUUID();

    /*
     * Insertar la semana.
     *
     * OR IGNORE protege si dos requests
     * intentan hacer el rollover
     * simultáneamente.
     */
    await db
      .prepare(
        `insert or ignore into training_weeks (
           id,
           training_plan_id,
           week_number,
           focus_label,
           total_target_distance,
           notes
         ) values (
           ?1, ?2, ?3, ?4, ?5, ?6
         )`
      )
      .bind(
        candidateWeekId,
        plan.id,
        weekNumber,
        generatedWeek.focus_label,
        generatedWeek
          .total_target_distance,
        generatedWeek.notes
      )
      .run();

    /*
     * Recuperar el ID REAL.
     */
    const persistedWeek =
      await db
        .prepare(
          `select id
           from training_weeks
           where training_plan_id = ?1
             and week_number = ?2
           limit 1`
        )
        .bind(
          plan.id,
          weekNumber
        )
        .first<any>();

    if (!persistedWeek?.id) {
      continue;
    }

    /*
     * Evitar duplicar sesiones si
     * otra solicitud ya creó la semana.
     */
    const sessionCount =
      await db
        .prepare(
          `select count(*) as total
           from training_sessions
           where training_week_id = ?1`
        )
        .bind(
          persistedWeek.id
        )
        .first<any>();

    if (
      Number(
        sessionCount?.total || 0
      ) === 0
    ) {

      statements.length = 0;

      for (
        const session of
          generatedWeek.sessions || []
      ) {
        statements.push(
          db
            .prepare(
              `insert into training_sessions (
                 id,
                 training_week_id,
                 day_of_week,
                 session_type,
                 title,
                 objective,
                 distance_target,
                 duration_target,
                 intensity_zone,
                 warmup_text,
                 main_set_text,
                 cooldown_text,
                 estimated_load,
                 status
               ) values (
                 ?1, ?2, ?3, ?4,
                 ?5, ?6, ?7, ?8,
                 ?9, ?10, ?11,
                 ?12, ?13, ?14
               )`
            )
            .bind(
              crypto.randomUUID(),
              persistedWeek.id,
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

      if (statements.length) {
        await db.batch(
          statements
        );
      }
    }

    createdWeeks++;
  }

  return {
    extended:
      createdWeeks > 0,

    createdWeeks,

    currentWeekNumber:
      rawCurrentWeek,

    maxWeekNumber:
      desiredMaxWeek,

    reason:
      "rolling_extension",
  };
}


async function ensurePlanForUser(
  db: D1Database,
  userId: string,
  aiEnv?: Pick<Bindings, "OPENAI_API_KEY" | "OPENAI_MODEL" | "AI_ENABLED">
) {
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
         preferred_training_days,
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
      preferred_training_days: string | null;
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
    preferredTrainingDays: profile.preferred_training_days || undefined,
    level: profile.experience_level,
    currentVolumeKm: Number(profile.current_weekly_volume || 0),
    eventName: goal.target_event_name || "",
    eventDate: goal.target_event_date || "",
    notes: profile.notes || "",
  };

  const createdPlan = await createTrainingPlanForUser(db, userId, input, aiEnv);

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

  if (planId === "P-19H35231X9575980TNH5DTZA") return "starter";
  if (planId === "P-6GE16555S80643802NH5DTZA") return "performance";
  if (planId === "P-7J192125FH642021ANH5DTZA") return "pro_coach";

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
  let claimedCampaignId: string | null = null;

  try {
    const body = (await c.req.json()) as AuthRegisterInput;

    const name = body.name?.trim() || "";
    const email = normalizeEmail(body.email || "");
    const password = body.password || "";
    const rawDeviceId = String(body.deviceId || "").trim();

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

    const ipAddress = c.req.header("cf-connecting-ip") || "";
    const userAgent = c.req.header("user-agent") || "";
    const deviceSource = rawDeviceId || `${userAgent}:${ipAddress}`;
    const deviceHash = await sha256Text(
      `trial-device:${deviceSource}:${c.env.SESSION_SECRET}`
    );
    const ipHash = ipAddress
      ? await sha256Text(`trial-ip:${ipAddress}:${c.env.SESSION_SECRET}`)
      : null;
    const userAgentHash = userAgent
      ? await sha256Text(`trial-ua:${userAgent}:${c.env.SESSION_SECRET}`)
      : null;

    const previousDeviceTrial = await c.env.DB
      .prepare(
        `select id
         from user_trials
         where device_hash = ?1
         limit 1`
      )
      .bind(deviceHash)
      .first<{ id: string }>();

    const campaign = await c.env.DB
      .prepare(
        `select id, plan_code, duration_days, max_trials, trials_started
         from trial_campaigns
         where campaign_code = 'performance_trial_14d_50'
           and is_active = 1
           and (starts_at is null or starts_at <= datetime('now'))
           and (ends_at is null or ends_at > datetime('now'))
         limit 1`
      )
      .first<{
        id: string;
        plan_code: string;
        duration_days: number;
        max_trials: number;
        trials_started: number;
      }>();

    let trialAssigned = false;
    let trialReason = "unavailable";

    if (previousDeviceTrial?.id) {
      trialReason = "device_already_used";
    } else if (campaign?.id) {
      let ipTrialCount = 0;
      if (ipHash) {
        const ipCount = await c.env.DB
          .prepare(
            `select count(*) as total
             from user_trials
             where signup_ip_hash = ?1
               and created_at >= datetime('now', '-30 days')`
          )
          .bind(ipHash)
          .first<{ total: number }>();
        ipTrialCount = Number(ipCount?.total || 0);
      }

      if (ipTrialCount >= 3) {
        trialReason = "ip_limit_reached";
      } else {
        const claim = await c.env.DB
          .prepare(
            `update trial_campaigns
             set trials_started = trials_started + 1,
                 updated_at = ?1
             where id = ?2
               and is_active = 1
               and trials_started < max_trials`
          )
          .bind(new Date().toISOString(), campaign.id)
          .run();

        trialAssigned = Number((claim.meta as any)?.changes || 0) > 0;
        if (trialAssigned) {
          claimedCampaignId = campaign.id;
          trialReason = "assigned";
        } else {
          trialReason = "campaign_full";
        }
      }
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const trialPlanCode = campaign?.plan_code || "performance";
    const trialExpiresAt = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * Number(campaign?.duration_days || 14)
    ).toISOString();
    const initialEntitlements = trialAssigned
      ? getEntitlementsFromPlan(trialPlanCode, "active")
      : getEntitlementsFromPlan(null, null);

    const statements = [
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
          ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
        )
        .bind(
          crypto.randomUUID(),
          userId,
          initialEntitlements.has_active_membership,
          initialEntitlements.can_generate_base_plan,
          initialEntitlements.can_connect_strava,
          initialEntitlements.can_use_strava_metrics,
          initialEntitlements.can_generate_advanced_plan,
          initialEntitlements.can_regenerate_with_history,
          initialEntitlements.can_use_premium_planning,
          initialEntitlements.source_plan_code,
          now
        ),
    ];

    if (trialAssigned && campaign?.id) {
      statements.push(
        c.env.DB
          .prepare(
            `insert into user_trials (
              id, user_id, campaign_id, plan_code, status, started_at, expires_at,
              converted_at, expired_at, device_hash, signup_ip_hash, user_agent_hash,
              created_at, updated_at
            ) values (?1, ?2, ?3, ?4, 'active', ?5, ?6, null, null, ?7, ?8, ?9, ?10, ?11)`
          )
          .bind(
            crypto.randomUUID(),
            userId,
            campaign.id,
            trialPlanCode,
            now,
            trialExpiresAt,
            deviceHash,
            ipHash,
            userAgentHash,
            now,
            now
          )
      );
    }

    await c.env.DB.batch(statements);

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
        userAgent || null,
        ipAddress || null
      )
      .run();

    return c.json({
      ok: true,
      token: rawToken,
      user: { id: userId, email, name },
      trial: trialAssigned
        ? {
            status: "active",
            plan_code: trialPlanCode,
            started_at: now,
            expires_at: trialExpiresAt,
            duration_days: Number(campaign?.duration_days || 14),
          }
        : {
            status: "unavailable",
            reason: trialReason,
          },
    });
  } catch (error) {
    if (claimedCampaignId) {
      await c.env.DB
        .prepare(
          `update trial_campaigns
           set trials_started = case when trials_started > 0 then trials_started - 1 else 0 end,
               updated_at = ?1
           where id = ?2`
        )
        .bind(new Date().toISOString(), claimedCampaignId)
        .run()
        .catch(() => undefined);
    }

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

    await refreshUserEntitlements(c.env.DB, auth.user.id);

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
    const trial = await getUserTrial(c.env.DB, auth.user.id);
    const access = await getEffectiveAccess(c.env.DB, auth.user.id);
    const strava = await getStravaConnection(c.env.DB, auth.user.id);

    return c.json({
      ok: true,
      user: auth.user,
      membership: membership || null,
      entitlements: entitlements || null,
      trial: trial || null,
      access: {
        source: access.source,
        planCode: access.planCode,
        status: access.status,
      },
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
      environment: "live",
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

    const effectiveAccess = await getEffectiveAccess(c.env.DB, body.userId);
    if (effectiveAccess.status === "active") {
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
                 preferred_training_days = ?3,
                 current_weekly_volume = ?4,
                 preferred_goal_type = ?5,
                 notes = ?6
             where user_id = ?7`
          )
          .bind(
            body.level.trim(),
            body.daysPerWeek,
            normalizePreferredTrainingDays(
              body.preferredTrainingDays,
              body.daysPerWeek
            ).join(","),
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
            current_weekly_volume, preferred_training_days,
            preferred_goal_type, notes, created_at
          ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
        )
        .bind(
          profileId,
          body.userId,
          body.level.trim(),
          body.daysPerWeek,
          body.currentVolumeKm,
          normalizePreferredTrainingDays(
            body.preferredTrainingDays,
            body.daysPerWeek
          ).join(","),
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


app.post("/api/plan/refresh-profile", async (c) => {
  try {
    /*
     * Requerimos sesión del usuario.
     */
    const auth =
      await requireAuthenticatedUser(c);

    if (!auth) {
      return jsonError(
        c,
        "No autenticado",
        401
      );
    }

    const body = (await c.req.json()) as AthleteProfileInput;

    validateProfile(body);

    /*
     * No confiamos en userId enviado por frontend.
     * Usamos siempre el usuario autenticado.
     */
    const userId = auth.user.id;

    const membership =
      await getLatestMembership(
        c.env.DB,
        userId
      );

    if (
      !membership ||
      membership.status !== "active"
    ) {
      return jsonError(
        c,
        "Se requiere una membresía activa",
        403
      );
    }

    /*
     * Normalizar los días seleccionados.
     */
    const preferredTrainingDays =
      normalizePreferredTrainingDays(
        body.preferredTrainingDays,
        body.daysPerWeek
      );

    const input: AthleteProfileInput = {
      ...body,

      daysPerWeek:
        preferredTrainingDays.length,

      preferredTrainingDays,
    };

    /*
     * Comprobar que la distancia es válida
     * para la membresía actual.
     */
    const allowed =
      await validateDistanceForMembership(
        c.env.DB,
        userId,
        input.distance
      );

    if (!allowed.ok) {
      return c.json(
        {
          ok: false,
          error: allowed.message,
          planCode: allowed.planCode,
          allowedDistances:
            allowed.allowedDistances,
        },
        403
      );
    }

    /*
     * AQUÍ está la diferencia importante:
     *
     * NO usamos createTrainingPlanForUser().
     */
    const result =
      await refreshExistingPlanFromCurrentWeek(
        c.env.DB,
        userId,
        input,
        c.env
      );

    return c.json({
      ok: true,
      preferredTrainingDays,
      ...result,
    });

  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible actualizar el plan",
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
      body,
      c.env
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

      autoPlan = await ensurePlanForUser(c.env.DB, userId, c.env);

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

    const rollingCoverage =
      await ensureRollingTrainingPlanCoverage(
        c.env.DB,
        userId,
        {
          id: plan.id,
          start_date: plan.start_date,
        }
      );

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
        sessions: (sessionRows.results || []).map((sessionRow: any) => ({
          ...sessionRow,
          main_set_text: cleanVisibleMainSetText(sessionRow.main_set_text),
        })),
      });
    }

    const profile = await c.env.DB
      .prepare(
        `select
           experience_level,
           weekly_days_available,
           preferred_training_days,
           current_weekly_volume,
           preferred_goal_type,
           notes
         from athlete_profiles
         where user_id = ?1
         limit 1`
      )
      .bind(userId)
      .first();

    const goal = await c.env.DB
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
      .first();

    const planChangeLimit = await c.env.DB
      .prepare(
        `select
           change_count,
           max_changes_allowed
         from plan_change_limits
         where user_id = ?1
         limit 1`
      )
      .bind(userId)
      .first();

    return c.json({
      ok: true,
      plan,
      weeks,
      rollingCoverage,
      autoPlan,
      runnerProfile: profile || null,
      runnerGoal: goal || null,
      planChangeLimit: planChangeLimit || {
        change_count: 0,
        max_changes_allowed: 1,
      },
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

    const access = await getEffectiveAccess(c.env.DB, auth.user.id);
    const entitlements = getEntitlementsFromPlan(
      access.planCode,
      access.status
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


type AiPlanReviewResult = {
  summary: string;
  weekly_recommendation: string;
  risk_level: "low" | "medium" | "high";
  load_adjustment: "maintain" | "reduce" | "increase";
  alerts: string[];
  next_steps: string[];
  coach_note: string;
};

function parseAiJsonFromText(text: string): AiPlanReviewResult {
  const fallback: AiPlanReviewResult = {
    summary: "Tu plan fue analizado con la información disponible.",
    weekly_recommendation:
      "Mantén los entrenamientos suaves realmente suaves y registra tu ritmo para mejorar los próximos ajustes.",
    risk_level: "low",
    load_adjustment: "maintain",
    alerts: [],
    next_steps: ["Completa la semana actual", "Registra ritmo y check-in semanal"],
    coach_note: "La recomendación es orientativa y no sustituye atención médica o de un entrenador presencial.",
  };

  try {
    const parsed = JSON.parse(text) as Partial<AiPlanReviewResult>;
    return {
      summary: String(parsed.summary || fallback.summary),
      weekly_recommendation: String(
        parsed.weekly_recommendation || fallback.weekly_recommendation
      ),
      risk_level:
        parsed.risk_level === "medium" || parsed.risk_level === "high"
          ? parsed.risk_level
          : "low",
      load_adjustment:
        parsed.load_adjustment === "reduce" || parsed.load_adjustment === "increase"
          ? parsed.load_adjustment
          : "maintain",
      alerts: Array.isArray(parsed.alerts)
        ? parsed.alerts.map(String).slice(0, 5)
        : [],
      next_steps: Array.isArray(parsed.next_steps)
        ? parsed.next_steps.map(String).slice(0, 5)
        : fallback.next_steps,
      coach_note: String(parsed.coach_note || fallback.coach_note),
    };
  } catch {
    return fallback;
  }
}

function extractOpenAiOutputText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const parts: string[] = [];
  const output = Array.isArray(response?.output) ? response.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const block of content) {
      if (typeof block?.text === "string") parts.push(block.text);
      if (typeof block?.output_text === "string") parts.push(block.output_text);
    }
  }

  return parts.join("\n").trim();
}

async function getLatestWeeklyCheckin(
  db: D1Database,
  userId: string,
  trainingPlanId: string | null,
  weekNumber: number
) {
  let query = `select
       week_number, energy_score, fatigue_score, soreness_score,
       sleep_quality_score, notes, recommendation, created_at
     from weekly_checkins
     where user_id = ?1
       and week_number = ?2`;
  const bindings: any[] = [userId, weekNumber];

  if (trainingPlanId) {
    query += ` and (training_plan_id = ?3 or training_plan_id is null)`;
    bindings.push(trainingPlanId);
  }

  query += ` order by created_at desc limit 1`;

  return db.prepare(query).bind(...bindings).first();
}

async function buildAiPlanReviewPayload(
  db: D1Database,
  userId: string,
  requestedWeekNumber?: number
) {
  const plan = await db
    .prepare(
      `select id, user_id, version, status, start_date, end_date,
              plan_summary, generation_source, created_at
       from training_plans
       where user_id = ?1
       order by created_at desc
       limit 1`
    )
    .bind(userId)
    .first<any>();

  if (!plan?.id) {
    throw new Error("No se encontró un plan activo para analizar.");
  }

  const profile = await db
    .prepare(
      `select
         experience_level,
         weekly_days_available,
         preferred_training_days,
         current_weekly_volume,
         preferred_goal_type,
         notes
       from athlete_profiles
       where user_id = ?1
       limit 1`
    )
    .bind(userId)
    .first();

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
    .first();

  const weekRows = await db
    .prepare(
      `select id, week_number, focus_label, total_target_distance, notes
       from training_weeks
       where training_plan_id = ?1
       order by week_number asc`
    )
    .bind(plan.id)
    .all<any>();

  const weeks = weekRows.results || [];

  if (!weeks.length) {
    throw new Error("No hay semanas disponibles para analizar.");
  }

  const selectedWeek =
    weeks.find((week: any) => Number(week.week_number) === Number(requestedWeekNumber)) ||
    weeks[0];

  const sessionRows = await db
    .prepare(
      `select id, day_of_week, session_type, title, objective,
              distance_target, duration_target, intensity_zone,
              warmup_text, main_set_text, cooldown_text, estimated_load, status
       from training_sessions
       where training_week_id = ?1
       order by rowid asc`
    )
    .bind((selectedWeek as any).id)
    .all<any>();

  const progressRows = await db
    .prepare(
      `select week_number, session_index, session_title, is_completed,
              completed_at, actual_distance_km, actual_duration_minutes,
              actual_pace_seconds_per_km, effort_score, notes, source, updated_at
       from training_session_progress
       where user_id = ?1
         and week_number = ?2
       order by session_index asc`
    )
    .bind(userId, Number((selectedWeek as any).week_number || 1))
    .all<any>();

  const latestCheckin = await getLatestWeeklyCheckin(
    db,
    userId,
    plan.id,
    Number((selectedWeek as any).week_number || 1)
  );

  return {
    plan,
    profile,
    goal,
    week: selectedWeek,
    sessions: sessionRows.results || [],
    progress: progressRows.results || [],
    latestCheckin,
    allWeeksSummary: weeks.map((week: any) => ({
      week_number: week.week_number,
      focus_label: week.focus_label,
      total_target_distance: week.total_target_distance,
      notes: week.notes,
    })),
  };
}

function fallbackPlanReview(payload: any): AiPlanReviewResult {
  const progress = Array.isArray(payload.progress) ? payload.progress : [];
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const completed = progress.filter((item: any) => Number(item.is_completed) === 1).length;
  const total = sessions.length || 1;
  const completionRate = completed / total;
  const checkin = payload.latestCheckin as any;
  const fatigue = Number(checkin?.fatigue_score || 0);
  const soreness = Number(checkin?.soreness_score || 0);
  const sleep = Number(checkin?.sleep_quality_score || 0);

  if (fatigue >= 4 || soreness >= 4 || sleep <= 2) {
    return {
      summary: `Semana ${payload.week?.week_number || ""}: carga con señales de fatiga alta o recuperación limitada.`,
      weekly_recommendation:
        "Reduce la intensidad de las próximas sesiones y mantén los rodajes en zona cómoda. Prioriza sueño, movilidad y recuperación.",
      risk_level: "high",
      load_adjustment: "reduce",
      alerts: [
        "Fatiga o molestias elevadas en el check-in",
        "Evita convertir rodajes suaves en sesiones rápidas",
      ],
      next_steps: [
        "Baja 15-25% la intensidad esta semana",
        "Registra ritmo y sensaciones después de cada sesión",
        "Si hay dolor fuerte, pausa la intensidad y revisa la molestia",
      ],
      coach_note:
        "Esta recomendación es orientativa. Si hay dolor persistente o fuerte, consulta a un profesional.",
    };
  }

  if (completionRate >= 0.85) {
    return {
      summary: `Semana ${payload.week?.week_number || ""}: buena adherencia al plan.`,
      weekly_recommendation:
        "Mantén la estructura actual. Si las sesiones suaves se sienten controladas, puedes continuar con la siguiente semana según lo planeado.",
      risk_level: "low",
      load_adjustment: "maintain",
      alerts: [],
      next_steps: [
        "Completa la semana sin forzar ritmos",
        "Mantén la tirada larga en esfuerzo cómodo",
        "Haz el check-in semanal al terminar la semana",
      ],
      coach_note:
        "La clave es sostener consistencia antes de subir carga. No conviertas todos los entrenamientos en pruebas de ritmo.",
    };
  }

  return {
    summary: `Semana ${payload.week?.week_number || ""}: adherencia parcial o datos todavía incompletos.`,
    weekly_recommendation:
      "Mantén la carga actual antes de subir volumen. Completa las sesiones clave y registra ritmo para mejorar el ajuste.",
    risk_level: "medium",
    load_adjustment: "maintain",
    alerts: ["Faltan datos o sesiones por completar"],
    next_steps: [
      "Prioriza completar las sesiones suaves",
      "Registra ritmo por km en cada entrenamiento",
      "No subas carga hasta completar mejor la semana",
    ],
    coach_note:
      "Con más datos de ritmo, sesiones realizadas y check-in, la recomendación será más precisa.",
  };
}

async function generateAiPlanReview(
  c: Context<{ Bindings: Bindings }>,
  payload: any
): Promise<{
  review: AiPlanReviewResult;
  model: string;
  usedFallback: boolean;
}> {
  const model =
    c.env.CLOUDFLARE_AI_MODEL ||
    "@cf/meta/llama-3.1-8b-instruct-fast";

  const aiEnabled =
    String(c.env.AI_ENABLED ?? "true").toLowerCase() !== "false";

  if (!aiEnabled || !c.env.AI) {
    return {
      review: fallbackPlanReview(payload),
      model: "fallback-rules",
      usedFallback: true,
    };
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "weekly_recommendation",
      "risk_level",
      "load_adjustment",
      "alerts",
      "next_steps",
      "coach_note",
    ],
    properties: {
      summary: { type: "string" },
      weekly_recommendation: { type: "string" },
      risk_level: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      load_adjustment: {
        type: "string",
        enum: ["maintain", "reduce", "increase"],
      },
      alerts: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
      },
      next_steps: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
      },
      coach_note: { type: "string" },
    },
  };

  try {
    const result = (await c.env.AI.run(
      model,
      {
        messages: [
          {
            role: "system",
            content:
              "Eres un coach de running prudente. Analiza exclusivamente los datos proporcionados del plan, progreso, ritmos y check-in. Responde en español claro y no inventes entrenamientos ni resultados. Si faltan datos, indícalo. Para Recuperar condición, prioriza base aeróbica, constancia, esfuerzo conversacional y progresión conservadora. No aumentes carga cuando exista dolor, fatiga alta, sueño deficiente o baja adherencia. No diagnostiques ni sustituyas atención médica. Devuelve únicamente el objeto solicitado por el esquema JSON.",
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: schema,
        },
        max_tokens: 700,
        temperature: 0.25,
        repetition_penalty: 1.08,
      } as any
    )) as any;

    const responseValue = result?.response ?? result;

    const review =
      typeof responseValue === "string"
        ? parseAiJsonFromText(responseValue)
        : parseAiJsonFromText(JSON.stringify(responseValue));

    return {
      review,
      model,
      usedFallback: false,
    };
  } catch (error) {
    console.warn(
      "Cloudflare Workers AI no estuvo disponible; se usarán reglas internas.",
      error
    );

    return {
      review: fallbackPlanReview(payload),
      model: "fallback-rules",
      usedFallback: true,
    };
  }
}

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
      await markTrialConverted(c.env.DB, userId);
      await refreshUserEntitlements(c.env.DB, userId);
      try {
        autoPlan = await ensurePlanForUser(c.env.DB, userId, c.env);
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
        await markTrialConverted(c.env.DB, linkedUserId);
        await refreshUserEntitlements(c.env.DB, linkedUserId);
        try {
          autoPlan = await ensurePlanForUser(c.env.DB, linkedUserId, c.env);
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
          autoPlan = await ensurePlanForUser(c.env.DB, linkedUserId, c.env);
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





app.post("/api/ai/plan-review", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const access = await getEffectiveAccess(c.env.DB, auth.user.id);
    if (access.status !== "active") {
      return jsonError(
        c,
        access.trial?.status === "expired"
          ? "Tu prueba gratuita terminó. Suscríbete a Performance para continuar."
          : "Se requiere una membresía activa para usar IA.",
        403
      );
    }

    const body = (await c.req.json().catch(() => ({}))) as {
      weekNumber?: number;
    };

    const payload = await buildAiPlanReviewPayload(
      c.env.DB,
      auth.user.id,
      body.weekNumber
    );

    const aiResult = await generateAiPlanReview(c, payload);
    const now = new Date().toISOString();
    const reviewId = crypto.randomUUID();

    await c.env.DB
      .prepare(
        `insert into ai_plan_reviews (
          id, user_id, training_plan_id, week_number,
          request_json, response_json, model, created_at
        ) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(
        reviewId,
        auth.user.id,
        payload.plan.id,
        Number((payload.week as any)?.week_number || body.weekNumber || 1),
        JSON.stringify(payload),
        JSON.stringify(aiResult.review),
        aiResult.model,
        now
      )
      .run();

    return c.json({
      ok: true,
      reviewId,
      model: aiResult.model,
      usedFallback: aiResult.usedFallback,
      review: aiResult.review,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible generar análisis inteligente",
      },
      500
    );
  }
});


// TRAININGAPP_PROGRESS_PLAN_ISOLATION_API_V1
app.get("/api/session-progress/me", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }
    const userId = auth.user.id;

    let trainingPlanId = String(
      c.req.query("trainingPlanId") || ""
    ).trim();

    if (!trainingPlanId) {
      const latestPlan = await c.env.DB
        .prepare(
          `select id
           from training_plans
           where user_id = ?1
           order by created_at desc
           limit 1`
        )
        .bind(userId)
        .first<{ id: string }>();

      trainingPlanId = String(latestPlan?.id || "");
    }

    if (!trainingPlanId) {
      return c.json({
        ok: true,
        progress: [],
      });
    }

    const ownedPlan = await c.env.DB
      .prepare(
        `select id
         from training_plans
         where id = ?1
           and user_id = ?2
         limit 1`
      )
      .bind(trainingPlanId, userId)
      .first<{ id: string }>();

    if (!ownedPlan?.id) {
      return jsonError(c, "Plan no válido para este usuario", 403);
    }

    const rows = await c.env.DB
      .prepare(
        `select
           id,
           user_id,
           training_plan_id,
           training_week_id,
           training_session_id,
           week_number,
           session_index,
           session_title,
           is_completed,
           completed_at,
           actual_distance_km,
           actual_duration_minutes,
           actual_pace_seconds_per_km,
           effort_score,
           notes,
           source,
           created_at,
           updated_at
         from training_session_progress
         where user_id = ?1
           and training_plan_id = ?2
         order by week_number asc, session_index asc`
      )
      .bind(userId, trainingPlanId)
      .all();

    return c.json({
      ok: true,
      trainingPlanId,
      progress: rows.results || [],
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar progreso de entrenamientos",
      },
      500
    );
  }
});


// TRAININGAPP_SESSION_PROGRESS_V4

app.get("/api/version", (c) => {
  return c.json({
    ok: true,
    api: "trainingapp-api",
    sessionProgressHandler: "v4-insert-ignore-update",
  });
});

app.post("/api/session-progress", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);

    if (!auth) {
      return jsonError(c, "No autenticado", 401);
    }

    const userId = auth.user.id;
    const body = await c.req.json();
    const now = new Date().toISOString();

    const weekNumber = Number(
      body.weekNumber ??
      body.week_number ??
      0
    );

    const sessionIndex = Number(
      body.sessionIndex ??
      body.session_index ??
      0
    );

    if (!weekNumber || Number.isNaN(weekNumber)) {
      return c.json(
        {
          ok: false,
          error: "weekNumber es requerido",
        },
        400
      );
    }

    if (
      sessionIndex < 0 ||
      Number.isNaN(sessionIndex)
    ) {
      return c.json(
        {
          ok: false,
          error: "sessionIndex inválido",
        },
        400
      );
    }

    const rawCompleted =
      body.isCompleted ??
      body.is_completed ??
      false;

    const isCompleted =
      rawCompleted === true ||
      rawCompleted === 1 ||
      rawCompleted === "1"
        ? 1
        : 0;

    const completedAt =
      isCompleted === 1
        ? (
            body.completedAt ??
            body.completed_at ??
            now
          )
        : null;

    const numberOrNull = (value: any) => {
      if (
        value === "" ||
        value === null ||
        value === undefined
      ) {
        return null;
      }

      const parsed = Number(value);

      return Number.isFinite(parsed)
        ? parsed
        : null;
    };

    const actualDistanceKm =
      numberOrNull(
        body.actualDistanceKm ??
        body.actual_distance_km
      );

    const actualDurationMinutes =
      numberOrNull(
        body.actualDurationMinutes ??
        body.actual_duration_minutes
      );

    let actualPaceSecondsPerKm =
      numberOrNull(
        body.actualPaceSecondsPerKm ??
        body.actual_pace_seconds_per_km
      );

    if (
      !actualPaceSecondsPerKm &&
      actualDistanceKm &&
      actualDurationMinutes &&
      actualDistanceKm > 0
    ) {
      actualPaceSecondsPerKm =
        Math.round(
          (actualDurationMinutes * 60) /
          actualDistanceKm
        );
    }

    const effortScore =
      numberOrNull(
        body.effortScore ??
        body.effort_score
      );

    const trainingPlanId =
      body.trainingPlanId ??
      body.training_plan_id ??
      null;

    const trainingWeekId =
      body.trainingWeekId ??
      body.training_week_id ??
      null;

    const trainingSessionId =
      body.trainingSessionId ??
      body.training_session_id ??
      null;

    const sessionTitle =
      body.sessionTitle ??
      body.session_title ??
      null;

    const notes =
      body.notes ?? null;

    const source =
      body.source ?? "manual";

    /*
     * PASO 1
     *
     * Insertar solamente si todavía NO existe.
     *
     * OR IGNORE evita por diseño:
     *
     * UNIQUE(
     *   user_id,
     *   week_number,
     *   session_index
     * )
     *
     * Incluso con dos requests simultáneos,
     * uno inserta y el otro simplemente ignora.
     */
    await c.env.DB
      .prepare(
        `insert or ignore into training_session_progress (
          id,
          user_id,
          training_plan_id,
          training_week_id,
          training_session_id,
          week_number,
          session_index,
          session_title,
          is_completed,
          completed_at,
          actual_distance_km,
          actual_duration_minutes,
          actual_pace_seconds_per_km,
          effort_score,
          notes,
          source,
          created_at,
          updated_at
        ) values (
          ?1, ?2, ?3, ?4, ?5, ?6,
          ?7, ?8, ?9, ?10, ?11, ?12,
          ?13, ?14, ?15, ?16, ?17, ?18
        )`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        trainingPlanId,
        trainingWeekId,
        trainingSessionId,
        weekNumber,
        sessionIndex,
        sessionTitle,
        isCompleted,
        completedAt,
        actualDistanceKm,
        actualDurationMinutes,
        actualPaceSecondsPerKm,
        effortScore,
        notes,
        source,
        now,
        now
      )
      .run();

    /*
     * PASO 2
     *
     * Sea nuevo o existente, actualizar
     * EL MISMO registro.
     */
    await c.env.DB
      .prepare(
        `update training_session_progress
         set training_plan_id = ?1,
             training_week_id = ?2,
             training_session_id = ?3,
             session_title = ?4,
             is_completed = ?5,
             completed_at = ?6,
             actual_distance_km = ?7,
             actual_duration_minutes = ?8,
             actual_pace_seconds_per_km = ?9,
             effort_score = ?10,
             notes = ?11,
             source = ?12,
             updated_at = ?13
         where user_id = ?14
           and week_number = ?15
           and session_index = ?16`
      )
      .bind(
        trainingPlanId,
        trainingWeekId,
        trainingSessionId,
        sessionTitle,
        isCompleted,
        completedAt,
        actualDistanceKm,
        actualDurationMinutes,
        actualPaceSecondsPerKm,
        effortScore,
        notes,
        source,
        now,
        userId,
        weekNumber,
        sessionIndex
      )
      .run();

    const saved = await c.env.DB
      .prepare(
        `select
           id,
           is_completed,
           completed_at,
           updated_at
         from training_session_progress
         where user_id = ?1
           and week_number = ?2
           and session_index = ?3
         limit 1`
      )
      .bind(
        userId,
        weekNumber,
        sessionIndex
      )
      .first<any>();

    if (!saved?.id) {
      throw new Error(
        "No fue posible localizar el progreso después de guardarlo."
      );
    }

    c.header(
      "X-TrainingApp-Handler",
      "session-progress-v4"
    );

    return c.json({
      ok: true,
      handlerVersion:
        "session-progress-v4",
      id: saved.id,
      updated: true,
      isCompleted:
        Number(saved.is_completed) === 1,
      completedAt:
        saved.completed_at ?? null,
    });

  } catch (error) {
    console.error(
      "session-progress-v4:",
      error
    );

    return c.json(
      {
        ok: false,
        handlerVersion:
          "session-progress-v4",
        error:
          error instanceof Error
            ? error.message
            : "No fue posible guardar progreso",
      },
      500
    );
  }
});


// TRAININGAPP_ADAPTIVE_STATUS_ENDPOINT_V1
app.get("/api/adaptive/me", async (c) => {
  try {
    const auth = await requireAuthenticatedUser(c);
    if (!auth) return jsonError(c, "No autenticado", 401);

    const adjustment = await c.env.DB
      .prepare(
        `select source_week_number, target_week_number, status, action,
                risk_level, volume_factor, pace_delta_seconds,
                completion_rate, distance_completion_rate,
                planned_distance_km, actual_distance_km,
                average_pace_seconds_per_km, average_effort_score,
                fatigue_score, soreness_score, sleep_quality_score,
                reason, source, scheduled_for, applied_at
         from adaptive_week_adjustments
         where user_id = ?1
         order by applied_at desc
         limit 1`
      )
      .bind(auth.user.id)
      .first<any>();

    return c.json({
      ok: true,
      adjustment: adjustment || null,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar el último ajuste semanal",
      },
      500
    );
  }
});


export default {
  fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },

  async scheduled(
    controller: ScheduledController,
    env: Bindings,
    _ctx: ExecutionContext
  ) {
    const scheduledAt = new Date(controller.scheduledTime);
    const result = await runAdaptiveSundayEngine(env, scheduledAt);
    console.log("TrainingApp Adaptive Sunday Engine", result);
  },
}; 
