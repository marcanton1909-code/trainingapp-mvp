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
  distance_target?: number;
  duration_target?: number;
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
  id: string;
  user_id: string | null;
  provider: string;
  provider_subscription_id: string;
  plan_code: string | null;
  status: string;
  payer_email?: string | null;
  external_reference?: string | null;
  started_at?: string | null;
  current_period_end?: string | null;
  last_event_at?: string | null;
  created_at?: string | null;
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

type TabMode =
  | "home"
  | "new"
  | "existing"
  | "membership"
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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabMode>("login");
  const [isMobile, setIsMobile] = useState(false);

  const [authLoading, setAuthLoading] = useState(true);
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

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
    distance: "21K",
    daysPerWeek: 5,
    level: "Intermedio",
    currentVolumeKm: 20,
    eventName: "",
    eventDate: "",
  });

  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  const [result, setResult] = useState("");
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [lookupEmail, setLookupEmail] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState("");

  const starterRef = useRef<HTMLDivElement | null>(null);
  const performanceRef = useRef<HTMLDivElement | null>(null);
  const proRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 960);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
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

        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Sesión inválida");
        }

        setAuthUser(data.user || null);
        setEntitlements(data.entitlements || null);
        setCurrentUserId(data.user?.id || "");
        setLookupEmail(data.user?.email || "");
        setForm((prev) => ({
          ...prev,
          name: data.user?.name || prev.name,
          email: data.user?.email || prev.email,
        }));
        setActiveTab("home");
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setAuthToken("");
        setAuthUser(null);
        setEntitlements(null);
        setActiveTab("login");
      } finally {
        setAuthLoading(false);
      }
    }

    bootstrapAuth();
  }, [authToken]);

  const visibleWeek = useMemo(() => {
    return weeks.length > 0 ? weeks[0] : null;
  }, [weeks]);

  const visibleWeeks = useMemo(() => {
    return visibleWeek ? [visibleWeek] : [];
  }, [visibleWeek]);

  const totalWeeks = visibleWeeks.length;
  const totalSessions = useMemo(
    () => visibleWeeks.reduce((acc, week) => acc + week.sessions.length, 0),
    [visibleWeeks]
  );
  const totalDistance = useMemo(
    () =>
      visibleWeeks.reduce(
        (acc, week) => acc + Number(week.total_target_distance || 0),
        0
      ),
    [visibleWeeks]
  );

  const allSessions = useMemo(
    () => visibleWeeks.flatMap((week) => week.sessions),
    [visibleWeeks]
  );

  const todaysSession = allSessions[0] || null;
  const readinessScore = visibleWeeks.length > 0 ? 82 : 0;
  const recoveryScore = visibleWeeks.length > 0 ? 76 : 0;

  const membershipLabel =
    membership?.plan_code === "starter"
      ? "Starter"
      : membership?.plan_code === "performance"
      ? "Performance"
      : membership?.plan_code === "pro_coach"
      ? "Pro Coach"
      : membership?.plan_code || "Sin plan";

  const membershipStatusLabel =
    membership?.status === "active"
      ? "Activa"
      : membership?.status === "pending_activation"
      ? "Pendiente"
      : membership?.status === "cancelled"
      ? "Cancelada"
      : membership?.status === "suspended"
      ? "Suspendida"
      : membership?.status === "expired"
      ? "Expirada"
      : membership?.status || "Sin estado";

  const membershipRenewalLabel = membership?.current_period_end
    ? new Date(membership.current_period_end).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Sin fecha disponible";

  const isStarter = entitlements?.source_plan_code === "starter";
  const isPerformance = entitlements?.source_plan_code === "performance";
  const isProCoach = entitlements?.source_plan_code === "pro_coach";
  const canConnectStrava = Boolean(entitlements?.can_connect_strava);
  const canUsePremiumPlanning = Boolean(entitlements?.can_use_premium_planning);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]:
        name === "daysPerWeek" || name === "currentVolumeKm"
          ? Number(value)
          : value,
    }));
  };

  const resetPlanState = () => {
    setResult("");
    setWeeks([]);
    setSelectedSession(null);
  };

  const fetchPlan = async (id: string) => {
    const readRes = await fetch(`${API_URL}/api/plan/${id}`);
    const readData = await readRes.json();

    if (!readRes.ok) {
      throw new Error(readData?.error || "No fue posible consultar tu plan");
    }

    setWeeks(readData.weeks || []);
  };

  const fetchMembershipStatus = async (email: string) => {
    const res = await fetch(`${API_URL}/api/membership/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "No fue posible consultar la membresía");
    }

    setMembership(data.membership || null);
    setAccessGranted(Boolean(data.accessGranted));
    return data;
  };

  const fetchPaypalConfig = async () => {
    const res = await fetch(`${API_URL}/api/paypal/config`);
    const data = await res.json();

    if (!res.ok || !data?.clientId) {
      throw new Error("No fue posible obtener la configuración de PayPal");
    }

    return data.clientId as string;
  };

  const refreshAuthMe = async (token: string) => {
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
    setCurrentUserId(data.user?.id || "");
    setLookupEmail(data.user?.email || "");
    setForm((prev) => ({
      ...prev,
      name: data.user?.name || prev.name,
      email: data.user?.email || prev.email,
    }));
  };

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
        if (!cancelled) {
          setPaypalLoading(false);
        }
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
      planId: string,
      planLabel: string
    ) => {
      if (!container) return;

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
              plan_id: planId,
              custom_id: currentUserId || undefined,
            });
          },
          onApprove: async (data) => {
            try {
              const subscriptionId = data.subscriptionID || "";

              if (!subscriptionId) {
                throw new Error("PayPal no devolvió subscriptionID");
              }

              if (!currentUserId) {
                throw new Error("No se encontró el userId actual");
              }

              const linkRes = await fetch(
                `${API_URL}/api/paypal/link-subscription`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    userId: currentUserId,
                    subscriptionId,
                  }),
                }
              );

              const linkData = await linkRes.json();

              if (!linkRes.ok) {
                throw new Error(
                  linkData?.error || "No fue posible enlazar la suscripción"
                );
              }

              setMembership(linkData.membership || null);
              setAccessGranted(
                linkData.membershipStatus === "active" ||
                  linkData.status === "active"
              );

              if (authToken) {
                await refreshAuthMe(authToken);
              }

              if (currentUserId) {
                await fetchPlan(currentUserId);
              }

              if (lookupEmail) {
                await fetchMembershipStatus(lookupEmail);
              }

              setResult(
                `Suscripción ${planLabel} activada correctamente. Ya puedes consultar tu plan.`
              );

              setActiveTab("home");
            } catch (error) {
              console.error(error);
              setResult(
                error instanceof Error
                  ? error.message
                  : "Ocurrió un error al enlazar la suscripción"
              );
            }
          },
          onError: (error) => {
            console.error(error);
            setResult(`Ocurrió un error al iniciar la suscripción ${planLabel}.`);
          },
        })
        .render(container);
    };

    renderButton(starterRef.current, PAYPAL_STARTER_PLAN_ID, "Starter");
    renderButton(
      performanceRef.current,
      PAYPAL_PERFORMANCE_PLAN_ID,
      "Performance"
    );
    renderButton(proRef.current, PAYPAL_PRO_PLAN_ID, "Pro Coach");
  }, [activeTab, paypalReady, currentUserId, authToken, lookupEmail]);

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
      if (!token) {
        throw new Error("No se recibió token de sesión");
      }

      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setAuthToken(token);
      setAuthUser(data.user || null);
      setCurrentUserId(data.user?.id || "");
      setLookupEmail(data.user?.email || "");
      setForm((prev) => ({
        ...prev,
        name: data.user?.name || prev.name,
        email: data.user?.email || prev.email,
      }));
      setResult("Cuenta creada correctamente. Completa tu onboarding.");
      setActiveTab("new");
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setRegisterLoading(false);
    }
  };

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
      if (!token) {
        throw new Error("No se recibió token de sesión");
      }

      localStorage.setItem(AUTH_TOKEN_KEY, token);
      setAuthToken(token);
      await refreshAuthMe(token);
      setResult("Sesión iniciada correctamente.");
      setActiveTab("home");
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLoginLoading(false);
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
      // ignore
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthToken("");
      setAuthUser(null);
      setEntitlements(null);
      setMembership(null);
      setAccessGranted(false);
      setWeeks([]);
      setCurrentUserId("");
      setLookupEmail("");
      setLoginForm({ email: "", password: "" });
      setRegisterForm({ name: "", email: "", password: "" });
      setActiveTab("login");
      setResult("Sesión cerrada.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetPlanState();
    setMembership(null);
    setAccessGranted(false);

    try {
      const onboardingPayload = {
        ...form,
        email: authUser?.email || form.email,
        name: authUser?.name || form.name,
      };

      const planRes = await fetch(`${API_URL}/api/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUserId,
          ...onboardingPayload,
        }),
      });

      const planData = await planRes.json();

      if (!planRes.ok) {
        throw new Error(planData?.error || "No fue posible generar tu plan");
      }

      setLookupEmail(authUser?.email || form.email);
      setForm((prev) => ({
        ...prev,
        email: authUser?.email || prev.email,
        name: authUser?.name || prev.name,
      }));
      setResult(
        "Tu perfil fue guardado. Para desbloquear o mejorar el acceso al plan, activa una membresía."
      );
      setActiveTab("membership");
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupLoading(true);
    resetPlanState();
    setMembership(null);
    setAccessGranted(false);

    try {
      const emailToLookup = lookupEmail || authUser?.email || "";

      const userRes = await fetch(`${API_URL}/api/user/find`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailToLookup }),
      });

      const userData = await userRes.json();

      if (!userRes.ok) {
        throw new Error(
          userData?.error || "No fue posible encontrar ese usuario"
        );
      }

      setCurrentUserId(userData.user.id);

      const membershipData = await fetchMembershipStatus(emailToLookup);

      if (!membershipData.accessGranted) {
        setResult(
          "Tu membresía no está activa todavía. Activa tu plan para desbloquear la semana visible."
        );
        setActiveTab("membership");
        return;
      }

      const existingUserId = userData.user.id;
      await fetchPlan(existingUserId);

      if (authToken) {
        await refreshAuthMe(authToken);
      }

      setResult(`Plan cargado correctamente para ${userData.user.email}.`);
      setActiveTab("home");
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLookupLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div style={loadingScreenStyle}>
        <div style={loadingCardStyle}>
          <div style={logoBoxStyle}>trAIning</div>
          <div style={{ marginTop: 18, color: "rgba(255,255,255,0.72)" }}>
            Cargando sesión...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={gridOverlayStyle} />
      <div style={glowOne} />
      <div style={glowTwo} />
      <div style={glowThree} />

      <div
        style={{
          ...wrapperStyle,
          gridTemplateColumns: isMobile ? "1fr" : "0.95fr 1.05fr",
          gap: isMobile ? 18 : 28,
          maxWidth: isMobile ? 640 : 1280,
        }}
      >
        <aside
          style={{
            ...brandPanelStyle,
            minHeight: isMobile ? "auto" : 760,
            padding: isMobile ? 22 : 36,
            order: isMobile ? 2 : 1,
          }}
        >
          <div>
            <div style={logoRowStyle}>
              <div style={logoBoxStyle}>trAIning</div>
              <span style={chipStyle}>Running Intelligence</span>
            </div>

            <p style={eyebrowStyle}>ENTRENA INTELIGENTE</p>
            <h1
              style={{
                ...titleStyle,
                fontSize: isMobile ? 34 : 48,
                maxWidth: "100%",
              }}
            >
              Entrena con estructura, claridad y una vista real de tu progreso.
            </h1>
            <p
              style={{
                ...subtitleStyle,
                maxWidth: "100%",
                fontSize: isMobile ? 15 : 16,
              }}
            >
              Ahora con acceso por cuenta, membresías, permisos por plan y base
              lista para métricas reales y Strava.
            </p>
          </div>

          <div
            style={{
              ...featureGridStyle,
              gridTemplateColumns: isMobile
                ? "1fr 1fr"
                : "repeat(2, minmax(0, 1fr))",
            }}
          >
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Usuario</span>
              <strong style={featureValueStyle}>
                {authUser?.name || "Invitado"}
              </strong>
            </div>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Plan actual</span>
              <strong style={featureValueStyle}>
                {entitlements?.source_plan_code || "Sin plan"}
              </strong>
            </div>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Strava</span>
              <strong style={featureValueStyle}>
                {canConnectStrava ? "Disponible" : "Bloqueado"}
              </strong>
            </div>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Acceso</span>
              <strong style={featureValueStyle}>
                {accessGranted ? "Activo" : "Pendiente"}
              </strong>
            </div>
          </div>

          <div
            style={{
              ...statsRowStyle,
              gridTemplateColumns: isMobile
                ? "1fr 1fr 1fr"
                : "repeat(3, minmax(0, 1fr))",
            }}
          >
            <div style={statCardStyle}>
              <div style={statValueStyle}>{totalWeeks || "--"}</div>
              <div style={statLabelStyle}>Semana visible</div>
            </div>
            <div style={statCardStyle}>
              <div style={statValueStyle}>{totalSessions || "--"}</div>
              <div style={statLabelStyle}>Sesiones cargadas</div>
            </div>
            <div style={statCardStyle}>
              <div style={statValueStyle}>
                {totalDistance ? `${totalDistance}k` : "--"}
              </div>
              <div style={statLabelStyle}>Carga semanal</div>
            </div>
          </div>
        </aside>

        <main
          style={{
            ...mainPanelStyle,
            order: isMobile ? 1 : 2,
          }}
        >
          {authUser ? (
            <div
              style={{
                ...tabsWrapStyle,
                width: isMobile ? "100%" : "fit-content",
                display: isMobile ? "grid" : "inline-flex",
                gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
              }}
            >
              <button
                onClick={() => setActiveTab("home")}
                style={{
                  ...tabButtonStyle,
                  ...(activeTab === "home" ? activeTabButtonStyle : {}),
                }}
              >
                Home
              </button>
              <button
                onClick={() => setActiveTab("new")}
                style={{
                  ...tabButtonStyle,
                  ...(activeTab === "new" ? activeTabButtonStyle : {}),
                }}
              >
                Onboarding
              </button>
              <button
                onClick={() => setActiveTab("existing")}
                style={{
                  ...tabButtonStyle,
                  ...(activeTab === "existing" ? activeTabButtonStyle : {}),
                }}
              >
                Mi plan
              </button>
              <button
                onClick={() => setActiveTab("membership")}
                style={{
                  ...tabButtonStyle,
                  ...(activeTab === "membership" ? activeTabButtonStyle : {}),
                }}
              >
                Membresía
              </button>
            </div>
          ) : null}

          {activeTab === "login" && (
            <section style={{ ...cardStyle, padding: isMobile ? 20 : 32 }}>
              <div style={sectionHeaderStyle}>
                <span style={badgeStyle}>Acceso</span>
                <h2 style={{ ...formTitleStyle, fontSize: isMobile ? 26 : 32 }}>
                  Iniciar sesión
                </h2>
                <p style={formTextStyle}>
                  Accede con tu correo y contraseña para ver tu plan, membresía
                  y próximas funciones de métricas reales.
                </p>
              </div>

              <form onSubmit={handleLogin} style={formStyle}>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Correo</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) =>
                      setLoginForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    required
                    style={inputStyle}
                    placeholder="tucorreo@email.com"
                  />
                </div>

                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Contraseña</label>
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
                    style={inputStyle}
                    placeholder="********"
                  />
                </div>

                <button type="submit" disabled={loginLoading} style={buttonStyle}>
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

          {activeTab === "register" && (
            <section style={{ ...cardStyle, padding: isMobile ? 20 : 32 }}>
              <div style={sectionHeaderStyle}>
                <span style={badgeStyle}>Registro</span>
                <h2 style={{ ...formTitleStyle, fontSize: isMobile ? 26 : 32 }}>
                  Crear cuenta
                </h2>
                <p style={formTextStyle}>
                  Crea tu usuario para acceder a onboarding, membresías y plan.
                </p>
              </div>

              <form onSubmit={handleRegister} style={formStyle}>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Nombre</label>
                  <input
                    type="text"
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required
                    style={inputStyle}
                    placeholder="Tu nombre"
                  />
                </div>

                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Correo</label>
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
                    style={inputStyle}
                    placeholder="tucorreo@email.com"
                  />
                </div>

                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Contraseña</label>
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
                    style={inputStyle}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>

                <button
                  type="submit"
                  disabled={registerLoading}
                  style={buttonStyle}
                >
                  {registerLoading ? "Creando cuenta..." : "Crear cuenta"}
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
            <section style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
              <div style={sectionHeaderStyle}>
                <span style={badgeStyle}>Dashboard</span>
                <h2 style={{ ...formTitleStyle, fontSize: isMobile ? 26 : 32 }}>
                  Resumen de entrenamiento
                </h2>
                <p style={formTextStyle}>
                  {accessGranted
                    ? "Una vista rápida de tu estado actual, tu próxima sesión y tu semana visible."
                    : "Completa tu membresía para desbloquear el plan y preparar la siguiente capa con métricas reales."}
                </p>
              </div>

              <div style={profileTopBarStyle}>
                <div>
                  <div style={profileNameStyle}>{authUser.name}</div>
                  <div style={profileEmailStyle}>{authUser.email}</div>
                </div>
                <button style={logoutButtonStyle} onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </div>

              {!accessGranted && (
                <div style={lockedCardStyle}>
                  <div style={lockedTitleStyle}>Acceso bloqueado</div>
                  <div style={lockedTextStyle}>
                    Tu membresía aún no está activa. Completa tu pago para
                    habilitar el plan y las funciones avanzadas por nivel.
                  </div>
                  <button
                    style={heroButtonStyle}
                    onClick={() => setActiveTab("membership")}
                  >
                    Ver membresías
                  </button>
                </div>
              )}

              {accessGranted && (
                <>
                  <div
                    style={{
                      ...membershipOverviewCardStyle,
                      marginBottom: 18,
                    }}
                  >
                    <div style={membershipOverviewHeaderStyle}>
                      <div>
                        <div style={membershipOverviewEyebrowStyle}>
                          Mi membresía
                        </div>
                        <div style={membershipOverviewTitleStyle}>
                          {membershipLabel}
                        </div>
                      </div>
                      <div style={membershipOverviewStatusBadgeStyle}>
                        {membershipStatusLabel}
                      </div>
                    </div>

                    <div
                      style={{
                        ...membershipOverviewGridStyle,
                        gridTemplateColumns: isMobile
                          ? "1fr"
                          : "repeat(4, minmax(0, 1fr))",
                      }}
                    >
                      <div style={membershipOverviewItemStyle}>
                        <div style={membershipOverviewItemLabelStyle}>Plan</div>
                        <div style={membershipOverviewItemValueStyle}>
                          {membershipLabel}
                        </div>
                      </div>

                      <div style={membershipOverviewItemStyle}>
                        <div style={membershipOverviewItemLabelStyle}>Estado</div>
                        <div style={membershipOverviewItemValueStyle}>
                          {membershipStatusLabel}
                        </div>
                      </div>

                      <div style={membershipOverviewItemStyle}>
                        <div style={membershipOverviewItemLabelStyle}>
                          Permisos
                        </div>
                        <div style={membershipOverviewItemValueStyle}>
                          {isStarter && "Base"}
                          {isPerformance && "Base + Strava"}
                          {isProCoach && "Base + Strava + Premium"}
                          {!isStarter && !isPerformance && !isProCoach && "Sin plan"}
                        </div>
                      </div>

                      <div style={membershipOverviewItemStyle}>
                        <div style={membershipOverviewItemLabelStyle}>
                          Próxima renovación
                        </div>
                        <div style={membershipOverviewItemValueStyle}>
                          {membershipRenewalLabel}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={entitlementsCardStyle}>
                    <div style={entitlementsTitleStyle}>Funciones habilitadas</div>
                    <div
                      style={{
                        ...entitlementsGridStyle,
                        gridTemplateColumns: isMobile
                          ? "1fr"
                          : "repeat(3, minmax(0, 1fr))",
                      }}
                    >
                      <div style={entitlementItemStyle}>
                        Plan base:{" "}
                        {entitlements?.can_generate_base_plan ? "Sí" : "No"}
                      </div>
                      <div style={entitlementItemStyle}>
                        Strava: {canConnectStrava ? "Sí" : "No"}
                      </div>
                      <div style={entitlementItemStyle}>
                        Premium: {canUsePremiumPlanning ? "Sí" : "No"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr",
                      gap: 16,
                    }}
                  >
                    <div style={heroCardStyle}>
                      <div style={heroBadgeStyle}>Sesión del día</div>
                      <div style={heroTitleStyle}>
                        {todaysSession
                          ? todaysSession.title
                          : "Aún no hay plan cargado"}
                      </div>
                      <div style={heroMetaStyle}>
                        {todaysSession?.day_of_week ||
                          "Consulta tu plan para comenzar"}
                        {todaysSession?.distance_target
                          ? ` · ${todaysSession.distance_target} km`
                          : ""}
                        {todaysSession?.duration_target
                          ? ` · ${todaysSession.duration_target} min`
                          : ""}
                      </div>
                      <div style={heroTextStyle}>
                        {todaysSession?.objective ||
                          "Aquí verás la sesión destacada de la semana visible."}
                      </div>
                      {todaysSession && (
                        <button
                          style={heroButtonStyle}
                          onClick={() => setSelectedSession(todaysSession)}
                        >
                          Ver sesión
                        </button>
                      )}
                    </div>

                    <div style={miniStatsWrapStyle}>
                      <div style={miniStatCardStyle}>
                        <div style={miniStatLabelStyle}>Readiness</div>
                        <div style={miniStatValueStyle}>
                          {visibleWeeks.length > 0 ? `${readinessScore}%` : "--"}
                        </div>
                        <div style={miniStatHintStyle}>Listo para rendir</div>
                      </div>
                      <div style={miniStatCardStyle}>
                        <div style={miniStatLabelStyle}>Recuperación</div>
                        <div style={miniStatValueStyle}>
                          {visibleWeeks.length > 0 ? `${recoveryScore}%` : "--"}
                        </div>
                        <div style={miniStatHintStyle}>Carga manejable</div>
                      </div>
                    </div>
                  </div>

                  <div style={stravaPlaceholderCardStyle}>
                    <div style={stravaPlaceholderTitleStyle}>
                      Integración con Strava
                    </div>
                    <div style={stravaPlaceholderTextStyle}>
                      {canConnectStrava
                        ? "Tu plan permite conectar Strava. El siguiente bloque será OAuth, sincronización de actividades reales y métricas automáticas."
                        : "Tu plan actual no incluye Strava. Mejora a Performance o Pro Coach para desbloquear métricas reales."}
                    </div>
                    {canConnectStrava ? (
                      <button style={secondaryButtonStyle} type="button">
                        Conectar Strava próximamente
                      </button>
                    ) : (
                      <button
                        style={secondaryButtonStyle}
                        type="button"
                        onClick={() => setActiveTab("membership")}
                      >
                        Mejorar plan
                      </button>
                    )}
                  </div>

                  {visibleWeek && (
                    <div style={homeWeekListWrapStyle}>
                      <div style={homeWeekListHeaderStyle}>
                        <div style={homeWeekListTitleStyle}>
                          Semana {visibleWeek.week_number}
                        </div>
                        <div style={homeWeekListSubtitleStyle}>
                          {visibleWeek.focus_label || "Bloque activo"}
                        </div>
                      </div>

                      <div
                        style={{
                          ...homeWeekListGridStyle,
                          gridTemplateColumns: isMobile
                            ? "1fr"
                            : "repeat(2, minmax(0, 1fr))",
                        }}
                      >
                        {visibleWeek.sessions.map((session, index) => (
                          <button
                            key={`${session.day_of_week}-${index}`}
                            style={homeWeekItemStyle}
                            onClick={() => setSelectedSession(session)}
                          >
                            <div style={homeWeekItemTopStyle}>
                              <span style={homeWeekDayStyle}>
                                {session.day_of_week || "Sesión"}
                              </span>
                              <span style={homeWeekZoneStyle}>
                                {session.intensity_zone || "General"}
                              </span>
                            </div>
                            <div style={homeWeekSessionTitleStyle}>
                              {session.title}
                            </div>
                            <div style={homeWeekMetaStyle}>
                              {session.distance_target
                                ? `${session.distance_target} km`
                                : ""}
                              {session.duration_target
                                ? ` · ${session.duration_target} min`
                                : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 18,
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "1fr"
                        : "repeat(3, minmax(0, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div style={summaryCardStyle}>
                      <div style={summaryLabelStyle}>Semana activa</div>
                      <div style={summaryValueStyle}>
                        {visibleWeek
                          ? `Semana ${visibleWeek.week_number}`
                          : "--"}
                      </div>
                    </div>
                    <div style={summaryCardStyle}>
                      <div style={summaryLabelStyle}>Sesiones visibles</div>
                      <div style={summaryValueStyle}>{totalSessions || "--"}</div>
                    </div>
                    <div style={summaryCardStyle}>
                      <div style={summaryLabelStyle}>Carga total</div>
                      <div style={summaryValueStyle}>
                        {totalDistance ? `${totalDistance} km` : "--"}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {authUser && activeTab === "new" && (
            <section style={{ ...cardStyle, padding: isMobile ? 20 : 32 }}>
              <div style={sectionHeaderStyle}>
                <span style={badgeStyle}>Comienza hoy</span>
                <h2 style={{ ...formTitleStyle, fontSize: isMobile ? 26 : 32 }}>
                  Completar onboarding
                </h2>
                <p style={formTextStyle}>
                  Captura tu información base para preparar tu estructura de
                  entrenamiento.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={formStyle}>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Nombre</label>
                  <input
                    name="name"
                    placeholder="Tu nombre"
                    value={authUser?.name || form.name}
                    onChange={handleChange}
                    required
                    style={inputStyle}
                    disabled
                  />
                </div>

                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Correo</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="tucorreo@email.com"
                    value={authUser?.email || form.email}
                    onChange={handleChange}
                    required
                    style={inputStyle}
                    disabled
                  />
                </div>

                <div
                  style={{
                    ...twoColsStyle,
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  }}
                >
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Objetivo</label>
                    <select
                      name="goal"
                      value={form.goal}
                      onChange={handleChange}
                      style={inputStyle}
                    >
                      <option>Completar una carrera</option>
                      <option>Mejorar tiempo</option>
                      <option>Retomar constancia</option>
                    </select>
                  </div>

                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Distancia</label>
                    <select
                      name="distance"
                      value={form.distance}
                      onChange={handleChange}
                      style={inputStyle}
                    >
                      <option>5K</option>
                      <option>10K</option>
                      <option>21K</option>
                      <option>42K</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    ...twoColsStyle,
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  }}
                >
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Días por semana</label>
                    <input
                      name="daysPerWeek"
                      type="number"
                      min={1}
                      max={7}
                      value={form.daysPerWeek}
                      onChange={handleChange}
                      style={inputStyle}
                    />
                  </div>

                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Nivel</label>
                    <select
                      name="level"
                      value={form.level}
                      onChange={handleChange}
                      style={inputStyle}
                    >
                      <option>Principiante</option>
                      <option>Intermedio</option>
                      <option>Avanzado</option>
                    </select>
                  </div>
                </div>

                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>
                    Volumen actual por semana (km)
                  </label>
                  <input
                    name="currentVolumeKm"
                    type="number"
                    min={0}
                    value={form.currentVolumeKm}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Evento objetivo</label>
                  <input
                    name="eventName"
                    placeholder="Ej. Medio Maratón CDMX"
                    value={form.eventName}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Fecha del evento</label>
                  <input
                    name="eventDate"
                    type="date"
                    value={form.eventDate}
                    onChange={handleChange}
                    style={{ ...inputStyle, colorScheme: "dark" }}
                  />
                </div>

                <button type="submit" disabled={loading} style={buttonStyle}>
                  {loading
                    ? "Guardando onboarding..."
                    : "Guardar onboarding y continuar"}
                </button>
              </form>
            </section>
          )}

          {authUser && activeTab === "existing" && (
            <section style={{ ...cardStyle, padding: isMobile ? 20 : 32 }}>
              <div style={sectionHeaderStyle}>
                <span style={badgeStyle}>Consultar</span>
                <h2 style={{ ...formTitleStyle, fontSize: isMobile ? 26 : 32 }}>
                  Cargar plan existente
                </h2>
                <p style={formTextStyle}>
                  Usa tu correo registrado para consultar acceso y cargar la
                  semana disponible.
                </p>
              </div>

              <form onSubmit={handleLookup} style={formStyle}>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Correo registrado</label>
                  <input
                    type="email"
                    placeholder="correo registrado"
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={lookupLoading}
                  style={secondaryButtonStyle}
                >
                  {lookupLoading
                    ? "Verificando acceso..."
                    : "Buscar usuario y cargar plan"}
                </button>
              </form>

              {membership && (
                <div style={membershipStatusCardStyle}>
                  <div style={membershipStatusTitleStyle}>
                    Estado de membresía
                  </div>
                  <div style={membershipStatusTextStyle}>
                    Plan: {membership.plan_code || "Sin plan"} · Estado:{" "}
                    {membership.status}
                  </div>
                </div>
              )}

              {accessGranted && visibleWeeks.length > 0 && (
                <section style={{ ...planContainerStyle, marginTop: 24 }}>
                  <div
                    style={{
                      ...planTopBarStyle,
                      alignItems: isMobile ? "start" : "end",
                      flexDirection: isMobile ? "column" : "row",
                    }}
                  >
                    <h3 style={planTitleStyle}>Tu semana actual</h3>
                    <div style={planHintStyle}>
                      Las siguientes semanas permanecen ocultas
                    </div>
                  </div>

                  {visibleWeeks.map((week) => (
                    <div key={week.week_number} style={weekCardStyle}>
                      <div
                        style={{
                          ...weekHeaderStyle,
                          alignItems: isMobile ? "start" : "center",
                          flexDirection: isMobile ? "column" : "row",
                        }}
                      >
                        <div>
                          <div style={weekLabelStyle}>
                            Semana {week.week_number}
                          </div>
                          <div style={weekFocusStyle}>
                            {week.focus_label || "Bloque de entrenamiento"}
                          </div>
                        </div>
                        <div style={weekDistanceStyle}>
                          {week.total_target_distance ?? 0} km
                        </div>
                      </div>

                      <div style={sessionsListStyle}>
                        {week.sessions.map((session, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedSession(session)}
                            style={sessionCardButtonStyle}
                          >
                            <div style={sessionTopRowStyle}>
                              <div style={sessionDayStyle}>
                                {session.day_of_week || "Sesión"}
                              </div>
                              <div style={sessionZoneStyle}>
                                {session.intensity_zone || "General"}
                              </div>
                            </div>

                            <div style={sessionTitleStyle}>{session.title}</div>

                            <div style={sessionMetaStyle}>
                              {session.distance_target
                                ? `${session.distance_target} km`
                                : ""}
                              {session.duration_target
                                ? ` · ${session.duration_target} min`
                                : ""}
                            </div>

                            {session.objective && (
                              <div style={sessionObjectiveStyle}>
                                {session.objective}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </section>
          )}

          {authUser && activeTab === "membership" && (
            <section style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
              <div style={sectionHeaderStyle}>
                <span style={badgeStyle}>Membresía</span>
                <h2 style={{ ...formTitleStyle, fontSize: isMobile ? 26 : 32 }}>
                  Elige tu plan
                </h2>
                <p style={formTextStyle}>
                  Starter para base, Performance para desbloquear Strava, Pro
                  Coach para la capa premium.
                </p>
              </div>

              {paypalLoading && (
                <div style={membershipNoteStyle}>Cargando PayPal...</div>
              )}

              {paypalError && <div style={resultStyle}>{paypalError}</div>}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "repeat(3, minmax(0, 1fr))",
                  gap: 20,
                  alignItems: "stretch",
                }}
              >
                <div style={pricingCardStyle}>
                  <div style={pricingHeaderBlockStyle}>
                    <div style={pricingTagStyle}>Base</div>
                    <h3 style={pricingTitleStyle}>Starter</h3>
                    <div style={pricingPriceStyle}>$149 MXN</div>
                    <div style={pricingPeriodStyle}>mensual</div>
                  </div>

                  <div style={pricingListStyle}>
                    <div style={pricingItemStyle}>
                      • Plan con perfil declarado
                    </div>
                    <div style={pricingItemStyle}>• Ideal para empezar</div>
                    <div style={pricingItemStyle}>• Sin Strava</div>
                  </div>

                  <div style={paypalShellStyle}>
                    <div ref={starterRef} style={paypalButtonWrapStyle} />
                  </div>
                </div>

                <div style={{ ...pricingCardStyle, ...pricingFeaturedStyle }}>
                  <div style={pricingHeaderBlockStyle}>
                    <div style={pricingTagStyle}>Recomendado</div>
                    <h3 style={pricingTitleStyle}>Performance</h3>
                    <div style={pricingPriceStyle}>$249 MXN</div>
                    <div style={pricingPeriodStyle}>mensual</div>
                  </div>

                  <div style={pricingListStyle}>
                    <div style={pricingItemStyle}>• Perfil + historial real</div>
                    <div style={pricingItemStyle}>• Conexión con Strava</div>
                    <div style={pricingItemStyle}>
                      • Mejor base para 10K / 21K / 42K
                    </div>
                  </div>

                  <div style={paypalShellStyle}>
                    <div ref={performanceRef} style={paypalButtonWrapStyle} />
                  </div>
                </div>

                <div style={pricingCardStyle}>
                  <div style={pricingHeaderBlockStyle}>
                    <div style={pricingTagStyle}>Premium</div>
                    <h3 style={pricingTitleStyle}>Pro Coach</h3>
                    <div style={pricingPriceStyle}>$449 MXN</div>
                    <div style={pricingPeriodStyle}>mensual</div>
                  </div>

                  <div style={pricingListStyle}>
                    <div style={pricingItemStyle}>• Strava + capa premium</div>
                    <div style={pricingItemStyle}>• Mejor refinamiento</div>
                    <div style={pricingItemStyle}>
                      • Base para planificación avanzada
                    </div>
                  </div>

                  <div style={paypalShellStyle}>
                    <div ref={proRef} style={paypalButtonWrapStyle} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {result && <div style={resultStyle}>{result}</div>}
        </main>
      </div>

      {selectedSession && (
        <div style={modalOverlayStyle} onClick={() => setSelectedSession(null)}>
          <div
            style={{
              ...modalCardStyle,
              maxWidth: isMobile ? "100%" : 640,
              padding: isMobile ? 18 : 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalEyebrowStyle}>
                  {selectedSession.day_of_week || "Sesión"}
                </div>
                <h3 style={{ ...modalTitleStyle, fontSize: isMobile ? 24 : 28 }}>
                  {selectedSession.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                style={closeButtonStyle}
              >
                ✕
              </button>
            </div>

            <div style={modalMetaStyle}>
              {selectedSession.distance_target
                ? `${selectedSession.distance_target} km`
                : "Sin distancia"}
              {selectedSession.duration_target
                ? ` · ${selectedSession.duration_target} min`
                : ""}
              {selectedSession.intensity_zone
                ? ` · ${selectedSession.intensity_zone}`
                : ""}
            </div>

            {selectedSession.objective && (
              <div style={detailBlockStyle}>
                <div style={detailTitleStyle}>Objetivo</div>
                <div style={detailTextStyle}>{selectedSession.objective}</div>
              </div>
            )}

            {selectedSession.warmup_text && (
              <div style={detailBlockStyle}>
                <div style={detailTitleStyle}>Calentamiento</div>
                <div style={detailTextStyle}>{selectedSession.warmup_text}</div>
              </div>
            )}

            {selectedSession.main_set_text && (
              <div style={detailBlockStyle}>
                <div style={detailTitleStyle}>Bloque principal</div>
                <div style={detailTextStyle}>{selectedSession.main_set_text}</div>
              </div>
            )}

            {selectedSession.cooldown_text && (
              <div style={detailBlockStyle}>
                <div style={detailTitleStyle}>Enfriamiento</div>
                <div style={detailTextStyle}>{selectedSession.cooldown_text}</div>
              </div>
            )}

            {typeof selectedSession.estimated_load === "number" && (
              <div style={detailBlockStyle}>
                <div style={detailTitleStyle}>Carga estimada</div>
                <div style={detailTextStyle}>
                  {selectedSession.estimated_load}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const loadingScreenStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(180deg, #070B10 0%, #0B0F14 100%)",
  padding: 20,
};

const loadingCardStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 28,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  textAlign: "center",
  color: "white",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(0,230,255,0.10), transparent 25%), radial-gradient(circle at top right, rgba(214,255,77,0.14), transparent 20%), linear-gradient(180deg, #070B10 0%, #0B0F14 100%)",
  color: "white",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  padding: "32px 20px",
  position: "relative",
  overflow: "hidden",
};

const gridOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
  backgroundSize: "34px 34px",
  opacity: 0.18,
  pointerEvents: "none",
};

const glowOne: React.CSSProperties = {
  position: "absolute",
  width: 300,
  height: 300,
  borderRadius: "50%",
  background: "rgba(214,255,77,0.10)",
  filter: "blur(80px)",
  top: -40,
  right: -60,
};

const glowTwo: React.CSSProperties = {
  position: "absolute",
  width: 300,
  height: 300,
  borderRadius: "50%",
  background: "rgba(0,230,255,0.10)",
  filter: "blur(80px)",
  bottom: -60,
  left: -60,
};

const glowThree: React.CSSProperties = {
  position: "absolute",
  width: 260,
  height: 260,
  borderRadius: "50%",
  background: "rgba(0,230,255,0.06)",
  filter: "blur(70px)",
  top: "34%",
  left: "40%",
};

const wrapperStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  display: "grid",
  gap: 28,
  position: "relative",
  zIndex: 1,
  alignItems: "start",
};

const brandPanelStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 32,
  padding: 36,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
  backdropFilter: "blur(12px)",
};

const logoRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const logoBoxStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 18px",
  borderRadius: 18,
  background: "rgba(214,255,77,0.10)",
  color: "#D6FF4D",
  fontWeight: 800,
  letterSpacing: "0.04em",
  width: "fit-content",
  border: "1px solid rgba(214,255,77,0.20)",
  boxShadow: "0 0 30px rgba(214,255,77,0.08)",
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(0,230,255,0.10)",
  color: "#00E6FF",
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid rgba(0,230,255,0.18)",
};

const eyebrowStyle: React.CSSProperties = {
  marginTop: 28,
  marginBottom: 12,
  color: "#00E6FF",
  fontSize: 12,
  letterSpacing: "0.22em",
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  lineHeight: 1.02,
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 18,
  color: "rgba(255,255,255,0.68)",
  lineHeight: 1.7,
};

const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  marginTop: 32,
};

const featureCardStyle: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 16,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const featureLabelStyle: React.CSSProperties = {
  display: "block",
  color: "rgba(255,255,255,0.55)",
  fontSize: 12,
  marginBottom: 6,
};

const featureValueStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#fff",
};

const statsRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 28,
};

const statCardStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#D6FF4D",
};

const statLabelStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "rgba(255,255,255,0.62)",
};

const mainPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const tabsWrapStyle: React.CSSProperties = {
  gap: 10,
  alignItems: "center",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 8,
};

const tabButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.65)",
  padding: "12px 18px",
  borderRadius: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const activeTabButtonStyle: React.CSSProperties = {
  background: "rgba(214,255,77,0.12)",
  color: "#D6FF4D",
};

const cardStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(17,22,29,0.98), rgba(11,15,20,0.96))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 32,
  boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
  backdropFilter: "blur(12px)",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(0,230,255,0.10)",
  color: "#00E6FF",
  padding: "8px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 14,
};

const formTitleStyle: React.CSSProperties = {
  margin: 0,
};

const formTextStyle: React.CSSProperties = {
  marginTop: 10,
  color: "rgba(255,255,255,0.65)",
  lineHeight: 1.6,
};

const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: 20,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const twoColsStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const fieldGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(255,255,255,0.72)",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 14px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0B0F14",
  color: "white",
  boxSizing: "border-box",
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const buttonStyle: React.CSSProperties = {
  background: "#D6FF4D",
  color: "#000",
  border: "none",
  borderRadius: 16,
  padding: "15px 16px",
  fontWeight: 800,
  cursor: "pointer",
  marginTop: 8,
  boxShadow: "0 12px 30px rgba(214,255,77,0.18)",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "rgba(0,230,255,0.14)",
  color: "#00E6FF",
  border: "1px solid rgba(0,230,255,0.20)",
  borderRadius: 16,
  padding: "15px 16px",
  fontWeight: 800,
  cursor: "pointer",
  marginTop: 8,
};

const resultStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.05)",
  color: "#00E6FF",
  lineHeight: 1.5,
  wordBreak: "break-word",
  border: "1px solid rgba(255,255,255,0.06)",
};

const profileTopBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 18,
  flexWrap: "wrap",
};

const profileNameStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
};

const profileEmailStyle: React.CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.65)",
  marginTop: 4,
};

const logoutButtonStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 14,
  padding: "12px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const heroCardStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 22,
  background:
    "linear-gradient(135deg, rgba(214,255,77,0.14), rgba(0,230,255,0.10) 60%, rgba(255,255,255,0.03))",
  border: "1px solid rgba(255,255,255,0.08)",
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const heroBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  width: "fit-content",
  padding: "8px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(255,255,255,0.08)",
  color: "#D6FF4D",
};

const heroTitleStyle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 800,
  lineHeight: 1.05,
  marginTop: 16,
};

const heroMetaStyle: React.CSSProperties = {
  marginTop: 8,
  color: "rgba(255,255,255,0.72)",
  fontSize: 14,
};

const heroTextStyle: React.CSSProperties = {
  marginTop: 12,
  color: "rgba(255,255,255,0.88)",
  lineHeight: 1.6,
};

const heroButtonStyle: React.CSSProperties = {
  marginTop: 18,
  background: "#D6FF4D",
  color: "#000",
  border: "none",
  borderRadius: 14,
  padding: "12px 14px",
  fontWeight: 800,
  cursor: "pointer",
  width: "fit-content",
};

const miniStatsWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const miniStatCardStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const miniStatLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.55)",
};

const miniStatValueStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 800,
  color: "#D6FF4D",
  marginTop: 8,
};

const miniStatHintStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "rgba(255,255,255,0.72)",
};

const homeWeekListWrapStyle: React.CSSProperties = {
  marginTop: 18,
  borderRadius: 22,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const homeWeekListHeaderStyle: React.CSSProperties = {
  marginBottom: 14,
};

const homeWeekListTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#D6FF4D",
};

const homeWeekListSubtitleStyle: React.CSSProperties = {
  marginTop: 4,
  color: "rgba(255,255,255,0.66)",
  fontSize: 13,
};

const homeWeekListGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const homeWeekItemStyle: React.CSSProperties = {
  borderRadius: 16,
  background: "#0B0F14",
  border: "1px solid rgba(255,255,255,0.06)",
  padding: 14,
  textAlign: "left",
  cursor: "pointer",
  color: "white",
};

const homeWeekItemTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 6,
  alignItems: "center",
};

const homeWeekDayStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#D6FF4D",
  fontWeight: 700,
};

const homeWeekZoneStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#00E6FF",
  fontWeight: 700,
};

const homeWeekSessionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
};

const homeWeekMetaStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "rgba(255,255,255,0.65)",
};

const summaryCardStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.55)",
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 24,
  fontWeight: 800,
  color: "#fff",
};

const planContainerStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const planTopBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
};

const planTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "#D6FF4D",
};

const planHintStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 13,
};

const weekCardStyle: React.CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 18,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const weekHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 14,
};

const weekLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(255,255,255,0.55)",
};

const weekFocusStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
};

const weekDistanceStyle: React.CSSProperties = {
  color: "#00E6FF",
  fontWeight: 700,
};

const sessionsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const sessionCardButtonStyle: React.CSSProperties = {
  borderRadius: 16,
  background: "#0B0F14",
  border: "1px solid rgba(255,255,255,0.06)",
  padding: 14,
  textAlign: "left",
  cursor: "pointer",
  color: "white",
};

const sessionTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 6,
};

const sessionDayStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#D6FF4D",
  fontWeight: 700,
};

const sessionZoneStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#00E6FF",
  fontWeight: 700,
};

const sessionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 6,
};

const sessionMetaStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(255,255,255,0.65)",
  marginBottom: 6,
};

const sessionObjectiveStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(255,255,255,0.82)",
  lineHeight: 1.5,
};

const pricingCardStyle: React.CSSProperties = {
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 22,
  display: "flex",
  flexDirection: "column",
  minHeight: 720,
  overflow: "hidden",
};

const pricingFeaturedStyle: React.CSSProperties = {
  boxShadow:
    "0 0 0 1px rgba(214,255,77,0.18), 0 18px 40px rgba(214,255,77,0.08)",
};

const pricingHeaderBlockStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const pricingTagStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(0,230,255,0.10)",
  color: "#00E6FF",
  fontSize: 12,
  fontWeight: 700,
  width: "fit-content",
  alignSelf: "flex-start",
};

const pricingTitleStyle: React.CSSProperties = {
  margin: "12px 0 0 0",
  fontSize: 24,
};

const pricingPriceStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 800,
  color: "#D6FF4D",
  lineHeight: 1.1,
};

const pricingPeriodStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.62)",
  fontSize: 14,
};

const pricingListStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 28,
  minHeight: 170,
  alignContent: "start",
};

const pricingItemStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.85)",
  lineHeight: 1.5,
  fontSize: 14,
};

const paypalShellStyle: React.CSSProperties = {
  marginTop: "auto",
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
  paddingTop: 12,
};

const paypalButtonWrapStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  transform: "scale(0.94)",
  transformOrigin: "center bottom",
};

const membershipNoteStyle: React.CSSProperties = {
  marginTop: 18,
  color: "rgba(255,255,255,0.62)",
  fontSize: 13,
};

const membershipStatusCardStyle: React.CSSProperties = {
  marginTop: 18,
  borderRadius: 18,
  padding: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const membershipStatusTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#D6FF4D",
};

const membershipStatusTextStyle: React.CSSProperties = {
  marginTop: 6,
  color: "rgba(255,255,255,0.78)",
  fontSize: 14,
};

const lockedCardStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const lockedTitleStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
};

const lockedTextStyle: React.CSSProperties = {
  marginTop: 10,
  color: "rgba(255,255,255,0.72)",
  lineHeight: 1.6,
};

const entitlementsCardStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  marginBottom: 18,
};

const entitlementsTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  marginBottom: 12,
};

const entitlementsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const entitlementItemStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  background: "#0B0F14",
  border: "1px solid rgba(255,255,255,0.06)",
  fontSize: 14,
  color: "rgba(255,255,255,0.84)",
};

const stravaPlaceholderCardStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 18,
  border: "1px solid rgba(0,230,255,0.16)",
  background: "rgba(0,230,255,0.06)",
  marginTop: 18,
};

const stravaPlaceholderTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#00E6FF",
};

const stravaPlaceholderTextStyle: React.CSSProperties = {
  marginTop: 8,
  color: "rgba(255,255,255,0.82)",
  lineHeight: 1.6,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(3,6,10,0.72)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 30,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  background: "linear-gradient(180deg, #11161D 0%, #0B0F14 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 28,
  boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 14,
};

const modalEyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#00E6FF",
  fontWeight: 700,
  marginBottom: 8,
};

const modalTitleStyle: React.CSSProperties = {
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "white",
  width: 38,
  height: 38,
  borderRadius: 12,
  cursor: "pointer",
};

const modalMetaStyle: React.CSSProperties = {
  marginTop: 14,
  marginBottom: 18,
  color: "rgba(255,255,255,0.7)",
  fontSize: 14,
};

const detailBlockStyle: React.CSSProperties = {
  borderRadius: 16,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  padding: 14,
  marginTop: 12,
};

const detailTitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#D6FF4D",
  fontWeight: 700,
  marginBottom: 6,
};

const detailTextStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.84)",
  lineHeight: 1.6,
  fontSize: 14,
};

const membershipOverviewCardStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const membershipOverviewHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  marginBottom: 16,
  flexWrap: "wrap",
};

const membershipOverviewEyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#00E6FF",
  fontWeight: 700,
  marginBottom: 6,
};

const membershipOverviewTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#fff",
};

const membershipOverviewStatusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(214,255,77,0.12)",
  color: "#D6FF4D",
  fontSize: 12,
  fontWeight: 800,
};

const membershipOverviewGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const membershipOverviewItemStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 14,
  background: "#0B0F14",
  border: "1px solid rgba(255,255,255,0.06)",
};

const membershipOverviewItemLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.55)",
  marginBottom: 6,
};

const membershipOverviewItemValueStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#fff",
  fontWeight: 700,
  lineHeight: 1.4,
  wordBreak: "break-word",
};