// ROBLE — servidor Express de un solo archivo, proyecto 100% independiente (repo propio,
// puerto propio, sin carpetas ni datos compartidos con CV Manufactura Industrial, Bolsas De
// Colombia, Montex o Number). Sirve el catálogo (SPA de una sola página) directo en '/'.
// Se publica en Render (Web Service, `npm start`); Render define PORT.
const express = require('express');
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

app.post('/api/lead', (req, res) => {
  const { nombre, telefono, mensaje } = req.body || {};
  if (!nombre || !telefono) return res.status(400).json({ error: 'Faltan nombre o teléfono.' });
  if (String(nombre).length > 120 || String(telefono).length > 30 || String(mensaje || '').length > 2000) {
    return res.status(400).json({ error: 'Datos demasiado largos.' });
  }
  const carpeta = path.join(__dirname, 'datos');
  const archivo = path.join(carpeta, 'leads-recibidos.csv');
  fs.mkdirSync(carpeta, { recursive: true });
  if (!fs.existsSync(archivo)) fs.writeFileSync(archivo, 'fecha,nombre,telefono,mensaje\n', 'utf8');
  const fila = [new Date().toISOString(), nombre, telefono, mensaje].map(csvEscape).join(',') + '\n';
  fs.appendFileSync(archivo, fila, 'utf8');
  res.json({ ok: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`ROBLE corriendo en http://0.0.0.0:${port}`);
}).on('error', (err) => {
  console.error(`No se pudo escuchar en el puerto ${port}: ${err.code || err.message}`);
});
