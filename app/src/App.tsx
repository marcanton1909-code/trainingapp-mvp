import { useState } from "react";

const API_URL = "https://trainingapp-api.marco-cruz.workers.dev";

export default function App() {
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
  const [result, setResult] = useState("");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult("");

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
        throw new Error(onboardingData?.error || "Error guardando onboarding");
      }

      const planRes = await fetch(`${API_URL}/api/plan/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: onboardingData.userId,
          ...form,
        }),
      });

      const planData = await planRes.json();

      if (!planRes.ok) {
        throw new Error(planData?.error || "Error generando plan");
      }

      setResult(
        `Perfil guardado y plan generado correctamente. User ID: ${onboardingData.userId}`
      );
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={glowOne} />
      <div style={glowTwo} />

      <div style={wrapperStyle}>
        <div style={brandPanelStyle}>
          <div style={logoBoxStyle}>trAIning</div>
          <p style={eyebrowStyle}>ENTRENA INTELIGENTE</p>
          <h1 style={titleStyle}>
            Tu plan de running con IA empieza aquí.
          </h1>
          <p style={subtitleStyle}>
            Define tu objetivo, tu distancia y tu nivel actual. Al guardar tu
            perfil, el sistema generará automáticamente tu plan inicial.
          </p>

          <div style={featureGridStyle}>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Objetivo</span>
              <strong style={featureValueStyle}>10K · 21K · 42K</strong>
            </div>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Motor</span>
              <strong style={featureValueStyle}>IA + reglas</strong>
            </div>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Sincronía</span>
              <strong style={featureValueStyle}>Strava ready</strong>
            </div>
            <div style={featureCardStyle}>
              <span style={featureLabelStyle}>Experiencia</span>
              <strong style={featureValueStyle}>Mobile first</strong>
            </div>
          </div>
        </div>

        <div style={formCardStyle}>
          <div style={formHeaderStyle}>
            <span style={badgeStyle}>Onboarding MVP</span>
            <h2 style={formTitleStyle}>Crea tu perfil inicial</h2>
            <p style={formTextStyle}>
              Esta información se guarda en Cloudflare y después genera tu plan
              automáticamente.
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

            <div style={twoColsStyle}>
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

            <div style={twoColsStyle}>
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
              {loading ? "Guardando y generando plan..." : "Guardar y generar plan"}
            </button>
          </form>

          {result && <div style={resultStyle}>{result}</div>}
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(0,230,255,0.10), transparent 25%), radial-gradient(circle at top right, rgba(214,255,77,0.14), transparent 20%), #0B0F14",
  color: "white",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  padding: "32px 20px",
  position: "relative",
  overflow: "hidden",
};

const glowOne: React.CSSProperties = {
  position: "absolute",
  width: 260,
  height: 260,
  borderRadius: "50%",
  background: "rgba(214,255,77,0.10)",
  filter: "blur(60px)",
  top: -40,
  right: -60,
};

const glowTwo: React.CSSProperties = {
  position: "absolute",
  width: 260,
  height: 260,
  borderRadius: "50%",
  background: "rgba(0,230,255,0.10)",
  filter: "blur(60px)",
  bottom: -60,
  left: -60,
};

const wrapperStyle: React.CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "1.05fr 0.95fr",
  gap: 24,
  position: "relative",
  zIndex: 1,
};

const brandPanelStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 28,
  padding: 32,
  minHeight: 680,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
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
  fontSize: 46,
  lineHeight: 1.05,
  margin: 0,
  maxWidth: 520,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 18,
  maxWidth: 520,
  color: "rgba(255,255,255,0.68)",
  lineHeight: 1.7,
  fontSize: 16,
};

const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginTop: 32,
};

const featureCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 16,
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

const formCardStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(17,22,29,0.98), rgba(11,15,20,0.96))",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 28,
  padding: 28,
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};

const formHeaderStyle: React.CSSProperties = {
  marginBottom: 24,
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
  fontSize: 30,
};

const formTextStyle: React.CSSProperties = {
  marginTop: 10,
  color: "rgba(255,255,255,0.65)",
  lineHeight: 1.6,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const twoColsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
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
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0B0F14",
  color: "white",
  boxSizing: "border-box",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  background: "#D6FF4D",
  color: "#000",
  border: "none",
  borderRadius: 14,
  padding: "15px 16px",
  fontWeight: 800,
  cursor: "pointer",
  marginTop: 8,
};

const resultStyle: React.CSSProperties = {
  marginTop: 18,
  padding: "14px 16px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.05)",
  color: "#00E6FF",
  lineHeight: 1.5,
  wordBreak: "break-word",
};