// Registro de uso y costo de cada llamada a Gemini, en Postgres (Railway).
// Solo guarda NÚMEROS: fecha, tipo de llamada, sesión, tokens y costo estimado.
// Nunca guarda lo que escriben las personas ni sus fotos.
// Si DATABASE_URL no está configurada o la base falla, la app sigue funcionando igual.
import postgres from 'postgres';

// Precio de lista de Gemini 2.5 Flash (US$ por millón de tokens). Ajustar si cambia el modelo o el precio.
// El "pensamiento" interno del modelo se cobra como salida.
export const PRECIO_ENTRADA_USD_M = Number(process.env.PRECIO_ENTRADA_USD_M || 0.30);
export const PRECIO_SALIDA_USD_M = Number(process.env.PRECIO_SALIDA_USD_M || 2.50);

let sql = null;
let tablaLista = null;

export function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 5, connect_timeout: 5, ssl: 'prefer', onnotice: () => {},
    });
  }
  if (!tablaLista) {
    tablaLista = sql`
      CREATE TABLE IF NOT EXISTS uso (
        id             BIGSERIAL PRIMARY KEY,
        creado         TIMESTAMPTZ NOT NULL DEFAULT now(),
        tipo           TEXT NOT NULL,          -- 'lectura' (fotos) | 'chat'
        modulo         TEXT,                   -- 'A' | 'B'
        conversacion   TEXT,                   -- id aleatorio por conversación, no identifica a nadie
        intercambio    INT,
        imagenes       INT NOT NULL DEFAULT 0,
        modelo         TEXT,
        tokens_entrada INT NOT NULL DEFAULT 0,
        tokens_salida  INT NOT NULL DEFAULT 0,
        costo_usd      NUMERIC(12,6) NOT NULL DEFAULT 0
      )`.catch((e) => { tablaLista = null; throw e; });
  }
  return { sql, lista: tablaLista };
}

export function costoDe(usage) {
  const entrada = usage?.promptTokenCount || 0;
  const salida = (usage?.candidatesTokenCount || 0) + (usage?.thoughtsTokenCount || 0);
  const costo = (entrada * PRECIO_ENTRADA_USD_M + salida * PRECIO_SALIDA_USD_M) / 1e6;
  return { entrada, salida, costo };
}

export async function registrarUso({ tipo, modulo, conversacion, intercambio = null, imagenes = 0, modelo, usage }) {
  const conn = db();
  if (!conn) return;
  const { entrada, salida, costo } = costoDe(usage);
  const id = typeof conversacion === 'string' ? conversacion.slice(0, 64) : null;
  try {
    await conn.lista;
    await conn.sql`
      INSERT INTO uso (tipo, modulo, conversacion, intercambio, imagenes, modelo, tokens_entrada, tokens_salida, costo_usd)
      VALUES (${tipo}, ${modulo}, ${id}, ${intercambio}, ${imagenes}, ${modelo}, ${entrada}, ${salida}, ${costo})`;
  } catch (e) {
    console.error('No se pudo registrar uso', e?.code || e?.name);
  }
}
