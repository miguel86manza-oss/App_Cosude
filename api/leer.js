// Función serverless: recibe las fotos de las hojas escritas a mano y devuelve su texto.
// Se llama UNA vez al inicio; después la conversación sigue solo con texto.
// Las fotos no se guardan en ningún lado: se leen y se descartan.
import { MODULOS_VALIDOS } from './_prompt.js';
import { llamarGemini, mensajeErrorGemini, MODEL } from './_gemini.js';
import { registrarUso } from './_uso.js';

const MAX_IMAGENES = 4;
const MAX_BASE64 = 1_400_000; // ~1 MB por foto ya comprimida en el navegador
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

const INSTRUCCION = `
Transcribe fielmente el texto escrito a mano en estas fotos de hojas de trabajo personales.
- Copia las palabras tal cual, sin corregir, resumir, ordenar ni interpretar.
- Mantén títulos, listas, flechas o columnas como texto simple (usa guiones o "→").
- Si hay varias fotos, transcríbelas en orden, separadas por una línea "--- Hoja N ---".
- Si una palabra no se entiende, escribe [ilegible]. No inventes.
- Ignora lo que no sea parte de la hoja (mesa, dedos, sombras).
- Responde solo con la transcripción, sin comentarios.
`.trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel.' });
  }

  const { modulo, conversacion, imagenes } = req.body || {};
  if (!MODULOS_VALIDOS.includes(modulo)) return res.status(400).json({ error: 'Módulo inválido.' });
  if (!Array.isArray(imagenes) || imagenes.length === 0 || imagenes.length > MAX_IMAGENES) {
    return res.status(400).json({ error: `Sube entre 1 y ${MAX_IMAGENES} fotos.` });
  }
  for (const im of imagenes) {
    if (!im || !TIPOS.includes(im.mimeType) || typeof im.data !== 'string' || im.data.length > MAX_BASE64) {
      return res.status(400).json({ error: 'Alguna foto no es válida o es demasiado grande.' });
    }
  }

  try {
    const r = await llamarGemini({
      contents: [{
        role: 'user',
        parts: [
          ...imagenes.map((im) => ({ inlineData: { mimeType: im.mimeType, data: im.data } })),
          { text: INSTRUCCION },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
    });

    if (r.usage) {
      await registrarUso({ tipo: 'lectura', modulo, conversacion, imagenes: imagenes.length, modelo: MODEL, usage: r.usage });
    }

    if (!r.ok) {
      console.error('Gemini error (leer)', r.status, r.data?.error?.status);
      return res.status(502).json({ error: mensajeErrorGemini(r.status) });
    }
    if (!r.texto || r.texto.replace(/\[ilegible\]/g, '').trim().length < 20) {
      return res.status(422).json({
        error: 'No logramos leer bien las fotos. Prueba sacarlas de nuevo con más luz y la hoja completa, o escribe tus hojas.',
      });
    }
    return res.status(200).json({ texto: r.texto });
  } catch (e) {
    console.error('Fallo de red con Gemini (leer)', e?.name);
    return res.status(502).json({ error: 'Problema de conexión. Vuelve a intentarlo.' });
  }
}
