"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase/browser";

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
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.push("/admin/login");
      }}
    >
      {children ?? "Cerrar sesion"}
    </Button>
  );
}
