"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

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
  const localAdminAvailable = env.canUseLocalAdminAuth;
  const supabaseMissing =
    !localAdminAvailable && (!env.hasSupabaseAuth || searchParams.get("reason") === "supabase-not-configured");

  return (
    <Card className="mx-auto w-full max-w-[560px] space-y-6 rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(44,34,65,0.12)] backdrop-blur md:p-10">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Admin IQ Kids</p>
        <h1 className="mt-3 font-display text-4xl text-brand-ink md:text-5xl">Iniciar sesion</h1>
        <p className="mt-3 text-sm leading-6 text-brand-ink/60">
          Acceso restringido al panel de gestion. Ingresa con credenciales de administrador.
        </p>
      </div>

      <div className="space-y-4">
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
        />
      </div>

      {supabaseMissing ? (
        <p className="rounded-2xl bg-brand-peach p-4 text-sm font-bold text-brand-ink">
          El login admin no esta configurado todavia.
        </p>
      ) : null}

      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

      <Button
        className="w-full"
        disabled={isPending || supabaseMissing}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              if (localAdminAvailable) {
                const response = await fetch("/api/admin/login-local", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ email, password }),
                });
                const payload = await response.json();

                if (!response.ok) {
                  setError(payload.error ?? "No se pudo iniciar sesion.");
                  return;
                }
              } else {
                const supabase = createSupabaseBrowserClient();
                const { error: signInError } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                });

                if (signInError) {
                  setError(signInError.message);
                  return;
                }
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
