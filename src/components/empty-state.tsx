import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <Card className="p-8 text-center">
      <h2 className="font-display text-3xl text-brand-ink">{title}</h2>
      <p className="mt-3 text-brand-ink/70">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="inline-flex">
          <Button className="mt-6">{actionLabel}</Button>
        </Link>
      ) : null}
    </Card>
  );
}
