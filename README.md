# GSB Alumni Day session board

A live audience-contribution board for the Steiger Bean session on the six task
types generative AI does well. Attendees submit one task from their own company
on a phone. Their submissions populate a board projected at the front of the
room.

Three screens, one database:

| Screen | Path | Built for |
|---|---|---|
| Submit | `/board` | Phones. One thumb, no account. Three tasks opens the full board |
| Matrix | `/board/matrix` | The projector. The slide, live and turning itself over |
| Board | `/board/live` | The projector, six scrolling columns |
| Dashboard | `/board/admin` | Your laptop. Every answer, searchable, with moderation |

The submit screen is the only one tuned for a small screen. The dashboard is
desktop first: it reflows down to phone width without breaking, but it is laid
out for a laptop.

`/` redirects to `/board`, so the short link on your slide can be the bare
domain.

---

## Deploy

### 1. Push this repository to GitHub, then import it on Vercel

Framework preset is Next.js. Nothing to change in the build settings.

### 2. Attach a Postgres database

In the Vercel project, open **Storage**, create a **Postgres** database (this is
Neon under the hood) and connect it to the project. Vercel injects `POSTGRES_URL`
automatically, so there is nothing to paste.

If you would rather use a Neon database you already have, copy its **pooled**
connection string into an environment variable named `POSTGRES_URL`. The pooled
one is the host with `-pooler` in it. The direct string works but will run out of
connections under a room of sixty phones.

### 3. Set the admin password

Project **Settings**, then **Environment Variables**:

| Name | Required | What it is |
|---|---|---|
| `POSTGRES_URL` | Yes | Pooled Postgres connection string. Vercel Postgres and Neon both inject this when the store is linked. `DATABASE_URL` is accepted as a fallback |
| `ADMIN_PASSWORD` | Yes | The password for the dashboard at `/board/admin`. Yours alone. Pick something you can type on stage without looking |
| `ROOM_PASSCODE` | No | Overrides the room code. **Defaults to `GSB26`** with nothing set, so there is one less variable to get wrong. Set it to `open` to remove the gate |

Set them for **Production**, **Preview** and **Development**, then redeploy.

### 4. Confirm the database is live

Open `https://your-domain/api/health`. You want:

```json
{
  "ok": true,
  "schema": "ready",
  "visible": 0,
  "total": 0,
  "environment": {
    "vercelEnv": "production",
    "adminPasswordSet": true,
    "databaseVar": "POSTGRES_URL",
    "databaseVarsSeen": ["DATABASE_URL", "POSTGRES_URL"]
  }
}
```

The table, the bucket enum and the indexes are created on the first request, so
there is no migration step.

**If it returns `ok: false`, read the `environment` block.** It reports the
deployment's own settings, never a secret value.

`databaseVars` lists every candidate variable and why it was accepted or
rejected, by scheme and length. The value itself never leaves the server,
because it carries the password.

| What you see | What it means |
|---|---|
| `databaseVars: []` | This deployment cannot see any database variable. The store is not connected to the project, or it is connected to a different environment than the one you are hitting |
| `POSTGRES_URL -> set but empty` | The variable exists with no value. Usually a variable created by hand and never filled in, which also shadows the one the integration would have supplied |
| `POSTGRES_URL -> not a postgres url, scheme is "https"` | Something other than a connection string is in there, often a dashboard link |
| `POSTGRES_URL -> not a url, no scheme found` | Not a connection string at all. Check for a truncated paste |
| `vercelEnv: "preview"` when you expected production | You are on a preview URL. Either set the variables for Preview too, or test the production domain |
| `adminPasswordSet: false` | `ADMIN_PASSWORD` is missing for this environment |
| Everything `usable` but `ok` is still false | The URL is well formed but the connection failed. The `error` line carries the reason |

Wrapping quotes and a leading `psql ` are stripped automatically, so a value
copied out of a `.env` line or a dashboard's ready-to-run command still works.

Environment variables only take effect on a **new build**. After changing any of
them, go to **Deployments**, open the newest one, and use **Redeploy**. Reloading
the page is not enough.

The app accepts `POSTGRES_URL`, `DATABASE_URL`, `POSTGRES_PRISMA_URL`,
`NEON_DATABASE_URL`, `POSTGRES_URL_NON_POOLING` or `DATABASE_URL_UNPOOLED`, and
falls back to any other variable whose value is a real Postgres URL. Hosts rename
these, and a rename should not take the board down.

---

## Run of show

**The night before**

1. Open `/api/health` and confirm `ok: true`
2. Open `/board/admin`, sign in, click **Seed three examples** so the board is
   never empty when the room walks in
3. Put the short URL on the slide that precedes the exercise

**In the room**

1. Open `/board/live` on the projected screen. Full screen the browser. There is
   no cursor and no chrome, so nothing on the page needs hiding
2. Keep `/board/admin` open on your laptop screen, not the projected one
3. Once real submissions start arriving, click **Hide the examples** so the
   seeded three stop competing with the room's own work
4. If anything inappropriate appears, click **Hide** on that row. It leaves the
   projected board within about half a second, with no reload and no touching
   the board machine

**Afterwards**

Click **Export CSV** on the dashboard. You get every entry including hidden
ones, with the raw and display-cased function label, the bucket, the timestamp
and the anonymous submitter id.

---

## Two doors, two keys

| Door | Key | Who holds it |
|---|---|---|
| `/board` and `/board/live` | `GSB26` | The room. Carried by the QR code, so nobody types it |
| `/board/admin` | `ADMIN_PASSWORD` | You. Deliberately outside the room gate, so it stays reachable if you change the room code mid session |

**How the room code reaches people.** Point the QR at
`https://your-domain/board?code=GSB26`. The first request swaps the code for a
cookie, strips it from the address bar so it cannot be screenshotted off a
neighbour's phone, and lands on the submit screen. The cookie lasts twelve
hours. Anyone who arrives without it sees a single field and can type the code
off your slide. Spaces, dashes and case are ignored, so `gsb 26` works.

The gate covers the data too: `/api/entries` returns 401 without the cookie, so
the board is not readable by URL alone.

The code is `GSB26` out of the box. Set `ROOM_PASSCODE` to change it, or to
`open` to remove the gate.

---

## What an attendee does

One page, phone first, nothing to install.

1. Scan the QR. No typing, no account, no email
2. Pick a task type from a dropdown, pick a function from a dropdown, write a few words.
   The task field asks them a question built from those two choices, so
   RECONCILE plus Finance reads "In Finance, which two versions disagree, and
   who finds where?"
3. Repeat until three are in
4. Then a **Show the whole board** button appears. It opens the full board and
   keeps filling as other people submit, with each new card animating in

A panel at the top shows the three slots from the first screen: filled ones
carry a tick and the words they wrote, the next one is outlined and says "Add
this one next". Nobody has to guess how many are left or whether the last one
landed.

**Nobody sees anyone else's words before their own three are in.** The teaser is
a count and nothing more: how many tasks are in, and how many people put them
there. No sample entries, no previews. This keeps the reveal worth waiting for
and stops the first few submissions anchoring everyone who follows.

**Both pickers are dropdowns.** Six stacked cards for the task type pushed the
rest of the form off a phone screen, so the task type now uses the same control
as the function, with the one line explanation shown inside each option and
again once a choice is made. The function list is deliberately short at
eighteen broad areas, with "Add your own" for everything else.

**Each task is short.** Ten characters is the floor, so "board pack prep" is a
valid entry. The copy says "a few words each is plenty" for a reason: three
quick lines beats one careful paragraph for this exercise.

**Stuck?** A "shuffle a starting point" button picks a task type and a function
at random. It is a prompt, not an answer: they still write the task, and they
can change either choice. It exists because a senior person staring at six
unfamiliar categories in a room full of peers will sometimes freeze, and a
random starting point is easier to argue with than a blank form.

`REQUIRED_SUBMISSIONS` in `src/lib/entries-constants.ts` is the one number to
change if three turns out to be too many for the room.

---

## The dashboard

`/board/admin`, behind the single password. It refreshes itself every four
seconds, so leaving it open on your laptop is enough.

**Four tiles across the top**

On the board, phones (distinct people who submitted), functions (distinct areas
represented), and hidden.

**The coverage matrix**

The slide, live, with the words in it. Six task types down the side, every
function the room has actually named across the top, and inside each cell the
tasks people wrote out in full.

The grid grows as the room fills it. New functions add columns, each answer
makes its cell taller, and a note fades in where it lands. An empty cell stays a
small outlined marker rather than stretching to match its tallest neighbour, so
the gaps read as gaps and not as holes.

The filled cells are not the point. A caption under the grid reads "24 of 108
cells filled. Nobody has looked at the rest," which is the line the exercise
exists to earn.

Row and column labels are filters, each carrying its own count. Clicking one
narrows the table underneath, and a chip above the table clears it.

The six task types are frozen to the left edge, so sliding the grid sideways
never leaves you looking at unlabelled rows.

Examples carry a dashed edge and quieter text, so a prop never reads as
somebody's answer.

**Seeding examples**

Twenty four worked examples ship with the app, four per task type, spread
across functions so the grid shows breadth rather than a stripe. **Add 6
examples** puts in the next batch and can be clicked repeatedly to top up if the
room is slow to start; it never duplicates, and says how many of the twenty four
are showing. **Remove the examples** deletes them outright rather than hiding
them, so they never pollute the CSV.

The library lives in `src/lib/seed-examples.ts` if you want to swap in your
own.

**The entries table**

Underneath the matrix, rows sit under the six task types in the order the
session teaches them, each group headed by the type, its one line explanation
and a count. Columns are function, the task, the time it arrived, and the hide
toggle. Only the tables scroll sideways on a narrow screen; the page never
does.

**Filter the answers**

| Control | What it does |
|---|---|
| Search | Matches the task text, the function, or the task type |
| The matrix | Tap a cell, a row label or a column header to filter the table. Tap again, or the chip above the table, to clear |
| Hidden shown / Hidden out | Keeps hidden entries in or out of the list |

The count line under the filters says how many answers you are looking at and
how many exist in total.

**Moderate**

Every row has a **Hide** toggle. Hiding drops the entry off the projected board
within about half a second, with no reload and without touching the board
machine. Hidden rows stay in the list, dimmed, with a **Show** button, and they
stay in the database and in the CSV.

---

## Projecting the matrix

Two ways in. On the dashboard the matrix panel carries a **Full screen**
button: it fills the viewport, switches to the projected layout and starts
rotating, and **Exit full screen** or Escape brings it back. Use that when you
are presenting off the same laptop screen you are working on.

`/board/matrix` is the same grid as its own page, for a second screen. Full bleed, no cursor, no chrome, so you
open it on the projected screen and press full screen in the browser. It sits
behind the same room code as everything else, so the QR link pattern works:
`/board/matrix?code=GSB26`.

Nothing is on screen but the grid. The title and the way back out are hidden
until you move the pointer to the top edge, where they slide down and stay
while you are up there. The cell count line is dropped too: it reads well on a
laptop and is chatter on a wall. Both are still on the dashboard.

Six task types always fill the height, whatever is in them. A crowded cell
clamps its answer to four lines rather than stealing the row, because losing
the last three task types off the bottom of the screen loses the one structure
the exercise is built on.

**It turns itself over every forty five seconds.** Not every function fits
across a screen, and nobody is going to walk over and scroll a projector, so
the grid pages through the columns and through the answers inside a crowded
cell on the same beat. A thin gold line sweeps across the bottom as a countdown,
so a change never reads as a glitch, and the corner shows which page of how
many.

| Flag | Default | What it does |
|---|---|---|
| `?columns=5` | `4` | How many functions are on screen at once. Clamped to 2 to 10 |
| `?notes=2` | `1` | How many answers show inside one cell. Clamped to 1 to 6 |
| `?rotate=30` | `45` | Seconds between turns. `0` holds the grid still |
| `?transport=poll` | off | Skips the live stream and polls instead |

They combine: `/board/matrix?code=GSB26&columns=5&rotate=30`.

---

## Tuning the board screen in the room

Three URL flags on `/board/live`, so you never have to redeploy from a hotel
room:

| Flag | Default | What it does |
|---|---|---|
| `?scale=1.2` | `1` | Multiplies every size on the board. Raise it for a smaller screen or a deeper room, lower it to fit more cards. Clamped to 0.7 to 2 |
| `?speed=35` | `20` | Scroll loop speed in pixels per second for overflowing columns. Clamped to 4 to 120 |
| `?transport=poll` | off | Skips the live stream and polls every two seconds instead. A safety valve if the venue network does something strange to long-lived connections |

They combine: `/board/live?scale=1.15&speed=30`.

---

## How the live updates work

The board and the phones both subscribe to `/api/entries/stream`, a Server-Sent
Events endpoint that pushes a new frame whenever the visible set of entries
changes. Three things make it survive a real room:

1. **The stream retires itself every 45 seconds** and the browser reconnects.
   Platform function limits can cut a long-lived response mid-frame, so the
   stream hands over cleanly before that can happen
2. **A watchdog in the browser** notices when no frame has arrived for 20
   seconds and rebuilds the connection. This is what a closed laptop lid looks
   like from the page's point of view
3. **Automatic fallback to polling.** Two clean connection failures and the page
   stops fighting and polls every two seconds instead. The board keeps updating
   either way

Waking, reconnecting to wifi, and switching back to the browser tab all trigger
an immediate pull, so the board is correct within a second of the laptop waking.

A poll sends the version it already holds. When nothing has changed the reply is
49 bytes instead of the whole board.

---

## Local development

```bash
npm install
cp .env.example .env.local     # fill in POSTGRES_URL and ADMIN_PASSWORD
npm run dev
```

Any Postgres works, including a local one. The schema is created on first
request.

```bash
npm run typecheck      # tsc, no emit
npm run build          # production build
npm start              # serve the production build
```

**Testing from a real phone on the same wifi.** Run `npm run dev -- -H 0.0.0.0`
and open `http://<your-laptop-ip>:3000/board` on the phone. The visitor cookie is
marked Secure only when the request actually arrives over https, so plain http on
a laptop works rather than silently dropping the cookie and breaking submission.

---

## Data model

One table, created automatically:

```sql
entries (
  id                  BIGSERIAL PRIMARY KEY,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  bucket              bucket_type NOT NULL,   -- the six-value enum
  function_label      TEXT        NOT NULL,
  task                TEXT        NOT NULL,
  submitter_cookie_id TEXT        NOT NULL,
  hidden              BOOLEAN     NOT NULL DEFAULT FALSE
)
```

`bucket_type` is a Postgres enum: `MONITOR`, `SYNTHESIZE`, `RESTRUCTURE`,
`RECONCILE`, `PRESSURE_TEST`, `EVALUATE`. The underscore in `PRESSURE_TEST` is
storage only. It displays as `PRESSURE TEST` everywhere.

Nothing is ever deleted. Hiding sets `hidden = true`, which drops the entry from
the board and from the CSV's visible count while keeping the row.

### Identity and limits

- Anonymous identity is a single httpOnly cookie set on first visit. No account,
  no email, no name is collected or displayed
- Six submissions per cookie per hour. The seventh gets a plain explanation
- A task under 10 characters or over 140 is rejected, client side and again on
  the server

### The function field

The combobox is preloaded with 33 options in alphabetical order plus **Add your
own**. Custom values are stored exactly as typed. Display title-cases them while
keeping known acronyms upper (IT, HR, M&A and so on), and the original is always
what lands in the CSV.

If a custom value is close to an existing option, the screen suggests the
existing one and offers both buttons. Typing `financee` offers **Use Finance**
next to **Keep financee**. It never silently rewrites what someone wrote.

---

## Two surfaces, one brand

The screens split by who is reading them, and they are designed against
different constraints.

**The room reads paper.** `/board` and `/unlock` sit on the brand ivory with
deep burgundy ink. The audience is older, on their own phones, in a lit hall.
Light-on-dark is the harder read for an ageing eye: the pupil opens wider, so
any uncorrected astigmatism smears pale type into its own background. Paper
avoids that, and it beats screen glare in a bright room.

**The dashboard reads paper too.** `/board/admin` is the presenter's laptop
and follows the same rules: real weights, AAA contrast, no state told by
colour alone. It is wider and denser than a phone, not dimmer.

**The projected screens keep the dark ground.** `/board/live` and
`/board/matrix` stay burgundy and champagne, as the slide deck is. A projector
throws light, so a dark field is right there for exactly the reason paper is
right on a phone. They opt in with `data-surface="dark"`, which re-points the
semantic tokens; the dashboard's matrix flips to dark the moment it is thrown
full screen.

### The gold problem

The champagne `#C9A96E` is the constraint the light surface is built around.

| Pairing | Ratio | Verdict |
| --- | --- | --- |
| Gold on burgundy `#2E0F15` | 7.85:1 | AAA — carries text on the dark screens |
| Gold on ivory `#FAF8F5` | **2.11:1** | Fails every WCAG threshold, text and borders alike |
| Burgundy on gold | 7.85:1 | AAA — so gold can be a *fill* under dark type |

So on the light surface gold is never text and never a control boundary. It is
a rule, a fill and a marker: the step numbers, the completed-task ticks, the
accent bar down the side of a panel. Labels move to a deepened bronze of the
same family, `#60441A`, which is AAA.

### The light palette

Every value clears 7:1 (WCAG AAA) against the *darkest* light surface it can
land on, not just against the page, so a label keeps its rating wherever it is
set down.

| Token | Value | Role |
| --- | --- | --- |
| `--page` | `#FAF8F5` | Brand ivory. Warm paper, not white |
| `--surface` | `#FFFFFF` | A field you type into |
| `--surface-sunk` | `#F2ECE5` | A panel set into the page |
| `--ink` | `#2E0F15` | Body copy — 16.6:1 |
| `--ink-soft` | `#683E3A` | Secondary — 7.2:1 worst case |
| `--accent-ink` | `#60441A` | The deepened gold, for labels — 7.2:1 worst case |
| `--accent` | `#C9A96E` | Fills, rules and markers only |
| `--line` | `#8A6A46` | A real control boundary — 4.7:1, clears WCAG 1.4.11 |

### What else changed for legibility

- **Nothing under 16px**, and every size is a `rem`, so a phone set to large
  text actually gets large text.
- **Body weight 400, labels 600.** Montserrat Light was a hairline at phone
  sizes and was the single biggest legibility cost in the first build.
- **Uppercase only for eyebrow labels of three words or fewer.** Capitals strip
  the word-shape a slower reader leans on, so sentences and buttons are in
  sentence case now. The six task names stay in capitals — they are the
  session's vocabulary and they match the slide — but at 18px/600 rather than
  14px/300 with 0.2em of tracking.
- **Tracking cut** from 0.2em to 0.08em on labels, and from 0.04em to 0.01em on
  body. Montserrat is already a wide face; tracking on top pushes letters out
  of their words.
- **Every tap target is 3.5rem or taller**, above both the Apple 44px and the
  Material 48px floors, with 0.75rem of air around it.
- **Pinch zoom is uncapped.** The old `maximumScale: 5` fails WCAG 1.4.4 and it
  is the first thing somebody reaches for when type is still too small.
- **The composed question moved out of the placeholder** and into real text
  above the field. A placeholder disappears on the first keystroke, which is
  the wrong home for the one line that helps people think.
- **No state is told by colour alone.** Selection is a tick and a weight change,
  errors are a warning glyph plus a heavier border and are announced with
  `role="alert"`, and the live indicator is a word as well as a dot.
- **`prefers-contrast: more` and `prefers-reduced-motion` are both honoured.**

---

## The matrix: fitting, and paging

Two problems the grid used to have, and what replaced them.

### Text is fitted to its cell, not cut at a line count

The old grid clamped a task at four lines and hid the rest, which is the worst
possible failure for a grid whose whole job is showing what people wrote. Now
every note's slot has a definite height and the text is *shrunk* until all of
it fits.

Both layouts are CSS Grid with definite row heights — that is what makes a
"fit" possible at all, since a table row treats height as a minimum and grows.
The markup stays a `<table>`, because that is what this data is, and
`display: contents` hands the cells to the grid.

`FitText` binary-searches whole pixels between a floor and a ceiling, five
reflows for a range this size, re-running only when the text or the box
actually changes (a `ResizeObserver`, coalesced to one measurement a frame).

| Surface | Floor | Ceiling | Why |
| --- | --- | --- | --- |
| Dashboard | 11px | 16px | Desk distance, dense grid, and the full table sits below it |
| Projection | height ÷ 77 | height ÷ 45 | 14–24px at 1080p, and the same *proportions* at 720p |

The projected bounds scale with the screen because a projected image is
stretched to the wall: what matters is the share of the picture a line takes,
not its pixel count. Fixed bounds tuned for 1080p clipped every note on a 720p
projector. The chrome around the grid scales the same way, in `vw`/`vh`.

**This is the one place the 16px floor does not apply**, and it is deliberate.
The room's own screens keep it. This is the presenter's laptop and a projected
wall, where the alternative to shrinking a long task is cutting it in half.

### Rows are as tall as their contents

Each row is built from however many slots its busiest visible cell needs, so a
row nobody has answered collapses to one slot instead of six full-height boxes
of nothing. The projection keeps six equal rows — the structure is the point on
a wall, and it has a fixed height to divide up.

### Arrows page sideways

Nothing scrolls horizontally any more. A column is either on the page whole or
not at all.

- **`‹` and `›`** in the panel header, with `1–4 of 9` between them. They wrap
  at both ends.
- **Left and right arrow keys**, when the focus is inside the panel. They are
  ignored while you are typing in the search box.
- On the projection the same arrows work, and a manual turn **restarts the
  rotation timer** so a click is not overtaken a second later. The countdown
  bar along the bottom restarts with it.
- Auto-rotation only advances the page; a full lap of the columns is what turns
  a crowded cell over to its next answer.

Defaults: four columns a page. Two answers a cell on the dashboard (the rest
counted as `+N more`, with the full table underneath), one on the projection so
it can rotate. `?columns=` and `?notes=` still tune the projected route.

---

## Known tradeoffs

Worth knowing before you stand in front of the room.

**Six columns at 1080p is genuinely tight.** A 140-character task at 24px in a
293px column runs to seven lines. Most submissions are shorter, and columns
scroll, but a board full of maximum-length tasks will show two or three cards per
column at a time. `?scale=0.85` fits noticeably more if that happens.

**The full-list gate is a conversation device, not security.** The submit screen
withholds the full board until someone submits, but the same data is on the
projected screen and `/api/entries?mode=live` returns it to anyone who asks. That
is deliberate. Locking it properly would mean an account, which is the one thing
the room must not need.

**The rate limit is per cookie.** Clearing cookies or opening a private window
resets it. For a room of alumni that is the right tradeoff against blocking two
people who share a conference NAT address.

**Long columns cycle in at most 150 seconds.** With 300 entries a column holds
50 cards, so the loop moves at roughly 70 pixels per second, which is faster than
the drift you see at 60 entries. Use `?speed=` if you want it slower and do not
mind waiting longer to see the bottom.

---

## Verified before shipping

Exercised in a real browser against a real Postgres:

- Submit works one-thumbed at iPhone 13 viewport, first tap to confirmation in
  well under 30 seconds
- The board picks up a new submission in under a second, no refresh
- Nothing breaks at zero entries, 60 entries, or 300 entries, with no horizontal
  overflow and no console errors at any size
- Hiding an entry removes it from the board in about half a second, no reload
- The board recovers from an offline period and picks up new entries afterwards
- The seventh submission from one cookie inside an hour is refused
- The CSV exports every row, header included, and quotes cells safely
- Seeding twice does not duplicate the examples
- Dashboard search, task-type chips and the hidden toggle each narrow the list
  correctly, and the page has no horizontal overflow down to 430px

Re-verified after the accessibility pass, in Chromium at 375x667 and 390x844,
auditing every rendered text node against its real computed background:

- **Zero** contrast failures at WCAG AA, and zero at AAA, on `/unlock`, on
  `/board`, with the pickers open, and on the revealed board
- **Zero** text under 16px and **zero** tap targets under 44px on any of them
- Tab reaches every control in order and each one shows a 3px focus ring
- The pickers open on Enter and choose on Arrow plus Enter
- The composed question is grammatical with neither choice made, with the task
  type alone, and with both
- Three submissions fill the three slots and unlock the board
- `/board/live` and `/board/matrix` still render on the dark ground, unchanged

Re-verified after the dashboard pass, with a maximum-length task seeded into a
crowded cell:

- **Zero** clipped notes on the dashboard at 1440x1000 and 1100x900, and on the
  projection at 1920x1080 and 1280x720 — measured as content height against box
  height for every note on screen, not by eye
- Notes land at 13–16px on the dashboard and 12–24px on the projection,
  shrinking only as far as the text needs
- **Zero** contrast failures at AA and at AAA on the dashboard and its gate,
  and **zero** tap targets under 44px, matrix filter headings included
- Paging wraps at both ends, by button and by arrow key, and the arrow keys stay
  out of the way while the search box has focus
- The last page shows a single function at its normal width, not stretched
- Heading filters, full screen, Escape back out, and the attendee flow all still
  work, with no console errors
