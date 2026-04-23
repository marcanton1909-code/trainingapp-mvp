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
  const [result, setResult] = useState<string>("");

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
      const res = await fetch(`${API_URL}/api/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error guardando onboarding");
      }

      setResult(`Onboarding guardado. User ID: ${data.userId}`);
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Ocurrió un error inesperado"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0F14",
        color: "white",
        fontFamily: "Arial, sans-serif",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
          background: "#11161d",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          padding: "24px",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "8px", color: "#D6FF4D" }}>
          trAIning onboarding
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", marginTop: 0 }}>
          Prueba conectada al backend real en Cloudflare Workers.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
          <input
            name="name"
            placeholder="Nombre"
            value={form.name}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <input
            name="email"
            type="email"
            placeholder="Correo"
            value={form.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />

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

          <input
            name="daysPerWeek"
            type="number"
            min={1}
            max={7}
            value={form.daysPerWeek}
            onChange={handleChange}
            style={inputStyle}
          />

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

          <input
            name="currentVolumeKm"
            type="number"
            min={0}
            value={form.currentVolumeKm}
            onChange={handleChange}
            style={inputStyle}
          />

          <input
            name="eventName"
            placeholder="Evento objetivo"
            value={form.eventName}
            onChange={handleChange}
            style={inputStyle}
          />

          <input
            name="eventDate"
            type="date"
            value={form.eventDate}
            onChange={handleChange}
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#D6FF4D",
              color: "#000",
              border: "none",
              borderRadius: "14px",
              padding: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Guardando..." : "Guardar onboarding"}
          </button>
        </form>

        {result && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.05)",
              color: "#00E6FF",
              wordBreak: "break-word",
            }}
          >
            {result}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#0B0F14",
  color: "white",
  boxSizing: "border-box",
};