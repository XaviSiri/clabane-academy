# Clabane Academy — Content Sources & Population Notes

This documents where the real Clabane content in the Academy came from, what
technical changes were made to support it, and what still needs Clabane
management's input. The content itself lives in the database (via
`scripts/populate-clabane-content.ts`), not hard-coded in the application —
administrators can edit, republish, or replace any of it through the normal
Content Management UI.

## A network constraint that shaped this work

This environment's sandbox blocks general internet access at the
organization level (only package registries are allowlisted) — confirmed
via the agent proxy status, not specific to clabane.com. Concretely:

- **Direct page fetching (WebFetch, curl) was unavailable** for clabane.com
  and any other general website.
- **Web search was the only working channel.** It returns indexed
  snippets/summaries citing clabane.com pages — useful, but not equivalent
  to reading the full page text.
- **No images could be downloaded** through any tool in this session, from
  any domain. This is why the Academy currently has no Clabane logo or
  product photography — see "Images" below.

Given this, content below is built from what web search could verify, with
`[CLABANE INTERNAL POLICY REQUIRED]` placeholders anywhere the real answer
depends on internal Clabane material (policies, procedures, the full
FAQ/Key Ingredients page text) that a public search snippet can't supply.

## Pages referenced (via web search snippets, not full fetches)

- `https://clabane.com/` — homepage positioning
- `https://clabane.com/pages/our-story` — founder, origin story (summary only)
- `https://clabane.com/collections` and its sub-collections: `/cleansers`,
  `/moisturizers`, `/sunscreen`, `/body`, `/acne`, `/face`, `/sets`,
  `/all-products`
- Individual product pages under `https://clabane.com/products/...` for the
  specific named products cited in Module 3 (see lesson content for exact
  product names)
- `https://clabane.com/pages/key-ingredients` — confirmed to exist; full
  content not retrievable (cited in the Module 3 FAQ lesson as a pointer)
- `https://clabane.com/pages/frequently-asked-questions` — confirmed to
  exist; full content not retrievable
- `https://clabane.com/pages/refund-and-returns-policy` — this one *was*
  substantially recoverable via search snippets (14-day window, damaged-item
  replacement, return address, contact channels) and is used directly in
  Module 4

## What's real vs. placeholder, by module

**Module 1 — Who We Are**: real. Founder (Dr. Malik Ssempereza), origin
story (gap in the market for sensitive African skin), mission statement,
brand positioning. Placeholders: a formally published vision statement (if
distinct from the mission), a detailed values list, internal culture
description, specific long-term goals.

**Module 2 — How We Work**: structure only, deliberately. No internal HR
policy, code of conduct, or communication-tooling standard is public, so
every lesson pairs generic, clearly-labeled professional-standard guidance
with an explicit `[CLABANE INTERNAL POLICY REQUIRED]` block asking
management to supply the real policy.

**Module 3 — Our Products**: substantially real. Two confirmed sub-lines
(Clabane Organics, Clabane MD), real collection categories, and specific
named products with their actual stated ingredients (e.g. the Ultra Pigment
Repair Kale Serum's 5% cysteamine, the MD Acne Control Cleanser's 10%
benzoyl peroxide). Explicitly flagged gap: **no hair care line was found**
on the site — rather than inventing one to match a generic category list,
the Body Care lesson says so directly and asks to be corrected if one
exists. The Key Ingredients and FAQ pages exist but their full text
couldn't be retrieved, so the FAQ lesson is a mix of confirmed facts and a
placeholder for the rest.

**Module 4 — Customer Experience**: partially real in an unexpected way —
the actual Refund & Returns policy (14-day window, damaged-item handling,
return address, contact channels: care@clabane.com,
+256-750748747, @ClabaneSkinCare) came through clearly in search results and
is used verbatim in the Returns & Refunds lesson. Internal escalation
process (who to notify, logging, SLAs) is a placeholder.

**Module 5 — Data and Security**: entirely generic, industry-standard
security-awareness content, explicitly framed as such (not attributed to
Clabane). Placeholders mark where Clabane-specific policy (password
requirements for company systems, device policy, incident-reporting
contact) needs to replace the general guidance.

## Images and visual identity

**No image files were added** — that constraint hasn't changed. Every
image-fetch path (WebFetch, curl, a third-party brand-asset aggregator)
hit the same network block, and a screenshot pasted into a chat message is
visual-only: it cannot be extracted or saved as a binary asset in this
environment, so it cannot become a logo file or product photo in the app.

**The color palette and typography were updated**, based on a real
screenshot of clabane.com's "Our Story" page that was shared directly in
conversation and visually inspected (not fetched, not a fabricated guess).
The placeholder navy (`#0d1b3e`) / gold (`#b8944f`) palette has been
replaced with a warm terracotta brown primary (`#7a4023`) and a teal accent
(`#1f7a70`), defined as CSS custom properties in `src/app/globals.css`
(`--clabane-primary`, `--clabane-primary-dark`, `--clabane-accent`,
`--clabane-gold`) and applied consistently across buttons, the nav logo
badge, progress bars, links, and the certificate. The body font changed
from Inter to Poppins (`src/app/layout.tsx`) for the rounder, friendlier
look seen on the real site. Clabane's actual logo glyph/flourish was
deliberately **not** reproduced — only color and type cues were carried
over.

**To add real Clabane imagery**: an administrator can upload the logo,
product photography, and module hero images through the existing upload
features once the files are supplied — the video/document storage
abstraction already used throughout the app is the right place for these;
no new upload mechanism is needed. The most direct path is for someone with
network access to download the assets from clabane.com and hand them to an
admin (or attach them as real files — not an inline chat screenshot — in a
conversation with Claude, which can then upload them through the existing
admin flows).

## A rendering change this required

Lesson content used to render as raw `white-space: pre-wrap` text, so any
structure (headings, bullet lists, bold text) would have shown up as
literal `#`, `-`, `**` characters rather than actual formatting — a real
problem for the "learning objectives / key takeaways / structured lessons"
style this content uses. `src/components/LessonContent.tsx` is a small,
dependency-free line-based renderer (headings, bullets, bold, and a
callout block used for "Key takeaway" call-outs and to visually distinguish
`[CLABANE INTERNAL POLICY REQUIRED]` placeholders) wired into the
employee-facing lesson page. This is a display-only change — it doesn't
touch the data model, the admin editing flow, or any other architecture.

## Re-running the population script

```bash
npx tsx scripts/populate-clabane-content.ts
```

This is idempotent-ish: it replaces each module's lessons and assessment
wholesale rather than diffing, and resets employee progress/certificates
tied to the old content (see the script's `cleanUpOrphanTestData` step). Do
not run it against a production database without understanding that
progress-reset behavior — it's intended for populating/repopulating a
fresh or QA deployment, not for incremental edits (use the admin UI for
those).
