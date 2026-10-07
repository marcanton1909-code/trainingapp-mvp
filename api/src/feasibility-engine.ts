/**
 * trAIning - Goal Feasibility Engine (pure domain module)
 * Planning heuristics only, NOT a medical diagnosis or a guarantee of injury prevention.
 * No persistence / external calls: safe to run in a pre-save preview.
 */
export type FeasibilityStatus =
  | "feasible"
  | "challenging"
  | "not_recommended"
  | "insufficient_data";

export type TrainingWeekEvidence = {
  /** Local YYYY-MM-DD Monday. Include the last four calendar weeks, even if no activity was completed. */
  weekStartDate: string;
  /** Per completed running session. Do not include planned-but-not-completed distances. */
  completedRunDistancesKm: number[];
  plannedSessions?: number;
  completedSessions?: number;
};

export type FeasibilityRequest = {
  targetDistanceKm: 5 | 10 | 15 | 21 | 42;
  eventDate: string;
  /**
   * Optional first editable Monday, supplied by the SERVER from plan state.
   * A past start date never grants extra preparation weeks.
   */
  transitionStartDate?: string;
  /**
   * Server-derived YYYY-MM-DD for deterministic evaluation/tests.
   * Do not read this from an untrusted client request.
   * Omit in production to use the server clock converted to the athlete's IANA timezone.
   */
  asOfDate?: string;
  /** IANA timezone stored on the athlete profile, not free-text client input. */
  athleteTimeZone?: string;
  weeks: TrainingWeekEvidence[];
  fatigueScore?: number | null;  // 1-5, higher = more fatigue
  sorenessScore?: number | null; // 1-5, higher = more soreness
  sleepQualityScore?: number | null; // 1-5, higher = better sleep
};

export type SimulatedWeek = {
  relativeWeek: number;
  weekStartDate: string;
  phase: "build" | "recovery" | "taper" | "race";
  longRunUpperKm: number;
  weeklyVolumeUpperKm: number;
};

export type FeasibilityResult = {
  status: FeasibilityStatus;
  confidence: "low" | "medium" | "high";
  /** Calendar date on which the assessment was evaluated in the athlete's timezone. */
  evaluatedOn: string;
  athleteTimeZone: string;
  daysUntilEvent: number;
  /** Complete seven-day periods until race day (not the count of training week slots). */
  fullWeeksRemaining: number;
  extraDaysRemaining: number;
  firstFullTrainingWeekDate: string | null;
  /** Number of Monday-to-Sunday slots from first available FULL training week through race week. */
  weeksAvailable: number;
  buildWeeks: number;
  taperWeeks: number;
  baselineLongRunKm: number | null;
  baselineWeeklyVolumeKm: number | null;
  adherencePct: number | null;
  projectedPeakLongRunKm: number | null;
  projectedPeakWeeklyVolumeKm: number | null;
  readinessGuidelines: { longRunKm: number; weeklyVolumeKm: number };
  simulatedWeeks: SimulatedWeek[];
  reasons: string[];
  message: string;
  /** UI should never apply new goal on a negative preview automatically. */
  requiresExplicitReview: boolean;
};

const readiness: Record<FeasibilityRequest["targetDistanceKm"], {longRunKm:number;weeklyVolumeKm:number}> = {
  5: { longRunKm: 4, weeklyVolumeKm: 12 },
  10: { longRunKm: 8, weeklyVolumeKm: 18 },
  15: { longRunKm: 12, weeklyVolumeKm: 24 },
  21: { longRunKm: 16, weeklyVolumeKm: 32 },
  42: { longRunKm: 28, weeklyVolumeKm: 48 },
};

function dateUTC(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const timestamp = Date.parse(`${ymd}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  if (new Date(timestamp).toISOString().slice(0, 10) !== ymd) return null;
  return timestamp;
}
function floorHalf(value: number): number {
  return Math.max(0, Math.floor((value + 1e-8) * 2) / 2);
}
function median(values: number[]): number {
  const sorted = [...values].sort((a,b)=>a-b);
  const index = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[index] : (sorted[index - 1] + sorted[index]) / 2;
}
function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}
const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

function ymdUTC(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function localYmd(now: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (part: string) => parts.find(p => p.type === part)?.value;
    const year = get("year"), month = get("month"), day = get("day");
    const ymd = `${year}-${month}-${day}`;
    return dateUTC(ymd) === null ? null : ymd;
  } catch {
    return null;
  }
}

/** Monday at midnight expressed as an *abstract calendar day* (UTC arithmetic avoids DST). */
function mondayAtOrBefore(timestamp: number): number {
  const dow = new Date(timestamp).getUTCDay();
  return timestamp - ((dow + 6) % 7) * DAY_MS;
}

/** Current Monday if today is Monday, otherwise next Monday (no artificial full partial week). */
function firstFullMondayOnOrAfter(today: number): number {
  const monday = mondayAtOrBefore(today);
  return today === monday ? monday : monday + WEEK_MS;
}

function resultBase(
  req: FeasibilityRequest,
  evaluatedOn: string,
  athleteTimeZone: string,
  daysUntilEvent: number,
  firstFullTrainingWeekDate: string | null,
  weeksAvailable: number
): FeasibilityResult {
  const taper = req.targetDistanceKm === 42 ? 3 : req.targetDistanceKm >= 21 ? 2 : 1;
  return {
    status: "insufficient_data", confidence: "low", weeksAvailable,
    evaluatedOn, athleteTimeZone, daysUntilEvent,
    fullWeeksRemaining: Math.max(0, Math.floor(daysUntilEvent / 7)),
    extraDaysRemaining: daysUntilEvent < 0 ? 0 : daysUntilEvent % 7,
    firstFullTrainingWeekDate,
    buildWeeks: Math.max(0, weeksAvailable - taper - 1), taperWeeks: taper,
    baselineLongRunKm: null, baselineWeeklyVolumeKm: null, adherencePct: null,
    projectedPeakLongRunKm: null, projectedPeakWeeklyVolumeKm: null,
    readinessGuidelines: {...readiness[req.targetDistanceKm]}, simulatedWeeks: [],
    reasons: [], message: "Necesitamos más historial antes de evaluar el objetivo.",
    requiresExplicitReview: true,
  };
}

/** Evaluate feasibility WITHOUT saving or altering any athlete plan. */
export function evaluateGoalFeasibility(
  req: FeasibilityRequest,
  /** Injected clock for tests. Production uses the server clock by default. */
  options: { now?: Date } = {}
): FeasibilityResult {
  const zone = req.athleteTimeZone || "America/Monterrey";
  const now = options.now ?? new Date();
  const evaluatedOn = req.asOfDate ?? localYmd(now, zone) ?? "";
  const today = dateUTC(evaluatedOn);
  const event = dateUTC(req.eventDate);
  const requestedStart = req.transitionStartDate === undefined
    ? null
    : dateUTC(req.transitionStartDate);
  const invalidStart = req.transitionStartDate !== undefined &&
    (requestedStart === null || new Date(requestedStart).getUTCDay() !== 1);
  const validClock = localYmd(new Date("2026-01-01T12:00:00Z"), zone) !== null;
  const daysUntilEvent = today !== null && event !== null
    ? Math.floor((event - today) / DAY_MS)
    : -1;
  const fullMonday = today === null ? null : firstFullMondayOnOrAfter(today);
  // A proposed transitionStartDate from an old plan can only move the start later.
  // It can NEVER move the evaluation backwards and create extra weeks.
  const start = fullMonday === null ? null : Math.max(fullMonday, requestedStart ?? fullMonday);
  const eventMonday = event === null ? null : mondayAtOrBefore(event);
  const weeksAvailable = !invalidStart && start !== null && eventMonday !== null &&
    eventMonday >= start && daysUntilEvent > 0
    ? Math.floor((eventMonday - start) / WEEK_MS) + 1
    : 0;
  const outcome = resultBase(
    req, evaluatedOn, zone, daysUntilEvent,
    start === null ? null : ymdUTC(start), weeksAvailable
  );

  if (!validClock || today === null || event === null || invalidStart || daysUntilEvent <= 0) {
    outcome.status = "not_recommended";
    outcome.reasons.push(invalidStart
      ? "La fecha de transición recibida no es un lunes válido."
      : "Fecha actual/zona horaria o fecha de carrera inválida, o el evento ya comenzó.");
    outcome.message = "Verifica la fecha del evento y la zona horaria antes de evaluar el objetivo.";
    return outcome;
  }

  if (weeksAvailable === 0 || start === null) {
    outcome.status = "not_recommended";
    outcome.reasons.push("No queda ninguna semana completa de entrenamiento antes de la carrera.");
    outcome.message = "El evento está demasiado próximo para planificar un nuevo bloque semanal.";
    return outcome;
  }

  // IMPORTANT: never inflate the history with a partly completed current week.
  // Use the last four FINISHED Monday-Sunday weeks as of the athlete's local today.
  const currentMonday = mondayAtOrBefore(today);
  const evidence = new Map<number, TrainingWeekEvidence>();
  for (const week of req.weeks || []) {
    const ts = dateUTC(week.weekStartDate);
    if (ts !== null && ts < currentMonday &&
        (currentMonday - ts) % WEEK_MS === 0) {
      evidence.set(ts, week);
    }
  }
  const lastFour: (TrainingWeekEvidence | undefined)[] = [4,3,2,1]
    .map(n => evidence.get(currentMonday - n * WEEK_MS));
  const known = lastFour.filter((w): w is TrainingWeekEvidence => w !== undefined);
  const totals = known.map(w => (w.completedRunDistancesKm || [])
    .filter(n => Number.isFinite(n) && n > 0 && n < 150)
    .reduce((sum,n)=>sum+n,0));
  const distanceSamples = known.flatMap(w => (w.completedRunDistancesKm || [])
    .filter(n => Number.isFinite(n) && n > 0 && n < 150));
  const completedRunWeeks = totals.filter(v=>v>0).length;
  const planned = known.reduce((sum,w)=>sum+Math.max(0,Number(w.plannedSessions||0)),0);
  const completed = known.reduce((sum,w)=>sum+Math.max(0,Number(w.completedSessions||0)),0);
  const adherence = planned > 0 ? clampRatio(completed / planned) : null;
  outcome.adherencePct = adherence === null ? null : Math.round(adherence * 100);
  outcome.confidence = known.length === 4 && completedRunWeeks >= 3 && planned > 0
    ? "high" : completedRunWeeks >= 2 && known.length >= 3 ? "medium" : "low";

  if (completedRunWeeks < 2 || distanceSamples.length < 3) {
    outcome.reasons.push("No hay suficientes entrenamientos realmente completados en las cuatro semanas previas.");
    outcome.message = "No podemos validar el objetivo con el historial disponible. Registra o sincroniza entrenamientos recientes.";
    if (weeksAvailable < 3) {
      outcome.status = "not_recommended";
      outcome.message = "El evento está demasiado próximo y además falta historial para justificar el incremento de carga.";
    }
    return outcome;
  }

  // Conservative baseline: median recent weekly volume and median of each week's longest run.
  // Unlike a single personal best, one unusually long session cannot dominate the baseline.
  const longestByWeek = known.map(w => Math.max(0,...(w.completedRunDistancesKm || [])
    .filter(n => Number.isFinite(n) && n > 0 && n < 150))).filter(v=>v>0);
  const baselineLong = floorHalf(median(longestByWeek));
  const baselineVolume = floorHalf(median(totals));
  outcome.baselineLongRunKm = baselineLong;
  outcome.baselineWeeklyVolumeKm = baselineVolume;

  const hardCap = req.targetDistanceKm === 21 ? 21.1 : req.targetDistanceKm === 42 ? 32 : Number.POSITIVE_INFINITY;
  let longRun = Math.max(0,baselineLong);
  let volume = Math.max(0,baselineVolume);
  let peakLong = longRun;
  let peakVolume = volume;
  // Build, recovery, taper and race weeks have different intent. Do not prescribe the race as a training long run.
  for (let i = 1; i <= weeksAvailable; i++) {
    const isRace = i === weeksAvailable;
    const isTaper = !isRace && i > outcome.buildWeeks;
    const isRecovery = !isRace && !isTaper && i % 4 === 0;
    let phase: SimulatedWeek["phase"] = "build";
    if (isRace) phase = "race";
    else if (isTaper) phase = "taper";
    else if (isRecovery) phase = "recovery";
    if (phase === "build") {
      longRun = floorHalf(Math.min(longRun + Math.min(1.5,longRun * 0.12), hardCap));
      volume = floorHalf(volume * 1.08);
    } else if (phase === "recovery") {
      longRun = floorHalf(longRun * 0.85);
      volume = floorHalf(volume * 0.82);
    } else if (phase === "taper") {
      longRun = floorHalf(longRun * 0.8);
      volume = floorHalf(volume * 0.75);
    } else {
      // Race distance NOT added to training volume or treated as a planned workout.
      longRun = 0; volume = 0;
    }
    if (phase === "build" || phase === "recovery") {
      peakLong = Math.max(peakLong,longRun);
      peakVolume = Math.max(peakVolume,volume);
    }
    outcome.simulatedWeeks.push({
      relativeWeek: i,
      weekStartDate: ymdUTC(start + (i - 1) * WEEK_MS),
      phase,
      longRunUpperKm: longRun,
      weeklyVolumeUpperKm: volume,
    });
  }
  outcome.projectedPeakLongRunKm = floorHalf(peakLong);
  outcome.projectedPeakWeeklyVolumeKm = floorHalf(peakVolume);

  const longRatio = peakLong / outcome.readinessGuidelines.longRunKm;
  const volumeRatio = peakVolume / outcome.readinessGuidelines.weeklyVolumeKm;
  const alreadyAtGuideline = baselineLong >= outcome.readinessGuidelines.longRunKm &&
    baselineVolume >= outcome.readinessGuidelines.weeklyVolumeKm;
  // An athlete who ALREADY has an established base should not be automatically
  // classified as challenging merely because fewer build weeks remain.
  const minimumBuildWeeks = alreadyAtGuideline ? 2 : 4;
  const adequateHistory = known.length >= 3 && completedRunWeeks >= 3;
  const highRecoveryRisk = (req.fatigueScore ?? 0) >= 4 || (req.sorenessScore ?? 0) >= 4 ||
    ((req.sleepQualityScore ?? 5) > 0 && (req.sleepQualityScore ?? 5) <= 2);
  if (highRecoveryRisk) outcome.reasons.push("El check-in reciente sugiere recuperación insuficiente; no se debe intensificar automáticamente.");
  if (weeksAvailable < 1 + outcome.taperWeeks + minimumBuildWeeks) outcome.reasons.push("Quedan pocas semanas completas de entrenamiento para construir base y reducir carga antes del evento.");
  if (longRatio < 1) outcome.reasons.push("La tirada larga proyectada no alcanza el umbral interno orientativo del objetivo.");
  if (volumeRatio < 1) outcome.reasons.push("El volumen semanal proyectado no alcanza el umbral interno orientativo del objetivo.");
  if (adherence !== null && adherence < 0.6) outcome.reasons.push("La adherencia reciente es baja; no es razonable asumir aumentos de carga sostenidos.");
  if (!adequateHistory) outcome.reasons.push("Sólo hay evidencia parcial del entrenamiento reciente.");

  if (weeksAvailable <= 1 + outcome.taperWeeks) {
    // A near-immediate event does not leave build time, regardless of missing uploads.
    outcome.status = "not_recommended";
  } else if (!adequateHistory) {
    // Missing runs may mean unsynchronized data, not necessarily insufficient fitness.
    // Do not assert physical unpreparedness from an incomplete history.
    outcome.status = "insufficient_data";
  } else if (longRatio < 0.8 || volumeRatio < 0.7 || (adherence !== null && adherence < 0.5)) {
    outcome.status = "not_recommended";
  } else if (highRecoveryRisk || longRatio < 1 || volumeRatio < 1 || adherence === null || adherence < 0.75 || weeksAvailable < 1 + outcome.taperWeeks + minimumBuildWeeks) {
    outcome.status = "challenging";
  } else {
    outcome.status = "feasible";
  }

  const messages: Record<FeasibilityStatus,string> = {
    feasible: "Los datos registrados respaldan una transición gradual según los criterios internos de trAIning. Revisa sensaciones y recuperación durante el proceso.",
    challenging: "El objetivo exige cautela. La preparación deberá ser conservadora y puede requerir modificar expectativas.",
    not_recommended: "La fecha y la carga reciente no respaldan esta transición. Te recomendamos revisar la distancia o posponer el objetivo.",
    insufficient_data: "Falta historial suficiente para verificar una transición. Registra actividades antes de confirmar el objetivo.",
  };
  outcome.message = messages[outcome.status];
  outcome.requiresExplicitReview = outcome.status !== "feasible";
  return outcome;
}
