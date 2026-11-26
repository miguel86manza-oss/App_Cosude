// Función serverless de Vercel: recibe la conversación y responde con Gemini.
// No guarda conversaciones: solo registra números de uso y costo (ver _uso.js).
import { buildSystemPrompt, MODULOS_VALIDOS } from './_prompt.js';
import { llamarGemini, mensajeErrorGemini, MODEL } from './_gemini.js';
import { registrarUso } from './_uso.js';

const MAX_MENSAJES = 40;        // ~20 intercambios
const MAX_CHARS_MENSAJE = 20000; // ~3 hojas pegadas holgadas
const MAX_CHARS_TOTAL = 80000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });
  }

  const { modulo, messages, conversacion } = req.body || {};
  const error = validar(modulo, messages);
  if (error) return res.status(400).json({ error });

  const intercambio = messages.filter((m) => m.role === 'user').length;

  try {
    const r = await llamarGemini({
      systemInstruction: { parts: [{ text: buildSystemPrompt(modulo, intercambio) }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    });

    // Se registra el costo aunque la respuesta venga vacía: Google la cobra igual.
    if (r.usage) {
      await registrarUso({ tipo: 'chat', modulo, conversacion, intercambio, modelo: MODEL, usage: r.usage });
    }

    if (!r.ok) {
      // Solo se registra el código de error, nunca el texto de la persona.
      console.error('Gemini error', r.status, r.data?.error?.status);
      return res.status(502).json({ error: mensajeErrorGemini(r.status) });
    }
    if (!r.texto) {
      console.error('Gemini sin texto', r.data?.candidates?.[0]?.finishReason, r.data?.promptFeedback?.blockReason);
      return res.status(502).json({
        error: 'No llegó una respuesta. Prueba reformulando tu último mensaje o habla con el facilitador.',
      });
    }
    return res.status(200).json({ reply: r.texto });
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
