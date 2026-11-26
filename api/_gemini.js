// Llamada común a Gemini para /api/chat y /api/leer.
export const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export async function llamarGemini(body) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    },
  );
  const data = await r.json().catch(() => ({}));
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const texto = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
  return { ok: r.ok, status: r.status, data, texto, usage: data?.usageMetadata };
}

export function mensajeErrorGemini(status) {
  return status === 429 || status === 503
    ? 'El servicio está saturado en este momento. Espera unos segundos y vuelve a intentarlo.'
    : 'No pudimos obtener respuesta. Vuelve a intentarlo.';
}
