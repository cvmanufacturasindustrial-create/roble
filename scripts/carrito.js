// ============================================================================================
// MÓDULO COMPARTIDO: Sistema de Carrito de Compras
// Motor genérico: estado (localStorage), cálculo de descuento/subtotal, WhatsApp y pago en
// línea. Mismo archivo en varios sitios propios (Montex, CV Manufactura Industrial, Number) —
// lo que SÍ cambia entre sitios (el HTML/CSS de cada línea del carrito) NO vive acá: cada sitio
// dibuja su propio carrito con su propio marcado, vía `config.onRender(items, helpers)`. Así el
// motor es 100% reutilizable sin forzar una única apariencia entre marcas con identidades
// visuales distintas. Usa scripts/whatsapp.js — cárgalo antes que este archivo.
//
// config = {
//   claveStorage:   string | () => string   — función si un sitio maneja más de un carrito.
//   whatsappNumero: string
//   limiteCarrito:  number|null — máximo de unidades por línea (null = sin límite).
//   formatMoneda:   (numero) => string
//   elementos: { count, overlay }   — ids del DOM: la insignia de cantidad y el overlay del panel.
//   apiPago: { config, firma } | null — si el sitio no tiene pasarela, omitir (no expone `.pagar`).
//   prefijoReferenciaPago: string
//   redirectUrlPago: string — opcional, a dónde vuelve Wompi tras el pago (por defecto la raíz).
//   clavesIguales:  (a, b) => boolean — cuándo dos ítems se consideran "el mismo" y suman
//                   cantidad. Por defecto: mismo código + talla + color.
//   reprecificarItem: (item) => void — opcional, recalcula item.precioUnitario según su
//                   cantidad (tote bags con precio por escala de volumen, que no llevan el
//                   descuento global — se marcan con item.escala).
//   descuentoVolumen: (unidadesTotales) => number (0 a 1) — opcional, % de descuento global.
//   mensajePedido:  config extra para mensajeDesdeCarrito (encabezado, notaFinal, detalleLinea).
//   onRender: (items, helpers) => void — dibuja el carrito con el marcado propio del sitio.
//             helpers = { formatMoneda, subtotales(items), calcularTotal(items),
//                         descuentoVolumen(unidades), sumar(i), restar(i), quitar(i),
//                         pedir(), pagar()?, cerrar() }
// }
// ============================================================================================

function crearCarrito(config) {
  const { claveStorage, whatsappNumero, limiteCarrito, formatMoneda, elementos, apiPago, prefijoReferenciaPago } = config;
  const clavesIguales = config.clavesIguales || ((a, b) => a.codigo === b.codigo && a.talla === b.talla && a.color === b.color);
  const descuentoVolumen = config.descuentoVolumen || (() => 0);

  function clave() { return typeof claveStorage === 'function' ? claveStorage() : claveStorage; }
  function leer() { try { return JSON.parse(localStorage.getItem(clave())) || []; } catch (_) { return []; } }
  function guardar(items) { localStorage.setItem(clave(), JSON.stringify(items)); render(); }

  function totalUnidades(items) { return items.reduce((acc, it) => acc + it.cantidad, 0); }

  // Divide el subtotal: la parte con descuento global y la parte con escala propia (que ya
  // trae el volumen incorporado y no se descuenta otra vez).
  function subtotales(items) {
    let conDescuento = 0, escala = 0;
    items.forEach((it) => {
      const st = it.precioUnitario * it.cantidad;
      if (it.escala) escala += st; else conDescuento += st;
    });
    return { conDescuento, escala, bruto: conDescuento + escala };
  }
  function calcularTotal(items) {
    const sub = subtotales(items);
    const desc = descuentoVolumen(totalUnidades(items));
    return sub.conDescuento * (1 - desc) + sub.escala;
  }

  // Agrega un ítem; devuelve false si supera el límite (quien llama decide qué hacer, p. ej.
  // mandar a un cotizador de volumen en vez del carrito).
  function agregar(item) {
    if (!item || !item.codigo || !(item.cantidad > 0)) return false;
    const items = leer();
    const existente = items.find((a) => clavesIguales(a, item));
    const cantidadFinal = (existente ? existente.cantidad : 0) + item.cantidad;
    if (limiteCarrito != null && cantidadFinal > limiteCarrito) return false;
    if (existente) {
      existente.cantidad = cantidadFinal;
      if (config.reprecificarItem) config.reprecificarItem(existente);
    } else {
      if (config.reprecificarItem) config.reprecificarItem(item);
      items.push(item);
    }
    guardar(items);
    return true;
  }

  function cambiarCantidad(indice, delta) {
    const items = leer();
    if (!items[indice]) return true;
    const nueva = items[indice].cantidad + delta;
    if (limiteCarrito != null && nueva > limiteCarrito) return false;
    if (nueva < 1) items.splice(indice, 1);
    else {
      items[indice].cantidad = nueva;
      if (config.reprecificarItem) config.reprecificarItem(items[indice]);
    }
    guardar(items);
    return true;
  }

  function quitar(indice) { const items = leer(); items.splice(indice, 1); guardar(items); }

  function actualizarContador(items) {
    const badge = document.getElementById(elementos.count);
    if (!badge) return;
    const total = totalUnidades(items);
    badge.textContent = total;
    badge.classList.toggle('oculto', total === 0);
    badge.classList.toggle('visible', total > 0);
  }

  function render() {
    const items = leer();
    actualizarContador(items);
    if (config.onRender) {
      config.onRender(items, {
        formatMoneda, subtotales, calcularTotal,
        descuentoVolumen: (u) => descuentoVolumen(u != null ? u : totalUnidades(items)),
        sumar: (i) => cambiarCantidad(i, 1),
        restar: (i) => cambiarCantidad(i, -1),
        quitar,
        pedir: pedirPorWhatsapp,
        pagar: apiPago ? pagarEnLinea : undefined,
        cerrar
      });
    }
  }

  function abrir() { render(); const ov = document.getElementById(elementos.overlay); if (ov) { ov.classList.add('open'); ov.setAttribute('aria-hidden', 'false'); } }
  function cerrar() { const ov = document.getElementById(elementos.overlay); if (ov) { ov.classList.remove('open'); ov.setAttribute('aria-hidden', 'true'); } }
  function alternar(forzarAbierto) {
    const ov = document.getElementById(elementos.overlay);
    if (!ov) return;
    const abrirAhora = typeof forzarAbierto === 'boolean' ? forzarAbierto : !ov.classList.contains('open');
    abrirAhora ? abrir() : cerrar();
  }

  function pedirPorWhatsapp() {
    const items = leer();
    if (!items.length) { alert('Tu carrito está vacío.'); return; }
    const desc = descuentoVolumen(totalUnidades(items));
    const sub = subtotales(items);
    const mp = config.mensajePedido || {};
    const texto = mensajeDesdeCarrito(items, formatMoneda, {
      encabezado: mp.encabezado, notaFinal: mp.notaFinal, detalleLinea: mp.detalleLinea,
      descuento: desc > 0 ? { porcentaje: desc, montoDescontado: sub.conDescuento * desc } : null
    });
    abrirWhatsapp(whatsappNumero, texto);
  }

  async function pagarEnLinea() {
    const items = leer();
    if (!items.length) { alert('Tu carrito está vacío.'); return; }
    const unidades = totalUnidades(items);
    if (limiteCarrito != null && unidades > limiteCarrito) {
      alert('Los pedidos de más de ' + limiteCarrito + ' unidades se manejan por cotización formal. Envíalo por WhatsApp y te confirmamos precio y fecha de entrega.');
      return;
    }
    const total = Math.round(calcularTotal(items));
    try {
      const cfg = await fetch(apiPago.config).then((r) => r.json());
      if (!cfg.configurada) {
        alert('El pago en línea estará disponible muy pronto. Por ahora envía tu pedido por WhatsApp y lo confirmamos de inmediato.');
        return;
      }
      const referencia = prefijoReferenciaPago + '-' + Date.now();
      const resp = await fetch(apiPago.firma, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia, montoEnCentavos: total * 100 })
      });
      if (!resp.ok) throw new Error('firma');
      const { firma } = await resp.json();
      const f = document.createElement('form');
      f.method = 'GET'; f.action = 'https://checkout.wompi.co/p/';
      const campos = {
        'public-key': cfg.publicKey, 'currency': 'COP', 'amount-in-cents': String(total * 100),
        'reference': referencia, 'signature:integrity': firma,
        'redirect-url': config.redirectUrlPago || (location.origin + '/')
      };
      Object.entries(campos).forEach(([k, v]) => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = k; inp.value = v;
        f.appendChild(inp);
      });
      document.body.appendChild(f);
      f.submit();
    } catch (e) {
      alert('No se pudo iniciar el pago en línea. Envía tu pedido por WhatsApp y lo procesamos de inmediato.');
    }
  }

  document.addEventListener('DOMContentLoaded', render);

  const api = {
    agregar, quitar, leer, render, abrir, cerrar, alternar,
    sumar: (i) => cambiarCantidad(i, 1),
    restar: (i) => cambiarCantidad(i, -1),
    pedir: pedirPorWhatsapp,
    whatsapp: () => whatsappNumero
  };
  if (apiPago) api.pagar = pagarEnLinea;
  return api;
}
