"use client";

import { useState, type FormEvent } from "react";
import type { AdminRole } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminSectionId } from "@/lib/auth/admin-permissions";

type AdminUserItem = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  allowedSections: string[];
  active: boolean;
};

type SectionItem = {
  id: AdminSectionId;
  label: string;
  href: string;
};

type AdminUsersPanelProps = {
  users: AdminUserItem[];
  sections: readonly SectionItem[];
};

type FormState = {
  id: string | null;
  email: string;
  fullName: string;
  password: string;
  role: AdminRole;
  allowedSections: AdminSectionId[];
  active: boolean;
};

const defaultForm: FormState = {
  id: null,
  email: "",
  fullName: "",
  password: "",
  role: "OPERATIONS",
  allowedSections: ["orders", "sync"],
  active: true,
};

export function AdminUsersPanel({ users, sections }: AdminUsersPanelProps) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const toggleSection = (section: AdminSectionId) => {
    setForm((current) => ({
      ...current,
      allowedSections: current.allowedSections.includes(section)
        ? current.allowedSections.filter((item) => item !== section)
        : [...current.allowedSections, section],
    }));
  };

  const resetForm = () => {
    setForm(defaultForm);
    setError(null);
    setMessage(null);
  };

  const editUser = (user: AdminUserItem) => {
    setForm({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      password: "",
      role: user.role,
      allowedSections: user.allowedSections.filter((section): section is AdminSectionId =>
        sections.some((availableSection) => availableSection.id === section),
      ),
      active: user.active,
    });
    setError(null);
    setMessage(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    const response = await fetch(form.id ? `/api/admin/users/${form.id}` : "/api/admin/users", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        fullName: form.fullName,
        password: form.password || undefined,
        role: form.role,
        allowedSections: form.allowedSections,
        active: form.active,
      }),
    });

    const payload = (await response.json()) as { error?: string };
    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo guardar el usuario.");
      return;
    }

    setMessage(form.id ? "Usuario actualizado." : "Usuario creado.");
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Admin</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Usuarios</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65">
          Solo el administrador principal puede crear accesos, cambiar contrasenas y definir que secciones ve cada usuario.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-5 md:p-6">
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">
                {form.id ? "Editar usuario" : "Nuevo usuario"}
              </p>
              <p className="mt-1 text-sm text-brand-ink/55">
                {form.id ? "Deja la contrasena vacia si no queres cambiarla." : "La contrasena debe tener al menos 8 caracteres."}
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-brand-ink">Nombre</span>
              <Input
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-brand-ink">Email</span>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-brand-ink">Contrasena</span>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                minLength={8}
                required={!form.id}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-brand-ink">Rol</span>
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminRole }))}
                className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
              >
                <option value="OPERATIONS">Operaciones con permisos seleccionados</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </select>
            </label>

            {form.role === "OPERATIONS" ? (
              <fieldset className="space-y-3 rounded-[1.5rem] border border-brand-ink/10 p-4">
                <legend className="px-2 text-sm font-bold text-brand-ink">Secciones permitidas</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sections
                    .filter((section) => section.id !== "users")
                    .map((section) => (
                      <label key={section.id} className="flex items-center gap-2 rounded-2xl bg-background px-3 py-2 text-sm font-bold text-brand-ink">
                        <input
                          type="checkbox"
                          checked={form.allowedSections.includes(section.id)}
                          onChange={() => toggleSection(section.id)}
                          className="h-4 w-4 accent-brand-pink"
                        />
                        {section.label}
                      </label>
                    ))}
                </div>
              </fieldset>
            ) : null}

            <label className="flex items-center gap-2 text-sm font-bold text-brand-ink">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                className="h-4 w-4 accent-brand-pink"
              />
              Usuario activo
            </label>

            {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
            {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear usuario"}
              </Button>
              {form.id ? (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancelar edicion
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card className="p-5 md:p-6">
          <div className="mb-4">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">Usuarios creados</p>
            <p className="mt-1 text-sm text-brand-ink/55">Los cambios impactan desde el proximo login de cada usuario.</p>
          </div>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-[1.5rem] border border-brand-ink/10 bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-bold text-brand-ink">{user.fullName}</p>
                    <p className="text-sm text-brand-ink/65">{user.email}</p>
                    <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/45">
                      {user.role} - {user.active ? "Activo" : "Inactivo"}
                    </p>
                    {user.role === "OPERATIONS" ? (
                      <p className="mt-2 text-sm text-brand-ink/60">
                        {user.allowedSections.length
                          ? user.allowedSections
                              .map((section) => sections.find((item) => item.id === section)?.label ?? section)
                              .join(", ")
                          : "Sin secciones asignadas"}
                      </p>
                    ) : null}
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => editUser(user)}>
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
