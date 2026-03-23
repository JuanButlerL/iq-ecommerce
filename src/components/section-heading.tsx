import { Badge } from "@/components/ui/badge";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeading({ eyebrow, title, description, align = "left" }: SectionHeadingProps) {
  const alignment = align === "center" ? "mx-auto text-center" : "";

  return (
    <div className={alignment}>
      {eyebrow ? <Badge className="mb-4">{eyebrow}</Badge> : null}
      <h2 className="font-display text-4xl leading-none text-brand-ink md:text-5xl">{title}</h2>
      {description ? <p className="mt-4 max-w-2xl text-base text-brand-ink/70">{description}</p> : null}
    </div>
  );
}
