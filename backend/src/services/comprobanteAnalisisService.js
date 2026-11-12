function normalizarNumero(value) {
  return String(value || '').replace(/\D/g, '');
}

function analizarComprobante({ datos, reserva, cuentaActiva }) {
  const validaciones = [];

  const esMercadoPago = Boolean(datos?.esMercadoPago);
  if (!esMercadoPago) {
    validaciones.push({
      codigo: 'mp',
      nivel: 'warn',
      mensaje: 'No se reconoció como comprobante de Mercado Pago, verificar manualmente'
    });
  }

  if (datos?.importe != null && reserva?.montoTotal != null) {
    const importe = Number(datos.importe);
    const esperado = Number(reserva.montoTotal);

    if (Number(importe.toFixed(2)) === Number(esperado.toFixed(2))) {
      validaciones.push({ codigo: 'importe', nivel: 'ok', mensaje: 'El importe coincide con la reserva.' });
    } else if (importe < esperado) {
      validaciones.push({ codigo: 'importe', nivel: 'error', mensaje: 'El importe es menor al monto de la reserva.' });
    } else {
      validaciones.push({ codigo: 'importe', nivel: 'warn', mensaje: 'El importe es mayor al monto de la reserva.' });
    }
  }

  const cbuClub = normalizarNumero(cuentaActiva?.cbu);
  const cbuDestino = normalizarNumero(datos?.destino?.cvu || datos?.destino?.cbu || '');
  if (cbuClub && cbuDestino) {
    if (cbuDestino === cbuClub) {
      validaciones.push({ codigo: 'destino', nivel: 'ok', mensaje: 'El CVU del comprobante coincide con la cuenta del club.' });
    } else {
      validaciones.push({ codigo: 'destino', nivel: 'error', mensaje: 'El CVU del comprobante no coincide con la cuenta del club.' });
    }
  }

  if (datos?.fechaDetectada && reserva?.createdAt) {
    const margenMin = 5 * 60 * 1000;
    const fechaComprobante = new Date(datos.fechaDetectada).getTime();
    const fechaCreacion = new Date(reserva.createdAt).getTime();
    if (fechaComprobante < fechaCreacion - margenMin || fechaComprobante > Date.now() + margenMin) {
      validaciones.push({ codigo: 'fecha', nivel: 'warn', mensaje: 'La fecha del comprobante está fuera del rango esperado.' });
    } else {
      validaciones.push({ codigo: 'fecha', nivel: 'ok', mensaje: 'La fecha del comprobante parece coherente con la reserva.' });
    }
  }

  return {
    esMercadoPago,
    validaciones
  };
}

module.exports = { analizarComprobante };
