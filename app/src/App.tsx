import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, RefObject } from "react";

const API_URL = "https://trainingapp-api.marco-cruz.workers.dev";

const PAYPAL_STARTER_PLAN_ID = "P-8NB63062HL487521UNHYRSJI";
const PAYPAL_PERFORMANCE_PLAN_ID = "P-4C338724PN8826316NHYRSJQ";
const PAYPAL_PRO_PLAN_ID = "P-2G5092788J304935ENHYRSJQ";

const AUTH_TOKEN_KEY = "trainingapp_auth_token";

const BETA_COPY = {
  badge: "Acceso anticipado",
  title: "Beta pagada activa",
  short:
    "Genera tu plan de running hoy. Conecta Strava para medir tu progreso y preparar futuros ajustes inteligentes.",
  long:
    "Estás usando una versión de acceso anticipado. El plan actual se genera con lógica estándar por objetivo, distancia, nivel, disponibilidad y fecha. La capa de ajustes inteligentes con IA se liberará progresivamente usando tu historial de entrenamiento.",
};

type TabMode =
  | "home"
  | "onboarding"
  | "plan"
  | "metrics"
  | "membership"
  | "profile"
  | "login"
  | "register";

type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type Membership = {
  id?: string;
  plan_code?: string | null;
  status?: string | null;
  provider_subscription_id?: string | null;
  payer_email?: string | null;
  updated_at?: string | null;
};

type Entitlements = {
  has_active_membership?: number;
  can_generate_base_plan?: number;
  can_connect_strava?: number;
  can_use_strava_metrics?: number;
  can_generate_advanced_plan?: number;
  can_regenerate_with_history?: number;
  can_use_premium_planning?: number;
  source_plan_code?: string | null;
};

type StravaStatus = {
  connected: boolean;
  status?: string;
  scope?: string | null;
  athleteId?: string | null;
  lastSyncAt?: string | null;
};

type Session = {
  id?: string;
  day_of_week?: string;
  session_type?: string;
  title: string;
  objective?: string;
  distance_target?: number | null;
  duration_target?: number | null;
  intensity_zone?: string;
  warmup_text?: string;
  main_set_text?: string;
  cooldown_text?: string;
  estimated_load?: number;
  status?: string;
};

type Week = {
  id?: string;
  week_number: number;
  focus_label?: string;
  total_target_distance?: number;
  notes?: string | null;
  sessions: Session[];
};

type MetricsWindow = {
  windowDays: number;
  totalDistanceKm: number;
  totalMovingTimeSeconds: number;
  activityCount: number;
  avgDistanceKm: number;
  longRunKm: number;
  avgPaceSecondsPerKm: number;
  daysActive: number;
  consistencyScore: number;
  trainingLoadScore: number;
  snapshotDate?: string;
  createdAt?: string;
};

type MetricsResponse = {
  days7: MetricsWindow | null;
  days28: MetricsWindow | null;
  days56: MetricsWindow | null;
};

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: {
        style?: Record<string, unknown>;
        createSubscription: (
          data: unknown,
          actions: {
            subscription: {
              create: (input: {
                plan_id: string;
                custom_id?: string;
              }) => Promise<string>;
            };
          }
        ) => Promise<string>;
        onApprove?: (data: { subscriptionID?: string }) => void | Promise<void>;
        onError?: (error: unknown) => void;
      }) => {
        render: (selector: string | HTMLElement) => Promise<void>;
      };
    };
  }
}

function loadPayPalSdk(clientId: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.paypal) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[data-paypal-sdk="true"]');
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId
    )}&vault=true&intent=subscription&currency=MXN`;
    script.async = true;
    script.dataset.paypalSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No fue posible cargar PayPal"));
    document.body.appendChild(script);
  });
}

function formatPace(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "--";
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${min}:${sec}/km`;
}

function formatTime(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

function getPlanLabel(planCode?: string | null) {
  if (planCode === "starter") return "Starter";
  if (planCode === "performance") return "Performance";
  if (planCode === "pro_coach") return "Pro Coach";
  return "Sin plan";
}

function getStatusLabel(status?: string | null) {
  if (status === "active") return "Activa";
  if (status === "pending_activation") return "Pendiente";
  if (status === "cancelled") return "Cancelada";
  if (status === "suspended") return "Suspendida";
  if (status === "expired") return "Expirada";
  return status || "Sin estado";
}

function getAllowedDistances(planCode?: string | null) {
  if (planCode === "starter") return ["5K", "10K", "15K"];
  if (planCode === "performance" || planCode === "pro_coach") {
    return ["5K", "10K", "15K", "21K", "42K"];
  }
  return ["5K", "10K", "15K"];
}

function hasAnyMetric(metrics: MetricsResponse | null) {
  return Boolean(
    metrics?.days7?.activityCount ||
      metrics?.days28?.activityCount ||
      metrics?.days56?.activityCount
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabMode>("login");
  const [authLoading, setAuthLoading] = useState(true);
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [strava, setStrava] = useState<StravaStatus>({
    connected: false,
    status: "not_connected",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    goal: "Completar una carrera",
    distance: "10K",
    daysPerWeek: 4,
    level: "Principiante",
    currentVolumeKm: 10,
    eventName: "",
    eventDate: "",
  });

  const [weeks, setWeeks] = useState<Week[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [result, setResult] = useState("");

  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [stravaLoading, setStravaLoading] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState("");

  const starterRef = useRef<HTMLDivElement | null>(null);
  const performanceRef = useRef<HTMLDivElement | null>(null);
  const proRef = useRef<HTMLDivElement | null>(null);

  const planCode =
    entitlements?.source_plan_code || membership?.plan_code || null;
  const hasActiveMembership = Boolean(entitlements?.has_active_membership);
  const canConnectStrava = Boolean(entitlements?.can_connect_strava);
  const isProCoach = planCode === "pro_coach";
  const allowedDistances = getAllowedDistances(planCode);

  const currentWeek = useMemo(() => weeks[0] || null, [weeks]);
  const currentSessions = currentWeek?.sessions || [];
  const highlightedSession = currentSessions[0] || null;
  const mainMetric = metrics?.days28 || metrics?.days7 || null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaStatus = params.get("strava");

    if (stravaStatus) {
      if (stravaStatus === "connected") {
        setResult(
          "Strava conectado correctamente. Ya puedes sincronizar tus actividades."
        );
        setActiveTab("metrics");
      } else {
        setResult(`Resultado de Strava: ${stravaStatus}`);
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_TOKEN_KEY) || "";
    if (stored) {
      setAuthToken(stored);
    } else {
      setAuthLoading(false);
      setActiveTab("login");
    }
  }, []);

  useEffect(() => {
    async function boot() {
      if (!authToken) return;

      try {
        setAuthLoading(true);
        await refreshMe(authToken);
        setActiveTab((prev) =>
          prev === "login" || prev === "register" ? "home" : prev
        );
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setAuthToken("");
        setAuthUser(null);
        setMembership(null);
        setEntitlements(null);
        setStrava({ connected: false, status: "not_connected" });
        setActiveTab("login");
      } finally {
        setAuthLoading(false);
      }
    }

    boot();
  }, [authToken]);

  useEffect(() => {
    if (!authUser || !authToken) return;
    fetchPlanSilently();
    fetchMetricsSilently();
  }, [authUser?.id, authToken]);

  useEffect(() => {
    if (!allowedDistances.includes(form.distance)) {
      setForm((prev) => ({
        ...prev,
        distance: allowedDistances[0] || "5K",
      }));
    }
  }, [planCode]);

  useEffect(() => {
    async function initPayPal() {
      if (activeTab !== "membership") return;
      if (paypalReady) return;

      try {
        setPaypalLoading(true);
        setPaypalError("");
        const res = await fetch(`${API_URL}/api/paypal/config`);
        const data = await res.json();

        if (!res.ok || !data.clientId) {
          throw new Error("No fue posible cargar configuración de PayPal");
        }

        await loadPayPalSdk(data.clientId);
        setPaypalReady(true);
      } catch (error) {
        setPaypalError(
          error instanceof Error ? error.message : "Error al cargar PayPal"
        );
      } finally {
        setPaypalLoading(false);
      }
    }

    initPayPal();
  }, [activeTab, paypalReady]);

  useEffect(() => {
    if (activeTab !== "membership" || !paypalReady || !window.paypal || !authUser) {
      return;
    }

    renderPayPalButton(starterRef, PAYPAL_STARTER_PLAN_ID, "Starter");
    renderPayPalButton(performanceRef, PAYPAL_PERFORMANCE_PLAN_ID, "Performance");
    renderPayPalButton(proRef, PAYPAL_PRO_PLAN_ID, "Pro Coach");
  }, [activeTab, paypalReady, authUser?.id]);

  async function refreshMe(token: string) {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "No fue posible consultar la sesión");
    }

    setAuthUser(data.user || null);
    setMembership(data.membership || null);
    setEntitlements(data.entitlements || null);
    setStrava(
      data.strava || {
        connected: false,
        status: "not_connected",
      }
    );

    setForm((prev) => ({
      ...prev,
      name: data.user?.name || prev.name,
      email: data.user?.email || prev.email,
    }));
  }

  async function fetchPlanSilently() {
    if (!authUser?.id) return;

    try {
      const res = await fetch(`${API_URL}/api/plan/${authUser.id}`);
      const data = await res.json();

      if (res.ok) {
        setWeeks(data.weeks || []);
      }
    } catch {
      // Sin bloquear UI
    }
  }

  async function fetchMetricsSilently() {
    if (!authToken) return;

    try {
      const res = await fetch(`${API_URL}/api/metrics/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setMetrics(data.metrics || null);
      }
    } catch {
      // Sin bloquear UI
    }
  }

  async function renderPayPalButton(
    ref: RefObject<HTMLDivElement | null>,
    paypalPlanId: string,
    label: string
  ) {
    if (!ref.current || !authUser || !window.paypal) return;

    ref.current.innerHTML = "";

    await window.paypal
      .Buttons({
        style: {
          shape: "pill",
          color: "gold",
          layout: "vertical",
          label: "subscribe",
        },
        createSubscription: (_data, actions) => {
          return actions.subscription.create({
            plan_id: paypalPlanId,
            custom_id: authUser.id,
          });
        },
        onApprove: async (data) => {
          try {
            const subscriptionId = data.subscriptionID || "";
            if (!subscriptionId) {
              throw new Error("PayPal no devolvió subscriptionID");
            }

            const res = await fetch(`${API_URL}/api/paypal/link-subscription`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: authUser.id,
                subscriptionId,
              }),
            });

            const linkData = await res.json();

            if (!res.ok) {
              throw new Error(
                linkData?.error || "No fue posible enlazar la suscripción"
              );
            }

            if (authToken) {
              await refreshMe(authToken);
              await fetchPlanSilently();
              await fetchMetricsSilently();
            }

            setResult(`Membresía ${label} activada correctamente.`);
            setActiveTab("home");
          } catch (error) {
            setResult(
              error instanceof Error
                ? error.message
                : "Error al activar suscripción"
            );
          }
        },
        onError: () => {
          setResult(`Ocurrió un error al iniciar ${label}.`);
        },
      })
      .render(ref.current);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setResult("");

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No fue posible iniciar sesión");
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      setAuthToken(data.token);
      await refreshMe(data.token);
      setActiveTab("home");
      setResult("Sesión iniciada correctamente.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegisterLoading(true);
    setResult("");

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No fue posible crear la cuenta");
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      setAuthToken(data.token);
      await refreshMe(data.token);
      setActiveTab("onboarding");
      setResult("Cuenta creada. Completa tu perfil para generar tu plan.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setRegisterLoading(false);
    }
  }

  async function handleLogout() {
    try {
      if (authToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      }
    } catch {
      // Sin bloquear logout
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthToken("");
      setAuthUser(null);
      setMembership(null);
      setEntitlements(null);
      setStrava({ connected: false, status: "not_connected" });
      setWeeks([]);
      setMetrics(null);
      setActiveTab("login");
      setResult("Sesión cerrada.");
    }
  }

  async function handleOnboarding(e: FormEvent) {
    e.preventDefault();
    if (!authUser) return;

    setLoading(true);
    setResult("");

    try {
      const payload = {
        ...form,
        name: authUser.name,
        email: authUser.email,
        userId: authUser.id,
      };

      const res = await fetch(`${API_URL}/api/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No fue posible guardar onboarding");
      }

      if (hasActiveMembership) {
        await generatePlan();
        setActiveTab("plan");
      } else {
        setActiveTab("membership");
        setResult("Perfil guardado. Activa una membresía para generar tu plan.");
      }
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function generatePlan() {
    if (!authUser) return;

    setPlanLoading(true);
    setResult("");

    try {
      const payload = {
        ...form,
        name: authUser.name,
        email: authUser.email,
        userId: authUser.id,
      };

      const res = await fetch(`${API_URL}/api/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No fue posible generar el plan");
      }

      await fetchPlanSilently();
      setResult("Plan generado correctamente.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setPlanLoading(false);
    }
  }

  async function connectStrava() {
    if (!authToken) return;

    setStravaLoading(true);
    setResult("");

    try {
      const res = await fetch(`${API_URL}/api/strava/connect-url`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No fue posible conectar Strava");
      }

      window.location.href = data.url;
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setStravaLoading(false);
    }
  }

  async function syncStrava() {
    if (!authToken) return;

    setStravaLoading(true);
    setResult("");

    try {
      const res = await fetch(`${API_URL}/api/strava/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No fue posible sincronizar Strava");
      }

      setMetrics(data.metrics || null);
      await refreshMe(authToken);
      await fetchMetricsSilently();

      setResult(
        `Strava sincronizado. Actividades consultadas: ${
          data.fetched || 0
        }. Actividades guardadas/actualizadas: ${data.stored || 0}.`
      );
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setStravaLoading(false);
    }
  }

  async function saveQuickCheckin() {
    if (!authToken) return;

    setLoading(true);
    setResult("");

    try {
      const res = await fetch(`${API_URL}/api/checkins/weekly`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          trainingPlanId: null,
          weekNumber: currentWeek?.week_number || 1,
          energyScore: 4,
          fatigueScore: 2,
          sorenessScore: 2,
          sleepQualityScore: 4,
          notes: "Check-in rápido desde dashboard.",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No fue posible guardar check-in");
      }

      setResult(`Check-in guardado. Recomendación: ${data.recommendation}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="loading-screen">
        <style>{styles}</style>
        <div className="loading-card">
          <div className="brand">trAIning</div>
          <p>Cargando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <style>{styles}</style>

      <div className="glow glow-one" />
      <div className="glow glow-two" />

      <div className={authUser ? "layout" : "public-layout"}>
        {authUser && (
          <aside className="sidebar">
            <div>
              <div className="brand">trAIning</div>
              <div className="brand-subtitle">Running Intelligence</div>

              <div className="profile-card">
                <strong>{authUser.name}</strong>
                <span>{authUser.email}</span>
                <em>{getPlanLabel(planCode)}</em>
              </div>

              <nav className="nav">
                <NavButton active={activeTab === "home"} onClick={() => setActiveTab("home")}>
                  Home
                </NavButton>
                <NavButton active={activeTab === "onboarding"} onClick={() => setActiveTab("onboarding")}>
                  Objetivo
                </NavButton>
                <NavButton active={activeTab === "plan"} onClick={() => setActiveTab("plan")}>
                  Mi plan
                </NavButton>
                <NavButton active={activeTab === "metrics"} onClick={() => setActiveTab("metrics")}>
                  Métricas
                </NavButton>
                <NavButton active={activeTab === "membership"} onClick={() => setActiveTab("membership")}>
                  Membresía
                </NavButton>
                <NavButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>
                  Perfil
                </NavButton>
              </nav>
            </div>

            <button className="logout-button" onClick={handleLogout}>
              Cerrar sesión
            </button>
          </aside>
        )}

        <main className="main">
          {!authUser && (
            <PublicLandingIntro
              onLogin={() => setActiveTab("login")}
              onCreateAccount={() => setActiveTab("register")}
            />
          )}

          {!authUser && activeTab === "login" && (
            <AuthCard
              title="Iniciar sesión"
              subtitle="Entra para consultar tu plan, membresía, Strava y métricas."
            >
              <form className="form" onSubmit={handleLogin}>
                <BetaBanner compact />

                <Field label="Correo">
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) =>
                      setLoginForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    required
                    placeholder="tucorreo@email.com"
                  />
                </Field>

                <Field label="Contraseña">
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) =>
                      setLoginForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    required
                    placeholder="********"
                  />
                </Field>

                <button className="primary-button" disabled={loginLoading}>
                  {loginLoading ? "Entrando..." : "Iniciar sesión"}
                </button>

                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setActiveTab("register")}
                >
                  Crear cuenta
                </button>
              </form>
            </AuthCard>
          )}

          {!authUser && activeTab === "register" && (
            <AuthCard
              title="Crear cuenta"
              subtitle="Crea tu usuario para generar tu plan y activar tu membresía."
            >
              <form className="form" onSubmit={handleRegister}>
                <BetaBanner compact />

                <Field label="Nombre">
                  <input
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required
                    placeholder="Tu nombre"
                  />
                </Field>

                <Field label="Correo">
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    required
                    placeholder="tucorreo@email.com"
                  />
                </Field>

                <Field label="Contraseña">
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                  />
                </Field>

                <button className="primary-button" disabled={registerLoading}>
                  {registerLoading ? "Creando..." : "Crear cuenta"}
                </button>

                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setActiveTab("login")}
                >
                  Ya tengo cuenta
                </button>
              </form>
            </AuthCard>
          )}

          {authUser && activeTab === "home" && (
            <section className="card">
              <Header
                badge="Dashboard"
                title="Tu entrenamiento"
                subtitle="Genera tu plan, conecta Strava y mide tu progreso desde una sola vista."
              />

              <BetaBanner />

              <div className="metrics-grid">
                <StatCard
                  label="Membresía"
                  value={getPlanLabel(planCode)}
                  hint={getStatusLabel(membership?.status)}
                />
                <StatCard
                  label="Semana visible"
                  value={currentWeek ? `#${currentWeek.week_number}` : "--"}
                  hint={currentWeek?.focus_label || "Sin plan cargado"}
                />
                <StatCard
                  label="Km planeados"
                  value={
                    currentWeek?.total_target_distance
                      ? `${currentWeek.total_target_distance} km`
                      : "--"
                  }
                  hint={
                    currentSessions.length
                      ? `${currentSessions.length} sesiones`
                      : "Sin sesiones"
                  }
                />
                <StatCard
                  label="Strava"
                  value={strava.connected ? "Conectado" : "No conectado"}
                  hint={canConnectStrava ? "Disponible en beta" : "Requiere Performance"}
                />
              </div>

              <div className="split-grid">
                <div className="hero-card">
                  <span className="chip lime">Sesión destacada</span>
                  <h2>{highlightedSession?.title || "Configura tu plan"}</h2>
                  <p>
                    {highlightedSession?.objective ||
                      "Completa tu objetivo y activa tu membresía para iniciar."}
                  </p>

                  {highlightedSession ? (
                    <button
                      className="primary-button"
                      onClick={() => setSelectedSession(highlightedSession)}
                    >
                      Ver sesión
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={() => setActiveTab("onboarding")}
                    >
                      Completar objetivo
                    </button>
                  )}
                </div>

                <div className="hero-card">
                  <span className="chip lime">Métricas reales</span>
                  <h2>{strava.connected ? "Strava conectado" : "Conecta Strava"}</h2>
                  <p>
                    {strava.connected && mainMetric
                      ? `${mainMetric.totalDistanceKm} km en 28 días · ${mainMetric.activityCount} actividades · ${formatPace(mainMetric.avgPaceSecondsPerKm)}`
                      : strava.connected
                      ? "Ya conectaste Strava. Sincroniza para actualizar tus datos."
                      : "Performance y Pro Coach pueden conectar Strava para guardar historial y preparar futuros ajustes inteligentes."}
                  </p>

                  {!canConnectStrava && (
                    <button
                      className="ghost-button"
                      onClick={() => setActiveTab("membership")}
                    >
                      Actualizar plan
                    </button>
                  )}

                  {canConnectStrava && !strava.connected && (
                    <button
                      className="ghost-button"
                      disabled={stravaLoading}
                      onClick={connectStrava}
                    >
                      {stravaLoading ? "Conectando..." : "Conectar Strava"}
                    </button>
                  )}

                  {canConnectStrava && strava.connected && (
                    <button
                      className="ghost-button"
                      disabled={stravaLoading}
                      onClick={syncStrava}
                    >
                      {stravaLoading ? "Sincronizando..." : "Sincronizar Strava"}
                    </button>
                  )}
                </div>
              </div>

              {isProCoach && (
                <div className="pro-card">
                  <span className="chip cyan">Pro Coach</span>
                  <h2>Seguimiento semanal</h2>
                  <p>
                    Registra cómo te sentiste y recibe una recomendación semanal
                    mientras activamos la capa de IA.
                  </p>
                  <button
                    className="primary-button"
                    disabled={loading}
                    onClick={saveQuickCheckin}
                  >
                    Guardar check-in rápido
                  </button>
                </div>
              )}
            </section>
          )}

          {authUser && activeTab === "onboarding" && (
            <section className="card">
              <Header
                badge="Objetivo"
                title="Configura tu plan"
                subtitle={
                  planCode === "starter"
                    ? "Starter permite planes 5K, 10K y 15K. Para 21K o 42K cambia a Performance."
                    : "Performance y Pro Coach permiten planes desde 5K hasta 42K."
                }
              />

              <BetaBanner compact />

              <form className="form" onSubmit={handleOnboarding}>
                <div className="two-col">
                  <Field label="Nombre">
                    <input value={authUser.name} disabled />
                  </Field>
                  <Field label="Correo">
                    <input value={authUser.email} disabled />
                  </Field>
                </div>

                <div className="two-col">
                  <Field label="Objetivo">
                    <select
                      value={form.goal}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, goal: e.target.value }))
                      }
                    >
                      <option>Completar una carrera</option>
                      <option>Mejorar tiempo</option>
                      <option>Retomar constancia</option>
                    </select>
                  </Field>

                  <Field label="Distancia">
                    <select
                      value={form.distance}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          distance: e.target.value,
                        }))
                      }
                    >
                      {allowedDistances.map((distance) => (
                        <option key={distance}>{distance}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="two-col">
                  <Field label="Días por semana">
                    <input
                      type="number"
                      min={3}
                      max={6}
                      value={form.daysPerWeek}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          daysPerWeek: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>

                  <Field label="Nivel">
                    <select
                      value={form.level}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, level: e.target.value }))
                      }
                    >
                      <option>Principiante</option>
                      <option>Intermedio</option>
                      <option>Avanzado</option>
                    </select>
                  </Field>
                </div>

                <div className="two-col">
                  <Field label="Volumen semanal actual km">
                    <input
                      type="number"
                      min={0}
                      value={form.currentVolumeKm}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          currentVolumeKm: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>

                  <Field label="Fecha del evento">
                    <input
                      type="date"
                      value={form.eventDate}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          eventDate: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                <Field label="Nombre del evento">
                  <input
                    value={form.eventName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        eventName: e.target.value,
                      }))
                    }
                    placeholder="Ej. 10K Monterrey, Medio Maratón CDMX..."
                  />
                </Field>

                <div className="button-row">
                  <button className="primary-button" disabled={loading}>
                    {loading ? "Guardando..." : "Guardar objetivo"}
                  </button>

                  {hasActiveMembership && (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={planLoading}
                      onClick={generatePlan}
                    >
                      {planLoading ? "Generando..." : "Generar plan"}
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          {authUser && activeTab === "plan" && (
            <section className="card">
              <Header
                badge="Mi plan"
                title="Semana actual"
                subtitle="Tu plan estándar se genera según objetivo, distancia, nivel, disponibilidad y fecha."
              />

              <BetaBanner compact />

              {!currentWeek && (
                <EmptyState
                  title="Aún no tienes plan"
                  text="Completa tu objetivo y activa tu membresía para generar el plan."
                  button="Configurar objetivo"
                  onClick={() => setActiveTab("onboarding")}
                />
              )}

              {currentWeek && (
                <>
                  <div className="week-header">
                    <div>
                      <h2>Semana {currentWeek.week_number}</h2>
                      <p>{currentWeek.focus_label}</p>
                    </div>
                    <strong>{currentWeek.total_target_distance} km</strong>
                  </div>

                  <div className="session-list">
                    {currentWeek.sessions.map((session, index) => (
                      <button
                        className="session-card"
                        key={session.id || index}
                        onClick={() => setSelectedSession(session)}
                      >
                        <div className="session-top">
                          <span>{session.day_of_week || "Sesión"}</span>
                          <em>{session.intensity_zone || "General"}</em>
                        </div>
                        <h3>{session.title}</h3>
                        <p>
                          {session.distance_target
                            ? `${session.distance_target} km`
                            : "Complementario"}
                          {session.duration_target
                            ? ` · ${session.duration_target} min`
                            : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {authUser && activeTab === "metrics" && (
            <section className="card">
              <Header
                badge="Métricas"
                title="Progreso real"
                subtitle="Sincroniza Strava para construir historial y preparar futuros ajustes inteligentes."
              />

              {!canConnectStrava && (
                <EmptyState
                  title="Strava no está incluido en Starter"
                  text="Cambia a Performance para conectar Strava y medir actividades reales."
                  button="Ver planes"
                  onClick={() => setActiveTab("membership")}
                />
              )}

              {canConnectStrava && !strava.connected && (
                <EmptyState
                  title="Conecta Strava"
                  text="Autoriza tu cuenta para sincronizar actividades. Strava está activo en beta para Performance y Pro Coach."
                  button={stravaLoading ? "Conectando..." : "Conectar Strava"}
                  onClick={connectStrava}
                />
              )}

              {canConnectStrava && strava.connected && (
                <>
                  <div className="connected-panel">
                    <div>
                      <span className="chip cyan">Strava conectado</span>
                      <h2>Historial activo</h2>
                      <p>
                        {hasAnyMetric(metrics)
                          ? "Tus métricas ya están disponibles. Este historial será la base para futuros ajustes inteligentes."
                          : "Conexión lista. Sincroniza actividades para actualizar el dashboard."}
                      </p>
                    </div>

                    <button
                      className="primary-button"
                      disabled={stravaLoading}
                      onClick={syncStrava}
                    >
                      {stravaLoading ? "Sincronizando..." : "Sincronizar"}
                    </button>
                  </div>

                  <div className="metrics-grid">
                    <MetricCard title="Últimos 7 días" data={metrics?.days7 || null} />
                    <MetricCard title="Últimos 28 días" data={metrics?.days28 || null} />
                    <MetricCard title="Últimos 56 días" data={metrics?.days56 || null} />
                  </div>
                </>
              )}
            </section>
          )}

          {authUser && activeTab === "membership" && (
            <section className="card">
              <Header
                badge="Membresía"
                title="Elige tu plan"
                subtitle="Starter para comenzar, Performance como plan principal y Pro Coach para seguimiento avanzado."
              />

              <BetaBanner />

              {paypalLoading && <div className="notice">Cargando PayPal...</div>}
              {paypalError && <div className="notice error">{paypalError}</div>}

              <div className="pricing-grid">
                <PlanCard
                  title="Starter"
                  price="$149 MXN"
                  tag="Hasta 15K"
                  description="Empieza con un plan claro para 5K, 10K o 15K."
                  features={[
                    "Planes 5K, 10K y 15K",
                    "Plan estándar por objetivo",
                    "Dashboard básico",
                    "Métricas del plan",
                    "Sin Strava",
                  ]}
                  paypalRef={starterRef}
                />

                <PlanCard
                  title="Performance"
                  price="$249 MXN"
                  tag="Recomendado"
                  description="Entrena con plan completo, Strava y métricas reales hasta maratón."
                  featured
                  features={[
                    "Planes 5K a 42K",
                    "Conexión con Strava en beta",
                    "Métricas reales",
                    "Dashboard completo",
                    "Historial para futura IA",
                  ]}
                  paypalRef={performanceRef}
                />

                <PlanCard
                  title="Pro Coach"
                  price="$449 MXN"
                  tag="Premium"
                  description="Todo Performance más check-in semanal y guía extra."
                  features={[
                    "Todo Performance",
                    "Check-in semanal",
                    "Recomendación semanal",
                    "Fuerza y movilidad",
                    "Acceso prioritario a IA",
                  ]}
                  paypalRef={proRef}
                />
              </div>
            </section>
          )}

          {authUser && activeTab === "profile" && (
            <section className="card">
              <Header
                badge="Perfil"
                title="Cuenta y acceso"
                subtitle="Revisa tu usuario, membresía, conexión de Strava y permisos activos."
              />

              <div className="metrics-grid">
                <StatCard label="Nombre" value={authUser.name} />
                <StatCard label="Correo" value={authUser.email} />
                <StatCard label="Plan" value={getPlanLabel(planCode)} />
                <StatCard label="Estado" value={getStatusLabel(membership?.status)} />
                <StatCard
                  label="Strava"
                  value={strava.connected ? "Conectado" : "No conectado"}
                />
                <StatCard
                  label="Premium"
                  value={isProCoach ? "Activo" : "No activo"}
                />
              </div>
            </section>
          )}

          {result && <div className="notice">{result}</div>}
        </main>
      </div>

      {authUser && (
        <nav className="mobile-nav">
          <button onClick={() => setActiveTab("home")} className={activeTab === "home" ? "active" : ""}>
            Home
          </button>
          <button onClick={() => setActiveTab("plan")} className={activeTab === "plan" ? "active" : ""}>
            Plan
          </button>
          <button onClick={() => setActiveTab("metrics")} className={activeTab === "metrics" ? "active" : ""}>
            Métricas
          </button>
          <button onClick={() => setActiveTab("membership")} className={activeTab === "membership" ? "active" : ""}>
            Planes
          </button>
        </nav>
      )}

      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="chip cyan">{selectedSession.day_of_week || "Sesión"}</span>
                <h2>{selectedSession.title}</h2>
              </div>
              <button onClick={() => setSelectedSession(null)}>✕</button>
            </div>

            <p className="modal-meta">
              {selectedSession.distance_target
                ? `${selectedSession.distance_target} km`
                : "Complementario"}
              {selectedSession.duration_target
                ? ` · ${selectedSession.duration_target} min`
                : ""}
              {selectedSession.intensity_zone
                ? ` · ${selectedSession.intensity_zone}`
                : ""}
            </p>

            <Detail title="Objetivo" text={selectedSession.objective} />
            <Detail title="Calentamiento" text={selectedSession.warmup_text} />
            <Detail title="Bloque principal" text={selectedSession.main_set_text} />
            <Detail title="Enfriamiento" text={selectedSession.cooldown_text} />
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "nav-button active" : "nav-button"} onClick={onClick}>
      {children}
    </button>
  );
}

function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="auth-card">
      <span className="chip cyan">Acceso</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </section>
  );
}

function PublicLandingIntro({
  onLogin,
  onCreateAccount,
}: {
  onLogin: () => void;
  onCreateAccount: () => void;
}) {
  return (
    <section className="public-hero">
      <span className="chip lime">{BETA_COPY.badge}</span>
      <h1>Planes de running listos para entrenar hoy</h1>
      <p className="public-lead">
        Crea tu plan por objetivo, distancia, nivel y disponibilidad. Conecta Strava
        en Performance o Pro Coach para medir tu progreso y preparar futuros ajustes
        inteligentes.
      </p>

      <div className="public-actions">
        <button className="primary-button" onClick={onCreateAccount}>
          Crear cuenta
        </button>
        <button className="ghost-button" onClick={onLogin}>
          Ya tengo cuenta
        </button>
      </div>

      <div className="public-feature-grid">
        <div>
          <strong>Starter</strong>
          <span>Planes 5K, 10K y 15K para empezar con estructura clara.</span>
        </div>
        <div>
          <strong>Performance</strong>
          <span>Hasta 42K, conexión con Strava y métricas reales.</span>
        </div>
        <div>
          <strong>Pro Coach</strong>
          <span>Todo Performance más check-in semanal y guía extra.</span>
        </div>
      </div>

      <div className="public-beta-note">
        <strong>Beta pagada activa</strong>
        <p>{BETA_COPY.long}</p>
      </div>
    </section>
  );
}

function Header({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="header">
      <span className="chip cyan">{badge}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function BetaBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "beta-banner compact" : "beta-banner"}>
      <span className="chip lime">{BETA_COPY.badge}</span>
      <div>
        <strong>{BETA_COPY.title}</strong>
        <p>{compact ? BETA_COPY.short : BETA_COPY.long}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <em>{hint}</em>}
    </div>
  );
}

function EmptyState({
  title,
  text,
  button,
  onClick,
}: {
  title: string;
  text: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary-button" onClick={onClick}>
        {button}
      </button>
    </div>
  );
}

function MetricCard({
  title,
  data,
}: {
  title: string;
  data: MetricsWindow | null;
}) {
  return (
    <div className="metric-card">
      <span>{title}</span>
      <strong>{data ? `${data.totalDistanceKm} km` : "--"}</strong>
      <em>
        {data
          ? `${data.activityCount} actividades · ${formatTime(
              data.totalMovingTimeSeconds
            )}`
          : "Sin datos"}
      </em>

      <div className="mini-metrics">
        <p>Ritmo: {data ? formatPace(data.avgPaceSecondsPerKm) : "--"}</p>
        <p>Tirada: {data ? `${data.longRunKm} km` : "--"}</p>
        <p>Activo: {data ? `${data.daysActive} días` : "--"}</p>
        <p>Consistencia: {data ? `${data.consistencyScore}%` : "--"}</p>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  tag,
  description,
  features,
  paypalRef,
  featured,
}: {
  title: string;
  price: string;
  tag: string;
  description: string;
  features: string[];
  paypalRef: RefObject<HTMLDivElement | null>;
  featured?: boolean;
}) {
  return (
    <div className={featured ? "price-card featured" : "price-card"}>
      <span className="chip lime">{tag}</span>
      <h2>{title}</h2>
      <strong>{price}</strong>
      <em>mensual</em>
      <p className="plan-description">{description}</p>

      <ul>
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <div className="paypal-box">
        <div ref={paypalRef} />
      </div>
    </div>
  );
}

function Detail({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;

  return (
    <div className="detail">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

const styles = `
* {
  box-sizing: border-box;
}

html, body, #root {
  min-height: 100%;
}

body {
  margin: 0;
  background: #070B10;
}

button,
input,
select {
  font: inherit;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(0, 230, 255, 0.12), transparent 28%),
    radial-gradient(circle at top right, rgba(214, 255, 77, 0.12), transparent 30%),
    linear-gradient(180deg, #070B10 0%, #0B0F14 100%);
  color: white;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  padding: 20px;
  position: relative;
  overflow-x: hidden;
}

.glow {
  position: fixed;
  width: 360px;
  height: 360px;
  border-radius: 999px;
  filter: blur(90px);
  pointer-events: none;
  z-index: 0;
}

.glow-one {
  top: -120px;
  right: -80px;
  background: rgba(214, 255, 77, 0.08);
}

.glow-two {
  bottom: -120px;
  left: -80px;
  background: rgba(0, 230, 255, 0.08);
}

.layout {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  position: relative;
  z-index: 1;
}

.public-layout {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  min-height: calc(100vh - 40px);
  display: grid;
  position: relative;
  z-index: 1;
}

.public-layout .main {
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr);
  align-items: center;
  min-height: calc(100vh - 40px);
}

.sidebar {
  min-height: calc(100vh - 40px);
  border-radius: 30px;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.09);
  padding: 22px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  backdrop-filter: blur(14px);
  box-shadow: 0 24px 70px rgba(0,0,0,0.28);
}

.brand {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  border-radius: 18px;
  background: rgba(214,255,77,0.11);
  color: #D6FF4D;
  font-weight: 950;
  letter-spacing: 0.04em;
  border: 1px solid rgba(214,255,77,0.18);
}

.brand-subtitle {
  margin-top: 12px;
  color: #00E6FF;
  font-size: 12px;
  letter-spacing: 0.16em;
  font-weight: 900;
}

.profile-card {
  margin-top: 24px;
  border-radius: 22px;
  padding: 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  display: grid;
  gap: 8px;
}

.profile-card strong {
  font-size: 18px;
}

.profile-card span {
  color: rgba(255,255,255,0.62);
  font-size: 13px;
  word-break: break-word;
}

.profile-card em {
  width: fit-content;
  margin-top: 6px;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(0,230,255,0.1);
  color: #00E6FF;
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
}

.nav {
  margin-top: 22px;
  display: grid;
  gap: 8px;
}

.nav-button,
.logout-button {
  width: 100%;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.76);
  border-radius: 16px;
  padding: 13px 14px;
  font-weight: 900;
  text-align: left;
  cursor: pointer;
}

.nav-button.active {
  background: rgba(214,255,77,0.12);
  color: #D6FF4D;
}

.logout-button {
  text-align: center;
}

.main {
  display: grid;
  gap: 18px;
  align-content: start;
}

.card,
.auth-card,
.loading-card {
  background: linear-gradient(180deg, rgba(17,22,29,0.98), rgba(11,15,20,0.96));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 30px;
  padding: 26px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.34);
}

.auth-card {
  width: 100%;
}

.public-hero {
  background: linear-gradient(135deg, rgba(214,255,77,0.12), rgba(0,230,255,0.08), rgba(255,255,255,0.035));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 34px;
  padding: 34px;
  box-shadow: 0 24px 70px rgba(0,0,0,0.34);
}

.public-hero h1 {
  font-size: clamp(42px, 6vw, 74px);
  line-height: 0.98;
  margin: 18px 0 0;
  letter-spacing: -0.055em;
}

.public-lead {
  color: rgba(255,255,255,0.72);
  font-size: 18px;
  line-height: 1.6;
  margin: 18px 0 0;
  max-width: 720px;
}

.public-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 26px;
}

.public-feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 28px;
}

.public-feature-grid div,
.public-beta-note {
  border-radius: 20px;
  padding: 16px;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.08);
}

.public-feature-grid strong,
.public-beta-note strong {
  display: block;
  color: #D6FF4D;
  font-weight: 950;
}

.public-feature-grid span,
.public-beta-note p {
  display: block;
  color: rgba(255,255,255,0.68);
  line-height: 1.5;
  margin-top: 8px;
  font-size: 14px;
}

.public-beta-note {
  margin-top: 14px;
}

.loading-screen {
  min-height: 100vh;
  background: #070B10;
  color: white;
  display: grid;
  place-items: center;
  padding: 24px;
}

.loading-card {
  text-align: center;
}

.chip {
  display: inline-flex;
  width: fit-content;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 950;
}

.chip.cyan {
  background: rgba(0,230,255,0.10);
  color: #00E6FF;
}

.chip.lime {
  background: rgba(214,255,77,0.10);
  color: #D6FF4D;
}

.header {
  margin-bottom: 20px;
}

.header h1,
.auth-card h1 {
  font-size: clamp(34px, 5vw, 58px);
  line-height: 1.02;
  margin: 16px 0 0;
}

.header p,
.auth-card p,
.hero-card p,
.empty-state p,
.connected-panel p,
.pro-card p {
  margin: 12px 0 0;
  color: rgba(255,255,255,0.68);
  line-height: 1.6;
}

.beta-banner {
  border-radius: 24px;
  padding: 18px;
  margin: 18px 0;
  background: linear-gradient(135deg, rgba(214,255,77,0.12), rgba(0,230,255,0.07));
  border: 1px solid rgba(214,255,77,0.16);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: start;
}

.beta-banner.compact {
  grid-template-columns: 1fr;
  padding: 16px;
}

.beta-banner strong {
  display: block;
  color: #fff;
  font-size: 16px;
  font-weight: 950;
}

.beta-banner p {
  margin: 7px 0 0;
  color: rgba(255,255,255,0.72);
  line-height: 1.55;
  font-size: 14px;
}

.form {
  display: grid;
  gap: 14px;
  margin-top: 22px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: rgba(255,255,255,0.74);
  font-size: 13px;
  font-weight: 900;
}

.field input,
.field select {
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: #0B0F14;
  color: white;
  padding: 14px;
  outline: none;
}

.field input[type="date"] {
  color-scheme: dark;
}

.button-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.primary-button,
.ghost-button {
  border-radius: 16px;
  padding: 14px 18px;
  font-weight: 950;
  cursor: pointer;
  min-width: 170px;
}

.primary-button {
  border: none;
  background: #D6FF4D;
  color: #050505;
}

.ghost-button {
  border: 1px solid rgba(0,230,255,0.22);
  background: rgba(0,230,255,0.12);
  color: #00E6FF;
}

.notice {
  border-radius: 18px;
  border: 1px solid rgba(0,230,255,0.18);
  background: rgba(0,230,255,0.08);
  color: #00E6FF;
  padding: 16px;
  line-height: 1.5;
}

.notice.error {
  border-color: rgba(255,80,80,0.25);
  background: rgba(255,80,80,0.09);
  color: #ff9999;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.stat-card,
.metric-card {
  border-radius: 22px;
  padding: 18px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  min-width: 0;
}

.stat-card span,
.metric-card span {
  color: rgba(255,255,255,0.55);
  font-size: 12px;
  font-weight: 900;
}

.stat-card strong,
.metric-card strong {
  display: block;
  margin-top: 8px;
  color: #D6FF4D;
  font-size: clamp(24px, 4vw, 34px);
  font-weight: 950;
  word-break: break-word;
}

.stat-card em,
.metric-card em {
  display: block;
  margin-top: 6px;
  color: rgba(255,255,255,0.68);
  font-style: normal;
  font-size: 13px;
}

.mini-metrics {
  display: grid;
  gap: 6px;
  margin-top: 14px;
}

.mini-metrics p {
  margin: 0;
  color: rgba(255,255,255,0.65);
  font-size: 13px;
}

.split-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
  margin-top: 18px;
}

.hero-card,
.pro-card,
.connected-panel,
.empty-state {
  border-radius: 26px;
  padding: 22px;
  border: 1px solid rgba(255,255,255,0.08);
}

.hero-card,
.connected-panel {
  background: linear-gradient(135deg, rgba(214,255,77,0.12), rgba(0,230,255,0.08), rgba(255,255,255,0.03));
}

.pro-card {
  margin-top: 18px;
  background: rgba(214,255,77,0.08);
  border-color: rgba(214,255,77,0.15);
}

.empty-state {
  margin-top: 20px;
  background: rgba(255,255,255,0.035);
}

.hero-card h2,
.pro-card h2,
.connected-panel h2,
.empty-state h2,
.week-header h2 {
  font-size: clamp(26px, 4vw, 36px);
  line-height: 1.08;
  margin: 16px 0 0;
}

.hero-card .primary-button,
.hero-card .ghost-button,
.empty-state .primary-button,
.connected-panel .primary-button,
.pro-card .primary-button {
  margin-top: 18px;
}

.connected-panel {
  margin-top: 18px;
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: space-between;
}

.week-header {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
}

.week-header p {
  color: rgba(255,255,255,0.68);
  margin: 8px 0 0;
}

.week-header strong {
  color: #D6FF4D;
  font-size: 34px;
  font-weight: 950;
}

.session-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.session-card {
  border: 1px solid rgba(255,255,255,0.08);
  background: #0B0F14;
  color: white;
  border-radius: 18px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
}

.session-card h3 {
  margin: 8px 0 0;
  font-size: 18px;
}

.session-card p {
  color: rgba(255,255,255,0.64);
  font-size: 13px;
  margin: 7px 0 0;
}

.session-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.session-top span {
  color: #D6FF4D;
  font-size: 12px;
  font-weight: 950;
}

.session-top em {
  color: #00E6FF;
  font-size: 12px;
  font-style: normal;
  font-weight: 950;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 22px;
}

.price-card {
  border-radius: 24px;
  padding: 20px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  min-height: 590px;
  overflow: hidden;
}

.price-card.featured {
  box-shadow: 0 0 0 1px rgba(214,255,77,0.20), 0 18px 40px rgba(214,255,77,0.08);
}

.price-card h2 {
  font-size: 26px;
  margin: 14px 0 0;
}

.price-card > strong {
  color: #D6FF4D;
  font-size: 34px;
  font-weight: 950;
  margin-top: 12px;
}

.price-card > em {
  color: rgba(255,255,255,0.62);
  font-size: 13px;
  font-style: normal;
  margin-top: 4px;
}

.plan-description {
  color: rgba(255,255,255,0.68);
  line-height: 1.5;
  font-size: 14px;
  margin: 14px 0 0;
}

.price-card ul {
  display: grid;
  gap: 12px;
  margin: 24px 0 0;
  padding-left: 18px;
  color: rgba(255,255,255,0.78);
  line-height: 1.45;
}

.paypal-box {
  margin-top: auto;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  padding-top: 20px;
}

.paypal-box > div {
  transform: scale(0.94);
  transform-origin: center bottom;
}

.mobile-nav {
  display: none;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4,7,10,0.76);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 18px;
  z-index: 100;
}

.modal {
  width: 100%;
  max-width: 680px;
  max-height: 88vh;
  overflow-y: auto;
  background: linear-gradient(180deg, #11161D 0%, #0B0F14 100%);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 28px;
  padding: 24px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.55);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.modal-header h2 {
  font-size: 30px;
  margin: 14px 0 0;
}

.modal-header button {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.06);
  color: white;
  cursor: pointer;
  font-weight: 950;
}

.modal-meta {
  color: rgba(255,255,255,0.68);
}

.detail {
  border-radius: 18px;
  padding: 15px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  margin-top: 12px;
}

.detail strong {
  color: #D6FF4D;
  font-size: 12px;
  font-weight: 950;
}

.detail p {
  color: rgba(255,255,255,0.78);
  line-height: 1.55;
  margin: 8px 0 0;
}

@media (max-width: 920px) {
  .public-layout .main {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .public-hero {
    padding: 24px;
    border-radius: 28px;
  }

  .public-hero h1 {
    font-size: clamp(38px, 12vw, 54px);
  }

  .public-feature-grid {
    grid-template-columns: 1fr;
  }

  .page {
    padding: 12px 12px 96px;
  }

  .layout {
    display: block;
  }

  .sidebar {
    min-height: auto;
    margin-bottom: 14px;
    padding: 18px;
  }

  .sidebar .nav,
  .sidebar .logout-button {
    display: none;
  }

  .profile-card {
    margin-top: 16px;
  }

  .main {
    gap: 14px;
  }

  .card,
  .auth-card {
    border-radius: 26px;
    padding: 22px;
  }

  .two-col,
  .split-grid,
  .pricing-grid {
    grid-template-columns: 1fr;
  }

  .beta-banner {
    grid-template-columns: 1fr;
  }

  .connected-panel {
    display: grid;
  }

  .primary-button,
  .ghost-button {
    width: 100%;
  }

  .mobile-nav {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 80;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding: 10px;
    border-radius: 24px;
    background: rgba(8,13,18,0.92);
    border: 1px solid rgba(255,255,255,0.10);
    backdrop-filter: blur(16px);
    box-shadow: 0 18px 50px rgba(0,0,0,0.45);
  }

  .mobile-nav button {
    border: 0;
    border-radius: 16px;
    padding: 12px 8px;
    background: transparent;
    color: rgba(255,255,255,0.65);
    font-size: 12px;
    font-weight: 950;
  }

  .mobile-nav button.active {
    background: rgba(214,255,77,0.12);
    color: #D6FF4D;
  }

  .price-card {
    min-height: auto;
  }
}
`;
