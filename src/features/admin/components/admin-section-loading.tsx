type AdminSectionLoadingProps = {
  title: string;
  detail: string;
};

export function AdminSectionLoading({ title, detail }: AdminSectionLoadingProps) {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div className="animate-pulse">
        <div className="h-4 w-28 rounded-full bg-brand-pink/20" />
        <div className="mt-4 h-11 w-64 max-w-full rounded-2xl bg-brand-ink/10" />
        <p className="mt-3 text-sm text-brand-ink/55">{title}: {detail}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-[2rem] bg-brand-ink/6" />)}
      </div>
      <div className="h-80 animate-pulse rounded-[2rem] bg-brand-ink/6" />
      <span className="sr-only">Cargando</span>
    </div>
  );
}
