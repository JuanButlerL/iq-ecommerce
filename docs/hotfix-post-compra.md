# Hotfix Post compra — 2026-09-22

## Diagnóstico y alcance

El código anterior ordenaba pedidos antiguos primero, elegía 100 y después
descartaba los ya enviados. El cron podía quedar en `0 enviados, 100 omitidos`
indefinidamente. Reproducido localmente y confirmado en producción mediante una
transacción READ ONLY finalizada con ROLLBACK. Solo Post compra fue reportado afectado.

Resultado del 2026-09-22 21:58 UTC: la automatización inmediata tenía 204 logs
SENT y los 100 pedidos del lote viejo ya estaban procesados. Había 9 eventos sin
ningún log entre 2026-09-21 21:23:49 UTC y 2026-09-22 21:52:24 UTC. Esos 9 deben
quedar anteriores al nuevo corte y no enviarse después del deploy. También se
detectaron 2 pedidos PAID sin `paidAt` ni comprobante; no son eventos enviables y
requieren revisión operativa separada, sin corregirlos automáticamente.

Este hotfix modifica exclusivamente la selección y el envío de `POST_PURCHASE`.
No cambia carrito, popup, ORDER_CREATED, estados de pedidos ni pagos. ORDER_CREATED
conserva el defecto de selección detectado; corregirlo requiere otro alcance y
su propia protección de pendientes. No se debe aumentar el límite como arreglo.

## Diagnóstico de producción sin enviar

Ejecutar `docs/diagnostico-post-compra.sql` con el cliente PostgreSQL del entorno:
usa una transacción READ ONLY, timeout de 15 segundos y solo SELECT. No requiere
emails de clientes ni credenciales en el reporte. Confirmar automatización,
último envío, 100 seleccionados ya procesados y pedidos nuevos fuera del lote.
Si los números no coinciden, revisar cron y errores antes de atribuir el incidente.

En `/opt/iqkids/web`, consultar `git rev-parse HEAD`, `docker compose ps` y
`docker compose logs --since=48h app`. Revisar el historial del scheduler y los
códigos HTTP de sus ejecuciones SIN invocar su endpoint. No compartir tokens ni
líneas de configuración con credenciales. Un cron 200 no demuestra un envío.
Los descartes por log existente no crean nuevos registros de auditoría.

## Comportamiento seguro

- `EMAIL_POST_PURCHASE_SEND_FROM` es obligatorio para Post compra, en UTC ISO:
  `YYYY-MM-DDTHH:mm:ssZ`. Vacío, inválido o activación ausente bloquean ese trigger.
- El corte efectivo es el mayor entre esa fecha y `activatedAt`. No cambia al
  reiniciar. No se rellena con una fecha histórica ni se resetean automatizaciones.
- Todos los eventos anteriores al corte quedan excluidos, aunque nunca se haya
  enviado su mail. Aplica también a recompra con demora: no recupera eventos viejos.
- Se usa `paidAt` cuando existe; si no, el último comprobante. Fecha de activación
  y demora se aplican al MISMO evento. Un comprobante nuevo no habilita un pago viejo.
- Los logs de esa automatización/pedido se excluyen ANTES del límite de 100.
- Se crea una reserva con la clave única existente antes de contactar al proveedor.
  Dos procesos nuevos concurrentes no pueden enviar el mismo objetivo.
- La reserva aparece temporalmente como OMITIDO con detalle `Envío reservado`;
  al terminar cambia a SENT o ERROR. No implica entrega al destinatario: SENT
  significa aceptación por el proveedor, igual que antes.
- Una reserva persistente, un ERROR o resultado ambiguo quedan para conciliación
  manual. No se reintentan automáticamente, incluso si el error parece transitorio.
  Es una elección para priorizar no duplicar envíos; puede dejar un mail sin enviar.
- No borrar logs, recrear plantillas ni cambiar IDs para reintentar. Un caso requiere
  contrastar con Resend y decidir individualmente. Este hotfix no agrega reenvíos.

## Publicación

Sin migraciones ni seed. No modifica datos históricos. Respetar el runbook general.
No mezclar los tres cambios locales de tracking existentes con este hotfix.

1. Guardar diagnóstico, revisión desplegada y configuración actual. Preparar un
   commit solo con los archivos de este hotfix y validar pruebas, tipos, lint y build.
2. Suspender temporalmente la invocación del cron y evitar procesamiento manual;
   esperar a que terminen las ejecuciones anteriores. No deben coexistir workers
   viejos y nuevos: el código viejo no respeta las reservas ni el nuevo corte.
3. Construir y reemplazar solo `app`, inicialmente con
   `EMAIL_POST_PURCHASE_SEND_FROM` ausente/vacío. Post compra queda bloqueado.
   Carrito y popup mantienen su comportamiento. No ejecutar migraciones ni seed.
4. Acordar una hora UTC NUEVA para retomar (idealmente unos minutos en el futuro).
   Consultar `date -u +%Y-%m-%dT%H:%M:%SZ` para leer el reloj. Guardar esa hora fija
   en `EMAIL_POST_PURCHASE_SEND_FROM` dentro del entorno real del servicio `app`.
   Asegurar que Docker Compose la pasa al contenedor; `.env.production` por sí solo
   no garantiza esto si Compose no la referencia. No copiar una fecha del incidente.
5. Recrear `app` con esa configuración, comprobar en `/admin/emails` que el corte
   de seguridad visible corresponde a la hora acordada (UI muestra Argentina), y
   reanudar el cron habitual. No usar `Procesar activos` como diagnóstico.
6. Observar una compra nueva real posterior al corte: un log SENT y una aceptación
   en Resend. Verificar que la siguiente ejecución no la reenvía. Los pendientes
   anteriores al corte deben permanecer sin nuevos logs. Conservar el corte fijo.

Si hay que volver al código anterior, suspender cron y procesamiento manual ANTES
del rollback: esa versión ignora la nueva variable y puede reintentar errores.
No borrar reservas para destrabarlo. No publicar el arreglo con un corte antiguo.

## Verificación local

`node --test tests/post-purchase.test.cjs` ejecuta el servicio real con imports
reemplazados y reloj fijo: no carga variables, Prisma, Resend ni SMTP reales.
Prueba saturación, lotes sucesivos, corte, demora, bajas, concurrencia, errores y
fallo del registro después de aceptar el envío. La unicidad real depende del índice
existente `email_send_logs_automation_target_key`; los tests simulan ese contrato.
TypeScript comprueba la consulta contra el cliente Prisma generado. La prueba con
datos productivos y la publicación siguen pendientes hasta operar el servidor.
