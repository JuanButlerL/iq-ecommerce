// Apps Script Web App que recibe cada pedido desde la web (ORDER_SYNC_PROVIDER=apps_script).
// Copia de referencia: el script real vive en la planilla de pedidos. Si se cambia, actualizar ambos.
//
// IMPORTANTE: las columnas se escriben POR NOMBRE DE HEADER, no por posición.
// - Cada valor del pedido va a la columna cuyo header (fila 1) se llama igual que el campo.
// - Si falta una columna conocida, se agrega al final de la fila 1 (no se corre nada).
// - Se pueden reordenar columnas o agregar columnas manuales: no se pisan.

const ORDER_COLUMNS = [
  'order_id',
  'public_order_number',
  'fecha_hora',
  'estado',
  'payment_status',
  'customer_first_name',
  'customer_last_name',
  'email',
  'telefono',
  'dni_cuit',
  'provincia',
  'localidad',
  'codigo_postal',
  'direccion',
  'calle',
  'altura',
  'sin_altura',
  'direccion_extra',
  'observaciones',
  'cupon',
  'porcentaje_descuento',
  'descuento',
  'subtotal',
  'envio',
  'total',
  'medio_pago',
  'comprobante_url',
  'fuente',
  'created_at',
  'canal',
  'razon_social',
  'condicion_iva',
  'tipo_factura',
  'descuento_mayorista',
  'domicilio_fiscal',
  'logistica',
  'tipo_entrega',
  'sucursal',
  'tracking',
  'etiqueta_url',
  'fecha_despacho',
  'estado_envio'
];

const ITEM_COLUMNS = [
  'order_item_id',
  'order_id',
  'product_id',
  'producto',
  'cantidad',
  'precio_unitario',
  'subtotal_item'
];

// Valor por defecto cuando el campo no viene en el payload (solo para filas nuevas).
const ORDER_DEFAULTS = {
  canal: 'MINORISTA',
  porcentaje_descuento: 0,
  descuento: 0,
  subtotal: 0,
  envio: 0,
  total: 0,
  descuento_mayorista: 0
};

// Lock propio de la planilla (document lock), NO el lock del script: el sync a operaciones y los
// envíos automáticos usan getScriptLock() y tardan minutos. Si doPost esperaba ese mismo lock,
// fallaba con "Lock timeout" y el pedido (ej. PROOF_UPLOADED) no llegaba a la planilla.
function getPedidosLock_() {
  return LockService.getDocumentLock() || LockService.getScriptLock();
}

function doPost(e) {
  const lock = getPedidosLock_();

  try {
    lock.waitLock(30000);
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const pedidosSheet = ss.getSheetByName('pedidos') || ss.insertSheet('pedidos');
    const itemsSheet = ss.getSheetByName('pedidos_items') || ss.insertSheet('pedidos_items');

    const order = data.order || {};
    const items = Array.isArray(data.items) ? data.items : [];

    if (!order.order_id) {
      throw new Error('El pedido no trae order_id.');
    }

    upsertPedido(pedidosSheet, order);
    replacePedidoItems(itemsSheet, order.order_id, items);

    return jsonResponse({
      ok: true,
      mode: 'upsert',
      received_order: order.public_order_number || null,
      items_count: items.length
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error)
    });
  } finally {
    lock.releaseLock();
  }
}

// ---------- Headers ----------

// Devuelve los headers de la fila 1, agregando al final los que falten.
function ensureHeaders(sheet, columns) {
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); })
    : [];

  const missing = columns.filter(function(c) { return headers.indexOf(c) === -1; });

  if (missing.length > 0) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    missing.forEach(function(c) { headers.push(c); });
  }

  return headers;
}

// Arma la fila respetando el orden real de la planilla.
// Si hay fila existente, las columnas que no vienen en el payload conservan su valor.
function buildRowByHeader(headers, record, defaults, existingRow) {
  return headers.map(function(header, i) {
    if (header && Object.prototype.hasOwnProperty.call(record, header)) {
      const value = record[header];
      return value === null || value === undefined ? '' : value;
    }
    if (existingRow) return existingRow[i];
    if (defaults && Object.prototype.hasOwnProperty.call(defaults, header)) return defaults[header];
    return '';
  });
}

function findRowByValue(sheet, colIndex1, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, colIndex1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(value)) return i + 2;
  }
  return -1;
}

// ---------- Pedidos ----------

function upsertPedido(sheet, order) {
  const headers = ensureHeaders(sheet, ORDER_COLUMNS);
  const orderIdCol = headers.indexOf('order_id') + 1;

  const targetRow = findRowByValue(sheet, orderIdCol, order.order_id);

  if (targetRow > 0) {
    const existing = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
    const row = buildRowByHeader(headers, order, ORDER_DEFAULTS, existing);
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([row]);
    return;
  }

  const row = buildRowByHeader(headers, order, ORDER_DEFAULTS, null);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
}

// ---------- Items ----------

function replacePedidoItems(sheet, orderId, items) {
  const headers = ensureHeaders(sheet, ITEM_COLUMNS);
  const orderIdCol = headers.indexOf('order_id') + 1;
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const values = sheet.getRange(2, orderIdCol, lastRow - 1, 1).getValues();
    for (let i = values.length - 1; i >= 0; i--) {
      if (String(values[i][0]) === String(orderId)) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  if (items.length === 0) return;

  const rows = items.map(function(item) {
    return buildRowByHeader(headers, item, { cantidad: 0, precio_unitario: 0, subtotal_item: 0 }, null);
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

// ---------- Reparación de filas corridas (correr UNA vez a mano) ----------
//
// Entre el 11/11 y el arreglo, el script escribía por posición con una lista que NO tenía
// calle / altura / sin_altura. Desde la columna "calle" todo quedó corrido 3 lugares a la izquierda.
// Se detecta porque en "comprobante_url" quedó MINORISTA/MAYORISTA (era el canal).
//
// Primero corré repararFilasCorridas_simular() y mirá el log (Ver > Registros).
// Si está bien, corré repararFilasCorridas(). calle/altura/sin_altura quedan vacías:
// para completarlas, tocá "Reintentar sync" en el admin de la web en esos pedidos.

// Orden en que el script viejo escribía (por posición).
const OLD_WRONG_ORDER = [
  'order_id', 'public_order_number', 'fecha_hora', 'estado', 'payment_status',
  'customer_first_name', 'customer_last_name', 'email', 'telefono', 'dni_cuit',
  'provincia', 'localidad', 'codigo_postal', 'direccion',
  'direccion_extra', 'observaciones', 'cupon', 'porcentaje_descuento', 'descuento',
  'subtotal', 'envio', 'total', 'medio_pago', 'comprobante_url', 'fuente', 'created_at',
  'canal', 'razon_social', 'condicion_iva', 'tipo_factura', 'descuento_mayorista',
  'domicilio_fiscal', 'nombre_fantasia', 'rubro'
];

function repararFilasCorridas_simular() {
  return repararFilasCorridas_(true);
}

function repararFilasCorridas() {
  return repararFilasCorridas_(false);
}

function repararFilasCorridas_(dryRun) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('pedidos');
  // Ojo: ensureHeaders puede agregar columnas al final (tipo_factura, etc.), no mueve nada.
  const headers = dryRun
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); })
    : ensureHeaders(sheet, ORDER_COLUMNS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const width = headers.length;
  const range = sheet.getRange(2, 1, lastRow - 1, width);
  const values = range.getValues();
  const comprobanteIdx = headers.indexOf('comprobante_url');
  let fixed = 0;

  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    const marker = String(row[comprobanteIdx] || '').trim().toUpperCase();
    if (marker !== 'MINORISTA' && marker !== 'MAYORISTA') continue;

    // Reconstruir el pedido leyendo cada celda con el nombre que le daba el script viejo.
    const record = {};
    OLD_WRONG_ORDER.forEach(function(name, pos) {
      record[name] = pos < row.length ? row[pos] : '';
    });
    record.calle = '';
    record.altura = '';
    record.sin_altura = '';

    const newRow = headers.map(function(h, i) {
      if (Object.prototype.hasOwnProperty.call(record, h)) return record[h];
      // Columnas extra más allá de lo que escribía el script viejo: se respetan.
      return i >= OLD_WRONG_ORDER.length ? row[i] : '';
    });

    Logger.log('Fila %s (pedido %s): total %s, canal %s, medio_pago %s',
      r + 2, record.public_order_number, record.total, record.canal, record.medio_pago);

    values[r] = newRow;
    fixed++;
  }

  if (!dryRun && fixed > 0) range.setValues(values);
  Logger.log('%s filas %s.', fixed, dryRun ? 'se repararían (simulación, no se tocó nada)' : 'reparadas');
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
