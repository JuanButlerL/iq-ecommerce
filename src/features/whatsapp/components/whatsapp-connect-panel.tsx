"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, MessageCircle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WhatsappConnectionView } from "@/features/whatsapp/onboarding-service";

type FacebookLoginResponse = { authResponse?: { code?: string } | null; status?: string };

type FacebookSdk = {
  init: (options: Record<string, unknown>) => void;
  login: (callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

// Solo se aceptan mensajes del popup de Meta, comparando el origen exacto.
const FACEBOOK_ORIGINS = new Set(["https://www.facebook.com", "https://web.facebook.com"]);

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
  const sessionKeyRef = useRef<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canConnect = missingConfig.length === 0 && Boolean(appId && configId);

  useEffect(() => {
    if (!canConnect) return;

    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
      setSdkReady(true);
    };

    if (window.FB) {
      window.fbAsyncInit();
    } else if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/es_LA/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.body.appendChild(script);
    }
  }, [appId, canConnect, graphVersion]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!FACEBOOK_ORIGINS.has(event.origin) || !sessionKeyRef.current) return;

      let payload: unknown;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (!payload || typeof payload !== "object" || (payload as { type?: string }).type !== "WA_EMBEDDED_SIGNUP") return;

      void post("/api/admin/whatsapp/onboarding/session", { sessionKey: sessionKeyRef.current, payload });
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
    if (!window.FB) return;

    sessionKeyRef.current = crypto.randomUUID();
    setRunning(true);
    setMessage(null);
    setError(null);

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;

        if (!code) {
          setRunning(false);
          setError("No se recibio autorizacion de Meta (ventana cerrada o permisos rechazados).");
          return;
        }

        void post("/api/admin/whatsapp/onboarding/code", { sessionKey: sessionKeyRef.current, code }).finally(() => setRunning(false));
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
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
              Se abre una ventana de Meta. Elegi el portfolio y la cuenta de WhatsApp, ingresa el numero y escanea el QR
              desde la app WhatsApp Business del telefono principal. <strong>Acepta compartir el historial</strong>: si se
              rechaza, despues no se puede sincronizar.
            </p>
          </div>
        </div>

        {missingConfig.length > 0 ? (
          <p className="rounded-2xl bg-brand-peach/60 p-4 text-sm text-brand-ink">
            Falta configurar en el servidor: <strong>{missingConfig.join(", ")}</strong>.
          </p>
        ) : null}

        <Button onClick={launchSignup} disabled={!canConnect || !sdkReady || running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {running ? "Conectando..." : sdkReady || !canConnect ? "Conectar WhatsApp Business" : "Cargando SDK de Meta..."}
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
