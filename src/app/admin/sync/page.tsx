import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminSyncPage() {
  await requireAdmin();
  const jobs = await prisma.syncJob.findMany({
    include: {
      order: true,
      logs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 3,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Integracion</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Sync</h1>
      </div>
      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.id} className="space-y-4 p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-brand-ink">{job.order.publicOrderNumber}</p>
                <p className="text-sm text-brand-ink/60">
                  {job.provider} / {job.status} / intentos: {job.attempts}
                </p>
              </div>
              <p className="break-words text-sm text-brand-ink/60 sm:max-w-[340px]">{job.lastError ?? "Sin errores"}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {job.logs.map((log) => (
                <div key={log.id} className="rounded-[1.5rem] bg-background p-4 text-sm text-brand-ink/70">
                  <p className="font-bold text-brand-ink">{log.status}</p>
                  <p>Intento {log.attemptNumber}</p>
                  <p>{log.errorMessage ?? "Sin error"}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
