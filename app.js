// ROBLE — servidor Express de un solo archivo, proyecto 100% independiente (repo propio,
// puerto propio, sin carpetas ni datos compartidos con CV Manufactura Industrial, Bolsas De
// Colombia, Montex o Number). Sirve el catálogo (SPA de una sola página) directo en '/'.
const express = require('express');
const path = require('path');

const app = express();
const port = parseInt(process.env.PORT, 10) || 3002;

app.use(express.json({ limit: '2mb' }));

// index:false — la ruta explícita de abajo controla qué se sirve en '/', no express.static.
app.use(express.static(__dirname, { index: false }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Leads del formulario de contacto (opcional, no bloquea nada si no se usa).
const fs = require('fs');
function csvEscape(valor) { return '"' + String(valor || '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"'; }

app.post('/api/lead', (req, res) => {
  const { nombre, telefono, mensaje } = req.body || {};
  if (!nombre || !telefono) return res.status(400).json({ error: 'Faltan nombre o teléfono.' });
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
