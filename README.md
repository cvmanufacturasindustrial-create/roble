# ROBLE

Catálogo web de la camisa ROBLE — proyecto **completamente independiente** de CV Manufactura
Industrial, Bolsas De Colombia, Montex o Number: repo propio, puerto propio, sin carpetas ni
datos compartidos con ninguno de esos sitios.

## Cómo correrlo

```bash
npm install
npm start             # node app.js — sirve el sitio en http://localhost:3002

PORT=3005 npm start   # otro puerto si lo necesitas
```

## Publicación: Render + dominio en GoDaddy

- **Render**: Web Service de Node (`render.yaml`): build `npm install`, start `npm start`.
  Cada push a `main` en GitHub vuelve a publicar solo.
- **Dominio** (comprado en GoDaddy): en Render → servicio → Settings → Custom Domains se
  agregan el dominio raíz y `www`; en GoDaddy → DNS se ponen los registros que Render indica
  (A del dominio raíz a la IP de Render y CNAME de `www` a `<servicio>.onrender.com`).
- Solo `imagenes/`, `scripts/`, `styles/` e `index.html` son públicos (ver `app.js`).
- En el plan gratis el disco se borra en cada deploy: `datos/leads-recibidos.csv` no es
  permanente; el formulario cae a WhatsApp si el servidor no responde.

## ⚠️ Antes de publicarlo, todavía faltan los precios reales

- **WhatsApp**: +57 318 195 0928 (`scripts/cart.js` → `WHATSAPP` e `index.html` →
  `WHATSAPP_ROBLE`).
- **Precios**: fuente única en `config/precios.json` (la página y el cobro de Mercado Pago lo
  leen). Oxford y Crop siguen en `89000` de ejemplo — cámbialos por los reales.
- **Mercado Pago**: el Access Token va SOLO en Render → Environment (`MP_ACCESS_TOKEN`), nunca
  en el código. Ver `.env.example`.

### Fotos ya cargadas — dos líneas de producto

Las fotos vienen de la carpeta "Camisas Roble" que el dueño dejó en el Escritorio (el nombre de
la carpeta es de cuando se enviaron, no indica la temporada). Los archivos llegaron con nombres
genéricos de cámara/WhatsApp, así que los colores se identificaron viendo cada foto (y, para la
línea Crop, además con un análisis automático del color dominante de la prenda para no
confundir tonos parecidos).

- **Camisa Oxford** (`imagenes/oxford/`, hombre, manga larga clásica): Amarillo, Negro, Rosado,
  Azul Rey, Blanco, Vinotinto, Verde Bosque, Verde Claro, Beige, Petróleo, Morado, Rojo, Verde
  Oliva, Celeste, Café y Terracota — 15 con foto real nueva; **Terracota** se quedó con la foto
  de ejemplo anterior porque no llegó una foto real de esa referencia.
- **Camisa Crop** (`imagenes/crop/`, mujer, corte corto — línea nueva, no existía antes en el
  sitio): Negro, Rosado, Azul Rey, Vinotinto, Verde Bosque, Verde Claro, Beige, Petróleo, Rojo,
  Celeste y Café — 11 colores, todos con foto real.

Si agregas o quitas colores, edita `PRODUCTOS.oxford.colores` / `PRODUCTOS.crop.colores` en
`index.html` (cada entrada es `{ nombre, hex, img }`).

## Qué incluye

- **Dos líneas de producto** (Camisa Oxford para hombre, Camisa Crop para mujer), cada una en
  varios colores, con su propia galería de fotos que cambia según el color elegido (flechas +
  miniaturas) y su propio carrito/cotizador independientes.
- **Cero personalización**: no hay módulo de subir logo ni de estampado — el catálogo muestra
  las camisas tal cual, en los colores disponibles. Si más adelante ROBLE necesita
  personalización, es un cambio aparte.
- **Carrito de compras** (`scripts/carrito.js` + `scripts/whatsapp.js`, el mismo motor genérico
  ya probado en CV Manufactura Industrial y Bolsas De Colombia) con descuento automático del
  5% desde 50 unidades y 10% desde 100, y pedido final por WhatsApp. Sin pasarela de pago en
  línea todavía (no hay llaves de Wompi para ROBLE) — se puede agregar después con el mismo
  patrón que usan los otros dos sitios.
- **Cotizador de mayoreo** aparte del carrito, con un selector para elegir entre Oxford y Crop
  (cada una con su propio precio), para quien solo quiere saber el precio de un pedido grande
  sin necesidad de agregarlo al carrito primero.
- **Formulario de contacto** (`POST /api/lead`) que guarda en `datos/leads-recibidos.csv`; si
  el servidor no responde, cae automáticamente a abrir un
  WhatsApp con los mismos datos.

## Estructura

```
ROBLE/
├── app.js                servidor Express de un solo archivo (puerto 3002 por defecto)
├── index.html            SPA de una sola página: header, hero, producto, mayoreo, contacto
├── styles/cart.css        estilos del carrito flotante (icono en el header, no abajo)
├── scripts/                whatsapp.js, carrito.js (motor genérico, sin cambios), cart.js
│                            (config propia de ROBLE), jspdf.umd.min.js (sin usar todavía)
├── imagenes/                logo, hero y fotos de producto
│   ├── oxford/                16 colores de la Camisa Oxford (hombre)
│   └── crop/                  11 colores de la Camisa Crop (mujer)
└── datos/                   leads-recibidos.csv (se crea solo al primer contacto)
```
