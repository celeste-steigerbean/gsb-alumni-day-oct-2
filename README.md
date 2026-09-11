# GSB Alumni Day session board

A live audience-contribution board for the Steiger Bean session on the six task
types generative AI does well. Attendees submit one task from their own company
on a phone. Their submissions populate a board projected at the front of the
room.

Three screens, one database:

| Screen | Path | Built for |
|---|---|---|
| Submit | `/board` | Phones. One thumb, two taps, no account |
| Board | `/board/live` | The projector, 1920x1080, read at fifteen feet |
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
| `ADMIN_PASSWORD` | Yes | The password for `/board/admin`. Pick something you can type on stage without looking |

Set both for **Production**, **Preview** and **Development**, then redeploy.

### 4. Confirm the database is live

Open `https://your-domain/api/health`. You want:

```json
{ "ok": true, "schema": "ready", "visible": 0, "total": 0 }
```

The table, the bucket enum and the indexes are created on the first request, so
there is no migration step. If this returns `ok: false`, the message names the
problem, and it is almost always a missing or non-pooled `POSTGRES_URL`.

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

## The dashboard

`/board/admin`, behind the single password. It refreshes itself every four
seconds, so leaving it open on your laptop is enough.

**Four tiles across the top**

On the board, phones (distinct people who submitted), functions (distinct areas
represented), and hidden.

**Two breakdowns**

*Where the room landed* counts the six task types. *Busiest functions* ranks the
top eight areas. Both are single-series magnitude bars in one colour with the
number labelled directly, so there is nothing to decode. When two task types tie
for the lead, the heading says nothing rather than picking one.

**Filter the answers**

| Control | What it does |
|---|---|
| Search | Matches the task text, the function, or the task type |
| Task type chips | Click to filter to one type, click again to clear. Each chip carries its own count |
| Hidden shown / Hidden out | Keeps hidden entries in or out of the list |

The count line under the filters says how many answers you are looking at and
how many exist in total.

**Moderate**

Every row has a **Hide** toggle. Hiding drops the entry off the projected board
within about half a second, with no reload and without touching the board
machine. Hidden rows stay in the list, dimmed, with a **Show** button, and they
stay in the database and in the CSV.

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
