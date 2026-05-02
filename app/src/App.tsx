import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = "https://trainingapp-api.marco-cruz.workers.dev";

const PAYPAL_STARTER_PLAN_ID = "P-8NB63062HL487521UNHYRSJI";
const PAYPAL_PERFORMANCE_PLAN_ID = "P-4C338724PN8826316NHYRSJQ";
const PAYPAL_PRO_PLAN_ID = "P-2G5092788J304935ENHYRSJQ";

const AUTH_TOKEN_KEY = "trainingapp_auth_token";

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

type Membership = {
  id?: string;
  user_id?: string | null;
  provider?: string;
  provider_subscription_id?: string;
  plan_code?: string | null;
  status?: string;
  payer_email?: string | null;
  external_reference?: string | null;
  started_at?: string | null;
  current_period_end?: string | null;
  updated_at?: string | null;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
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
  updated_at?: string;
};

type StravaStatus = {
  connected: boolean;
  status?: string;
  scope?: string | null;
  athleteId?: string | null;
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

type TabMode =
  | "home"
  | "onboarding"
  | "plan"
  | "metrics"
  | "membership"
  | "profile"
  | "login"
  | "register";

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

function removeExistingPayPalSdk() {
  const existing = document.querySelector('script[data-paypal-sdk="true"]');
  if (existing) existing.remove();
}

function loadPayPalSdk(clientId: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.paypal) {
      resolve();
      return;
    }

    removeExistingPayPalSdk();

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId
    )}&vault=true&intent=subscription&currency=MXN`;
    script.async = true;
    script.dataset.paypalSdk = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("No fue posible cargar el SDK de PayPal"));
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

function getAllowedDistances(planCode?: string | null) {
  if (planCode === "starter") return ["5K", "10K", "15K"];
  if (planCode === "performance" || planCode === "pro_coach") {
    return ["5K", "10K", "15K", "21K", "42K"];
  }
  return ["5K", "10K", "15K"];
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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabMode>("login");
  const [isMobile, setIsMobile] = useState(false);

  const [authLoading, setAuthLoading] = useState(true);
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
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

  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [stravaLoading, setStravaLoading] = useState(false);

  const [result, setResult] = useState("");
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);

  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState("");

  const starterRef = useRef<HTMLDivElement | null>(null);
  const performanceRef = useRef<HTMLDivElement | null>(null);
  const proRef = useRef<HTMLDivElement | null>(null);

  const planCode = entitlements?.source_plan_code || membership?.plan_code || null;
  const hasActiveMembership = Boolean(entitlements?.has_active_membership);
  const canConnectStrava = Boolean(entitlements?.can_connect_strava);
  const canUsePremiumPlanning = Boolean(entitlements?.can_use_premium_planning);
  const allowedDistances = getAllowedDistances(planCode);

  const currentWeek = useMemo(() => {
    return weeks.length > 0 ? weeks[0] : null;
  }, [weeks]);

  const allSessions = useMemo(() => {
    return currentWeek?.sessions || [];
  }, [currentWeek]);

  const totalSessions = allSessions.length;
  const totalDistance = currentWeek?.total_target_distance || 0;
  const todaysSession = allSessions[0] || null;
  const primaryMetrics = metrics?.days28 || metrics?.days7 || null;

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 920);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaStatus = params.get("strava");

    if (stravaStatus) {
      if (stravaStatus === "connected") {
        setResult("Strava conectado correctamente. Ya puedes sincronizar tus actividades.");
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
    async function bootstrapAuth() {
      if (!authToken) return;

      try {
        setAuthLoading(true);
        await refreshAuthMe(authToken);
        setActiveTab((prev) =>
          prev === "login" || prev === "register" ? "home" : prev
        );
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setAuthToken("");
        setAuthUser(null);
        setEntitlements(null);
        setMembership(null);
        setStrava({ connected: false, status: "not_connected" });
        setActiveTab("login");
      } finally {
        setAuthLoading(false);
      }
    }

    bootstrapAuth();
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !authUser) return;

    fetchPlanSilently();
    fetchMetricsSilently();
  }, [authToken, authUser?.id]);

  useEffect(() => {
    const currentDistance = form.distance;
    if (!allowedDistances.includes(currentDistance)) {
      setForm((prev) => ({
        ...prev,
        distance: allowedDistances[0] || "5K",
      }));
    }
  }, [planCode]);

  useEffect(() => {
    let cancelled = false;

    async function initPaypal() {
      if (activeTab !== "membership") return;
      if (paypalReady) return;

      try {
        setPaypalLoading(true);
        setPaypalError("");

        const clientId = await fetchPaypalConfig();
        if (cancelled) return;

        await loadPayPalSdk(clientId);
        if (cancelled) return;

        setPaypalReady(true);
      } catch (error) {
        if (!cancelled) {
          setPaypalError(
            error instanceof Error
              ? error.message
              : "No fue posible inicializar PayPal"
          );
        }
      } finally {
        if (!cancelled) setPaypalLoading(false);
      }
    }

    initPaypal();

    return () => {
      cancelled = true;
    };
  }, [activeTab, paypalReady]);

  useEffect(() => {
    if (activeTab !== "membership" || !paypalReady || !window.paypal) return;

    const renderButton = async (
      container: HTMLDivElement | null,
      paypalPlanId: string,
      label: string
    ) => {
      if (!container || !authUser?.id) return;

      container.innerHTML = "";

      await window.paypal!
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
              if (!subscriptionId) throw new Error("PayPal no devolvió subscriptionID");

              const linkRes = await fetch(`${API_URL}/api/paypal/link-subscription`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  userId: authUser.id,
                  subscriptionId,
                }),
              });

              const linkData = await linkRes.json();

              if (!linkRes.ok) {
                throw new Error(
                  linkData?.error || "No fue posible enlazar la suscripción"
                );
              }

              if (authToken) {
                await refreshAuthMe(authToken);
                await fetchPlanSilently();
                await fetchMetricsSilently();
              }

              setResult(`Suscripción ${label} activada correctamente.`);
              setActiveTab("home");
            } catch (error) {
              setResult(
                error instanceof Error
                  ? error.message
                  : "Ocurrió un error al enlazar la suscripción"
              );
            }
          },
          onError: () => {
            setResult(`Ocurrió un error al iniciar la suscripción ${label}.`);
          },
        })
        .render(container);
    };

    renderButton(starterRef.current, PAYPAL_STARTER_PLAN_ID, "Starter");
    renderButton(performanceRef.current, PAYPAL_PERFORMANCE_PLAN_ID, "Performance");
    renderButton(proRef.current, PAYPAL_PRO_PLAN_ID, "Pro Coach");
  }, [activeTab, paypalReady, authUser?.id, authToken]);

  async function refreshAuthMe(token: string) {
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
    setEntitlements(data.entitlements || null);
    setMembership(data.membership || null);
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

  async function fetchPaypalConfig() {
    const res = await fetch(`${API_URL}/api/paypal/config`);
    const data = await res.json();

    if (!res.ok || !data?.clientId) {
      throw new Error("No fue posible obtener la configuración de PayPal");
    }

    return data.clientId as string;
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
      // silencio intencional
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
      // silencio intencional
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
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

      const token = data.token || "";
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setAuthToken(token);
      await refreshAuthMe(token);
      setActiveTab("home");
      setResult("Sesión iniciada correctamente.");
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
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

      const token = data.token || "";
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setAuthToken(token);
      await refreshAuthMe(token);
      setActiveTab("onboarding");
      setResult("Cuenta creada correctamente. Completa tu perfil para generar tu plan.");
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleLogout = async () => {
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
      // silencio
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthToken("");
      setAuthUser(null);
      setEntitlements(null);
      setMembership(null);
      setWeeks([]);
      setMetrics(null);
      setStrava({ connected: false, status: "not_connected" });
      setActiveTab("login");
      setResult("Sesión cerrada.");
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    setLoading(true);
    setResult("");

    try {
      const onboardingPayload = {
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
        body: JSON.stringify(onboardingPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No fue posible guardar onboarding");
      }

      setResult(
        hasActiveMembership
          ? "Perfil guardado. Ahora puedes consultar tu plan."
          : "Perfil guardado. Activa una membresía para generar tu plan."
      );

      if (hasActiveMembership) {
        await regeneratePlan();
        setActiveTab("plan");
      } else {
        setActiveTab("membership");
      }
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLoading(false);
    }
  };

  const regeneratePlan = async () => {
    if (!authUser) return;

    setLookupLoading(true);
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
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const connectStrava = async () => {
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
        throw new Error(data?.error || "No fue posible generar URL de Strava");
      }

      window.location.href = data.url;
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setStravaLoading(false);
    }
  };

  const syncStrava = async () => {
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
      await refreshAuthMe(authToken);
      await fetchMetricsSilently();

      setResult(
        `Strava sincronizado. Actividades consultadas: ${data.fetched || 0}. Actividades guardadas/actualizadas: ${data.stored || 0}.`
      );
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setStravaLoading(false);
    }
  };

  const saveCheckin = async () => {
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
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>
          <div style={logoStyle}>trAIning</div>
          <p style={mutedTextStyle}>Cargando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={backgroundGlowOneStyle} />
      <div style={backgroundGlowTwoStyle} />

      <div
        style={{
          ...appShellStyle,
          gridTemplateColumns: isMobile ? "1fr" : "320px 1fr",
        }}
      >
        {authUser && (
          <aside style={sideBarStyle}>
            <div>
              <div style={logoStyle}>trAIning</div>
              <p style={smallCapsStyle}>Running Intelligence</p>

              <div style={profileBoxStyle}>
                <div style={profileNameStyle}>{authUser.name}</div>
                <div style={profileEmailStyle}>{authUser.email}</div>
                <div style={planPillStyle}>{getPlanLabel(planCode)}</div>
              </div>

              <nav style={navStyle}>
                <button style={navButtonStyle(activeTab === "home")} onClick={() => setActiveTab("home")}>
                  Home
                </button>
                <button style={navButtonStyle(activeTab === "onboarding")} onClick={() => setActiveTab("onboarding")}>
                  Onboarding
                </button>
                <button style={navButtonStyle(activeTab === "plan")} onClick={() => setActiveTab("plan")}>
                  Mi plan
                </button>
                <button style={navButtonStyle(activeTab === "metrics")} onClick={() => setActiveTab("metrics")}>
                  Métricas
                </button>
                <button style={navButtonStyle(activeTab === "membership")} onClick={() => setActiveTab("membership")}>
                  Membresía
                </button>
                <button style={navButtonStyle(activeTab === "profile")} onClick={() => setActiveTab("profile")}>
                  Perfil
                </button>
              </nav>
            </div>

            <button style={logoutButtonStyle} onClick={handleLogout}>
              Cerrar sesión
            </button>
          </aside>
        )}

        <main style={mainStyle}>
          {!authUser && activeTab === "login" && (
            <section style={cardStyle}>
              <span style={badgeStyle}>Acceso</span>
              <h1 style={titleStyle}>Iniciar sesión</h1>
              <p style={textStyle}>
                Entra para consultar tu plan, membresía, Strava y métricas.
              </p>

              <form style={formStyle} onSubmit={handleLogin}>
                <label style={labelStyle}>Correo</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  placeholder="tucorreo@email.com"
                />

                <label style={labelStyle}>Contraseña</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  required
                  placeholder="********"
                />

                <button style={primaryButtonStyle} disabled={loginLoading}>
                  {loginLoading ? "Entrando..." : "Iniciar sesión"}
                </button>

                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => setActiveTab("register")}
                >
                  Crear cuenta
                </button>
              </form>
            </section>
          )}

          {!authUser && activeTab === "register" && (
            <section style={cardStyle}>
              <span style={badgeStyle}>Registro</span>
              <h1 style={titleStyle}>Crear cuenta</h1>
              <p style={textStyle}>
                Crea tu usuario para generar tu plan y activar tu membresía.
              </p>

              <form style={formStyle} onSubmit={handleRegister}>
                <label style={labelStyle}>Nombre</label>
                <input
                  style={inputStyle}
                  value={registerForm.name}
                  onChange={(e) =>
                    setRegisterForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  placeholder="Tu nombre"
                />

                <label style={labelStyle}>Correo</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  placeholder="tucorreo@email.com"
                />

                <label style={labelStyle}>Contraseña</label>
                <input
                  style={inputStyle}
                  type="password"
                  minLength={8}
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  required
                  placeholder="Mínimo 8 caracteres"
                />

                <button style={primaryButtonStyle} disabled={registerLoading}>
                  {registerLoading ? "Creando..." : "Crear cuenta"}
                </button>

                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => setActiveTab("login")}
                >
                  Ya tengo cuenta
                </button>
              </form>
            </section>
          )}

          {authUser && activeTab === "home" && (
            <section style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <span style={badgeStyle}>Dashboard</span>
                <h1 style={titleStyle}>Tu entrenamiento</h1>
                <p style={textStyle}>
                  Genera tu plan, conecta Strava y mide tu progreso desde una sola vista.
                </p>
              </div>

              <div style={metricGridStyle}>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Membresía</div>
                  <div style={statValueStyle}>{getPlanLabel(planCode)}</div>
                  <div style={statHintStyle}>{getStatusLabel(membership?.status)}</div>
                </div>

                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Semana visible</div>
                  <div style={statValueStyle}>{currentWeek ? `#${currentWeek.week_number}` : "--"}</div>
                  <div style={statHintStyle}>{currentWeek?.focus_label || "Sin plan cargado"}</div>
                </div>

                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Km planeados</div>
                  <div style={statValueStyle}>{totalDistance ? `${totalDistance} km` : "--"}</div>
                  <div style={statHintStyle}>{totalSessions ? `${totalSessions} sesiones` : "Sin sesiones"}</div>
                </div>

                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Strava</div>
                  <div style={statValueStyle}>{strava.connected ? "Conectado" : "No conectado"}</div>
                  <div style={statHintStyle}>
                    {canConnectStrava ? "Disponible" : "Requiere Performance"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  ...splitGridStyle,
                  gridTemplateColumns: isMobile ? "1fr" : "1.15fr 0.85fr",
                }}
              >
                <div style={highlightCardStyle}>
                  <span style={badgeDarkStyle}>Sesión destacada</span>
                  <h2 style={highlightTitleStyle}>
                    {todaysSession?.title || "Aún no tienes plan cargado"}
                  </h2>
                  <p style={textStyle}>
                    {todaysSession?.objective ||
                      "Completa tu onboarding y activa tu membresía para generar un plan estándar."}
                  </p>

                  {todaysSession && (
                    <button
                      style={primaryButtonStyle}
                      onClick={() => setSelectedSession(todaysSession)}
                    >
                      Ver sesión
                    </button>
                  )}

                  {!todaysSession && (
                    <button
                      style={primaryButtonStyle}
                      onClick={() => setActiveTab("onboarding")}
                    >
                      Completar onboarding
                    </button>
                  )}
                </div>

                <div style={highlightCardStyle}>
                  <span style={badgeDarkStyle}>Métricas reales</span>
                  <h2 style={highlightTitleStyle}>
                    {primaryMetrics
                      ? `${primaryMetrics.totalDistanceKm} km`
                      : "Conecta Strava"}
                  </h2>
                  <p style={textStyle}>
                    {primaryMetrics
                      ? `${primaryMetrics.activityCount} actividades · ${formatPace(
                          primaryMetrics.avgPaceSecondsPerKm
                        )} · consistencia ${primaryMetrics.consistencyScore}%`
                      : "Performance y Pro Coach pueden conectar Strava para comenzar a guardar historial real."}
                  </p>

                  {canConnectStrava && !strava.connected && (
                    <button
                      style={secondaryButtonStyle}
                      disabled={stravaLoading}
                      onClick={connectStrava}
                    >
                      {stravaLoading ? "Conectando..." : "Conectar Strava"}
                    </button>
                  )}

                  {canConnectStrava && strava.connected && (
                    <button
                      style={secondaryButtonStyle}
                      disabled={stravaLoading}
                      onClick={syncStrava}
                    >
                      {stravaLoading ? "Sincronizando..." : "Sincronizar Strava"}
                    </button>
                  )}
                </div>
              </div>

              {planCode === "pro_coach" && (
                <div style={proCoachCardStyle}>
                  <span style={badgeStyle}>Pro Coach</span>
                  <h2 style={subTitleStyle}>Seguimiento semanal</h2>
                  <p style={textStyle}>
                    Registra cómo te sentiste y recibe una recomendación semanal
                    basada en reglas mientras activamos la capa de IA.
                  </p>
                  <button style={primaryButtonStyle} onClick={saveCheckin}>
                    Guardar check-in rápido
                  </button>
                </div>
              )}
            </section>
          )}

          {authUser && activeTab === "onboarding" && (
            <section style={cardStyle}>
              <span style={badgeStyle}>Onboarding</span>
              <h1 style={titleStyle}>Configura tu objetivo</h1>
              <p style={textStyle}>
                {planCode === "starter"
                  ? "Starter permite 5K, 10K y 15K. Para 21K o 42K cambia a Performance."
                  : "Performance y Pro Coach permiten planes hasta 42K."}
              </p>

              <form style={formStyle} onSubmit={handleOnboarding}>
                <div style={twoColStyle(isMobile)}>
                  <div>
                    <label style={labelStyle}>Nombre</label>
                    <input style={inputStyle} value={authUser.name} disabled />
                  </div>
                  <div>
                    <label style={labelStyle}>Correo</label>
                    <input style={inputStyle} value={authUser.email} disabled />
                  </div>
                </div>

                <div style={twoColStyle(isMobile)}>
                  <div>
                    <label style={labelStyle}>Objetivo</label>
                    <select
                      style={inputStyle}
                      value={form.goal}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, goal: e.target.value }))
                      }
                    >
                      <option>Completar una carrera</option>
                      <option>Mejorar tiempo</option>
                      <option>Retomar constancia</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Distancia</label>
                    <select
                      style={inputStyle}
                      value={form.distance}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, distance: e.target.value }))
                      }
                    >
                      {allowedDistances.map((distance) => (
                        <option key={distance}>{distance}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={twoColStyle(isMobile)}>
                  <div>
                    <label style={labelStyle}>Días por semana</label>
                    <input
                      style={inputStyle}
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
                  </div>

                  <div>
                    <label style={labelStyle}>Nivel</label>
                    <select
                      style={inputStyle}
                      value={form.level}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, level: e.target.value }))
                      }
                    >
                      <option>Principiante</option>
                      <option>Intermedio</option>
                      <option>Avanzado</option>
                    </select>
                  </div>
                </div>

                <div style={twoColStyle(isMobile)}>
                  <div>
                    <label style={labelStyle}>Volumen semanal actual km</label>
                    <input
                      style={inputStyle}
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
                  </div>

                  <div>
                    <label style={labelStyle}>Fecha del evento</label>
                    <input
                      style={{ ...inputStyle, colorScheme: "dark" }}
                      type="date"
                      value={form.eventDate}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, eventDate: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <label style={labelStyle}>Nombre del evento</label>
                <input
                  style={inputStyle}
                  value={form.eventName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, eventName: e.target.value }))
                  }
                  placeholder="Ej. 10K Monterrey, Medio Maratón CDMX..."
                />

                <button style={primaryButtonStyle} disabled={loading}>
                  {loading ? "Guardando..." : "Guardar y continuar"}
                </button>

                {hasActiveMembership && (
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    disabled={lookupLoading}
                    onClick={regeneratePlan}
                  >
                    {lookupLoading ? "Generando..." : "Generar nuevo plan"}
                  </button>
                )}
              </form>
            </section>
          )}

          {authUser && activeTab === "plan" && (
            <section style={cardStyle}>
              <span style={badgeStyle}>Mi plan</span>
              <h1 style={titleStyle}>Semana actual</h1>
              <p style={textStyle}>
                Se muestra la semana visible del plan estándar. Las siguientes semanas quedan listas en tu historial.
              </p>

              {!currentWeek && (
                <div style={emptyStateStyle}>
                  <h2 style={subTitleStyle}>Aún no hay plan cargado</h2>
                  <p style={textStyle}>
                    Completa onboarding y activa tu membresía para generar el plan.
                  </p>
                  <button
                    style={primaryButtonStyle}
                    onClick={() => setActiveTab("onboarding")}
                  >
                    Completar onboarding
                  </button>
                </div>
              )}

              {currentWeek && (
                <>
                  <div style={weekHeaderStyle}>
                    <div>
                      <h2 style={subTitleStyle}>Semana {currentWeek.week_number}</h2>
                      <p style={textStyle}>{currentWeek.focus_label}</p>
                    </div>
                    <div style={weekKmStyle}>{currentWeek.total_target_distance} km</div>
                  </div>

                  <div style={sessionListStyle}>
                    {currentWeek.sessions.map((session, index) => (
                      <button
                        key={`${session.id || index}`}
                        style={sessionItemStyle}
                        onClick={() => setSelectedSession(session)}
                      >
                        <div style={sessionTopStyle}>
                          <span style={sessionDayStyle}>
                            {session.day_of_week || "Sesión"}
                          </span>
                          <span style={sessionZoneStyle}>
                            {session.intensity_zone || "General"}
                          </span>
                        </div>
                        <div style={sessionTitleStyle}>{session.title}</div>
                        <div style={sessionMetaStyle}>
                          {session.distance_target
                            ? `${session.distance_target} km`
                            : "Complementario"}
                          {session.duration_target
                            ? ` · ${session.duration_target} min`
                            : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {authUser && activeTab === "metrics" && (
            <section style={cardStyle}>
              <span style={badgeStyle}>Métricas</span>
              <h1 style={titleStyle}>Progreso real</h1>
              <p style={textStyle}>
                Performance y Pro Coach pueden conectar Strava para mostrar métricas reales.
              </p>

              {!canConnectStrava && (
                <div style={emptyStateStyle}>
                  <h2 style={subTitleStyle}>Strava no incluido en Starter</h2>
                  <p style={textStyle}>
                    Cambia a Performance para conectar Strava y medir actividades reales.
                  </p>
                  <button
                    style={primaryButtonStyle}
                    onClick={() => setActiveTab("membership")}
                  >
                    Ver planes
                  </button>
                </div>
              )}

              {canConnectStrava && !strava.connected && (
                <div style={emptyStateStyle}>
                  <h2 style={subTitleStyle}>Conecta Strava</h2>
                  <p style={textStyle}>
                    Autoriza tu cuenta para sincronizar actividades y crear historial.
                  </p>
                  <button
                    style={primaryButtonStyle}
                    disabled={stravaLoading}
                    onClick={connectStrava}
                  >
                    {stravaLoading ? "Conectando..." : "Conectar Strava"}
                  </button>
                </div>
              )}

              {canConnectStrava && strava.connected && (
                <>
                  <div style={actionsRowStyle}>
                    <button
                      style={primaryButtonStyle}
                      disabled={stravaLoading}
                      onClick={syncStrava}
                    >
                      {stravaLoading ? "Sincronizando..." : "Sincronizar Strava"}
                    </button>
                  </div>

                  <div style={metricGridStyle}>
                    <MetricCard title="Últimos 7 días" data={metrics?.days7 || null} />
                    <MetricCard title="Últimos 28 días" data={metrics?.days28 || null} />
                    <MetricCard title="Últimos 56 días" data={metrics?.days56 || null} />
                  </div>
                </>
              )}
            </section>
          )}

          {authUser && activeTab === "membership" && (
            <section style={cardStyle}>
              <span style={badgeStyle}>Membresía</span>
              <h1 style={titleStyle}>Elige tu plan</h1>
              <p style={textStyle}>
                Starter para comenzar, Performance como plan principal y Pro Coach para seguimiento avanzado.
              </p>

              {paypalLoading && <p style={textStyle}>Cargando PayPal...</p>}
              {paypalError && <div style={alertStyle}>{paypalError}</div>}

              <div
                style={{
                  ...pricingGridStyle,
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                }}
              >
                <PlanCard
                  title="Starter"
                  price="$149 MXN"
                  tag="Hasta 15K"
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
                  featured
                  features={[
                    "Planes 5K a 42K",
                    "Conexión con Strava",
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
            <section style={cardStyle}>
              <span style={badgeStyle}>Perfil</span>
              <h1 style={titleStyle}>Cuenta y acceso</h1>

              <div style={profileDetailsGridStyle}>
                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Nombre</div>
                  <div style={statValueSmallStyle}>{authUser.name}</div>
                </div>

                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Correo</div>
                  <div style={statValueSmallStyle}>{authUser.email}</div>
                </div>

                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Plan</div>
                  <div style={statValueSmallStyle}>{getPlanLabel(planCode)}</div>
                </div>

                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Estado</div>
                  <div style={statValueSmallStyle}>{getStatusLabel(membership?.status)}</div>
                </div>

                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Strava</div>
                  <div style={statValueSmallStyle}>
                    {strava.connected ? "Conectado" : "No conectado"}
                  </div>
                </div>

                <div style={statCardStyle}>
                  <div style={statLabelStyle}>Premium</div>
                  <div style={statValueSmallStyle}>
                    {canUsePremiumPlanning ? "Activo" : "No activo"}
                  </div>
                </div>
              </div>
            </section>
          )}

          {result && <div style={alertStyle}>{result}</div>}
        </main>
      </div>

      {selectedSession && (
        <div style={modalOverlayStyle} onClick={() => setSelectedSession(null)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={badgeStyle}>{selectedSession.day_of_week || "Sesión"}</div>
                <h2 style={subTitleStyle}>{selectedSession.title}</h2>
              </div>
              <button style={closeButtonStyle} onClick={() => setSelectedSession(null)}>
                ✕
              </button>
            </div>

            <p style={textStyle}>
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

            {typeof selectedSession.estimated_load === "number" && (
              <Detail
                title="Carga estimada"
                text={String(selectedSession.estimated_load)}
              />
            )}
          </div>
        </div>
      )}
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
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{title}</div>
      <div style={statValueStyle}>{data ? `${data.totalDistanceKm} km` : "--"}</div>
      <div style={statHintStyle}>
        {data
          ? `${data.activityCount} actividades · ${formatTime(
              data.totalMovingTimeSeconds
            )}`
          : "Sin datos"}
      </div>
      <div style={metricMiniGridStyle}>
        <span>Ritmo: {data ? formatPace(data.avgPaceSecondsPerKm) : "--"}</span>
        <span>Tirada: {data ? `${data.longRunKm} km` : "--"}</span>
        <span>Activo: {data ? `${data.daysActive} días` : "--"}</span>
        <span>Consistencia: {data ? `${data.consistencyScore}%` : "--"}</span>
      </div>
    </div>
  );
}

function PlanCard({
  title,
  price,
  tag,
  features,
  paypalRef,
  featured,
}: {
  title: string;
  price: string;
  tag: string;
  features: string[];
  paypalRef: React.RefObject<HTMLDivElement | null>;
  featured?: boolean;
}) {
  return (
    <div style={{ ...pricingCardStyle, ...(featured ? pricingFeaturedStyle : {}) }}>
      <div style={pricingTagStyle}>{tag}</div>
      <h2 style={subTitleStyle}>{title}</h2>
      <div style={priceStyle}>{price}</div>
      <div style={pricePeriodStyle}>mensual</div>

      <div style={featureListStyle}>
        {features.map((feature) => (
          <div key={feature} style={featureItemStyle}>
            • {feature}
          </div>
        ))}
      </div>

      <div style={paypalContainerStyle}>
        <div ref={paypalRef} style={paypalButtonWrapStyle} />
      </div>
    </div>
  );
}

function Detail({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;

  return (
    <div style={detailBoxStyle}>
      <div style={detailTitleStyle}>{title}</div>
      <div style={detailTextStyle}>{text}</div>
    </div>
  );
}

const loadingPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#070B10",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  padding: 24,
};

const loadingCardStyle: React.CSSProperties = {
  borderRadius: 24,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  padding: 28,
  textAlign: "center",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(0,230,255,0.13), transparent 28%), radial-gradient(circle at top right, rgba(214,255,77,0.14), transparent 28%), linear-gradient(180deg, #070B10 0%, #0B0F14 100%)",
  color: "#fff",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  padding: 20,
  position: "relative",
  overflowX: "hidden",
};

const backgroundGlowOneStyle: React.CSSProperties = {
  position: "fixed",
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "rgba(214,255,77,0.09)",
  filter: "blur(90px)",
  top: -80,
  right: -80,
  pointerEvents: "none",
};

const backgroundGlowTwoStyle: React.CSSProperties = {
  position: "fixed",
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "rgba(0,230,255,0.09)",
  filter: "blur(90px)",
  bottom: -80,
  left: -80,
  pointerEvents: "none",
};

const appShellStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1320,
  margin: "0 auto",
  display: "grid",
  gap: 20,
  position: "relative",
  zIndex: 1,
};

const sideBarStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 30,
  padding: 22,
  minHeight: 760,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  backdropFilter: "blur(14px)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
};

const mainStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
  alignContent: "start",
};

const logoStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 18px",
  borderRadius: 18,
  background: "rgba(214,255,77,0.11)",
  color: "#D6FF4D",
  fontWeight: 900,
  letterSpacing: "0.04em",
  border: "1px solid rgba(214,255,77,0.18)",
};

const smallCapsStyle: React.CSSProperties = {
  color: "#00E6FF",
  fontSize: 12,
  letterSpacing: "0.16em",
  fontWeight: 800,
  marginTop: 12,
};

const profileBoxStyle: React.CSSProperties = {
  marginTop: 24,
  borderRadius: 22,
  padding: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const profileNameStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const profileEmailStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "rgba(255,255,255,0.62)",
  wordBreak: "break-word",
};

const planPillStyle: React.CSSProperties = {
  display: "inline-flex",
  marginTop: 12,
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(0,230,255,0.1)",
  color: "#00E6FF",
  fontSize: 12,
  fontWeight: 800,
};

const navStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 22,
};

const navButtonStyle = (active: boolean): React.CSSProperties => ({
  width: "100%",
  border: "1px solid rgba(255,255,255,0.08)",
  background: active ? "rgba(214,255,77,0.12)" : "rgba(255,255,255,0.03)",
  color: active ? "#D6FF4D" : "rgba(255,255,255,0.74)",
  borderRadius: 16,
  padding: "13px 14px",
  fontWeight: 800,
  textAlign: "left",
  cursor: "pointer",
});

const logoutButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  borderRadius: 16,
  padding: "13px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(17,22,29,0.98), rgba(11,15,20,0.96))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 30,
  padding: 26,
  boxShadow: "0 24px 70px rgba(0,0,0,0.34)",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(0,230,255,0.10)",
  color: "#00E6FF",
  fontSize: 12,
  fontWeight: 900,
};

const badgeDarkStyle: React.CSSProperties = {
  ...badgeStyle,
  background: "rgba(255,255,255,0.08)",
  color: "#D6FF4D",
};

const titleStyle: React.CSSProperties = {
  fontSize: 36,
  lineHeight: 1.05,
  margin: "14px 0 0 0",
};

const subTitleStyle: React.CSSProperties = {
  fontSize: 24,
  lineHeight: 1.15,
  margin: "12px 0 0 0",
};

const textStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.68)",
  lineHeight: 1.6,
  marginTop: 10,
};

const mutedTextStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.68)",
};

const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: 20,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 13,
  marginTop: 22,
};

const labelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.74)",
  fontSize: 13,
  fontWeight: 800,
  display: "block",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0B0F14",
  color: "#fff",
  padding: "14px 14px",
  outline: "none",
};

const twoColStyle = (isMobile: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
  gap: 13,
});

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 16,
  background: "#D6FF4D",
  color: "#050505",
  padding: "14px 16px",
  fontWeight: 900,
  cursor: "pointer",
  width: "fit-content",
  minWidth: 170,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(0,230,255,0.2)",
  borderRadius: 16,
  background: "rgba(0,230,255,0.12)",
  color: "#00E6FF",
  padding: "14px 16px",
  fontWeight: 900,
  cursor: "pointer",
  width: "fit-content",
  minWidth: 170,
};

const alertStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(0,230,255,0.18)",
  background: "rgba(0,230,255,0.08)",
  color: "#00E6FF",
  padding: 16,
  lineHeight: 1.5,
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginTop: 20,
};

const statCardStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 18,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const statLabelStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 12,
  fontWeight: 800,
};

const statValueStyle: React.CSSProperties = {
  color: "#D6FF4D",
  fontSize: 30,
  fontWeight: 950,
  marginTop: 8,
};

const statValueSmallStyle: React.CSSProperties = {
  color: "#fff",
  fontSize: 18,
  fontWeight: 850,
  marginTop: 8,
  wordBreak: "break-word",
};

const statHintStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.68)",
  fontSize: 13,
  marginTop: 6,
};

const splitGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 18,
};

const highlightCardStyle: React.CSSProperties = {
  borderRadius: 26,
  padding: 22,
  background:
    "linear-gradient(135deg, rgba(214,255,77,0.12), rgba(0,230,255,0.08), rgba(255,255,255,0.03))",
  border: "1px solid rgba(255,255,255,0.08)",
};

const highlightTitleStyle: React.CSSProperties = {
  fontSize: 30,
  lineHeight: 1.08,
  margin: "16px 0 0 0",
};

const proCoachCardStyle: React.CSSProperties = {
  marginTop: 18,
  borderRadius: 26,
  padding: 22,
  background: "rgba(214,255,77,0.08)",
  border: "1px solid rgba(214,255,77,0.14)",
};

const emptyStateStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 22,
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
  marginTop: 20,
};

const weekHeaderStyle: React.CSSProperties = {
  marginTop: 20,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const weekKmStyle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 950,
  color: "#D6FF4D",
};

const sessionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 18,
};

const sessionItemStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0B0F14",
  color: "#fff",
  borderRadius: 18,
  padding: 16,
  textAlign: "left",
  cursor: "pointer",
};

const sessionTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 8,
};

const sessionDayStyle: React.CSSProperties = {
  color: "#D6FF4D",
  fontSize: 12,
  fontWeight: 900,
};

const sessionZoneStyle: React.CSSProperties = {
  color: "#00E6FF",
  fontSize: 12,
  fontWeight: 900,
};

const sessionTitleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
};

const sessionMetaStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.64)",
  fontSize: 13,
  marginTop: 7,
};

const actionsRowStyle: React.CSSProperties = {
  marginTop: 18,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const metricMiniGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginTop: 14,
  color: "rgba(255,255,255,0.65)",
  fontSize: 13,
};

const pricingGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 22,
};

const pricingCardStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  flexDirection: "column",
  minHeight: 560,
  overflow: "hidden",
};

const pricingFeaturedStyle: React.CSSProperties = {
  boxShadow: "0 0 0 1px rgba(214,255,77,0.20), 0 18px 40px rgba(214,255,77,0.08)",
};

const pricingTagStyle: React.CSSProperties = {
  ...badgeStyle,
  color: "#D6FF4D",
  background: "rgba(214,255,77,0.10)",
};

const priceStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 950,
  color: "#D6FF4D",
  marginTop: 12,
};

const pricePeriodStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.62)",
  fontSize: 13,
  marginTop: 4,
};

const featureListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 24,
  color: "rgba(255,255,255,0.78)",
  lineHeight: 1.45,
};

const featureItemStyle: React.CSSProperties = {
  fontSize: 14,
};

const paypalContainerStyle: React.CSSProperties = {
  marginTop: "auto",
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
  paddingTop: 20,
};

const paypalButtonWrapStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  transform: "scale(0.94)",
  transformOrigin: "center bottom",
};

const profileDetailsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginTop: 22,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(4,7,10,0.76)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  zIndex: 50,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 680,
  maxHeight: "88vh",
  overflowY: "auto",
  background: "linear-gradient(180deg, #11161D 0%, #0B0F14 100%)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
};

const closeButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const detailBoxStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 15,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  marginTop: 12,
};

const detailTitleStyle: React.CSSProperties = {
  color: "#D6FF4D",
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 6,
};

const detailTextStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.78)",
  lineHeight: 1.55,
};