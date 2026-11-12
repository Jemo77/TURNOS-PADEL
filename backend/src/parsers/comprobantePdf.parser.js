function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function esComprobanteMercadoPago(texto) {
  const normalizado = normalizarTexto(texto);
  if (!normalizado.includes('comprobante de transferencia')) return false;
  if (!normalizado.includes('mercado pago')) return false;

  const operacion = normalizado.match(/n\.?\s*°?\s*de operacion de mercado pago\s*(\d{8,})/i);
  return Boolean(operacion);
}

function parsearFechaHora(fechaTexto, horaTexto) {
  if (!fechaTexto || !horaTexto) return null;

  const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

  const match = String(fechaTexto).match(/(\d{1,2})\/(\w+)\/(\d{4})/i);
  if (!match) return null;

  const dia = Number(match[1]);
  const mes = meses[String(match[2]).toLowerCase()];
  const anio = Number(match[3]);

  if (mes === undefined || Number.isNaN(dia) || Number.isNaN(anio)) return null;

  const [hh, mm] = String(horaTexto).split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  return new Date(Date.UTC(anio, mes, dia, hh + 3, mm, 0));
}

function extraerDatos(texto) {
  const textoOriginal = String(texto || '');
  const lineas = textoOriginal.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
  const resultado = {
    tipo: 'transferencia',
    esMercadoPago: false,
    fecha: null,
    hora: null,
    importe: null,
    moneda: 'ARS',
    motivo: null,
    origen: { nombre: null, banco_o_billetera: null, cuit_cuil: null, cvu: null },
    destino: { nombre: null, banco_o_billetera: null, cuit_cuil: null, cvu: null },
    numero_operacion: null
  };

  const fechaHora = textoOriginal.match(/(\d{1,2})\/([a-zA-ZáéíóúÁÉÍÓÚ]+)\/(\d{4})\s+a las\s+(\d{1,2}:\d{2})/i);
  if (fechaHora) {
    resultado.fecha = `${fechaHora[1]}/${fechaHora[2]}/${fechaHora[3]}`;
    resultado.hora = fechaHora[4];
  }

  const antesMotivo = textoOriginal.split(/Motivo:/i)[0] || textoOriginal;
  const importeMatch = antesMotivo.match(/\$\s*([\d.,\s]+)/i);
  if (importeMatch) {
    const valorRaw = importeMatch[1].replace(/\./g, '').replace(/\s+/g, '').replace(',', '.');
    const valor = Number(parseFloat(valorRaw).toFixed(2));
    if (!Number.isNaN(valor)) resultado.importe = valor;
  }

  const motivo = textoOriginal.match(/Motivo:\s*(.+)/i);
  if (motivo) resultado.motivo = motivo[1].trim();

  const indiceOrigenDestino = lineas.findIndex((linea) => /Origen y destino/i.test(linea));
  if (indiceOrigenDestino >= 0) {
    const bloques = [];
    let bloqueActual = null;

    for (const linea of lineas.slice(indiceOrigenDestino + 1)) {
      if (/^N\.?\s*[°º]?\s*de operacion de mercado pago/i.test(linea)) break;

      if (!bloqueActual) {
        bloqueActual = { nombre: linea, banco_o_billetera: null, cuit_cuil: null, cvu: null };
        continue;
      }

      if (/^mercado pago$/i.test(linea)) {
        bloqueActual.banco_o_billetera = 'Mercado Pago';
        continue;
      }

      if (/^CUIT\/CUIL:/i.test(linea)) {
        bloqueActual.cuit_cuil = linea.replace(/^CUIT\/CUIL:\s*/i, '').trim();
        continue;
      }

      if (/^CVU:/i.test(linea)) {
        bloqueActual.cvu = linea.replace(/^CVU:\s*/i, '').trim();
        bloques.push(bloqueActual);
        bloqueActual = null;
        continue;
      }

      if (bloqueActual && bloqueActual.cvu == null && !/^mercado pago$/i.test(linea) && !/^CUIT\/CUIL:/i.test(linea) && !/^CVU:/i.test(linea)) {
        bloqueActual.nombre = linea;
      }
    }

    if (bloqueActual) bloques.push(bloqueActual);

    if (bloques[0]) resultado.origen = {
      nombre: bloques[0].nombre || null,
      banco_o_billetera: bloques[0].banco_o_billetera || null,
      cuit_cuil: bloques[0].cuit_cuil ? bloques[0].cuit_cuil.replace(/^CUIT\/CUIL:\s*/i, '').trim() : null,
      cvu: bloques[0].cvu ? bloques[0].cvu.replace(/^CVU:\s*/i, '').trim() : null
    };

    if (bloques[1]) resultado.destino = {
      nombre: bloques[1].nombre || null,
      banco_o_billetera: bloques[1].banco_o_billetera || null,
      cuit_cuil: bloques[1].cuit_cuil ? bloques[1].cuit_cuil.replace(/^CUIT\/CUIL:\s*/i, '').trim() : null,
      cvu: bloques[1].cvu ? bloques[1].cvu.replace(/^CVU:\s*/i, '').trim() : null
    };
  }

  const operacion = textoOriginal.match(/N\.?\s*[°º]?\s*de\s*operaci[oó]n\s*de\s*Mercado\s*Pago\s*\n?\s*(\d{8,})/i);
  if (operacion) resultado.numero_operacion = operacion[1];

  resultado.esMercadoPago = esComprobanteMercadoPago(textoOriginal);

  return resultado;
}

module.exports = { extraerDatos, parsearFechaHora, esComprobanteMercadoPago };
