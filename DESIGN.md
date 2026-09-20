---
name: "PRISMA"
description: "Monochromatic operational editorialism across PRISMA marketing and import-readiness workspaces."
colors:
  ink: "#171715"
  muted: "#666661"
  paper: "#f7f7f4"
  workspace: "#f6f6f3"
  line: "#deded8"
  panel: "#efefeb"
  soft: "#e9e9e4"
  dark: "#141514"
  white: "#fff"
typography:
  display:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(4.6rem, 8vw, 6rem)"
    fontWeight: 590
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(2.4rem, 4vw, 4.1rem)"
    fontWeight: 560
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.04em"
  application-heading:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "clamp(2.3rem, 4vw, 3.7rem)"
    fontWeight: 590
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  metric:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "29px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.05em"
  control-label:
    fontFamily: "Manrope Variable, sans-serif"
    fontSize: "11px"
    fontWeight: 700
rounded:
  focus: "4px"
  control: "7px"
  workspace-control: "8px"
  button: "9px"
  compact-card: "10px"
  card: "13px"
  workspace-card: "14px"
  frame: "16px"
  round: "50%"
spacing:
  micro: "4px"
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  canvas: "34px"
  section-mobile: "88px"
  section-desktop: "150px"
components:
  button-primary:
    backgroundColor: "{colors.dark}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 18px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "#30302d"
    textColor: "{colors.white}"
  button-light:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "0 18px"
    height: "46px"
  app-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.muted}"
    rounded: "{rounded.button}"
    padding: "0 12px"
    height: "42px"
  workspace-button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.control-label}"
    rounded: "{rounded.workspace-control}"
    padding: "0 13px"
    height: "40px"
  workspace-button-quiet:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.control-label}"
    rounded: "{rounded.workspace-control}"
    padding: "0 13px"
    height: "40px"
  workspace-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.workspace-card}"
    padding: "22px"
  workspace-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.workspace-control}"
    padding: "0 10px"
    height: "40px"
---

# Design System: PRISMA

## Overview

**Creative North Star: "The Operational Dossier"**

PRISMA feels like a calm, meticulously prepared operations file brought to life. Warm paper, graphite type, fine rules, and oversized plain-language headlines give marketing content editorial authority; compact product simulations then prove that the same visual world can carry dense customs and logistics information without becoming clinical.

The system is restrained rather than austere. Large fields of quiet space set the marketing pace, while precise line icons, small status marks, clipped application frames, and a dark grounded close supply contrast. The `/app` workspace turns the same visual language into a persistent operating environment: warm canvas, white bordered cards, compact tables and forms, a sticky utility bar, and a floating navigation rail. Product UI is visibly denser than the surrounding narrative, but both share one monochrome palette, one variable sans-serif family, and one rounded geometric language.

**Key Characteristics:**

- Warm monochrome surfaces with graphite text and no decorative accent color.
- Oversized, tightly tracked editorial headlines paired with measured operational detail.
- Spacious marketing sections alternating with credible, compact application demonstrations.
- Thin neutral borders, restrained radii, and selective ambient depth.
- Motion that settles, reveals, or crossfades without delaying comprehension.
- A dense but calm application shell built from cards, metrics, tables, overlays, and contextual assistance.

## Colors

The palette moves from warm paper to near-black through close gray intervals; hierarchy comes from value, density, and scale rather than hue.

### Primary

- **Graphite Ink:** The default foreground for headings, body emphasis, active controls, progress, and high-confidence status marks.
- **Grounded Dark:** The strongest surface, reserved for primary actions and major closing sections.

### Neutral

- **Warm Paper:** The site canvas and default light environment.
- **Workspace Paper:** The slightly denser application-shell canvas behind white operational cards.
- **Operational Gray:** Secondary text and explanatory copy.
- **Fine Rule:** Dividers, field outlines, and application-shell boundaries.
- **Quiet Panel:** Tinted feature sections and subdued application regions.
- **Soft Workspace:** Assistant and low-emphasis background planes.
- **Clean White:** Product cards, active segmented states, fields, and inverse text.

### Named Rules

**The No Accent Rule.** Do not introduce a chromatic brand color to manufacture emphasis; use contrast, weight, scale, and state instead.

**The Warm Neutral Rule.** Light grays should retain the slightly warm paper character of the existing palette, not drift toward blue-gray software chrome.

## Typography

**Display Font:** Manrope Variable (with sans-serif fallback)  
**Body Font:** Manrope Variable (with sans-serif fallback)  
**Label Font:** Manrope Variable (with sans-serif fallback)

**Character:** One variable grotesk carries both editorial scale and operational precision. Display text is compact, weight-calibrated, and tightly tracked; body copy opens up through generous leading, while product labels become smaller and firmer.

### Hierarchy

- **Display:** Large hero statements use the display token and balanced wrapping; the tight line height makes short Portuguese phrases read as composed blocks.
- **Headline:** Section headlines use the headline token, normally capped to a concise two-to-four-line thought.
- **Title:** Product-panel titles use the title token and tabular numerals where readiness scores or operational values must align.
- **Application Heading:** Workspace page titles use the application-heading token; their scale preserves editorial continuity without competing with the marketing hero.
- **Metric:** Readiness totals, percentages, and count summaries use the metric token with tabular numerals.
- **Body:** Long-form explanatory copy uses the body token, usually limited to roughly 35–65 characters per line depending on context.
- **Label:** Compact labels, evidence notes, badges, tabs, and application metadata use the label scale; uppercase and tracking are reserved for provenance or demonstration labels.

### Named Rules

**The Scale Before Color Rule.** Establish hierarchy with size, weight, line length, and whitespace before changing foreground value.

**The Product Density Rule.** Marketing copy remains comfortably readable; only the framed product demonstrations descend to the compact 8–13px simulation scale.

## Layout

The marketing shell uses a 1216px maximum width with 24px desktop gutters. Core feature and demonstration content sits inside a 1168px measure. Desktop feature sections use asymmetrical two-column pairs, typically close to a 1.08/0.92 split with 80–90px gaps, alternating product and explanation. Major light sections use approximately 150px vertical padding; the assistant section is slightly more generous.

At 900px, editorial pairs collapse to a single column, navigation changes to a menu, and section spacing contracts. At 620px, gutters become 18px, major sections use 88px vertical padding, product cards reduce internal padding, and application sidebars disappear while every workflow demonstration remains available. Full-width dashboard frames may intentionally meet the viewport edge on mobile, but the page itself must never overflow horizontally.

The internal workspace uses a 1320px maximum canvas beneath a 68px sticky top bar. On wide screens its asymmetric inset (`44px 52px 88px 116px`) leaves room for a fixed left navigation rail while keeping data views centered. Operational layouts use 18px gaps and ratios around 1.35/0.65; metric summaries use four or five equal columns. At 1000px, top navigation hides, content insets contract, five-up metrics become three columns, and wide tables retain an 840px intrinsic width inside horizontal overflow. At 700px, the rail becomes a bottom floating dock, the canvas uses 16px side gutters and 104px bottom clearance, all major content grids become one column, and metrics become two columns.

**The Narrative Alternation Rule.** Repeated feature sections alternate copy and product evidence on desktop, then become one complete linear story on mobile.

**The Shell Clearance Rule.** Workspace content must reserve physical space for the floating rail on desktop and bottom dock on mobile; navigation may overlay the canvas, never the task controls.

## Elevation & Depth

The system is flat by default. Depth comes primarily from tonal layering, borders, and clipping; diffuse shadows appear beneath large application shells, the floating workspace rail, temporary menus, search, notifications, and the contextual assistant drawer. Sticky headers use translucent paper surfaces with backdrop blur so content remains legible without becoming a separate dark bar.

### Shadow Vocabulary

- **Application Window:** A broad, low-contrast shadow anchors the main dashboard demonstration without making it float aggressively.
- **Assistant Shell:** A softer ambient shadow distinguishes the conversation surface from its gray section.
- **Collaboration Card:** A compact shadow gives the nested review conversation just enough physical separation from its dark canvas.
- **Workspace Card:** An almost imperceptible ambient shadow keeps white task cards distinct from the workspace canvas.
- **Floating Utility:** Stronger compact shadows identify the rail, row menu, notification popover, and search modal as temporary layers.
- **Assistant Drawer:** A left-cast shadow separates the 420px contextual panel from the active workspace without dimming the underlying task.

### Named Rules

**The Flat-by-Default Rule.** Use borders and neighboring surface values first; reserve shadows for large framed demonstrations and nested focal cards.

## Shapes

The form language is softly engineered: 16px marketing frames, 14px workspace cards and modals, 13–15px embedded product cards, 8–10px everyday fields and controls, and 5–7px compact statuses. Circular geometry is reserved for identity marks, avatars, status dots, window controls, and modal close actions. Thin one-pixel borders define structure, while chat bubbles may use one pinched corner to show direction.

**The Nested Radius Rule.** Inner controls use a visibly smaller radius than their containing card; do not stack equally rounded rectangles.

## Components

### Buttons

- **Shape:** Compact rounded rectangle with a 9px radius, 46px default height, and 18px horizontal padding.
- **Primary:** Near-black surface, white label, firm weight, and an optional 17–18px line arrow.
- **Hover / Focus:** Hover lifts 2px and lightens the surface over 250ms; keyboard focus uses a 2px graphite outline offset by 4px.
- **Light:** White surface with graphite text; on dark sections it is the primary inverse action and warms to a pale gray on hover.
- **Workspace Primary:** A 40px graphite control with an 8px radius, 13px horizontal padding, and 11px bold label. It does not lift; hover lightens the fill.
- **Workspace Quiet / Icon / Mini:** White bordered secondary actions share the 8px radius. Icon actions are square; mini actions drop to 30px height and use a pale neutral fill.

### Chips

- **Style:** Compact 5–10px radii, dense labels, and neutral fills or outlines. Completed status reverses to graphite with white text; warning remains monochrome and gains an outline rather than a color.
- **State:** Segmented controls place the active choice on white over a warmer gray track. Tab state uses text weight plus a 2px underline.

### Cards / Containers

- **Corner Style:** 13px product cards nested inside 16px marketing frames; live workspace cards use a 14px radius.
- **Background:** White working surfaces over warm paper, quiet gray, or graphite demonstration canvases.
- **Shadow Strategy:** Flat by default; only focal shells use the ambient shadows defined above.
- **Border:** One-pixel warm-gray rules separate rows, tools, and shell regions.
- **Internal Padding:** 24px is the marketing product-card inset. Workspace cards use 22px and both systems reduce to 17px on mobile.

### Inputs / Fields

- **Style:** White field, one-pixel warm-gray border, 9px radius, 42px height, and muted placeholder text.
- **Focus:** Use the global graphite focus ring; never depend on a subtle border-color shift alone.
- **Error / Disabled:** Keep status chromatically neutral. Disabled controls reduce opacity and show a not-allowed cursor; nearby copy or title text explains the limitation.
- **Workspace Forms:** Search controls are 39px high and fields are 40px high, with an 8px radius and 10px horizontal inset. Labels are 11px bold; review textareas use the same border and radius language.

### Navigation

Marketing navigation is quiet 14px text centered in a three-column sticky header, with the brand at the start and the demo plus `/app` entry actions at the end. Hover darkens the label. Below 900px, the links become a full-width stacked menu with 17px vertical rows and hairline separators. All actionable targets reach at least 44px on small screens.

The workspace combines a 68px sticky utility header with a fixed 54px-wide floating rail. The rail uses 38px square icon targets, white at rest and inverse graphite when active or hovered. At 700px it becomes a horizontally scrollable bottom dock so the full workspace remains reachable with one hand.

### Application Window

The recurring signature frame pairs a 38px browser-like bar with a clipped operational workspace. A pale sidebar and white main surface organize dense data; tabs, readiness tracks, outlined rows, and restrained status marks communicate state. On phones the sidebar disappears, not the workflow content.

### Workspace Shell

The `/app` entry opens the frontend workspace directly; the homepage “Entrar” link is an entry route, not evidence of implemented authentication. The shell keeps brand and global utilities in the top bar, primary destinations in the rail, and all task content in a centered main canvas. Page changes crossfade inside the persistent shell. Notifications use a compact anchored popover, global search uses a centered scrim modal, and contextual assistance uses a right drawer; these patterns must remain distinct.

### Metrics, Tables, and Task Rows

Metrics are warm-gray inset blocks with oversized tabular values and compact labels. Tables are border-led rather than boxed: a pale header row, 10–11px data, 13px vertical row padding, and a quiet hover fill. Wide operational tables scroll within their card below 1000px instead of collapsing columns into ambiguous fragments. Timeline, review, CNPJ, product, and action rows reuse hairline separation and strong-first/secondary-second typography.

### Overlays

Search uses a centered 620px maximum modal over a translucent graphite scrim. Notifications remain a 280px anchored popover. The assistant is a full-height right drawer capped at 420px. All temporary layers use white surfaces, 12–14px radii where applicable, and stronger shadows than persistent cards.

### Motion

Marketing entrances settle vertically with an exponential ease (`cubic-bezier(0.16, 1, 0.3, 1)`), the hero product is revealed through a clipped frame, progress responds once, and local state changes crossfade in roughly 300ms. GSAP ScrollTrigger adds only scrubbed depth: the hero product shifts upward 56px and scales to 0.98, the central statement traverses from 34px to -30px, and feature visuals traverse from 24px to -18px. These scroll effects use linear scrub and are not registered when reduced motion is requested.

Inside the workspace, page content uses a 240ms fade with a small 10px entrance and -7px exit. The assistant drawer uses a spring (`stiffness: 290`, `damping: 28`) over a 440px horizontal path. Persistent shell chrome does not animate between views. Content is readable at rest before motion completes.

## Do's and Don'ts

### Do:

- **Do** use specific logistics terminology and realistic operational structures to make the monochrome world distinctive.
- **Do** pair generous editorial whitespace with compact, credible product evidence.
- **Do** preserve complete interactions and content when layouts collapse to one column.
- **Do** label illustrative data and simulated limitations in visible, readable text.
- **Do** use line icons with consistent rounded strokes and no filled decorative icon style.
- **Do** preserve the top bar and rail while workspace task views change.
- **Do** keep operational tables horizontally scrollable when their real column structure cannot collapse safely.

### Don't:

- **Don't** add a chromatic accent, gradient, or decorative glow to create artificial energy.
- **Don't** turn every content block into a floating card; section rhythm and tonal planes should carry the composition.
- **Don't** use heavy shadows or uniformly large radii across nested elements.
- **Don't** shrink marketing typography into application density, or enlarge operational labels until the simulations lose credibility.
- **Don't** hide product demonstrations on mobile; remove only nonessential application chrome.
- **Don't** present the `/app` entry as authenticated, integrated, or production-backed; the built route is a frontend workspace simulation.
- **Don't** reuse scroll-scrub motion inside the workspace; task-state changes use short fades, popovers, modals, or the contextual drawer.
