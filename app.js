// ROBLE — servidor Express de un solo archivo, proyecto 100% independiente (repo propio,
// puerto propio, sin carpetas ni datos compartidos con CV Manufactura Industrial, Bolsas De
// Colombia, Montex o Number). Sirve el catálogo (SPA de una sola página) directo en '/'.
// Se publica en Render (Web Service, `npm start`); Render define PORT.
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const port = parseInt(process.env.PORT, 10) || 3002;
// Render termina el HTTPS y reenvía como http:// puertas adentro.
app.set('trust proxy', true);

app.use(express.json({ limit: '2mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Solo estas carpetas son públicas. NO se sirve la raíz del repo: dejaría descargables
// datos/leads-recibidos.csv (nombres y teléfonos de clientes), app.js, package.json, etc.
const UN_ANIO = 365 * 24 * 60 * 60 * 1000;
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes'), { maxAge: UN_ANIO }));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));

app.get(['/', '/index.html'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Leads del formulario de contacto. En Render Free el disco se borra en cada deploy/reinicio:
// el CSV es solo un respaldo; si el POST falla, la página abre WhatsApp con los mismos datos.
function csvEscape(valor) {
  let texto = String(valor || '').replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(texto)) texto = "'" + texto;   // evita fórmulas al abrir en Excel
  return '"' + texto.replace(/"/g, '""') + '"';
}

function anexarCsv(nombreArchivo, encabezado, campos) {
  const archivo = path.join(__dirname, 'datos', nombreArchivo);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  if (!fs.existsSync(archivo)) fs.writeFileSync(archivo, encabezado, 'utf8');
  fs.appendFileSync(archivo, campos.map(csvEscape).join(',') + '\n', 'utf8');
}

function limitarPeticiones({ maxPeticiones, ventanaMs }) {
  const registro = new Map();
  return (req, res, next) => {
    const ip = req.ip || 'desconocida';
    const ahora = Date.now();
    const e = registro.get(ip);
    if (!e || ahora > e.expira) { registro.set(ip, { cuenta: 1, expira: ahora + ventanaMs }); return next(); }
    if (++e.cuenta > maxPeticiones) return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta en unos minutos.' });
    next();
  };
}

// ===== Precios: única fuente para la página (GET /api/precios) y para el cobro =====
// El servidor NUNCA cobra el precio que manda el navegador: lo recalcula desde este archivo.
const RUTA_PRECIOS = path.join(__dirname, 'config', 'precios.json');
function leerPrecios() { return JSON.parse(fs.readFileSync(RUTA_PRECIOS, 'utf8')); }
function descuentoVolumen(unidades) { return unidades >= 100 ? 0.10 : unidades >= 50 ? 0.05 : 0; }

app.get('/api/precios', (_req, res) => {
  try { res.json(leerPrecios()); } catch (e) { res.status(500).json({ error: 'No se pudo leer la lista de precios.' }); }
});

// ===== Pasarela de pago: Mercado Pago Checkout Pro =====
// Variables de entorno: MP_ACCESS_TOKEN (obligatoria para activar el pago), MP_WEBHOOK_SECRET
// (valida los avisos de MP) y SITIO_URL (URL pública https, para las URLs de regreso/aviso).
const MP_API = 'https://api.mercadopago.com';
const ENCABEZADO_PEDIDOS = 'fecha,referencia,estado,nombre,telefono,direccion,resumen,total_cop,id_pago\n';
function tokenMP() { return (process.env.MP_ACCESS_TOKEN || '').trim(); }
function urlBase(req) { return (process.env.SITIO_URL || (req.protocol + '://' + req.get('host'))).trim().replace(/\/+$/, ''); }
const texto = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max);

app.get('/api/pago/mercadopago/config', (_req, res) => {
  res.json({ configurada: Boolean(tokenMP()) });
});

const limitarPago = limitarPeticiones({ maxPeticiones: 20, ventanaMs: 10 * 60 * 1000 });

app.post('/api/pago/mercadopago/preferencia', limitarPago, async (req, res) => {
  const token = tokenMP();
  if (!token) return res.status(503).json({ error: 'Pago en línea no configurado.' });
  const { items, comprador } = req.body || {};
  const nombre = texto(comprador && comprador.nombre, 120);
  const telefono = texto(comprador && comprador.telefono, 30);
  const direccion = texto(comprador && comprador.direccion, 300);
  if (!nombre || !telefono || !direccion) return res.status(400).json({ error: 'Faltan nombre, teléfono o dirección de entrega.' });
  if (!Array.isArray(items) || items.length < 1 || items.length > 40) return res.status(400).json({ error: 'Carrito inválido.' });

  let precios;
  try { precios = leerPrecios(); } catch (e) { return res.status(500).json({ error: 'No se pudo leer la lista de precios.' }); }
  const lineas = [];
  for (const it of items) {
    const prod = it && precios[it.codigo];
    const cantidad = Number(it && it.cantidad);
    if (!prod || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500) return res.status(400).json({ error: 'Producto o cantidad inválidos.' });
    lineas.push({ codigo: it.codigo, prod, cantidad, color: texto(it.color, 40), talla: texto(it.talla, 10) });
  }
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  if (unidades > 500) return res.status(400).json({ error: 'Para más de 500 unidades usa la cotización por WhatsApp.' });
  const desc = descuentoVolumen(unidades);
  const mpItems = lineas.map((l) => ({
    id: l.codigo,
    title: l.prod.nombre + (l.color ? ' · ' + l.color : '') + (l.talla ? ' · Talla ' + l.talla : ''),
    quantity: l.cantidad,
    unit_price: Math.round(l.prod.precio * (1 - desc)),
    currency_id: 'COP',
  }));
  const total = mpItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const referencia = 'ROBLE-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  const base = urlBase(req);
  const preferencia = {
    items: mpItems,
    external_reference: referencia,
    payer: { name: nombre },
    metadata: { telefono, direccion },
    statement_descriptor: 'ROBLE',
    back_urls: { success: base + '/?pago=exito', failure: base + '/?pago=fallo', pending: base + '/?pago=pendiente' },
  };
  // MP exige URLs públicas https para volver solo y para avisar al servidor (en local no aplica).
  if (base.startsWith('https://')) {
    preferencia.auto_return = 'approved';
    preferencia.notification_url = base + '/api/webhooks/mercadopago';
  }
  try {
    const r = await fetch(MP_API + '/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Idempotency-Key': referencia },
      body: JSON.stringify(preferencia),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    if (!r.ok || !j.init_point) {
      console.error('[mercadopago] error creando preferencia', r.status, JSON.stringify(j).slice(0, 300));
      return res.status(502).json({ error: 'Mercado Pago no respondió. Intenta de nuevo o pide por WhatsApp.' });
    }
    const resumen = lineas.map((l) => l.cantidad + 'x ' + l.prod.nombre + ' ' + l.color + ' ' + l.talla).join(' | ');
    anexarCsv('pedidos-web.csv', ENCABEZADO_PEDIDOS, [new Date().toISOString(), referencia, 'iniciado', nombre, telefono, direccion, resumen, total, '']);
    console.log('[mercadopago] preferencia creada', referencia, total);
    const url = token.startsWith('TEST-') && j.sandbox_init_point ? j.sandbox_init_point : j.init_point;
    res.json({ url, referencia, total });
  } catch (e) {
    console.error('[mercadopago] fallo de red creando preferencia:', e.message);
    res.status(502).json({ error: 'No se pudo conectar con Mercado Pago. Intenta de nuevo o pide por WhatsApp.' });
  }
});

async function consultarPagoMP(id) {
  const r = await fetch(MP_API + '/v1/payments/' + encodeURIComponent(id), {
    headers: { Authorization: 'Bearer ' + tokenMP() }, signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('MP respondió ' + r.status);
  return r.json();
}

// Al volver de Mercado Pago la página confirma el estado REAL del pago aquí (no confía en la URL).
app.get('/api/pago/mercadopago/estado/:id', async (req, res) => {
  if (!tokenMP()) return res.status(503).json({ error: 'Pago en línea no configurado.' });
  if (!/^\d{1,24}$/.test(req.params.id)) return res.status(400).json({ error: 'Id de pago inválido.' });
  try {
    const p = await consultarPagoMP(req.params.id);
    res.json({ status: p.status, referencia: p.external_reference, total: p.transaction_amount });
  } catch (e) {
    res.status(502).json({ error: 'No se pudo consultar el pago.' });
  }
});

// Firma de los avisos de MP: x-signature = "ts=...,v1=..." y v1 = HMAC-SHA256(secreto,
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;").
function firmaValidaMP(req, idDato, secreto) {
  const partes = Object.fromEntries(String(req.get('x-signature') || '').split(',').map((p) => p.trim().split('=')));
  if (!partes.ts || !partes.v1) return false;
  const requestId = req.get('x-request-id');
  const manifiesto = 'id:' + String(idDato).toLowerCase() + ';' + (requestId ? 'request-id:' + requestId + ';' : '') + 'ts:' + partes.ts + ';';
  const esperado = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');
  return esperado.length === partes.v1.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
}

app.post('/api/webhooks/mercadopago', async (req, res) => {
  const tipo = req.query.type || req.query.topic || (req.body && req.body.type);
  const id = req.query['data.id'] || (req.body && req.body.data && req.body.data.id) || req.query.id;
  const secreto = (process.env.MP_WEBHOOK_SECRET || '').trim();
  if (secreto && !firmaValidaMP(req, id, secreto)) return res.status(401).json({ error: 'Firma inválida.' });
  res.sendStatus(200);   // MP reintenta si no recibe 200 rápido; el resto se procesa después
  if (tipo !== 'payment' || !id || !tokenMP()) return;
  try {
    // Fuente de verdad: el pago consultado a MP con nuestro token, no el cuerpo del aviso.
    const p = await consultarPagoMP(id);
    console.log('[mercadopago] aviso de pago', id, p.status, p.external_reference, p.transaction_amount);
    if (p.status === 'approved') {
      const meta = p.metadata || {};
      anexarCsv('pedidos-web.csv', ENCABEZADO_PEDIDOS, [new Date().toISOString(), p.external_reference || '', 'aprobado',
        (p.payer && (p.payer.first_name || '')) || '', meta.telefono || '', meta.direccion || '', p.description || '', p.transaction_amount, id]);
    }
  } catch (e) {
    console.error('[mercadopago] no se pudo procesar el aviso', id, e.message);
  }
});

app.post('/api/lead', (req, res) => {
  const { nombre, telefono, mensaje } = req.body || {};
  if (!nombre || !telefono) return res.status(400).json({ error: 'Faltan nombre o teléfono.' });
  if (String(nombre).length > 120 || String(telefono).length > 30 || String(mensaje || '').length > 2000) {
    return res.status(400).json({ error: 'Datos demasiado largos.' });
  }
  anexarCsv('leads-recibidos.csv', 'fecha,nombre,telefono,mensaje\n', [new Date().toISOString(), nombre, telefono, mensaje]);
  res.json({ ok: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`ROBLE corriendo en http://0.0.0.0:${port}`);
}).on('error', (err) => {
  console.error(`No se pudo escuchar en el puerto ${port}: ${err.code || err.message}`);
});
