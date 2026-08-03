# Handoff: Callboard — Action Pro Network (Feed + Projects)

## Overview

Callboard is the professional-network product surface for **Action**, a platform for film
and TV professionals (actors, crew, instructors). It covers two screens — **Feed** and
**Projects** — in **light and dark themes**, at **desktop (1440px)** and **mobile (390×844)**.

The read is "LinkedIn for film": a cool-grey ground, white 16px-radius cards with hairline
borders, pill-shaped actions, and a horizontal top nav (Feed · Projects · Classes · Network ·
Messages) where each item carries its own count. Navy `#14213D` (Pantone 2767 C) is the only
accent — it carries buttons, active tabs, links, badges and progress, so the interface reads
institutional rather than decorative.

Two product ideas drive the layout and must survive implementation:

1. **Community is structural, not decorative.** Every person carries a mutual-connection or
   mutual-circle count; comment threads render open by default (not behind a "3 comments"
   tap); "N in your circle enrolled/applied" appears on class and project cards; the reaction
   verb is **Congratulate**, and **Endorse** sits beside it as a first-class action.
2. **Classes are promoted in four places** — top nav with a live count, a "Classes filling up
   near you" rail directly under the composer, a "Your class in progress" card in the right
   rail, and a dedicated bottom tab on mobile.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes that show the
intended look and behavior. They are **not production code to lift**. The task is to
**recreate these designs in the target codebase's own environment** (React, Vue, SwiftUI,
native, etc.) using its established component library, routing, state and styling patterns.
If no environment exists yet, choose the framework appropriate to the project and implement
the designs there.

Specifically: the prototypes use inline styles on `<span>`/`<div>` elements and hand-drawn
inline SVG icons because that is how the mock was authored. In production these should become
real components (`<Button>`, `<Card>`, `<Avatar>`, `<Tag>`, `<Badge>`), real `<button>` /
`<a>` / `<input>` elements with accessible semantics, and icons from **Lucide** at
`stroke-width: 1.5` (every icon in the mock is a Lucide shape).

## Fidelity

**High fidelity (hifi).** Colors, type, spacing, radii and copy are final and should be
matched closely. Values below are exact. Note that:

- No hover, focus, pressed, loading or error states are drawn in the mock — they are specified
  in prose under **Interactions & Behavior** and must be built.
- All imagery is a drag-and-drop placeholder (`<image-slot>`); no final photography exists yet.
- Nothing in the prototype is wired: it is a static rendering of one state per screen.

## Screens / Views

### 1. Feed — Desktop (1440 × auto), light and dark

**Purpose.** The professional's home. Catch up on what people in your circles booked, wrapped
and are teaching; post an update; get pulled into classes and matched auditions.

**Layout.**

- Page ground `#EEF1F5` (dark: `#0A0D13`). Font stack `'Barlow', sans-serif`.
- **Top bar**: 68px tall, background `#FFFFFF` (dark `#141A23`), 1px bottom border `#DEE4EC`
  (dark `#242C38`), horizontal padding 36px, items gap 22px.
  - Brand lockup, left: 36×36 navy tile, radius 11px, letter "A" in Barlow Condensed 700/19px
    white; beside it a two-line stack — "ACTION" Barlow Condensed 700/21px `#121821`, and
    "PRO NETWORK" JetBrains Mono 500/9.5px, letter-spacing .18em, `#7C8797`.
  - Search pill: fixed 286px wide, radius 999px, fill `#F5F7FA`, 1px border `#EAEEF4`,
    padding 10px 15px, 17px search icon, placeholder "Search pros, projects, classes"
    (Barlow 400/14px `#7C8797`).
  - Flexible spacer, then the nav: five items, each `min-width: 86px`, full 68px height,
    icon (22px) over label (Barlow 13px), gap 4px. Active item = 2.5px bottom border
    `#14213D`, icon stroke `#14213D`, label 600 weight `#121821`; inactive = transparent
    border, icon `#7C8797`, label 500 weight `#4A5666`.
    Order and counts: **Feed** (no count, active on this screen), **Projects** `12`,
    **Classes** `3`, **Network** `5`, **Messages** `2`. Count badge: min-width 18px,
    height 18px, radius 999px, navy fill, white Barlow 700/10px, positioned `top:11px;
    right:20px` inside the item.
  - Right cluster, separated by an 18px left padding and 1px left border `#EAEEF4`: 21px bell
    icon with an 8px navy notification dot (2px white ring), then a 36px round avatar
    (`#DEE4EC` fill, initials Barlow 600/14px `#4A5666`) with a 15px chevron.
- **Body**: three columns, total width 1248px, centered, `padding: 24px 0 44px`, column gap
  24px, `align-items: flex-start`.
  - **Left rail 264px** (fixed): profile card, "Your circles" card, "Saved projects" row.
  - **Center 616px** (fixed): composer, Classes rail, then post cards.
  - **Right rail 344px** (fixed): "Your class in progress", "Auditions matched to you",
    "Pros you may know".
- **Card shell (used everywhere)**: background `#FFFFFF` (dark `#141A23`), 1px border
  `#DEE4EC` (dark `#242C38`), radius **16px**, shadow
  `0 1px 3px rgba(18,24,33,.06), 0 8px 24px -14px rgba(18,24,33,.14)`
  (dark: `0 1px 3px rgba(0,0,0,.5)`).

**Components.**

- **Profile card** (left rail). 64px cover band `#E8EDF5` (dark `#1B212B`); 68px round avatar
  overlapping the band by -34px with a 4px white ring; name "Jordan Diaz" Barlow Condensed
  600/23px; role line "1st AD · Los Angeles" Barlow 400/13.5px `#4A5666`; a verified row —
  14px check-circle icon + "Verified pro · 9 vouches" Barlow 600/12.5px navy; then a
  1px `#EAEEF4` divider and three label/value rows (9px gap): Connections **312**,
  Credits **14**, Classes taken **6** (labels 400/13.5px `#4A5666`, values 600/13.5px `#121821`).
- **Your circles card**. Section label Barlow 600/13px, letter-spacing .06em, uppercase
  `#7C8797`. Three rows: 32px round avatar, name Barlow 500/14.5px, member count in
  JetBrains Mono 400/12.5px `#7C8797` — AD Collective 1.2k, Indie Camera Dept 840,
  Meisner Study Group 312. Footer row above a 1px top border: plus icon + "Find a circle"
  Barlow 600/14px navy.
- **Saved projects row**. One-line card: 19px bookmark icon, "Saved projects" Barlow 500/14.5px,
  count "4" JetBrains Mono 600/13px navy.
- **Composer**. 44px avatar + a full-width pill input (`#F5F7FA` fill, 1px `#EAEEF4` border,
  radius 999px, padding 13px 18px) reading "Share an update with your circle…". Below,
  four outlined chips (radius 999px, 1px `#DEE4EC`, padding 8px 14px, Barlow 600/13px
  `#4A5666`, 16px leading icon): **Still**, **Milestone**, **Project**, **Class note** — then
  a navy **Post** pill (padding 9px 22px, Barlow 600/14px white) pushed right.
- **Classes rail** ("Classes filling up near you"). Header: 34px rounded-square icon tile
  (radius 11px, `#E8EDF5` fill, navy graduation-cap icon), title Barlow Condensed 600/21px,
  and a right-aligned "See all 40" + arrow in navy 600/13px. Two class cards side by side
  (gap 14px, each `flex: 1`), card radius 14px, 1px border, 16:9 image slot with an absolute
  badge top-left (white pill, radius 6px, Barlow 600/11px, uppercase, .08em, navy) reading
  "8 sessions" / "1 day". Body padding 13px 14px 14px: time "THU 7:00 PM" (Barlow 600/12px,
  .05em, uppercase, `#7C8797`), title Barlow Condensed 600/19px, instructor Barlow 400/13.5px
  `#4A5666`, then a 22px overlapping avatar stack (-8px overlap, 2px white ring) with
  "5 in your circle enrolled" Barlow 500/12.5px. Footer row: navy pill **Reserve a seat**
  (`flex: 1`, radius 999px, padding 10px 12px, Barlow 600/13.5px white) beside seat-count text
  ("4 seats left" / "12 seats") Barlow 500/12px `#7C8797`. The rail closes with a tinted strip
  (`#F5F7FA`, 1px top border, padding 12px 18px): 16px briefcase icon + "Your circle booked 12
  classes this month · 3 rooms meeting tonight".
- **Post card — milestone (Elena Ruiz).** Header: 50px avatar, name Barlow Condensed 600/20px,
  16px navy verified check, "· 2h"; sub-line "Actor · Los Angeles · 6 mutual connections"
  Barlow 400/13.5px. Right: outlined navy **Follow** pill (1.5px border, padding 8px 18px).
  Body: a milestone chip (radius 999px, `#E8EDF5` fill, 15px star icon, Barlow 700/11.5px,
  .08em, uppercase, navy) reading "MILESTONE · FIRST SAG-ELIGIBLE CREDIT"; headline Barlow
  Condensed 600/25px, line-height 1.28, with the film title in italic; body Barlow 400/15.5px,
  line-height 1.65, `#4A5666`. Social proof row: 26px avatar stack + "**Priya Desai** and 26
  others congratulated this" with "3 comments" right-aligned. Action bar (1px top border,
  four equal `flex: 1` targets, radius 10px, padding 10px 0, Barlow 600/14px `#4A5666`):
  **Congratulate · Comment · Endorse · Share**. Comment well: `#F5F7FA` background, 1px top
  border, bottom corners 16px — two open comments (36px avatar; bubble radius 14px with name
  Barlow 600/15px, qualifier "· Actor" / "· Instructor" + verified check, body Barlow 400/14.5px
  line-height 1.55) each followed by Like · Reply · timestamp; then the current user's avatar
  and a white "Write a comment…" pill.
- **Post card — wrap (Marcus Webb).** Same header pattern with an outlined **Connect** pill and
  sub-line "Director · 3 mutual circles"; a Barlow Condensed 600/23px headline; a full-bleed
  16:9 image slot with hairline top and bottom borders; social proof "**Sam Okafor** and 11
  others congratulated this · 4 comments"; the same four-action bar (comments collapsed here).
- **Your class in progress** (right rail). Uppercase label with graduation-cap icon; title
  Barlow Condensed 600/21px; "Linda Castellano · Thursdays 7:00 PM"; a row of
  "SESSION 3 OF 8" (Barlow 600/13px uppercase) and "37%" (JetBrains Mono 700/13px navy);
  an 8px progress track (`#F5F7FA`, radius 999px) with a navy fill at 37%; a 26px avatar stack
  + "11 classmates"; and two half-width pills — navy **Resume class** and outlined navy
  **Message room** (padding 11px 12px).
- **Auditions matched to you** (right rail). Header with "See all 12" in navy 600/12.5px, then
  rows separated by 1px borders: 42px rounded-square icon tile (radius 12px, `#F5F7FA`,
  1px `#EAEEF4`), title Barlow Condensed 600/16px, meta Barlow 400/12.5px `#7C8797`
  ("Lead · 22–30 · Chicago"), right column with rate in navy 600/13px and a 17px bookmark icon.
  Entries: **Midnight Dispatch** $450/day, **Lantern** (Supporting · 50–65 · Maine).
- **Pros you may know** (right rail). Rows of 44px avatar, name Barlow Condensed 600/17px,
  role line, "N mutual · vouched by …", and an outlined navy **Connect** pill.

**Dark theme mapping (Feed and Projects alike).**

| Role | Light | Dark |
| --- | --- | --- |
| Page ground | `#EEF1F5` | `#0A0D13` |
| Card / bar surface | `#FFFFFF` | `#141A23` |
| Sunken surface (input, well, tint strip) | `#F5F7FA` | `#1B212B` |
| Card border | `#DEE4EC` | `#242C38` |
| Hairline / inner divider | `#EAEEF4` | `#1F2631` |
| Avatar fill | `#DEE4EC` | `#28303C` |
| Accent (buttons, active tab, progress) | `#14213D` | `#8AA6D8` |
| Accent text/icon on dark | — | `#A9C0E4` |
| Accent tint (chips, icon tiles) | `#E8EDF5` | `rgba(138,166,216,.14)` |
| Primary text | `#121821` | `#E9EEF6` |
| Secondary text | `#4A5666` | `#AAB6C6` |
| Tertiary / meta text | `#7C8797` | `#78859A` |
| Text on accent | `#FFFFFF` | `#0A0D13` |
| Card shadow | `0 1px 3px rgba(18,24,33,.06), 0 8px 24px -14px rgba(18,24,33,.14)` | `0 1px 3px rgba(0,0,0,.5)` |

### 2. Projects — Desktop (1440 × auto), light and dark

**Purpose.** Browse and filter open productions and roles; apply.

**Layout.** Same 68px top bar (Projects tab active). Single column, width 1248px, centered,
`padding: 30px 0 44px`, vertical gap 18px.

**Components, top to bottom.**

- **Page header.** Kicker "OPPORTUNITIES" Barlow 600/13px, .16em, uppercase, navy; `<h1>`
  "Projects" Barlow Condensed 600/46px `#121821`; sub "Find your next role, crew position, or
  collaboration." Barlow 400/16px `#4A5666`. Right: outlined navy **★ Saved (4)** pill and a
  navy **Post a project** pill with a plus icon (padding 12px 22px).
- **Search & filter card.** Row one (`gap: 11px`, stretch): a flexible search field (radius
  12px, `#F5F7FA`, 1px `#DEE4EC`, 18px icon, placeholder "Search projects, roles, production
  companies…" 15px) followed by four dropdown fields — **Location** 200px "Los Angeles, CA",
  **Job type** 150px "All jobs", **Gender** 120px "Any", **Age** 120px — each a 12px-radius
  white box with a 1px border, an 11px `#7C8797` label over a Barlow 600/14px value and a 15px
  chevron. Then a navy **Search** pill (padding 14px 24px) and a filter-icon button carrying a
  count badge "4" (`#E8EDF5` pill, navy 700/11.5px). Row two, above a 1px top border: category
  chips, **non-wrapping** — active "All" is a solid navy pill (padding 7px 15px, white 600/13px);
  the rest are `#F5F7FA` pills with a 1px `#EAEEF4` border and `#4A5666` 500/13px text —
  Short film, Feature film, Web series, Music video, Commercial, Documentary, Crew calls.
- **Results bar.** "Showing **6,231 roles** across **1,504 productions** near Los Angeles"
  (Barlow 400/15.5px, bold segments 600 `#121821`); a segmented **Productions / Roles** toggle
  (3px padding, radius 999px, white, 1px border; selected segment = navy pill with white text
  and icon); and a **Sort** dropdown (160px) reading "Newest first".
- **Project row (split card).** The full card is `display: flex`, radius 16px, overflow hidden.
  The **featured/staff-pick row** additionally gets `border-color: #14213D` and a
  `0 0 0 1.5px #14213D` ring on top of the standard shadow (dark: `#8AA6D8`).
  - **Left (flex: 1), padding 20px 22px 18px.** Status chips (radius 6px, Barlow 600/11px,
    .08em, uppercase): "★ STAFF PICK" `#E8EDF5`/navy and "OPEN" `#E6F3EC`/`#1F7A4D`
    (dark: `rgba(45,168,110,.16)`/`#5FCF97`). Title Barlow Condensed 600/27px, with 20px
    bookmark and share icons top-right. Meta row (gap 14px): pay "$450–$900 / day" Barlow
    600/14.5px navy, 15px pin icon + "Chicago, IL", 15px clock icon + "Posted Jul 29"
    (`#7C8797`). Description Barlow 400/15px, line-height 1.6, `#4A5666`. Tag chips
    (`#F5F7FA`, 1px `#EAEEF4`, radius 999px, 12.5px, `white-space: nowrap`). Footer: navy
    **View details & apply** pill (padding 11px 22px) + 24px avatar stack + "4 in your circle
    applied".
  - **Right (fixed 290px), `#F5F7FA` fill, 1px left border `#EAEEF4`, padding 18px 20px.**
    "ROLES OPEN · 5" uppercase label, then role rows — 28px round avatar, role name Barlow
    600/15px, "Lead · Female · 22–30" Barlow 400/12.5px `#7C8797`, and a small outlined navy
    **Apply** pill each. Below: "+ 3 more roles →" in navy, a hairline, then a poster row —
    28px avatar, "Posted by **Marcus Webb**", "Director · 3 mutual".
  - Non-featured rows repeat this structure without the ring, with their own status chips
    (e.g. "FEATURE FILM" / "OPEN", "DEFERRED").
- **Footer.** Centered outlined navy **Load more projects** pill.

### 3. Feed — Mobile (390 × 844), light and dark

- **Status bar**: 9:41 / 5G / battery glyph, Barlow 600/14px, padding 14px 22px 4px.
- **App bar** (white, padding 8px 20px 14px, gap 12px): 34px navy brand tile, "ACTION" Barlow
  Condensed 700/22px, 23px search icon, 23px mail icon with a navy count badge "2"
  (min-width 17px, top -3px / right -4px), 34px avatar. **Messages lives here** because the
  fifth bottom tab was given to Classes.
- **Scroll region**: 664px tall, cards inset `margin: 0 12px`, vertical gap 12px.
  - Compact composer: 42px avatar + "Share an update…" + a 38px round navy plus button.
  - Classes rail: header "Classes filling up" + "See all"; horizontally scrolling 236px-wide
    class cards (the second peeks at 55% opacity); card body identical to desktop at mobile
    sizes, with a full-width navy **Reserve a seat** pill (padding 11px 12px, 14px text).
  - Post card: 46px avatar, name Barlow Condensed 600/19px + verified check, "Actor · 6 mutual
    · 2h", milestone chip, Barlow Condensed 600/23px headline, 15px body, social-proof row,
    a three-up action bar (**Congratulate · Comment · Share**; Endorse drops on mobile),
    and the open comment well with a "Write a comment…" pill.
- **Bottom tab bar**: absolute, white, 1px top border, 10px bottom inset for the home
  indicator; five equal tabs at 60px height — **Feed · Projects · Classes · Network · Profile**
  — 23px icons over Barlow 11.5px labels. Active tab: navy icon and 600 label plus a 34px ×
  3px navy indicator flush to the top edge (radius `0 0 3px 3px`). Classes carries a "3" badge
  (min-width 16px, Barlow 700/9.5px).

### 4. Projects — Mobile (390 × 844), light and dark

- Status bar + app bar as above, with an "Projects" title block, a full-width search pill and a
  horizontally scrolling filter chip row (non-wrapping, active chip navy).
- Results row: "**6,231 roles** · 1,504 productions" plus the compact **Productions / Roles**
  segmented toggle.
- 394px scroll region of stacked project cards (inset 12px, gap 12px): status chips, title
  Barlow Condensed 600/26px, pay/location/date meta, tag chips, "N in your circle applied", and
  a full-width navy **View details & apply** pill; the roles panel becomes a tinted block at the
  foot of each card rather than a side panel.
- Same five-tab bottom bar, Projects active.

## Interactions & Behavior

None of this is wired in the prototype; all of it is expected in the build.

- **Navigation.** Top-nav items and bottom tabs route to Feed / Projects / Classes / Network /
  Messages (mobile: Profile). Active state = the 2.5px navy underline (desktop) or the navy
  indicator bar + navy icon/label (mobile). Counts are live and should poll or subscribe.
- **Buttons.** Every pill in the mock is a real button/link. Suggested states, all derived from
  the accent, since none are drawn:
  - Navy primary: hover `#1B2C52`, pressed `#0E1729`, disabled 45% opacity.
  - Outlined navy: hover fill `rgba(20,33,61,.06)`, pressed `rgba(20,33,61,.12)`.
  - Ghost action-bar items (Congratulate/Comment/Endorse/Share): hover fill `#F5F7FA`
    (dark `#1B212B`) inside the existing 10px radius.
  - Focus for all interactive elements: `outline: 2px solid #14213D; outline-offset: 2px`
    (dark `#8AA6D8`) — never the browser default.
  - Dark theme uses `#8AA6D8` as the accent; hover one step lighter (`#A9C0E4`), pressed one
    step darker (`#6E8CC4`).
- **Follow / Connect** toggle to a filled "Following" / "Pending" state in place, without a
  layout shift (keep the pill's width stable or animate it).
- **Congratulate** is a toggle: filled navy icon + navy label when set, and the social-proof
  line increments. **Endorse** opens a small picker of skills to endorse. **Comment** focuses
  the "Write a comment…" field. Threads are **open by default** — do not collapse them behind a
  count; long threads show the two most recent plus "View all N comments".
- **Reserve a seat** goes to checkout/enrolment; seat counts ("4 seats left") are live and the
  button becomes a disabled "Waitlist" when the count hits zero.
- **Classes rail** scrolls horizontally on mobile (snap to card), and on desktop shows two cards
  with "See all 40" leading to the Classes index.
- **Projects search.** The chip row filters immediately; dropdowns open menus; **Search** applies
  the free-text query. The filter-icon button opens an advanced-filter sheet, and its badge
  shows the number of active filters. The **Productions / Roles** toggle switches the result
  unit (cards grouped by production vs. flat role rows). **Sort** offers Newest first, Pay,
  Closing soon, Relevance.
- **Apply** (per role) opens the application flow; the row's button becomes a non-interactive
  "Applied" state afterwards. Bookmark icons toggle saved state and update the "Saved (4)" count.
- **Loading.** Skeletons that mirror the card shells (16px radius, `#F5F7FA` blocks); the feed
  and project list paginate — desktop Projects uses the explicit "Load more projects" button,
  mobile uses infinite scroll.
- **Empty / error.** Not designed. Follow the same card shell with a centered message and a
  single navy primary action.
- **Responsive.** Desktop is a fixed three-column 1248px canvas. Below ~1180px drop the right
  rail; below ~900px drop the left rail and take the centre column full-width; below 640px use
  the mobile layout (single column, 12px gutters, bottom tab bar, Messages in the header).
- **Motion.** Nothing animates in the mock. Keep it restrained: 120–160ms ease-out for hover
  and toggles, 200ms for sheets and menus; respect `prefers-reduced-motion`.

## State Management

- `session.user` — name, initials, avatar, role, location, verified flag, vouch count,
  connections / credits / classes-taken counts.
- `nav.counts` — `{ projects: 12, classes: 3, network: 5, messages: 2 }`, live.
- `feed.posts[]` — id, author (name, initials, role, location, verified, mutuals, relationship
  = none/following/connected), timestamp, kind (`milestone` | `wrap` | `update` | `classNote`),
  chip label, headline, body, optional image, `congratulations` (count, sample avatars,
  `hasCongratulated`), `endorsements`, `comments[]` (author, qualifier, body, timestamp, likes),
  pagination cursor.
- `composer` — draft text, selected kind chip, attachments, posting/error state.
- `classes.nearby[]` — title, instructor, schedule, session count, image, circle-enrolled count
  and avatars, seats left, reserved flag.
- `classes.inProgress` — title, instructor, schedule, `sessionIndex`/`sessionTotal` (→ percent),
  classmate count and avatars.
- `auditions.matched[]` — title, role, age range, location, rate, saved flag.
- `network.suggestions[]` — person, mutuals, vouched-by, connection state.
- `projects.query` — text, location, jobType, gender, age, category chip, advanced-filter count,
  sort, view (`productions` | `roles`), page.
- `projects.results[]` — id, title, chips (staff pick, type, status), pay range, location,
  posted date, description, tags, circle-applied count, `roles[]` (name, breakdown, applied
  state), poster (name, role, mutuals), saved flag.
- `theme` — `light | dark`, persisted; both themes are fully specified above.

## Design Tokens

**Color — light**

| Token | Value |
| --- | --- |
| ground | `#EEF1F5` |
| surface | `#FFFFFF` |
| surface-sunken | `#F5F7FA` |
| border | `#DEE4EC` |
| border-hairline | `#EAEEF4` |
| accent (navy, Pantone 2767 C) | `#14213D` |
| accent-tint | `#E8EDF5` |
| text-primary | `#121821` |
| text-secondary | `#4A5666` |
| text-tertiary | `#7C8797` |
| avatar-fill | `#DEE4EC` |
| success (Open chip) | bg `#E6F3EC`, text `#1F7A4D` |

**Color — dark**

| Token | Value |
| --- | --- |
| ground | `#0A0D13` |
| surface | `#141A23` |
| surface-sunken | `#1B212B` |
| border | `#242C38` |
| border-hairline | `#1F2631` |
| accent | `#8AA6D8` |
| accent-text | `#A9C0E4` |
| accent-tint | `rgba(138,166,216,.14)` |
| text-primary | `#E9EEF6` |
| text-secondary | `#AAB6C6` |
| text-tertiary | `#78859A` |
| avatar-fill | `#28303C` |
| success | bg `rgba(45,168,110,.16)`, text `#5FCF97` |

**Typography.** Three families, all Google Fonts:

- **Barlow Condensed** — names, titles, headings, brand, nav brand. Weights 600, 700.
- **Barlow** — body, UI, labels, buttons. Weights 400, 500, 600, 700.
- **JetBrains Mono** — numerals and technical micro-labels (member counts, percent, "PRO
  NETWORK", captions). Weights 400–700.

| Role | Spec |
| --- | --- |
| Page title (Projects h1) | Barlow Condensed 600 / 46px / 1 |
| Section header (deck title) | Barlow Condensed 600 / 40px / 1 |
| Project title | Barlow Condensed 600 / 27px (mobile 26px) / 1.1 |
| Post headline | Barlow Condensed 600 / 25px / 1.28 (secondary post 23px / 1.3) |
| Card title / rail heading | Barlow Condensed 600 / 21px / 1.2 |
| Person name (feed) | Barlow Condensed 600 / 20px / 1.1 |
| Class card title | Barlow Condensed 600 / 19px / 1.2 |
| List item title | Barlow Condensed 600 / 16–17px |
| Body copy | Barlow 400 / 15.5px / 1.65 |
| Body copy (dense/mobile) | Barlow 400 / 15px / 1.6 |
| Comment body | Barlow 400 / 14.5px / 1.55 |
| Secondary / meta | Barlow 400 / 13.5px |
| Micro meta | Barlow 400 / 12.5px |
| Button label | Barlow 600 / 14px (small 13–13.5px), letter-spacing .01em |
| Section label (uppercase) | Barlow 600 / 13px, letter-spacing .06em, uppercase |
| Kicker (uppercase) | Barlow 600 / 12–13px, letter-spacing .16–.18em, uppercase |
| Chip / tag | Barlow 500–600 / 11–13px, uppercase variants at .08em |
| Numeric / mono | JetBrains Mono 400–700 / 9.5–13px |

**Radius.** 999px (pills, avatars, badges, progress), 16px (cards, mobile screens' cards),
14px (nested cards, comment bubbles), 12px (inputs, dropdowns, icon tiles), 11px (brand tile,
small icon tiles), 10px (action-bar targets), 6px (status/badge chips).

**Spacing.** 4 · 5 · 8 · 9 · 12 · 13 · 14 · 16 · 18 · 20 · 22 · 24 · 30 · 36 · 44px.
Card padding is 16–20px on desktop, 14–16px on mobile; column gap 24px; card stack gap 16px
(mobile 12px); page gutters 36px desktop / 12px mobile.

**Elevation.** `card` = `0 1px 3px rgba(18,24,33,.06), 0 8px 24px -14px rgba(18,24,33,.14)`;
dark `card` = `0 1px 3px rgba(0,0,0,.5)`. Featured project row adds a `0 0 0 1.5px` accent ring.
Overlapping avatars use `box-shadow: 0 0 0 2px <surface>` and `margin-left: -8px`.

**Fixed dimensions.** Desktop canvas 1440px, content 1248px, columns 264 / 616 / 344px, top bar
68px, roles panel 290px, search pill 286px. Mobile canvas 390 × 844px, tab bar 60px + 10px
home-indicator inset, class card 236px wide. Minimum mobile touch target 44px.

## Assets

- **Icons** — all inline SVG in the prototype, drawn to match **Lucide** at `stroke-width: 1.5`,
  round caps and joins, 24-unit viewBox. Use the real Lucide set in production: home, briefcase,
  graduation-cap, users, mail, bell, search, chevron-down, arrow-right, plus, star, bookmark,
  share, message-square, thumbs-up, check-circle, map-pin, clock, sliders, image, camera, user.
- **Photography** — none exists. Every image is an empty drag-and-drop `<image-slot>`
  placeholder with a caption describing the intended shot: class stills (scene study, fight for
  camera, self-tape lab), a wrap still ("Night Shift, day 6"), and production stills on the
  Projects rows. Aspect ratios: 16:9 for class and post images, 16:10 for project stills.
  Replace with real assets; keep the ratios.
- **Fonts** — Barlow, Barlow Condensed, JetBrains Mono from Google Fonts.
- **Content** — all names, productions, quotes and numbers are invented placeholder copy.

## Files

| File | What it is |
| --- | --- |
| `Action Pro Feed - Callboard (standalone).html` | **Start here.** Self-contained offline build — every screen, both themes, fonts and assets inlined. Open in a browser. |
| `Callboard.dc.html` | Editable source of the same design. Needs `support.js` and `image-slot.js` beside it (both included). |
| `support.js` | Runtime for the source file. Not part of the design. |
| `image-slot.js` | The drag-and-drop image placeholder element used for every photo. Not part of the design. |

Screen order in both files: Feed desktop light → Feed desktop dark → Projects desktop light →
Projects desktop dark → Feed mobile light → Feed mobile dark → Projects mobile light →
Projects mobile dark. Each screen carries a `data-screen-label` attribute naming it.
