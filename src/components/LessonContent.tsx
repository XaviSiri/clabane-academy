/**
 * Minimal, dependency-free renderer for lesson content.
 *
 * Lesson.content is plain text authored by admins. Rendering it verbatim
 * with white-space: pre-wrap (the previous approach) meant any structure —
 * headings, bullet lists, emphasis — showed up as literal "#", "-", "**"
 * characters, which reads poorly for the structured lessons (learning
 * objectives, key takeaways, scenarios) the Academy's content calls for.
 *
 * Rather than pull in a full markdown ecosystem (remark/rehype) for a
 * handful of block types, this is a small line-based parser covering just
 * what admin-authored lesson content actually uses:
 *   # Heading            -> large heading
 *   ## Subheading        -> medium heading
 *   - item / • item      -> bullet list
 *   > text                -> callout box (used for Key Takeaways, tips)
 *   **bold**              -> inline emphasis
 *   blank line            -> paragraph break
 * A line containing "CLABANE INTERNAL POLICY REQUIRED" or wrapped in
 * [ ... ] is treated as a placeholder and given distinct styling so it's
 * unmistakable to both admins and employees that real content is pending.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

function isPlaceholder(line: string): boolean {
  return /CLABANE INTERNAL POLICY REQUIRED|CLABANE ADMINISTRATOR|^\[.+\]$/i.test(line.trim());
}

export function LessonContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];
  let blockKey = 0;

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blockKey++}`} className="my-2 list-disc space-y-1 pl-5">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blockKey}-${i}`)}</li>
        ))}
      </ul>
    );
    listItems = [];
  }

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ");
    const key = `p-${blockKey++}`;
    if (isPlaceholder(text)) {
      blocks.push(
        <p key={key} className="my-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          {renderInline(text, key)}
        </p>
      );
    } else {
      blocks.push(
        <p key={key} className="my-2">
          {renderInline(text, key)}
        </p>
      );
    }
    paragraph = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h4 key={`h4-${blockKey++}`} className="mt-4 mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {trimmed.slice(3)}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3 key={`h3-${blockKey++}`} className="mt-5 mb-2 text-lg font-semibold text-slate-900">
          {trimmed.slice(2)}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2));
      continue;
    }
    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      const text = trimmed.slice(2);
      blocks.push(
        <div
          key={`callout-${blockKey++}`}
          className="my-3 rounded-md border-l-4 border-[var(--clabane-gold)] bg-amber-50/60 px-4 py-2 text-slate-700"
        >
          {renderInline(text, `callout-${blockKey}`)}
        </div>
      );
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();

  return <div className="text-sm leading-relaxed text-slate-700">{blocks}</div>;
}
