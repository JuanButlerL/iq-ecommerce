"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase/browser";
import { env } from "@/lib/env";

type AdminSignOutButtonProps = {
  className?: string;
} & Omit<ComponentProps<typeof Button>, "onClick">;

export function AdminSignOutButton({ className, children, ...props }: AdminSignOutButtonProps) {
  const router = useRouter();

  return (
    <Button
      variant="secondary"
      className={className}
      {...props}
      onClick={async () => {
        if (env.canUseLocalAdminAuth) {
          await fetch("/api/admin/logout-local", { method: "POST" });
        } else {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.signOut();
        }
        router.push("/admin/login");
        router.refresh();
      }}
    >
      {children ?? "Cerrar sesion"}
    </Button>
  );
}
