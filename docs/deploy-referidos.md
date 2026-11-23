# Plan de referidos (Club de Familias iQ)

Rama `feature/referidos`. Basado en la PPT de marketing "IQ Kids — Plan de referidos v2" y en las decisiones de Juan del 2026-11-23.

## Cómo funciona

1. La embajadora entra a `/referidos` y pone su DNI (o CUIL).
2. Si ese DNI tiene al menos una compra confirmada en la web (Mercado Pago pagado o comprobante subido), le mandamos un link de acceso al **email de su última compra** y la pantalla le muestra a qué email fue, enmascarado (primera y última letra y el dominio, ej. `s***a@gmail.com`). Si no tiene compras, se le avisa y se le ofrece escribir por WhatsApp. Esto lo pidió Juan: a cambio, alguien que pruebe DNIs puede saber si una persona compró en la web. Lo frenan los límites por IP y por DNI.
3. El link abre `/referidos/ingresar`. El token viaja en el `#` de la URL (no llega a logs ni a Referer) y solo se canjea al tocar "Entrar", así los escáneres de links de Outlook no lo queman. Es de un solo uso y vence a los 30 minutos.
4. La sesión es una cookie `iqkids_ref_session` firmada con HMAC (httpOnly, SameSite=Lax, 30 días). Se invalida al bloquear a la embajadora.
5. Arma su **código para amigas** (ej. `SOFI15`, 4 a 15 letras o números) y acepta las reglas. Al mismo tiempo se genera su **código de crédito** personal y aleatorio (`CRED-XXXXX-XXXXX`). Los dos son filas de `coupons` con `referral_kind`, así el checkout, el pedido y el sync al Sheets los tratan como un cupón más (`cupon` y `descuento` en la planilla).
6. En el portal ve el mensaje para copiar o mandar por WhatsApp, la imagen para bajar, su saldo, cuántas amigas compraron y las reglas.

## Reglas

- La amiga tiene 15% sobre los productos en su primera compra, sin mínimo. El envío se cobra como siempre. Los productos con descuento propio quedan afuera, como con cualquier cupón.
- **Amiga nueva**: no puede tener compras confirmadas previas con el mismo DNI/CUIL, email (normalizado: minúsculas, sin `+tag`, Gmail sin puntos), teléfono (últimos 10 dígitos) o dirección (calle + altura + CP). Tampoco puede coincidir con ningún DNI, email, teléfono o dirección de la embajadora: eso cubre los autorreferidos y a la gente del mismo hogar.
- Cuando el pedido de la amiga se crea, queda un `referral_credits` en `PENDING`. Al confirmarse el pago (MP pagado o comprobante subido) pasa a `AVAILABLE` después de `credit_hold_days` días (hoy 0, o sea enseguida), salvo que esté prendida la aprobación manual. Antes de acreditar se vuelven a correr los controles contra las compras anteriores a ese pedido, y se rechaza si la misma amiga ya generó crédito con otro pedido.
- El crédito vale `credit_amount_ars` ($5.000), vence a los `credit_validity_days` (90) y no tiene tope.
- Se gasta con el código de crédito en el checkout, **solo con el DNI de la titular**. Descuenta hasta el saldo o hasta el subtotal de productos, y el resto queda. Se usan primero los créditos que vencen antes.
- Si el pedido donde se usó el crédito se cancela, vence o queda sin pagar más de 48 horas, el crédito vuelve al saldo.
- El crédito se descuenta dentro de la transacción del pedido con un `SELECT ... FOR UPDATE` sobre la embajadora: dos compras simultáneas no pueden gastar el mismo saldo.

## Seguridad

- Límite de intentos guardado en Postgres (`rate_limit_buckets`, sobrevive a reinicios): pedido de acceso 8 por IP cada 15 min, 40 por IP por día y 3 por DNI por hora. Canje de token 20 por IP cada 15 min. Creación de código 20 por hora por cuenta.
- Las rutas públicas que cambian algo rechazan requests con `Origin` de otro sitio.
- El portal no muestra datos de las amigas, solo fecha, monto y estado. La vista de cupón del checkout nunca devuelve el id de la embajadora.
- Los cupones de referidos no aparecen en Admin > Cupones ni en los selectores de automatizaciones, y no se pueden borrar desde ahí.

## Admin

`/admin/referidos` (sección nueva `referrals`; los admins que no son super admin necesitan que se la habiliten en Usuarios):

- Prender o apagar el programa. Apagado, `/referidos` da 404 y los códigos dejan de funcionar.
- Porcentaje, monto, vigencia, días de espera, aprobación manual, mensaje para compartir, imagen (link https) y reglas.
- Lista de créditos con aprobar, forzar y anular. Por ejemplo, si una transferencia nunca llegó, se anula el crédito.
- Lista de embajadoras con bloqueo: corta los códigos y cierra la sesión.
- "Exportar CSV para la AppSheet": una fila por crédito.

## Avisos

El cron de emails (`/api/cron/email-automations`, cada 15 minutos) también corre `processReferralCredits`: avanza los créditos y le manda un email a la embajadora cuando se le acredita uno. Si ese paso falla, no afecta a las automatizaciones.

## Deploy (Caso B: con migración)

Migración `202611231200_add_referral_program`: **solo agrega** tablas (`referral_settings`, `referral_accounts`, `referral_login_tokens`, `referral_credits`, `referral_credit_uses`, `rate_limit_buckets`), tres enums y dos columnas nullable en `coupons` (`referral_kind`, `referral_account_id`). No modifica datos existentes.

1. Backup de la base (ver `deploy-produccion-digitalocean.md`).
2. `git fetch origin` + `git checkout <commit>`.
3. `docker compose build app`.
4. `docker compose run --rm app npx prisma migrate deploy`.
5. `docker compose up -d app`.
6. El programa queda **apagado**. Para lanzarlo: Admin > Referidos, cargar la imagen y revisar los textos, y prender "Programa activo".

Variables: no hace falta ninguna nueva. Se usa `ADMIN_SESSION_SECRET` para derivar la clave de sesión; opcionalmente se puede definir `REFERRAL_SESSION_SECRET` (32+ caracteres). Hace falta `EMAIL_SENDING_ENABLED=true` para que lleguen los links.

## Prueba hecha (local, 2026-11-23)

Script de punta a punta contra `next start`, 47 de 47 OK: email enmascarado para DNI con compras y aviso para DNI sin compras, límite por DNI, token de un solo uso, cookie adulterada, origen ajeno, reglas obligatorias, código reservado, 15% en el checkout, autorreferido por DNI, CUIL y dirección, amiga que ya compró (por DNI, email con +tag y teléfono con +54 9), pedido cancelado rechazado, solo el primer pedido de la misma amiga acredita, canje de $5.000, saldo agotado, saldo devuelto al cancelar, sin doble gasto con dos compras simultáneas, bloqueo, cupón común intacto y programa apagado.
