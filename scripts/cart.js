/* Carrito flotante de ROBLE — capa delgada sobre el motor compartido (scripts/carrito.js +
   scripts/whatsapp.js, cárgalos antes que este archivo). Un solo producto (la camisa ROBLE)
   en varios colores/tallas, sin pasarela de pago en línea todavía (solo WhatsApp) y sin
   límite de unidades por línea, porque no hay cotizador de "más de X se va a cotización" —
   el cotizador de mayoreo vive aparte, en el propio index.html. */
(function () {
  // ⚠️ Placeholder: reemplaza por el número real de WhatsApp de ROBLE (código de país + número,
  // sin espacios ni signos, ej. 573001234567).
  const WHATSAPP = '573000000000';

  function formatoCOP(n) { return '$' + Math.round(n).toLocaleString('es-CO') + ' COP'; }

  const Cart = crearCarrito({
    claveStorage: 'cart_roble',
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
          '<img class="cart-item-img" src="' + it.img + '" alt="' + it.nombre + '">' +
          '<div class="cart-item-info">' +
            '<div class="cart-item-nombre">' + it.nombre + '</div>' +
            '<div class="cart-item-detalle">Talla ' + it.talla + ' · ' + it.color + '</div>' +
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
      const sub = helpers.subtotales(items);
      const totalUnidades = items.reduce((s, it) => s + it.cantidad, 0);
      const desc = helpers.descuentoVolumen(totalUnidades);
      const total = helpers.calcularTotal(items);
      footer.innerHTML =
        (desc > 0
          ? '<div class="cart-descuento">Descuento por volumen (' + Math.round(desc * 100) + '%) aplicado</div>'
          : '') +
        '<div class="cart-total">Total: ' + helpers.formatMoneda(total) + '</div>' +
        '<button type="button" class="cart-btn-pedir" onclick="Cart.pedir()">Pedir por WhatsApp</button>';
    }
  });

  window.Cart = Cart;
  window.toggleCart = function (forzarAbierto) { Cart.alternar(forzarAbierto); };
  window.addToCart = function (item) { return Cart.agregar(item); };
})();
