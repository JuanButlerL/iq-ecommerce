# Deploy: promos NxM (cupones y descuentos por producto)

Release que agrega cupones NxM (2x1, 3x2, 4x3...) y NxM en descuentos por producto, con el tilde
"las unidades sin cargo suman para el envío gratis".

## Qué cambia en la base

Dos migraciones, **solo aditivas**. `202611011600_add_coupon_buy_x_pay_y_scope` agrega a `coupons` la
columna `buy_x_pay_y_same_product_only` (default `false`, o sea "se pueden mezclar productos").
`202611011200_add_buy_x_pay_y_promotions` hace lo siguiente:

- agrega el valor `BUY_X_PAY_Y` al enum `CouponDiscountType`;
- crea el enum `ProductDiscountType` (`PERCENTAGE`, `BUY_X_PAY_Y`);
- `coupons`: agrega `buy_quantity`, `pay_quantity` (nulos) y `free_units_count_for_free_shipping` (default `true`);
- `products`: agrega `discount_type` (default `PERCENTAGE`), `discount_buy_quantity`, `discount_pay_quantity` (nulos) y `discount_free_units_count_for_free_shipping` (default `true`);
- `order_items`: agrega `free_units` (default `0`) y `promo_label` (nulo).

No actualiza ni borra ninguna fila, no toca pedidos, pagos, clientes ni envíos. Todas las sentencias usan
`IF NOT EXISTS`, así que se puede re-ejecutar sin error. Los cupones y descuentos existentes siguen
funcionando igual (se probó aplicando todas las migraciones sobre una base con datos y comparando).

## 0. Variables de la sesión

```bash
cd /opt/iqkids/web
STAMP=$(date +%Y%m%d-%H%M)
echo $STAMP
sudo mkdir -p /opt/iqkids/backups && sudo chmod 700 /opt/iqkids/backups
```

## 1. Preflight

```bash
docker compose ps
git status --short          # tiene que estar limpio; si no, frenar y revisar
git rev-parse HEAD > /opt/iqkids/backups/pre-nxm-$STAMP.commit
cat /opt/iqkids/backups/pre-nxm-$STAMP.commit
df -h
```

Conteos antes del pase (guardarlos):

```sql
SELECT 'products' AS entity, COUNT(*) FROM products
UNION ALL SELECT 'coupons', COUNT(*) FROM coupons
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'store_settings', COUNT(*) FROM store_settings;
```

## 2. Backup obligatorio (antes de migrar)

**Si PostgreSQL corre en Docker** (ajustar `db`, usuario y base a los del compose):

```bash
docker compose exec -T db pg_dump -U postgres -d postgres -Fc > /opt/iqkids/backups/pre-nxm-$STAMP.dump
```

**Si la base es externa (Supabase u otra)**, usar la URL directa sin dejarla en el historial:

```bash
read -rs DIRECT_URL_VALUE && echo
docker run --rm -e PGURL="$DIRECT_URL_VALUE" postgres:16 sh -c 'pg_dump "$PGURL" -Fc' > /opt/iqkids/backups/pre-nxm-$STAMP.dump
unset DIRECT_URL_VALUE
```

Validar el backup (si falla, **no seguir**):

```bash
ls -lh /opt/iqkids/backups/pre-nxm-$STAMP.dump
docker run --rm -i postgres:16 pg_restore --list < /opt/iqkids/backups/pre-nxm-$STAMP.dump | grep -c "TABLE DATA"
```

Copiar el `.dump` fuera del Droplet (storage privado habitual).

## 3. Deploy (build → migrar → recién ahí levantar)

```bash
git fetch origin main
git checkout main
git pull --ff-only origin main
git log -1 --oneline                       # tiene que mostrar el commit de las promos NxM
docker compose build app
docker compose run --rm app npx prisma migrate status
docker compose run --rm app npx prisma migrate deploy
docker compose up -d app
docker compose ps
docker compose logs --tail=150 app
```

No usar `prisma db seed` ni `npm run db:seed` en producción.

## 4. Verificación

```bash
curl -fsS https://iqkids.com.ar/ > /dev/null && echo OK
docker compose logs --since=10m app | grep -i error
```

Repetir los conteos del preflight: tienen que dar exactamente lo mismo.

Chequeo de columnas nuevas:

```sql
SELECT code, discount_type, buy_quantity, pay_quantity, free_units_count_for_free_shipping FROM coupons ORDER BY created_at DESC LIMIT 5;
SELECT name, discount_type, discount_percentage, discount_buy_quantity, discount_pay_quantity FROM products;
```

### Smoke test (5 minutos)

1. Admin → Cupones: crear `PRUEBA3X2` tipo NxM, llevás 3 / pagás 2, uso "Un uso total".
2. En la tienda, carrito con 3 cajas, checkout, aplicar `PRUEBA3X2`: tiene que descontar 1 caja.
3. Con "Se pueden mezclar productos", 1 caja de cada sabor (3 en total) activa el 3x2. Cambiar a
   "Solo unidades del mismo producto": con esas mismas 3 cajas tiene que avisar que faltan unidades, y con
   3 cajas del mismo sabor tiene que funcionar.
4. Con el tilde **tildado** y 3 cajas de $21.660, el envío tiene que salir gratis (cuenta $64.980).
   Editar el cupón, **destildar**, volver a aplicarlo: el envío tiene que cobrarse (cuenta $43.320).
5. Con 2 cajas el cupón tiene que avisar que faltan unidades.
6. Admin → Descuentos: probar un NxM en un producto, ver la etiqueta en la tienda y el descuento en el carrito; después quitarlo.
7. Probar que un cupón de porcentaje existente siga funcionando igual.
8. Borrar o pausar `PRUEBA3X2`.

## 5. Plan de rollback

La migración es aditiva: el código anterior funciona con la base nueva, así que **el rollback normal es
solo de código** y no se pierde ningún pedido.

1. Si se llegaron a crear cupones NxM, primero guardarlos y pausarlos (el código anterior no conoce ese
   tipo de cupón y el listado de cupones del admin fallaría):

   ```sql
   BEGIN;
   CREATE TABLE IF NOT EXISTS rollback_nxm_coupons AS SELECT * FROM coupons WHERE discount_type = 'BUY_X_PAY_Y';
   UPDATE coupons SET active = false, discount_type = 'PERCENTAGE', discount_percentage = 0
   WHERE discount_type = 'BUY_X_PAY_Y';
   COMMIT;
   ```

   Los NxM por producto no necesitan nada: el código anterior simplemente no los aplica.

2. Volver al commit anterior:

   ```bash
   cd /opt/iqkids/web
   git checkout $(cat /opt/iqkids/backups/pre-nxm-<STAMP>.commit)
   docker compose build app
   docker compose up -d app
   docker compose logs --tail=150 app
   ```

3. No hace falta revertir la migración: las columnas nuevas quedan sin uso y no molestan.

**Restaurar el backup completo solo ante una catástrofe** (por ejemplo, datos dañados), porque se
pierden los pedidos creados después del backup. Restaurar sobre una base nueva y apuntar la app ahí, o
coordinarlo con ventana de mantenimiento:

```bash
docker compose stop app
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists < /opt/iqkids/backups/pre-nxm-<STAMP>.dump
```
