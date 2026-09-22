# Individual Student Attendance — Next.js + MongoDB

A three-role attendance system: students log in and fill in their
own daily sign-in, teachers review and sign off the students in
their courses, and admins see attendance across every course and
manage accounts. Backed by MongoDB (free-tier friendly, no Redis).

## Roles

| Role    | Can do |
|---------|--------|
| Student | Log in, fill in their own daily times/signature/absence, view & download their own sheet as Word/PDF. Cannot touch the staff-signature column or the approval block. |
| Teacher | Log in, see the courses they're assigned to, open any enrolled student's sheet, fill in the "Staff sig." column per day, and sign off the sheet (name/signature/comments). Cannot edit the student's own fields. |
| Admin   | Everything: create courses, create teacher and student accounts, assign teachers to courses, edit any field on any sheet (for corrections), and see attendance totals across every course on one dashboard. |

Every one of those boundaries is enforced **in the API routes**, not
just hidden in the UI — a student's browser can't be tricked into
writing to the staff-signature field, for example (see `app/api/sheets/**/route.js`).

## Getting started

### 1. Set up MongoDB

Use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) —
the free M0 tier costs nothing and doesn't ask for a card. Create a
cluster, create a database user, and get your connection string
(Atlas UI: **Connect → Drivers**). It looks like:

```
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/attendance?retryWrites=true&w=majority
```

The path segment after the host (`attendance` above) is the database
name — pick anything; it's created automatically on first write.

### 2. Configure environment variables

Create `.env.local`:

```
MONGODB_URI="mongodb+srv://..."
AUTH_SECRET="a long random string — e.g. `openssl rand -base64 32`"
```

`AUTH_SECRET` signs the login session cookie. Without a real one set,
the app falls back to an insecure default and prints a warning —
fine for a first local test, never for anything real.

### 3. Install and create the first admin account

```bash
npm install
MONGODB_URI="mongodb+srv://..." npm run create-admin
```

This prompts for a name/username/password and creates the one admin
account. Every other account — teachers and students — is created
afterward from the admin UI (`/admin/users` for teachers,
`/admin/courses/[course]` for students), since there's deliberately
no public sign-up page.

### 4. Run it

```bash
npm run dev
```

Open http://localhost:3000, sign in with the admin account, create a
course, add a teacher, add a student, and you're set.

```bash
npm run build && npm start
```
for a production build.

## Deploying (e.g. to Vercel)

1. Push this project to a Git repo and import it into Vercel (or any
   Node host — nothing here needs a persistent filesystem, since all
   state lives in MongoDB).
2. Set `MONGODB_URI` and `AUTH_SECRET` in the project's environment
   variables.
3. Run the bootstrap script once, pointed at the same
   `MONGODB_URI` (from your own machine, or Vercel's CLI:
   `vercel env pull` then `npm run create-admin`), to create the
   first admin account.
4. Deploy.

## Data model

Three MongoDB collections:

- **`users`** — one document per account. `role` is `"admin"`,
  `"teacher"`, or `"student"`. Students have a single `courseId`;
  teachers have a `courseIds` array (a teacher can be assigned to
  more than one course). Passwords are stored as bcrypt hashes only
  — never plaintext.
- **`courses`** — `{ name, code, duration, teacherIds }`.
- **`sheets`** — one per student, keyed by the student's own `_id`
  (so there's always exactly one active sheet per student — no
  separate lookup needed). Holds `month`/`year`, the `rows` map
  (keyed by ISO date), and the approval block. Each row holds the
  student's fields (`startTime`, `lunchOut`, `lunchIn`, `endTime`,
  `studentSig`, `absent`) and the staff field (`staffSig`)
  separately, which is what makes the field-level permission split
  straightforward to enforce.

## Word (.docx) export

`/api/sheets/me/docx` (student) and `/api/sheets/[studentId]/docx`
(teacher/admin, permission-checked) build the Word document
server-side, from whatever's currently saved, on every request —
there's no stored file to go stale. See `lib/docx.js`.

## Security notes for a real deployment

This covers the essentials — hashed passwords, signed httpOnly
session cookies, server-side field-level authorization — but a few
things are intentionally left out to keep the starter project
readable, and worth adding before this holds anything sensitive:

- **Rate limiting on `/api/auth/login`** — nothing currently stops
  repeated password guesses. A simple fixed-window limiter (or a
  service like Upstash's rate-limit package) in front of that route
  is the standard fix.
- **Password reset** — there's no self-service flow; an admin resets
  a password via `PUT /api/users/[id]` with a new `password` field
  (the student-creation route, `POST /api/courses/[id]/students`,
  works the same way if you'd rather build a small UI for it).
- **Audit log** — `sheets` records `signedBy`/`signedAt`, but there's
  no history of *who* edited what before that; consider appending to
  a `history` array on write if that matters for your use case.
- **Force a real `AUTH_SECRET` at boot** — right now a missing one
  just logs a warning in production; failing hard (`throw` instead
  of `console.warn`) is safer once this is live.

## Project layout

```
lib/
  mongodb.js       lazy, cached MongoDB connection
  auth.js          JWT session signing/verification, password hashing (edge + node safe)
  session.js        server-only session helpers for API routes (requireSession)
  dateUtils.js       weekday generation, validation, completion/status helpers
  docx.js            builds the .docx document
  sheetView.js       joins a sheet with its student's & course's names

middleware.js        page-level role guard (redirects; API routes still self-check)

app/
  login/              sign-in page
  api/auth/            login, logout, me
  api/courses/         course CRUD + per-course student list/create
  api/users/            teacher/admin account management
  api/sheets/           me/** for students; [studentId]/** for teacher/admin; sign action
  api/admin/overview/   aggregate stats for the admin dashboard
  student/              student's own form + printable sheet
  teacher/               course list -> student list -> sign-off page
  admin/                 overview, course management, staff management, full-access sheet editor

components/
  Nav.js, Toast.js, AttendanceTable.js, SheetDocument.js

scripts/
  create-admin.mjs      one-time bootstrap for the first admin account
```
