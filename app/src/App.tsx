import { useEffect, useState } from "react";

const API_URL = "https://trainingapp-api.marco-cruz.workers.dev";

type Session = {
  id?: string;
  day_of_week?: string;
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
  sessions: Session[];
};

type TabMode = "new" | "existing";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabMode>("new");
  const [isMobile, setIsMobile] = useState(false);

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

  const [result, setResult] = useState("");
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [lookupEmail, setLookupEmail] = useState("");

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 960);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const totalWeeks = weeks.length;
  const totalSessions = weeks.reduce((acc, week) => acc + week.sessions.length, 0);
  const totalDistance = weeks.reduce(
    (acc, week) => acc + Number(week.total_target_distance || 0),
    0
  );

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetPlanState();

    try {
      const onboardingRes = await fetch(`${API_URL}/api/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const onboardingData = await onboardingRes.json();

      if (!onboardingRes.ok) {
        throw new Error(onboardingData?.error || "No fue posible guardar tu perfil");
      }

      const newUserId = onboardingData.userId;

      const planRes = await fetch(`${API_URL}/api/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: newUserId,
          ...form,
        }),
      });

      const planData = await planRes.json();

      if (!planRes.ok) {
        throw new Error(planData?.error || "No fue posible generar tu plan");
      }

      await fetchPlan(newUserId);
      setResult("Tu perfil fue guardado y tu plan inicial ya está listo.");
      setActiveTab("existing");
      setLookupEmail(form.email);
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

    try {
      const userRes = await fetch(`${API_URL}/api/user/find`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: lookupEmail }),
      });

      const userData = await userRes.json();

      if (!userRes.ok) {
        throw new Error(userData?.error || "No fue posible encontrar ese usuario");
      }

      const existingUserId = userData.user.id;

      await fetchPlan(existingUserId);
      setResult(`Plan cargado correctamente para ${userData.user.email}.`);
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLookupLoading(false);
    }
  };

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
              Un plan claro, adaptable y listo para seguir desde el primer día.
            </h1>
            <p
              style={{
                ...subtitleStyle,
                maxWidth: "100%",
                fontSize: isMobile ? 15 : 16,
              }}
            >
              Crea un plan nuevo o consulta uno existente. Todo en una
              experiencia más cercana a una app real.
            </p>
          </div>

          <div
            style={{
              ...featureGridStyle,
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(2, minmax(0, 1fr))",
            }}
          >
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Objetivos</span>
              <strong style={featureValueStyle}>5K · 10K · 21K · 42K</strong>
            </div>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Personalización</span>
              <strong style={featureValueStyle}>Según tu meta</strong>
            </div>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Bloques</span>
              <strong style={featureValueStyle}>Semanas y sesiones</strong>
            </div>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Consulta</span>
              <strong style={featureValueStyle}>Por correo</strong>
            </div>
          </div>

          <div
            style={{
              ...statsRowStyle,
              gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "repeat(3, minmax(0, 1fr))",
            }}
          >
            <div style={statCardStyle}>
              <div style={statValueStyle}>{totalWeeks || "--"}</div>
              <div style={statLabelStyle}>Semanas visibles</div>
            </div>
            <div style={statCardStyle}>
              <div style={statValueStyle}>{totalSessions || "--"}</div>
              <div style={statLabelStyle}>Sesiones cargadas</div>
            </div>
            <div style={statCardStyle}>
              <div style={statValueStyle}>
                {totalDistance ? `${totalDistance}k` : "--"}
              </div>
              <div style={statLabelStyle}>Carga acumulada</div>
            </div>
          </div>
        </aside>

        <main
          style={{
            ...mainPanelStyle,
            order: isMobile ? 1 : 2,
          }}
        >
          <div
            style={{
              ...tabsWrapStyle,
              width: isMobile ? "100%" : "fit-content",
              display: isMobile ? "grid" : "inline-flex",
              gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
            }}
          >
            <button
              onClick={() => setActiveTab("new")}
              style={{
                ...tabButtonStyle,
                ...(activeTab === "new" ? activeTabButtonStyle : {}),
              }}
            >
              Nuevo plan
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
          </div>

          {activeTab === "new" && (
            <section style={{ ...cardStyle, padding: isMobile ? 20 : 32 }}>
              <div style={sectionHeaderStyle}>
                <span style={badgeStyle}>Comienza hoy</span>
                <h2 style={{ ...formTitleStyle, fontSize: isMobile ? 26 : 32 }}>
                  Crear perfil y generar plan
                </h2>
                <p style={formTextStyle}>
                  Captura tu información base y genera tu plan inicial de forma
                  automática.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={formStyle}>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Nombre</label>
                  <input
                    name="name"
                    placeholder="Tu nombre"
                    value={form.name}
                    onChange={handleChange}
                    required
                    style={inputStyle}
                  />
                </div>

                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Correo</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="tucorreo@email.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                    style={inputStyle}
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
                  <label style={labelStyle}>Volumen actual por semana (km)</label>
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
                    style={inputStyle}
                  />
                </div>

                <button type="submit" disabled={loading} style={buttonStyle}>
                  {loading
                    ? "Guardando y generando plan..."
                    : "Guardar y generar plan"}
                </button>
              </form>
            </section>
          )}

          {activeTab === "existing" && (
            <section style={{ ...cardStyle, padding: isMobile ? 20 : 32 }}>
              <div style={sectionHeaderStyle}>
                <span style={badgeStyle}>Consultar</span>
                <h2 style={{ ...formTitleStyle, fontSize: isMobile ? 26 : 32 }}>
                  Cargar plan existente
                </h2>
                <p style={formTextStyle}>
                  Usa el correo registrado para consultar el plan guardado.
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
                  {lookupLoading ? "Buscando plan..." : "Buscar usuario y cargar plan"}
                </button>
              </form>
            </section>
          )}

          {result && <div style={resultStyle}>{result}</div>}

          {weeks.length > 0 && (
            <section style={planContainerStyle}>
              <div
                style={{
                  ...planTopBarStyle,
                  alignItems: isMobile ? "start" : "end",
                  flexDirection: isMobile ? "column" : "row",
                }}
              >
                <h3 style={planTitleStyle}>Tu plan inicial</h3>
                <div style={planHintStyle}>Selecciona una sesión para verla a detalle</div>
              </div>

              {weeks.map((week) => (
                <div key={week.week_number} style={weekCardStyle}>
                  <div
                    style={{
                      ...weekHeaderStyle,
                      alignItems: isMobile ? "start" : "center",
                      flexDirection: isMobile ? "column" : "row",
                    }}
                  >
                    <div>
                      <div style={weekLabelStyle}>Semana {week.week_number}</div>
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
                <div style={detailTextStyle}>{selectedSession.estimated_load}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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