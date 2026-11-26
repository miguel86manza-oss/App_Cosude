// Resumen de uso y costo, solo para el equipo Adapsys.
// GET /api/costos?clave=<COSTOS_CLAVE>   (opcional: &desde=2026-12-01)
// Devuelve solo números agregados; no hay contenido de conversaciones que mostrar.
import { timingSafeEqual } from 'node:crypto';
import { db, PRECIO_ENTRADA_USD_M, PRECIO_SALIDA_USD_M } from './_uso.js';

function claveValida(dada) {
  const real = process.env.COSTOS_CLAVE;
  if (!real || typeof dada !== 'string') return false;
  const a = Buffer.from(dada), b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!claveValida(req.query?.clave)) return res.status(404).json({ error: 'No encontrado' });
  const conn = db();
  if (!conn) return res.status(500).json({ error: 'Falta configurar DATABASE_URL en Vercel.' });

  const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query?.desde || '') ? req.query.desde : '1970-01-01';

  try {
    await conn.lista;
    const { sql } = conn;
    const [total] = await sql`
      SELECT count(*)::int AS llamadas,
             count(DISTINCT conversacion)::int AS conversaciones,
             coalesce(sum(tokens_entrada), 0)::int AS tokens_entrada,
             coalesce(sum(tokens_salida), 0)::int AS tokens_salida,
             coalesce(sum(costo_usd), 0)::float AS costo_usd
      FROM uso WHERE creado >= ${desde}`;
    const porTipo = await sql`
      SELECT tipo, modulo, count(*)::int AS llamadas, sum(costo_usd)::float AS costo_usd
      FROM uso WHERE creado >= ${desde} GROUP BY 1, 2 ORDER BY 1, 2`;
    const porDia = await sql`
      SELECT to_char(creado AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS dia_utc,
             count(DISTINCT conversacion)::int AS conversaciones,
             count(*)::int AS llamadas, sum(costo_usd)::float AS costo_usd
      FROM uso WHERE creado >= ${desde} GROUP BY 1 ORDER BY 1`;
    const [porConv] = await sql`
      SELECT coalesce(avg(c), 0)::float AS costo_promedio_usd, coalesce(max(c), 0)::float AS costo_maximo_usd,
             coalesce(avg(n), 0)::float AS intercambios_promedio
      FROM (SELECT conversacion, sum(costo_usd) AS c, max(intercambio) AS n
            FROM uso WHERE creado >= ${desde} AND conversacion IS NOT NULL GROUP BY 1) t`;

    return res.status(200).json({
      desde,
      precios_usd_por_millon: { entrada: PRECIO_ENTRADA_USD_M, salida: PRECIO_SALIDA_USD_M },
      total, por_conversacion: porConv, por_tipo: porTipo, por_dia: porDia,
    });
  } catch (e) {
    console.error('Error consultando costos', e?.code || e?.name);
    return res.status(500).json({ error: 'No se pudo consultar la base.' });
  }
}
