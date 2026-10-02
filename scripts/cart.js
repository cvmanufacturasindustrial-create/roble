/* Carrito flotante de ROBLE — capa delgada sobre el motor compartido (scripts/carrito.js +
   scripts/whatsapp.js, cárgalos antes que este archivo). Dos formas de cerrar el pedido:
   pago en línea con Mercado Pago Checkout Pro (solo si el servidor tiene MP_ACCESS_TOKEN) o
   pedido por WhatsApp. El precio que se cobra lo calcula el servidor (config/precios.json). */
(function () {
  // WhatsApp de ROBLE (código de país + número, sin espacios). También en index.html (WHATSAPP_ROBLE).
  const WHATSAPP = '573181950928';
  const CLAVE_CARRITO = 'cart_roble';
  const CLAVE_ENTREGA = 'datos_entrega_roble';

  let pagoMPDisponible = false;

  function formatoCOP(n) { return '$' + Math.round(n).toLocaleString('es-CO') + ' COP'; }
  function escapar(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function leerEntrega() { try { return JSON.parse(localStorage.getItem(CLAVE_ENTREGA)) || {}; } catch (_) { return {}; } }

  const Cart = crearCarrito({
    claveStorage: CLAVE_CARRITO,
    whatsappNumero: WHATSAPP,
    limiteCarrito: null,
    formatMoneda: formatoCOP,
    elementos: { count: 'cart-count', overlay: 'cart-panel' },
    descuentoVolumen(unidades) { return unidades >= 100 ? 0.10 : unidades >= 50 ? 0.05 : 0; },
    mensajePedido: {
      encabezado: 'Hola, quiero pedir:',
      notaFinal: 'Precios en COP sin IVA.'
    },
    onRender(items, helpers) {
      const cont = document.querySelector('.cart-items');
      const footer = document.querySelector('.cart-panel-footer');
      if (!cont || !footer) return;
      if (!items.length) {
        cont.innerHTML = '<div class="cart-empty">Tu carrito está vacío.</div>';
        footer.innerHTML = '';
        return;
      }
      cont.innerHTML = items.map((it, i) => (
        '<div class="cart-item">' +
          '<img class="cart-item-img" src="' + escapar(it.img) + '" alt="' + escapar(it.nombre) + '">' +
          '<div class="cart-item-info">' +
            '<div class="cart-item-nombre">' + escapar(it.nombre) + '</div>' +
            '<div class="cart-item-detalle">Talla ' + escapar(it.talla) + ' · ' + escapar(it.color) + '</div>' +
            '<div class="cart-item-precio">' + helpers.formatMoneda(it.precioUnitario) + ' c/u</div>' +
            '<div class="cart-item-qty">' +
              '<button type="button" onclick="Cart.restar(' + i + ')">−</button>' +
              '<span>' + it.cantidad + '</span>' +
              '<button type="button" onclick="Cart.sumar(' + i + ')">+</button>' +
              '<button type="button" class="cart-item-quitar" onclick="Cart.quitar(' + i + ')">Quitar</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      )).join('');
      const totalUnidades = items.reduce((s, it) => s + it.cantidad, 0);
      const desc = helpers.descuentoVolumen(totalUnidades);
      const total = helpers.calcularTotal(items);
      const e = leerEntrega();
      footer.innerHTML =
        (desc > 0
          ? '<div class="cart-descuento">Descuento por volumen (' + Math.round(desc * 100) + '%) aplicado</div>'
          : '') +
        '<div class="cart-total">Total: ' + helpers.formatMoneda(total) + '</div>' +
        (pagoMPDisponible
          ? '<div class="cart-entrega">' +
              '<div class="cart-entrega-titulo">Datos de entrega</div>' +
              '<input id="entrega-nombre" type="text" placeholder="Nombre completo" autocomplete="name" oninput="guardarEntregaCarrito()" value="' + escapar(e.nombre) + '">' +
              '<input id="entrega-telefono" type="tel" placeholder="Celular" autocomplete="tel" oninput="guardarEntregaCarrito()" value="' + escapar(e.telefono) + '">' +
              '<input id="entrega-direccion" type="text" placeholder="Dirección y ciudad" autocomplete="street-address" oninput="guardarEntregaCarrito()" value="' + escapar(e.direccion) + '">' +
              '<div class="cart-entrega-error" id="entrega-error"></div>' +
            '</div>' +
            '<button type="button" class="cart-btn-mp" id="btn-pagar-mp" onclick="pagarConMercadoPago()">Pagar con Mercado Pago</button>' +
            '<div class="cart-mp-nota">Tarjeta, PSE, Nequi, Efecty y más · pago seguro</div>'
          : '') +
        '<button type="button" class="cart-btn-pedir' + (pagoMPDisponible ? ' secundario' : '') + '" onclick="Cart.pedir()">Pedir por WhatsApp</button>';
    }
  });

  // Sincroniza los precios guardados en el carrito con la lista oficial del servidor (por si
  // el precio cambió desde que el cliente agregó la camisa).
  function actualizarPreciosCarrito(precios) {
    let items;
    try { items = JSON.parse(localStorage.getItem(CLAVE_CARRITO)) || []; } catch (_) { return; }
    let cambio = false;
    items.forEach((it) => {
      const p = precios[it.codigo];
      if (p && p.precio !== it.precioUnitario) { it.precioUnitario = p.precio; cambio = true; }
    });
    if (cambio) localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items));
    Cart.render();
  }

  function datosEntregaDelFormulario() {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    return { nombre: v('entrega-nombre'), telefono: v('entrega-telefono'), direccion: v('entrega-direccion') };
  }
  window.guardarEntregaCarrito = function () { localStorage.setItem(CLAVE_ENTREGA, JSON.stringify(datosEntregaDelFormulario())); };

  window.pagarConMercadoPago = async function () {
    const items = Cart.leer();
    if (!items.length) return;
    const comprador = datosEntregaDelFormulario();
    const error = document.getElementById('entrega-error');
    if (!comprador.nombre || !comprador.telefono || !comprador.direccion) {
      error.textContent = 'Completa nombre, celular y dirección para el envío.';
      return;
    }
    error.textContent = '';
    localStorage.setItem(CLAVE_ENTREGA, JSON.stringify(comprador));
    const boton = document.getElementById('btn-pagar-mp');
    boton.disabled = true;
    boton.textContent = 'Conectando con Mercado Pago…';
    try {
      const r = await fetch('/api/pago/mercadopago/preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comprador,
          items: items.map((it) => ({ codigo: it.codigo, cantidad: it.cantidad, color: it.color, talla: it.talla })),
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || 'error');
      localStorage.setItem('roble_pago_pendiente', j.referencia);
      window.location.href = j.url;
    } catch (e) {
      boton.disabled = false;
      boton.textContent = 'Pagar con Mercado Pago';
      error.textContent = (e && e.message && e.message !== 'error') ? e.message : 'No se pudo iniciar el pago. Intenta de nuevo o pide por WhatsApp.';
    }
  };

  // ===== Regreso desde Mercado Pago (?pago=exito|pendiente|fallo&payment_id=...) =====
  function aviso(tipo, titulo, detalle) {
    const colores = { ok: '#166534', espera: '#92400e', error: '#991b1b' };
    const fondos = { ok: '#f0fdf4', espera: '#fffbeb', error: '#fef2f2' };
    const div = document.createElement('div');
    div.className = 'aviso-pago';
    div.setAttribute('role', 'status');
    div.style.cssText = 'position:fixed;top:84px;left:50%;transform:translateX(-50%);z-index:170;max-width:calc(100vw - 32px);width:460px;' +
      'background:' + fondos[tipo] + ';color:' + colores[tipo] + ';border:1px solid currentColor;border-radius:14px;padding:1rem 2.6rem 1rem 1.1rem;' +
      'box-shadow:0 12px 30px rgba(0,0,0,0.15);font-family:Outfit,sans-serif;';
    div.innerHTML = '<b style="display:block;font-size:1rem;margin-bottom:0.2rem">' + escapar(titulo) + '</b><span style="font-size:0.9rem">' + escapar(detalle) + '</span>' +
      '<button type="button" aria-label="Cerrar" style="position:absolute;top:0.5rem;right:0.6rem;border:none;background:none;font-size:1.3rem;cursor:pointer;color:inherit">×</button>';
    div.querySelector('button').onclick = () => div.remove();
    document.body.appendChild(div);
  }

  async function revisarRegresoDePago() {
    const q = new URLSearchParams(location.search);
    const pago = q.get('pago');
    if (!pago) return;
    const idPago = q.get('payment_id') || q.get('collection_id');
    let estado = pago === 'exito' ? 'approved' : pago === 'pendiente' ? 'pending' : 'rejected';
    // El estado real se confirma con el servidor (la URL la podría escribir cualquiera).
    if (idPago && /^\d+$/.test(idPago)) {
      try {
        const r = await fetch('/api/pago/mercadopago/estado/' + idPago);
        if (r.ok) estado = (await r.json()).status || estado;
      } catch (_) { /* se queda con el estado de la URL */ }
    }
    if (estado === 'approved') {
      localStorage.removeItem(CLAVE_CARRITO);
      localStorage.removeItem('roble_pago_pendiente');
      Cart.render();
      aviso('ok', '¡Pago aprobado! Gracias por tu compra.', 'Te escribiremos al celular que dejaste para coordinar el envío.');
    } else if (estado === 'pending' || estado === 'in_process') {
      aviso('espera', 'Tu pago está pendiente.', 'Cuando Mercado Pago lo confirme preparamos tu pedido. Tu carrito sigue guardado.');
    } else {
      aviso('error', 'El pago no se completó.', 'No se hizo ningún cobro. Puedes intentarlo de nuevo o pedir por WhatsApp.');
    }
    history.replaceState(null, '', location.pathname + location.hash);   // quita ?pago=... de la URL
  }

  window.Cart = Cart;
  window.toggleCart = function (forzarAbierto) { Cart.alternar(forzarAbierto); };
  window.addToCart = function (item) { return Cart.agregar(item); };

  fetch('/api/pago/mercadopago/config').then((r) => r.json())
    .then((c) => { pagoMPDisponible = !!c.configurada; Cart.render(); })
    .catch(() => {});
  fetch('/api/precios').then((r) => r.json()).then(actualizarPreciosCarrito).catch(() => {});
  document.addEventListener('DOMContentLoaded', revisarRegresoDePago);
})();
