import { readFile } from "node:fs/promises";
import path from "node:path";

import { Card } from "@/components/ui/card";

type GuideBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "ordered"; items: string[] }
  | { type: "code"; text: string };

function parseGuide(markdown: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; ) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      index += 1;
      continue;
    }

    const isBullet = /^-\s+/.test(line);
    const isOrdered = /^\d+\.\s+/.test(line);
    if (isBullet || isOrdered) {
      const expression = isBullet ? /^-\s+(.+)$/ : /^\d+\.\s+(.+)$/;
      const items: string[] = [];
      while (index < lines.length) {
        const item = expression.exec(lines[index].trim());
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ type: isBullet ? "bullets" : "ordered", items });
      continue;
    }

    if (/^`[^`]+`$/.test(line)) {
      blocks.push({ type: "code", text: line.slice(1, -1) });
      index += 1;
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|^-\s+|^\d+\.\s+/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={`${part}-${index}`} className="rounded bg-brand-ink/7 px-1.5 py-0.5 font-mono text-[0.82em] text-brand-ink">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

export async function MarketingGuide() {
  const guidePath = path.join(process.cwd(), "docs", "marketing-atribucion.md");
  const guide = await readFile(guidePath, "utf8");
  const blocks = parseGuide(guide);

  return (
    <article className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          if (block.level === 1) return <h1 key={index} className="font-display text-4xl leading-none text-brand-ink md:text-5xl">{block.text}</h1>;
          if (block.level === 2) return <h2 key={index} className="pt-5 font-display text-3xl text-brand-ink md:text-4xl">{block.text}</h2>;
          return <h3 key={index} className="pt-2 text-base font-extrabold text-brand-ink">{block.text}</h3>;
        }

        if (block.type === "paragraph") return <p key={index} className="max-w-4xl text-sm leading-7 text-brand-ink/70 md:text-base"><InlineCode text={block.text} /></p>;
        if (block.type === "code") return <pre key={index} className="overflow-x-auto rounded-2xl bg-brand-ink p-4 text-xs leading-6 text-white"><code>{block.text}</code></pre>;

        const List = block.type === "ordered" ? "ol" : "ul";
        return <List key={index} className={`${block.type === "ordered" ? "list-decimal" : "list-disc"} ml-5 space-y-2 text-sm leading-6 text-brand-ink/70 md:text-base`}>{block.items.map((item) => <li key={item}><InlineCode text={item} /></li>)}</List>;
      })}
    </article>
  );
}

export function MarketingGuideNotice() {
  return <Card className="border-brand-pink/20 bg-[#fff7f5] p-4 text-sm leading-6 text-brand-ink/70">Esta guía se publica desde <code className="rounded bg-white px-1.5 py-0.5 text-xs text-brand-ink">docs/marketing-atribucion.md</code>. Al actualizar ese documento en una mejora de Marketing, esta página se actualiza con el mismo deploy.</Card>;
}
