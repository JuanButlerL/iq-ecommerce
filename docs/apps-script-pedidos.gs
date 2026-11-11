// Apps Script Web App que recibe cada pedido desde la web (ORDER_SYNC_PROVIDER=apps_script).
// Copia de referencia: el script real vive en la planilla de pedidos. Si se cambia, actualizar ambos.
// Las columnas se escriben por posición: los campos nuevos siempre van al final.

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const pedidosSheet = ss.getSheetByName('pedidos') || ss.insertSheet('pedidos');
    const itemsSheet = ss.getSheetByName('pedidos_items') || ss.insertSheet('pedidos_items');

    ensurePedidosHeader(pedidosSheet);
    ensureItemsHeader(itemsSheet);

    const order = data.order;
    const items = Array.isArray(data.items) ? data.items : [];

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

function upsertPedido(sheet, order) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const orderIdCol = headers.indexOf('order_id') + 1;

  if (orderIdCol <= 0) {
    throw new Error('No se encontro la columna order_id en pedidos.');
  }

  const rowData = [
    order.order_id || '',
    order.public_order_number || '',
    order.fecha_hora || '',
    order.estado || '',
    order.payment_status || '',
    order.customer_first_name || '',
    order.customer_last_name || '',
    order.email || '',
    order.telefono || '',
    order.dni_cuit || '',
    order.provincia || '',
    order.localidad || '',
    order.codigo_postal || '',
    order.direccion || '',
    order.direccion_extra || '',
    order.observaciones || '',
    order.cupon || '',
    order.porcentaje_descuento || 0,
    order.descuento || 0,
    order.subtotal || 0,
    order.envio || 0,
    order.total || 0,
    order.medio_pago || '',
    order.comprobante_url || '',
    order.fuente || '',
    order.created_at || '',
    // Agregadas para mayoristas (2026-11). Vacías en pedidos minoristas, salvo canal.
    order.canal || 'MINORISTA',
    order.razon_social || '',
    order.condicion_iva || '',
    order.tipo_factura || '',
    order.descuento_mayorista || 0,
    order.domicilio_fiscal || '',
    order.nombre_fantasia || '',
    order.rubro || ''
  ];

  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const ids = sheet.getRange(2, orderIdCol, lastRow - 1, 1).getValues().flat();
    const existingIndex = ids.findIndex((value) => String(value) === String(order.order_id));

    if (existingIndex >= 0) {
      const targetRow = existingIndex + 2;
      sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
      return;
    }
  }

  sheet.appendRow(rowData);
}

function replacePedidoItems(sheet, orderId, items) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const orderIdCol = headers.indexOf('order_id') + 1;

  if (orderIdCol <= 0) {
    throw new Error('No se encontro la columna order_id en pedidos_items.');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    const values = sheet.getRange(2, orderIdCol, lastRow - 1, 1).getValues().flat();

    for (let i = values.length - 1; i >= 0; i--) {
      if (String(values[i]) === String(orderId)) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  items.forEach(function(item) {
    sheet.appendRow([
      item.order_item_id || '',
      item.order_id || '',
      item.product_id || '',
      item.producto || '',
      item.cantidad || 0,
      item.precio_unitario || 0,
      item.subtotal_item || 0
    ]);
  });
}

function ensurePedidosHeader(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.appendRow([
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
    'nombre_fantasia',
    'rubro'
  ]);
}

function ensureItemsHeader(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.appendRow([
    'order_item_id',
    'order_id',
    'product_id',
    'producto',
    'cantidad',
    'precio_unitario',
    'subtotal_item'
  ]);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
