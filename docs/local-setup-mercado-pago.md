# Reactivar entorno local

Guia rapida para retomar este branch localmente despues de apagar la maquina.

## Contexto

- Rama de trabajo: `feature/add-mercado-pago`
- App: Next.js en `http://localhost:3000`
- DB local: PostgreSQL en Docker, puerto `54322`
- Contenedor esperado: `iqkids-postgres-local`

## Paso 1. Abrir el repo

Ubicarse en:

```powershell
cd c:\dev\WebCodigo
```

## Paso 2. Verificar rama

```powershell
git branch --show-current
```

Debe devolver:

```txt
feature/add-mercado-pago
```

## Paso 3. Levantar Docker

Abrir Docker Desktop si no esta corriendo.

Verificar contenedores:

```powershell
docker ps -a
```

Si existe `iqkids-postgres-local` pero esta apagado:

```powershell
docker start iqkids-postgres-local
```

Si no existe, crearlo:

```powershell
docker run --name iqkids-postgres-local -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=postgres -p 54322:5432 -d postgres:16
```

## Paso 4. Confirmar DB local

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 54322
```

`TcpTestSucceeded` debe dar `True`.

## Paso 5. Aplicar migraciones si hace falta

Normalmente ya quedan aplicadas, pero si hubo cambios nuevos:

```powershell
npm run db:deploy
```

Si la DB esta vacia o queres restaurar datos base:

```powershell
npm run db:seed
```

## Paso 6. Levantar la app

```powershell
npm run dev
```

Abrir:

```txt
http://localhost:3000
```

## Variables locales importantes

Revisar en `.env`:

- `DATABASE_URL`
- `DIRECT_URL`
- `MERCADO_PAGO_ENABLED`
- `MERCADO_PAGO_ENVIRONMENT`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`

Para pruebas locales actuales:

- Mercado Pago puede funcionar sin webhook real para probar redireccion y monto.
- En local con `localhost`, no se prueba el webhook end-to-end real.
- La validacion final de webhook queda para produccion o para usar una URL publica tipo `ngrok`.

## Que deberia funcionar

- Checkout con selector de medio de pago
- Redirect directo a Mercado Pago si ese metodo esta habilitado
- Transferencia sin romperse
- Admin > Configuracion con toggles para habilitar o deshabilitar medios de pago

## Si algo falla

### Error de DB

Si aparece error contra `127.0.0.1:54322`:

1. Confirmar que Docker Desktop este prendido
2. Confirmar que `iqkids-postgres-local` este corriendo
3. Reintentar `docker start iqkids-postgres-local`

### Error de Prisma client

Si Prisma no regenera por archivos bloqueados:

1. cerrar `npm run dev`
2. correr:

```powershell
npx prisma generate
```

3. volver a levantar `npm run dev`

### Error de build por `.next`

Si hay bloqueo en `.next\trace`:

1. cerrar el dev server
2. borrar `.next`
3. volver a correr `npm run dev`

## Comandos utiles

```powershell
git status --short
git branch --show-current
docker ps -a
docker start iqkids-postgres-local
npm run db:deploy
npm run db:seed
npm run dev
```
