// ============================================================================================
// MÓDULO COMPARTIDO: Integración con WhatsApp
// Mismo archivo, sin cambios, en varios sitios propios (Montex, CV Manufactura Industrial,
// Number): no depende de ningún catálogo ni marca concreta. Solo arma el mensaje y abre wa.me.
// ============================================================================================

// Abre WhatsApp Web/App con el número y el texto ya escritos (codificados en la URL).
function abrirWhatsapp(numero, texto) {
  window.open('https://wa.me/' + numero + '?text=' + encodeURIComponent(texto), '_blank');
}

// Arma el mensaje a partir de un carrito: items = [{ nombre, talla, color, cantidad, precioUnitario }]
// formatMoneda: función (numero) => texto, propia de cada sitio (COP, etc.)
// config opcional: { encabezado, notaFinal, detalleLinea: (item)=>string, descuento: { porcentaje, montoDescontado },
//                     construirMensajeCompleto: (items, config) => string — si un sitio ya tenía
//                     un formato de mensaje muy propio (p. ej. CV: viñetas "•", "N x nombre",
//                     "TOTAL" en negrita, nota de IVA), esta función reemplaza TODO el armado
//                     de texto de acá abajo, para no cambiarle una palabra al mensaje que ya
//                     conocen los clientes/el equipo de ventas. }
function mensajeDesdeCarrito(items, formatMoneda, config) {
  config = config || {};
  if (config.construirMensajeCompleto) return config.construirMensajeCompleto(items, config);
  const encabezado = config.encabezado || 'Hola, quiero pedir:';
  let texto = encabezado + '\n';
  items.forEach((it) => {
    const detalleTalla = it.talla ? ' (talla ' + it.talla + (it.color ? ', ' + it.color : '') + ')' : (it.color ? ' (' + it.color + ')' : '');
    const extra = config.detalleLinea ? config.detalleLinea(it) : '';
    const precioTxt = it.precioUnitario != null ? ' — ' + formatMoneda(it.precioUnitario * it.cantidad) : ' — precio pendiente de confirmar';
    texto += '- ' + it.nombre + detalleTalla + ' x' + it.cantidad + precioTxt + extra + '\n';
  });
  const hayPreciosDefinidos = items.every((it) => it.precioUnitario != null);
  if (hayPreciosDefinidos) {
    const bruto = items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);
    if (config.descuento && config.descuento.porcentaje > 0) {
      texto += 'Subtotal: ' + formatMoneda(bruto) + '\n';
      texto += 'Descuento por volumen (' + Math.round(config.descuento.porcentaje * 100) + '%): -' + formatMoneda(config.descuento.montoDescontado) + '\n';
    }
    const total = bruto - (config.descuento ? config.descuento.montoDescontado : 0);
    texto += 'Total: ' + formatMoneda(total);
  } else {
    texto += 'Precios pendientes de confirmar.';
  }
  if (config.notaFinal) texto += '\n\n' + config.notaFinal;
  return texto;
}

// Arma el mensaje de una cotización por volumen: { nombre, cantidad, precioUnitario, total }
function mensajeDesdeCotizacion({ nombre, cantidad, total, formatMoneda }) {
  const totalTxt = total != null ? formatMoneda(total) : 'precio pendiente de confirmar';
  return 'Hola, quiero cotizar al por mayor:\n- ' + nombre + ' x' + cantidad + '\nTotal estimado: ' + totalTxt;
}
