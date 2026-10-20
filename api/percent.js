// Guarda y lee el porcentaje del cupón en Upstash Redis (base de datos de Vercel Marketplace).
const DEFAULT_PERCENT = 33;
const KEY = 'cupon:percent';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...parts) {
  const res = await fetch(REDIS_URL + '/' + parts.map(encodeURIComponent).join('/'), {
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN }
  });
  if (!res.ok) throw new Error('redis ' + res.status);
  return (await res.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Falta conectar la base de datos Redis en Vercel.' });
  }

  try {
    if (req.method === 'GET') {
      const value = await redis('get', KEY);
      const percent = value === null ? DEFAULT_PERCENT : Number(value);
      return res.status(200).json({ percent });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!process.env.ADMIN_PASSWORD) {
        return res.status(500).json({ error: 'Falta la variable ADMIN_PASSWORD en Vercel.' });
      }
      if (body.password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Contraseña incorrecta.' });
      }
      const percent = Math.round(Number(body.percent));
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        return res.status(400).json({ error: 'El porcentaje debe ser un número entre 0 y 100.' });
      }
      await redis('set', KEY, String(percent));
      return res.status(200).json({ percent });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo conectar con la base de datos.' });
  }
};
