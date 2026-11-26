// Función serverless de Vercel: recibe la conversación y responde con Gemini.
// No guarda nada: no hay base de datos y no se registra el contenido en logs.
import { buildSystemPrompt, MODULOS_VALIDOS } from './_prompt.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_MENSAJES = 40;        // ~20 intercambios
const MAX_CHARS_MENSAJE = 20000; // ~3 hojas pegadas holgadas
const MAX_CHARS_TOTAL = 80000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });
  }

  const { modulo, messages } = req.body || {};
  const error = validar(modulo, messages);
  if (error) return res.status(400).json({ error });

  const intercambio = messages.filter((m) => m.role === 'user').length;

  const body = {
    systemInstruction: { parts: [{ text: buildSystemPrompt(modulo, intercambio) }] },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      },
    );
    const data = await r.json();

    if (!r.ok) {
      // Solo se registra el código de error, nunca el texto de la persona.
      console.error('Gemini error', r.status, data?.error?.status);
      const ocupado = r.status === 429 || r.status === 503;
      return res.status(502).json({
        error: ocupado
          ? 'El servicio está saturado en este momento. Espera unos segundos y vuelve a intentarlo.'
          : 'No pudimos obtener respuesta. Vuelve a intentarlo.',
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const texto = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();

    if (!texto) {
      console.error('Gemini sin texto', data?.candidates?.[0]?.finishReason, data?.promptFeedback?.blockReason);
      return res.status(502).json({
        error: 'No llegó una respuesta. Prueba reformulando tu último mensaje o habla con el facilitador.',
      });
    }

    return res.status(200).json({ reply: texto });
  } catch (e) {
    console.error('Fallo de red con Gemini', e?.name);
    return res.status(502).json({ error: 'Problema de conexión. Vuelve a intentarlo.' });
  }
}

function validar(modulo, messages) {
  if (!MODULOS_VALIDOS.includes(modulo)) return 'Módulo inválido.';
  if (!Array.isArray(messages) || messages.length === 0) return 'Conversación vacía.';
  if (messages.length > MAX_MENSAJES) return 'La conversación llegó a su largo máximo. Puedes empezar una nueva.';
  let total = 0;
  for (const m of messages) {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') {
      return 'Formato de mensaje inválido.';
    }
    if (m.content.length > MAX_CHARS_MENSAJE) return 'Un mensaje es demasiado largo.';
    total += m.content.length;
  }
  if (total > MAX_CHARS_TOTAL) return 'La conversación es demasiado larga. Puedes empezar una nueva.';
  if (messages[messages.length - 1].role !== 'user') return 'El último mensaje debe ser tuyo.';
  return null;
}
