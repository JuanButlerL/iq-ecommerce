"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, MessageCircle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WhatsappConnectionView } from "@/features/whatsapp/onboarding-service";

// El signup se abre como dialogo OAuth en la misma pestana, con un redirect_uri propio y fijo:
// con el popup del SDK, Meta ataba el code a un redirect_uri interno y el canje fallaba (100/36008).
// Esta URL tiene que estar en "URIs de redireccionamiento de OAuth validos" de la app.
const SIGNUP_REDIRECT_PATH = "/admin/whatsapp";
const PENDING_SIGNUP_KEY = "iqkids.whatsapp.signup";
const PENDING_SIGNUP_MAX_AGE_MS = 15 * 60 * 1000;

// Lee y borra el alta pendiente: el state se usa una sola vez y vence a los 15 minutos.
function readPendingSignup(): { state: string; redirectUri: string } | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_SIGNUP_KEY);
    window.sessionStorage.removeItem(PENDING_SIGNUP_KEY);
    const pending = raw ? (JSON.parse(raw) as { state?: string; redirectUri?: string; at?: number }) : null;

    if (!pending?.state || !pending.redirectUri || !pending.at || Date.now() - pending.at > PENDING_SIGNUP_MAX_AGE_MS) {
      return null;
    }

    return { state: pending.state, redirectUri: pending.redirectUri };
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<WhatsappConnectionView["status"], string> = {
  PENDING: "Esperando datos del signup",
  CONNECTING: "Conectando",
  CONNECTED: "Conectado",
  FAILED: "Fallo",
  CANCELLED: "Cancelado",
};

type Props = {
  appId: string | null;
  configId: string | null;
  graphVersion: string;
  missingConfig: string[];
  connections: WhatsappConnectionView[];
};

export function WhatsappConnectPanel({ appId, configId, graphVersion, missingConfig, connections }: Props) {
  const router = useRouter();
  const callbackHandled = useRef(false);
  const [running, setRunning] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canConnect = missingConfig.length === 0 && Boolean(appId && configId);

  // Vuelta del dialogo de Meta: ?code=...&state=... (o ?error=...). Se procesa una sola vez.
  useEffect(() => {
    if (callbackHandled.current) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const metaError = params.get("error_description") ?? params.get("error_message") ?? params.get("error");

    if (!code && !metaError) return;

    callbackHandled.current = true;
    window.history.replaceState(window.history.state, "", SIGNUP_REDIRECT_PATH);
    const pending = readPendingSignup();

    if (metaError) {
      setError(`Meta no completo el alta: ${metaError}`);
      return;
    }

    if (!pending || pending.state !== state) {
      setError("La vuelta de Meta no corresponde a un alta iniciada desde este navegador. Volve a intentarlo.");
      return;
    }

    setRunning(true);
    void post("/api/admin/whatsapp/onboarding/code", {
      sessionKey: pending.state,
      code,
      redirectUri: pending.redirectUri,
    }).finally(() => setRunning(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(url: string, body?: unknown) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = (await response.json()) as { data?: { connection?: WhatsappConnectionView }; error?: string };

      if (!response.ok) throw new Error(result.error ?? "No se pudo completar el paso.");

      const connection = result.data?.connection;
      if (connection?.status === "CONNECTED") {
        setMessage("WhatsApp quedo conectado en coexistencia. Ya se pidieron los contactos y el historial.");
      } else if (connection?.status === "CANCELLED") {
        setMessage("El signup se cancelo antes de terminar.");
      }

      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar el paso.");
      return false;
    } finally {
      router.refresh();
    }
  }

  function launchSignup() {
    if (!appId || !configId) return;

    // El state viaja a Meta y vuelve en el redirect; tambien es la sessionKey de la conexion.
    const state = crypto.randomUUID();
    const redirectUri = `${window.location.origin}${SIGNUP_REDIRECT_PATH}`;

    try {
      window.sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({ state, redirectUri, at: Date.now() }));
    } catch {
      setError("El navegador no permite guardar el estado del alta (sessionStorage).");
      return;
    }

    const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("config_id", configId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("override_default_response_type", "true");
    url.searchParams.set("state", state);
    url.searchParams.set(
      "extras",
      JSON.stringify({ setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }),
    );

    setRunning(true);
    window.location.assign(url.toString());
  }

  async function retry(id: string) {
    setRetryingId(id);
    setMessage(null);
    setError(null);
    await post(`/api/admin/whatsapp/onboarding/${id}/retry`);
    setRetryingId(null);
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-yellow/40">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="space-y-2 text-sm leading-6 text-brand-ink/70">
            <p className="font-bold text-brand-ink">Conectar el numero de la app WhatsApp Business a la Cloud API</p>
            <p>
              Te lleva a Meta en esta misma pestana. Elegi el portfolio y la cuenta de WhatsApp, ingresa el numero y escanea
              el QR desde la app WhatsApp Business del telefono principal. <strong>Acepta compartir el historial</strong>: si
              se rechaza, despues no se puede sincronizar. Al terminar, Meta te devuelve a esta pagina.
            </p>
          </div>
        </div>

        {missingConfig.length > 0 ? (
          <p className="rounded-2xl bg-brand-peach/60 p-4 text-sm text-brand-ink">
            Falta configurar en el servidor: <strong>{missingConfig.join(", ")}</strong>.
          </p>
        ) : null}

        <Button onClick={launchSignup} disabled={!canConnect || running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {running ? "Conectando..." : "Conectar WhatsApp Business"}
        </Button>

        {message ? (
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {message}
          </p>
        ) : null}
        {error ? (
          <p className="flex items-center gap-2 text-sm font-bold text-red-600">
            <CircleAlert className="h-4 w-4" /> {error}
          </p>
        ) : null}
      </Card>

      <div className="space-y-4">
        <h2 className="font-display text-2xl text-brand-ink">Intentos de conexion</h2>
        {connections.length === 0 ? <p className="text-sm text-brand-ink/60">Todavia no hubo intentos.</p> : null}
        {connections.map((connection) => (
          <Card key={connection.id} className="space-y-4 p-4 md:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-bold text-brand-ink">
                  {STATUS_LABEL[connection.status]}
                  {connection.displayPhoneNumber ? ` · ${connection.displayPhoneNumber}` : ""}
                  {connection.verifiedName ? ` · ${connection.verifiedName}` : ""}
                </p>
                <p className="text-xs text-brand-ink/50">
                  {new Date(connection.createdAt).toLocaleString("es-AR")} · WABA {connection.wabaId ?? "-"} · Numero{" "}
                  {connection.phoneNumberId ?? "-"}
                </p>
              </div>
              {connection.status === "FAILED" && connection.hasToken && connection.wabaId ? (
                <Button size="sm" variant="secondary" onClick={() => retry(connection.id)} disabled={retryingId === connection.id}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {retryingId === connection.id ? "Reintentando..." : "Reintentar"}
                </Button>
              ) : null}
            </div>

            {connection.errorMessage ? <p className="break-words text-sm text-red-600">{connection.errorMessage}</p> : null}

            <div className="grid gap-2 text-xs text-brand-ink/70 sm:grid-cols-2">
              <p>Coexistencia: {connection.isOnBizApp === null ? "-" : connection.isOnBizApp ? "si" : "no"} ({connection.platformType ?? "-"})</p>
              <p>Evento: {connection.signupEvent ?? "-"}</p>
              <p className="break-all">Sync contactos: {connection.contactsSyncRequestId ?? "-"}</p>
              <p className="break-all">Sync historial: {connection.historySyncRequestId ?? "-"}</p>
            </div>

            {connection.steps.length > 0 ? (
              <ol className="space-y-1 rounded-[1.5rem] bg-background p-4 text-xs text-brand-ink/70">
                {connection.steps.map((step, index) => (
                  <li key={index} className="break-words">
                    {step.ok ? "OK" : "ERROR"} · {step.step}
                    {step.detail ? ` · ${step.detail}` : ""} · {new Date(step.at).toLocaleTimeString("es-AR")}
                  </li>
                ))}
              </ol>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
