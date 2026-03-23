"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase/browser";
import { env } from "@/lib/env";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const supabaseMissing =
    !env.hasSupabaseAuth || searchParams.get("reason") === "supabase-not-configured";
  const bypassActive = env.devAdminBypass;

  return (
    <Card className="mx-auto max-w-md space-y-5 p-8">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Admin IQ Kids</p>
        <h1 className="mt-3 font-display text-4xl text-brand-ink">Iniciar sesion</h1>
      </div>
      <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
      <Input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
      />
      {supabaseMissing ? (
        <p className="rounded-2xl bg-brand-peach p-4 text-sm font-bold text-brand-ink">
          Falta configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`
          reales para habilitar login admin local.
        </p>
      ) : null}
      {bypassActive ? (
        <p className="rounded-2xl bg-brand-mint p-4 text-sm font-bold text-brand-ink">
          Modo local activo. El panel admin puede usarse sin login real mientras desarrollás.
        </p>
      ) : null}
      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      {bypassActive ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            router.push("/admin");
            router.refresh();
          }}
        >
          Entrar en modo local
        </Button>
      ) : null}
      <Button
        className="w-full"
        disabled={isPending || supabaseMissing || bypassActive}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const supabase = createSupabaseBrowserClient();
              const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });

              if (signInError) {
                setError(signInError.message);
                return;
              }

              router.push("/admin");
              router.refresh();
            } catch (clientError) {
              setError(clientError instanceof Error ? clientError.message : "No se pudo iniciar sesion.");
            }
          });
        }}
      >
        {isPending ? "Ingresando..." : "Ingresar"}
      </Button>
    </Card>
  );
}
