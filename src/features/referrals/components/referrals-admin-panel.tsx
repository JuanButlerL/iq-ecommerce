"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ReferralAdminData } from "@/features/referrals/admin";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";
import { formatArgentinaDate } from "@/lib/utils/datetime";

type Props = {
  data: ReferralAdminData;
  warnings: { sessionSecretMissing: boolean; emailDisabled: boolean };
};

const paymentLabels: Record<string, string> = {
  PENDING: "Sin pagar",
  PROOF_UPLOADED: "Comprobante subido",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
};

const creditBadge: Record<string, string> = {
  PENDING: "bg-brand-yellow/40 text-brand-ink",
  AVAILABLE: "bg-brand-mint text-green-800",
  REJECTED: "bg-red-50 text-red-700",
  VOIDED: "bg-brand-ink/5 text-brand-ink/60",
};

function maskTaxId(value: string) {
  return value.length > 3 ? `${"•".repeat(value.length - 3)}${value.slice(-3)}` : value;
}

export function ReferralsAdminPanel({ data, warnings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    ...data.settings,
    shareImageUrl: data.settings.shareImageUrl ?? "",
  });
  const [creditFilter, setCreditFilter] = useState<"ALL" | "PENDING" | "AVAILABLE" | "REJECTED" | "VOIDED">("ALL");
  const [search, setSearch] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    failed: number;
    results: Array<{ line: number; taxId: string; code: string; ok: boolean; message: string }>;
  } | null>(null);
  const normalizedSearch = search.trim().toLowerCase();

  const filteredCredits = useMemo(
    () =>
      data.credits.filter(
        (credit) =>
          (creditFilter === "ALL" || credit.status === creditFilter) &&
          (!normalizedSearch ||
            [credit.friendCode ?? "", credit.orderNumber, credit.friendName, credit.referrerTaxId, credit.referrerName ?? ""].some((value) =>
              value.toLowerCase().includes(normalizedSearch),
            )),
      ),
    [data.credits, creditFilter, normalizedSearch],
  );
  const filteredAccounts = useMemo(
    () =>
      data.accounts.filter(
        (account) =>
          !normalizedSearch ||
          [account.taxId, account.firstName ?? "", account.email ?? "", account.friendCode ?? ""].some((value) =>
            value.toLowerCase().includes(normalizedSearch),
          ),
      ),
    [data.accounts, normalizedSearch],
  );
  const totals = {
    accounts: data.accounts.filter((account) => account.status === "ACTIVE").length,
    credited: data.credits.filter((credit) => credit.status === "AVAILABLE").length,
    pending: data.credits.filter((credit) => credit.status === "PENDING" && credit.confirmedAt).length,
    balance: data.accounts.reduce((total, account) => total + account.balanceArs, 0),
  };

  function run(request: () => Promise<Response>, success: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await request();
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "No se pudo guardar.");
        return;
      }

      setMessage(success);
      router.refresh();
    });
  }

  function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () =>
        fetch("/api/admin/referrals/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }),
      "Configuración guardada.",
    );
  }

  function creditAction(id: string, action: "approve" | "force-approve" | "void") {
    let note = "";

    if (action === "void") {
      const answer = window.prompt("¿Por qué se anula? (queda registrado)");
      if (answer === null) return;
      note = answer;
    }

    if (action === "force-approve" && !window.confirm("No pasó los controles automáticos. ¿Aprobarlo igual?")) {
      return;
    }

    run(
      () =>
        fetch(`/api/admin/referrals/credits/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note }),
        }),
      action === "void" ? "Crédito anulado." : "Crédito aprobado.",
    );
  }

  function handleBulkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBulkResult(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/referrals/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bulkText }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "No se pudo hacer la carga.");
        return;
      }

      setBulkResult(payload.data);
      // Keeps only the lines that failed, so they can be fixed and loaded again.
      const failedLines = new Set<number>(payload.data.results.filter((result: { ok: boolean }) => !result.ok).map((result: { line: number }) => result.line));
      setBulkText(
        bulkText
          .split(/\r?\n/)
          // Line numbers from the server count every line, blank ones included.
          .filter((line, index) => line.trim() && failedLines.has(index + 1))
          .join("\n"),
      );
      router.refresh();
    });
  }

  function toggleBlocked(id: string, blocked: boolean) {
    if (blocked && !window.confirm("¿Bloquear a este referidor/a? Sus códigos dejan de funcionar y se cierra su sesión.")) {
      return;
    }

    run(
      () =>
        fetch(`/api/admin/referrals/accounts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked }),
        }),
      blocked ? "Referidor/a bloqueado/a." : "Referidor/a desbloqueado/a.",
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Marketing</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Referidos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65">
            Club de Familias iQ. Cualquier DNI con una compra confirmada entra en /referidos, arma su código para invitar y recibe un código
            personal para gastar el crédito.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page */}
        <a
          href="/api/admin/referrals/export"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-brand-pinkSoft/30"
        >
          <Download className="h-4 w-4" /> Exportar CSV para la AppSheet
        </a>
      </div>

      {warnings.sessionSecretMissing ? (
        <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
          Falta configurar ADMIN_SESSION_SECRET o REFERRAL_SESSION_SECRET: el portal no puede abrir sesiones.
        </p>
      ) : null}
      {warnings.emailDisabled ? (
        <p className="rounded-2xl bg-brand-yellow/30 p-4 text-sm font-bold text-brand-ink">
          El envío de emails está apagado: no van a llegar los links de acceso ni los avisos de crédito.
        </p>
      ) : null}
      {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-brand-mint p-4 text-sm font-bold text-green-800">{message}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Referidores con código", String(totals.accounts)],
          ["Créditos acreditados", String(totals.credited)],
          ["Créditos en espera", String(totals.pending)],
          ["Saldo sin usar", formatArs(totals.balance)],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs font-bold text-brand-ink/55">{label}</p>
            <p className="font-display text-2xl text-brand-ink">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5 md:p-6">
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <h2 className="font-display text-2xl text-brand-ink">Configuración</h2>
          <label className="flex items-center gap-3 text-sm font-bold text-brand-ink">
            <input type="checkbox" className="h-4 w-4 accent-brand-pink" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />
            Programa activo (muestra /referidos y hace funcionar los códigos)
          </label>
          <div className="flex flex-wrap items-center gap-3 text-sm text-brand-ink">
            <label className="flex items-center gap-3 font-bold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-pink"
                checked={settings.showInHeader}
                onChange={(event) => setSettings({ ...settings, showInHeader: event.target.checked })}
              />
              Mostrar en el menú de la tienda con el texto
            </label>
            <Input
              className="h-10 max-w-[220px]"
              maxLength={30}
              value={settings.headerLabel}
              onChange={(event) => setSettings({ ...settings, headerLabel: event.target.value })}
            />
            <span className="text-xs text-brand-ink/55">Solo aparece mientras el programa está activo.</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>% para quien invitan</span>
              <Input type="number" min={1} max={50} value={settings.friendDiscountPercentage} onChange={(event) => setSettings({ ...settings, friendDiscountPercentage: Number(event.target.value) })} />
            </label>
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>Crédito por invitado/a ($)</span>
              <Input type="number" min={100} value={settings.creditAmountArs} onChange={(event) => setSettings({ ...settings, creditAmountArs: Number(event.target.value) })} />
            </label>
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>Vigencia del crédito (días)</span>
              <Input type="number" min={7} value={settings.creditValidityDays} onChange={(event) => setSettings({ ...settings, creditValidityDays: Number(event.target.value) })} />
            </label>
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>Espera antes de acreditar (días)</span>
              <Input type="number" min={0} value={settings.creditHoldDays} onChange={(event) => setSettings({ ...settings, creditHoldDays: Number(event.target.value) })} />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm text-brand-ink">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-pink"
              checked={settings.requireManualApproval}
              onChange={(event) => setSettings({ ...settings, requireManualApproval: event.target.checked })}
            />
            Aprobar cada crédito a mano (si está apagado, se acredita solo al confirmarse la compra)
          </label>
          <label className="block space-y-1 text-sm font-bold text-brand-ink">
            <span>Mensaje para compartir</span>
            <Textarea rows={3} value={settings.shareMessage} onChange={(event) => setSettings({ ...settings, shareMessage: event.target.value })} />
            <span className="block text-xs font-normal text-brand-ink/55">Usá {"{codigo}"} y {"{descuento}"}; se reemplazan por los de cada referidor/a.</span>
          </label>
          <label className="block space-y-1 text-sm font-bold text-brand-ink">
            <span>Imagen para compartir (link)</span>
            <Input value={settings.shareImageUrl} placeholder="https://..." onChange={(event) => setSettings({ ...settings, shareImageUrl: event.target.value })} />
          </label>
          <label className="block space-y-1 text-sm font-bold text-brand-ink">
            <span>Reglas (una por línea)</span>
            <Textarea rows={7} value={settings.termsText} onChange={(event) => setSettings({ ...settings, termsText: event.target.value })} />
            <span className="block text-xs font-normal text-brand-ink/55">Podés usar {"{descuento}"}, {"{credito}"}, {"{vigencia}"} y {"{espera}"}.</span>
          </label>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar configuración"}
          </Button>
        </form>
      </Card>

      <Card className="p-5 md:p-6">
        <form onSubmit={handleBulkSubmit} className="space-y-3">
          <h2 className="font-display text-2xl text-brand-ink">Carga masiva de códigos</h2>
          <p className="text-sm leading-6 text-brand-ink/65">
            Un renglón por persona: DNI y el código para invitar, por ejemplo <span className="font-mono">30123456 SOFI15</span>. Se crean los dos
            códigos (el de invitar y el de crédito) para cada DNI con una compra confirmada en la web. Funciona aunque el programa esté apagado.
            Después, cada persona entra a /referidos con su DNI y ya ve todo armado.
          </p>
          <Textarea rows={6} value={bulkText} placeholder={"30123456 SOFI15\n27999888 MARTU15"} onChange={(event) => setBulkText(event.target.value)} />
          <Button type="submit" disabled={isPending || !bulkText.trim()}>
            {isPending ? "Creando..." : "Crear códigos"}
          </Button>
        </form>
        {bulkResult ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-bold text-brand-ink">
              {bulkResult.created} creado{bulkResult.created === 1 ? "" : "s"}
              {bulkResult.failed ? ` · ${bulkResult.failed} con problemas (quedaron en el cuadro para corregirlos)` : ""}
            </p>
            <ul className="max-h-72 divide-y divide-brand-ink/5 overflow-y-auto text-sm">
              {bulkResult.results.map((result) => (
                <li key={result.line} className="flex flex-wrap gap-x-3 py-1.5">
                  <span className={result.ok ? "font-bold text-green-700" : "font-bold text-red-600"}>{result.ok ? "OK" : "Error"}</span>
                  <span className="font-mono">{result.taxId || "—"}</span>
                  <span className="font-bold">{result.code || "—"}</span>
                  <span className="text-brand-ink/65">{result.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Input placeholder="Buscar por código, pedido, DNI o nombre" value={search} onChange={(event) => setSearch(event.target.value)} />

      <Card className="p-5 md:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl text-brand-ink">Créditos</h2>
          <div className="flex flex-wrap gap-1">
            {(["ALL", "PENDING", "AVAILABLE", "REJECTED", "VOIDED"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCreditFilter(value)}
                className={cn("rounded-full px-3 py-1 text-xs font-extrabold", creditFilter === value ? "bg-brand-ink text-white" : "bg-brand-ink/5 text-brand-ink/70")}
              >
                {{ ALL: "Todos", PENDING: "Pendientes", AVAILABLE: "Acreditados", REJECTED: "Rechazados", VOIDED: "Anulados" }[value]}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-brand-ink/50">
              <tr>
                <th className="py-2">Fecha</th>
                <th>Código</th>
                <th>Pedido del invitado/a</th>
                <th>Pago</th>
                <th>Crédito</th>
                <th>Vence / usado</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/5">
              {filteredCredits.map((credit) => (
                <tr key={credit.id} className="align-top">
                  <td className="py-3">{formatArgentinaDate(new Date(credit.createdAt))}</td>
                  <td>
                    <p className="font-bold">{credit.friendCode ?? "—"}</p>
                    <p className="text-xs text-brand-ink/55">{credit.referrerName ?? ""} · DNI {maskTaxId(credit.referrerTaxId)}</p>
                  </td>
                  <td>
                    <a href={`/admin/pedidos?search=${encodeURIComponent(credit.orderNumber)}`} className="font-bold text-brand-pink underline">
                      {credit.orderNumber}
                    </a>
                    <p className="text-xs text-brand-ink/55">
                      {credit.friendName} · {formatArs(credit.orderTotalArs)}
                    </p>
                  </td>
                  <td className="text-xs">{paymentLabels[credit.orderStatus === "CANCELLED" || credit.orderStatus === "EXPIRED" ? credit.orderStatus : credit.orderPaymentStatus] ?? credit.orderPaymentStatus}</td>
                  <td>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-extrabold", creditBadge[credit.status])}>{credit.statusLabel}</span>
                    <p className="mt-1 text-xs text-brand-ink/55">{formatArs(credit.amountArs)}</p>
                    {credit.reviewNote ? <p className="mt-1 max-w-[220px] text-xs text-brand-ink/55">{credit.reviewNote}</p> : null}
                  </td>
                  <td className="text-xs text-brand-ink/70">
                    {credit.expiresAt ? `Vence ${formatArgentinaDate(new Date(credit.expiresAt))}` : "—"}
                    {credit.usedArs ? <p>Usado {formatArs(credit.usedArs)} ({credit.usedInOrders.join(", ")})</p> : null}
                  </td>
                  <td className="space-x-2 whitespace-nowrap text-right text-xs font-bold">
                    {credit.status === "PENDING" || credit.status === "REJECTED" ? (
                      <>
                        <button type="button" disabled={isPending} className="text-green-700 underline" onClick={() => creditAction(credit.id, "approve")}>
                          Aprobar
                        </button>
                        {credit.status === "REJECTED" ? (
                          <button type="button" disabled={isPending} className="text-brand-ink/60 underline" onClick={() => creditAction(credit.id, "force-approve")}>
                            Forzar
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {credit.status !== "VOIDED" ? (
                      <button type="button" disabled={isPending} className="text-red-600 underline" onClick={() => creditAction(credit.id, "void")}>
                        Anular
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredCredits.length ? <p className="py-6 text-center text-sm text-brand-ink/55">No hay créditos para mostrar.</p> : null}
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <h2 className="mb-3 font-display text-2xl text-brand-ink">Referidores</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-brand-ink/50">
              <tr>
                <th className="py-2">Nombre</th>
                <th>DNI</th>
                <th>Código para invitar</th>
                <th>Código crédito</th>
                <th>Invitados</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/5">
              {filteredAccounts.map((account) => (
                <tr key={account.id}>
                  <td className="py-3">
                    <p className="font-bold">{account.firstName ?? "—"}</p>
                    <p className="text-xs text-brand-ink/55">{account.email ?? ""}</p>
                  </td>
                  <td>{account.taxId}</td>
                  <td className="font-bold">{account.friendCode ?? "—"}</td>
                  <td className="font-mono text-xs">{account.creditCode ?? "—"}</td>
                  <td>
                    {account.creditsAvailable}
                    {account.creditsPending ? <span className="text-xs text-brand-ink/55"> (+{account.creditsPending} en espera)</span> : null}
                  </td>
                  <td>{formatArs(account.balanceArs)}</td>
                  <td className="text-xs font-bold">{{ ACTIVE: "Activa", INVITED: "Sin código", BLOCKED: "Bloqueada" }[account.status]}</td>
                  <td className="text-right text-xs font-bold">
                    <button
                      type="button"
                      disabled={isPending}
                      className={account.status === "BLOCKED" ? "text-green-700 underline" : "text-red-600 underline"}
                      onClick={() => toggleBlocked(account.id, account.status !== "BLOCKED")}
                    >
                      {account.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredAccounts.length ? <p className="py-6 text-center text-sm text-brand-ink/55">Todavía no entró ningún referidor/a.</p> : null}
        </div>
      </Card>
    </div>
  );
}
