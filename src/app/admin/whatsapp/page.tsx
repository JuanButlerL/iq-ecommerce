import { requirePrincipalAdmin } from "@/lib/auth/admin";
import { hasSecretKey } from "@/lib/crypto/secret-box";
import { env } from "@/lib/env";
import { WhatsappConnectPanel } from "@/features/whatsapp/components/whatsapp-connect-panel";
import { listWhatsappConnections } from "@/features/whatsapp/onboarding-service";

export default async function AdminWhatsappPage() {
  await requirePrincipalAdmin();
  const connections = await listWhatsappConnections();
  const missingConfig = [
    !env.WHATSAPP_APP_ID && "WHATSAPP_APP_ID",
    !env.WHATSAPP_APP_SECRET && "WHATSAPP_APP_SECRET",
    !env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID && "WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID",
    !hasSecretKey() && "WHATSAPP_TOKEN_ENCRYPTION_KEY",
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Integracion</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">WhatsApp</h1>
      </div>
      <WhatsappConnectPanel
        appId={env.WHATSAPP_APP_ID || null}
        configId={env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || null}
        graphVersion={/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_API_VERSION) ? env.WHATSAPP_GRAPH_API_VERSION : "v25.0"}
        missingConfig={missingConfig}
        connections={connections}
      />
    </div>
  );
}
