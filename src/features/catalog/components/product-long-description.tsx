type DescriptionSection = {
  title: string;
  lines: string[];
};

type ParsedDescription = {
  intro: string[];
  sections: DescriptionSection[];
};

type ProductLongDescriptionProps = {
  content: string;
};

const listSectionKeywords = ["INGREDIENTES", "SABORES", "HECHA"];
const nutritionKeywords = ["INFORMACION NUTRICIONAL"];
const flavorSubheadings = ["MANI", "CACAO", "BANANA"];
const bulletPattern = /^(?:\u2022|-|\*)\s*/;

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function isLikelyHeading(line: string) {
  const normalized = normalizeForMatch(line);
  const hasLetter = /[A-Z]/.test(normalized);
  const hasLowercase = /[a-záéíóúñü]/.test(line);

  return hasLetter && !hasLowercase && line.length <= 90;
}

function isNutritionSection(title: string) {
  const normalized = normalizeForMatch(title);
  return nutritionKeywords.some((keyword) => normalized.includes(normalizeForMatch(keyword)));
}

function isListSection(title: string) {
  const normalized = normalizeForMatch(title);
  return (
    listSectionKeywords.some((keyword) => normalized.includes(keyword)) ||
    isNutritionSection(title)
  );
}

function isFlavorSubheading(line: string) {
  return flavorSubheadings.includes(normalizeForMatch(line));
}

function parseBulletLine(line: string) {
  const isBullet = bulletPattern.test(line);

  return {
    isBullet,
    text: line.replace(bulletPattern, "").trim(),
  };
}

function parseDescription(content: string): ParsedDescription {
  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const intro: string[] = [];
  const sections: DescriptionSection[] = [];
  let currentSection: DescriptionSection | null = null;

  for (const line of lines) {
    if (currentSection && isNutritionSection(currentSection.title) && isFlavorSubheading(line)) {
      currentSection.lines.push(line);
      continue;
    }

    if (isLikelyHeading(line)) {
      currentSection = { title: line, lines: [] };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    } else {
      intro.push(line);
    }
  }

  return { intro, sections };
}

export function ProductLongDescription({ content }: ProductLongDescriptionProps) {
  const parsed = parseDescription(content);

  if (!parsed.intro.length && !parsed.sections.length) {
    return null;
  }

  return (
    <details className="group border-t border-brand-ink/10 pt-5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-1 py-2 text-left outline-none transition hover:text-brand-pink focus-visible:ring-2 focus-visible:ring-brand-pink/30">
        <span>
          <span className="block text-xs font-extrabold uppercase tracking-[0.26em] text-brand-pink">
            Descripcion
          </span>
          <span className="mt-1 block text-sm leading-6 text-brand-ink/65">
            Ver detalle completo del producto
          </span>
        </span>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-pink/10 text-xl leading-none text-brand-pink transition-transform duration-300 group-open:rotate-180"
          aria-hidden="true"
        >
          ↓
        </span>
      </summary>

      <div className="space-y-5 px-1 pb-1 pt-4">
      {parsed.intro.length ? (
        <div className="space-y-3 border-b border-brand-ink/10 pb-5">
          {parsed.intro.map((paragraph, index) => (
            <p
              key={`${paragraph}-${index}`}
              className={
                index === 0
                  ? "max-w-3xl font-display text-[1.65rem] leading-tight text-brand-ink md:text-[2rem]"
                  : "max-w-3xl text-[0.95rem] leading-7 text-brand-ink/74"
              }
            >
              {paragraph}
            </p>
          ))}
        </div>
      ) : null}

      {parsed.sections.map((section) => (
        <article key={section.title} className="space-y-3 border-b border-brand-ink/10 pb-5 last:border-b-0 last:pb-0">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.26em] text-brand-pink">
            {section.title}
          </h2>

          {isListSection(section.title) ? (
            <ul className="space-y-2.5">
              {section.lines.map((line, index) => (
                (() => {
                  const bullet = parseBulletLine(line);

                  return (
                    <li
                      key={`${line}-${index}`}
                      className="flex gap-3 text-sm font-normal leading-6 text-brand-ink/76"
                    >
                      {bullet.isBullet ? (
                        <span
                          className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-pink"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className={bullet.isBullet ? "" : "pl-0"}>{bullet.text}</span>
                    </li>
                  );
                })()
              ))}
            </ul>
          ) : (
            <div className="space-y-2.5">
              {section.lines.map((line, index) => {
                const bullet = parseBulletLine(line);

                return bullet.isBullet ? (
                  <p key={`${line}-${index}`} className="flex gap-3 text-sm leading-6 text-brand-ink/74">
                    <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-pink" aria-hidden="true" />
                    <span>{bullet.text}</span>
                  </p>
                ) : (
                  <p key={`${line}-${index}`} className="text-sm leading-6 text-brand-ink/74">
                    {bullet.text}
                  </p>
                );
              })}
            </div>
          )}
        </article>
      ))}
      </div>
    </details>
  );
}
