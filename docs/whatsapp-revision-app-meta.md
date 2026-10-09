# WhatsApp: revisión de la app en Meta (acceso avanzado)

Objetivo: obtener **acceso avanzado** a `whatsapp_business_management` y `whatsapp_business_messaging` en la app `bot_ia_iqkids`, para que el Embedded Signup de coexistencia deje de responder "IKI FOODS no puede registrar clientes en este momento".

## Datos de la cuenta

| Dato | Valor |
|---|---|
| App | `bot_ia_iqkids` (ID `1434612668460245`) |
| Portfolio | IKI FOODS (`1186653626554719`) |
| WABA | `2823715747991529` |
| Número en la WABA | IQ Kids · +54 9 11 7651 2762 · Phone number ID `1210396342161310` |

El +54 9 11 7651 2762 **no es el número de logística**: es otro número de la empresa que ya está en la Cloud API. Se usa para las pruebas y los videos.

### WABA del portfolio IKI FOODS (revisadas el 08/10/2026)

| Nombre | ID | Moneda | Medio de pago | Números |
|---|---|---|---|---|
| IQ Kids | `989787580816722` | ARS | VISA \*9804 | Ninguno |
| IQ Kids | `2823715747991529` | AED | VISA \*9804 | +54 9 11 7651-2762 (notificaciones, Cloud API) |
| IKI FOODS | `2069517450313551` | Sin moneda | Ninguno | Ninguno |
| IKI FOODS | `27529223953395029` | Sin moneda | Ninguno | Ninguno |
| App de WhatsApp Business | `912789491386699` | ARS | VISA \*5764 | +54 9 11 7393-3235 (sin conexión) |

**Número de logística: +54 9 11 5851-3378.** Hoy no está en ninguna WABA: vive solo en la app WhatsApp Business de Juan. En el alta de coexistencia, elegir la WABA existente **IQ Kids `989787580816722`** (ARS, con medio de pago, vacía). No usar la de AED ni las dos "IKI FOODS" sin moneda.

## 1. Llamadas de prueba

Todas son **de solo lectura**: no envían mensajes ni modifican nada.

### Generar el token (lo hace la persona, en su navegador)

1. Abrir el [Explorador de la API Graph](https://developers.facebook.com/tools/explorer/).
2. **Meta App**: `bot_ia_iqkids`.
3. **User or Page**: `User Token`.
4. En **Permissions** agregar: `whatsapp_business_management`, `whatsapp_business_messaging` y `business_management`.
5. Tocar **Generate Access Token** y aceptar en la ventana de Meta, eligiendo el portfolio IKI FOODS y la cuenta de WhatsApp.

El token no se copia en ningún lado: el explorador lo usa directamente.

### Consultas (método `GET`, pegar en la barra del explorador y tocar **Submit**)

| # | Consulta | Permiso que ejercita | Resultado esperado |
|---|---|---|---|
| 1 | `2823715747991529?fields=id,name,currency,timezone_id,message_template_namespace` | `whatsapp_business_management` | Datos de la WABA |
| 2 | `2823715747991529/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,platform_type` | `whatsapp_business_management` | El número +54 9 11 7651 2762 |
| 3 | `2823715747991529/message_templates?fields=name,status,category,language` | `whatsapp_business_management` | Lista de plantillas (puede venir vacía) |
| 4 | `2823715747991529/subscribed_apps` | `whatsapp_business_management` | Apps suscritas a la WABA |
| 5 | `1210396342161310/whatsapp_business_profile?fields=about,address,description,email,websites,vertical` | `whatsapp_business_messaging` | Perfil de empresa del número |

**Hecho el 09/10/2026** (API v26.0), apuntando las consultas 1 a 4 a la WABA de pesos `989787580816722`: todas respondieron OK. Las de números, plantillas y apps suscritas vinieron vacías, como se esperaba en una WABA nueva.

Correr cada consulta **una vez** alcanza. Después, en Casos de uso → Conectar en WhatsApp → **Permisos y funciones**, el contador de llamadas de cada permiso debería subir. Meta puede tardar hasta 24 h en reflejarlo.

## 2. Textos para la revisión

En **Revisión de la app → Permisos y funciones**, pedir **acceso avanzado** para los dos permisos. Los textos van en inglés porque los revisores trabajan en inglés.

### `whatsapp_business_management`

> IQ Kids is an Argentine healthy-snacks brand (www.iqkids.com.ar) that sells online through its own e-commerce. We use whatsapp_business_management to manage our own WhatsApp Business Account, owned by our verified business portfolio (IKI FOODS).
>
> Specifically, our app uses this permission to:
> 1. Connect our company phone number, which is already used in the WhatsApp Business app by our logistics team, to the Cloud API through Embedded Signup with coexistence (featureType whatsapp_business_app_onboarding), so the same number works in the app for manual support and in the Cloud API for automated order notifications.
> 2. Subscribe our app to our WABA webhooks (subscribed_apps) and verify the phone number status (is_on_biz_app, platform_type).
> 3. Request the coexistence contacts and chat history sync (smb_app_data).
> 4. Create and manage Utility message templates for order updates (for example "order shipped" and "order delivered") and read their approval status.
>
> We only access WhatsApp assets that belong to our own business. We do not onboard or manage assets of third-party businesses.

### `whatsapp_business_messaging`

> We use whatsapp_business_messaging to send transactional order notifications from our own WhatsApp Business phone number to customers who purchased on www.iqkids.com.ar and provided their phone number at checkout: order confirmation, order shipped and order delivered updates, using approved Utility templates.
>
> We also receive incoming customer messages and message status updates (sent, delivered, read, failed) through our webhook (https://www.iqkids.com.ar/api/whatsapp/webhook), which validates the X-Hub-Signature-256 signature, so our team can follow up on each order. Customers can reply at any time and our logistics team answers them manually from the WhatsApp Business app (coexistence).
>
> We do not send marketing campaigns with this integration. Our privacy policy is published at https://www.iqkids.com.ar/privacidad.

### Notas para el revisor (si el formulario lo pide)

> The integration runs in our own admin panel (https://www.iqkids.com.ar/admin/whatsapp), which is restricted to our principal administrator. The reviewer can follow the screencasts attached to each permission. The business portfolio IKI FOODS is verified.

## 3. Guion de los videos

Grabar la pantalla completa, en una resolución que se lea, sin cortes. Duración ideal: 1 a 3 minutos cada uno. Meta pide que el video muestre **la app usando el permiso de punta a punta**.

### Video 1: `whatsapp_business_management` (crear una plantilla)

1. Mostrar WhatsApp Manager (business.facebook.com/wa/manage) con la cuenta **IQ Kids `989787580816722`** (la de pesos, donde va a quedar el número de logística).
2. Ir a **Plantillas de mensajes → Crear plantilla**.
3. Categoría **Utilidad**, nombre `pedido_despachado`, idioma **Español (ARG)**.
4. Cuerpo: `Hola {{1}}, tu pedido #{{2}} de IQ Kids salió hoy. Llega aproximadamente el {{3}}. ¡Gracias por tu compra!`, con valores de ejemplo `Juan`, `1042` y `15/10`.
5. Enviar a revisión y mostrar que la plantilla queda en estado **En revisión**.
6. Mostrar en el Explorador la consulta 3 de la sección 1, donde aparece la plantilla nueva.

Esta plantilla es la que después vamos a usar para los avisos reales, así que no es solo para el video.

**Regrabado el 09/10/2026** con el Explorador de la API Graph en vez del Administrador de WhatsApp, para que se vea la app `bot_ia_iqkids` usando el permiso: `POST /989787580816722/message_templates` creó `pedido_despachado` (ID `38994871070157752`, UTILITY, es_AR, `PENDING`) y después `GET /989787580816722/message_templates` la mostró en revisión.

### Video 2: `whatsapp_business_messaging` (enviar un mensaje)

1. Mostrar **Configuración de la API** de la app, con el número de IQ Kids seleccionado en **De**.
2. En **Para**, elegir un número de prueba del equipo, previamente agregado como destinatario.
3. Tocar **Enviar mensaje** (plantilla `hello_world`).
4. Mostrar el teléfono del equipo recibiendo el mensaje (se puede filmar con otro celular o usar la cámara de la compu).
5. Responder desde ese teléfono y mostrar que llega el evento al webhook. Opcional, pero suma.

## 4. Después de la aprobación

1. En Casos de uso → Conectar en WhatsApp → **Registro de proveedores de tecnología**, completar el registro.
2. Repetir el alta desde Admin → WhatsApp. No hace falta cambiar código.
