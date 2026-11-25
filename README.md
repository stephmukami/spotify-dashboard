# Spotify Taste Graph

Log in with Spotify, and the app compares your top artists, tracks and genres with everyone else who has
signed up. It then draws a graph of the people whose taste is closest to yours. Click anyone on the graph
to see what you share.

**Stack:** React 19 + Vite (frontend), Vercel Functions (`/api`), Neon Postgres with Drizzle ORM.

## How it works

1. **Login.** The browser runs Spotify's Authorization Code + PKCE flow, so no client secret is needed. It
   sends the access token to `POST /api/session`. The server asks Spotify who the token belongs to, saves
   the user, and sets an httpOnly session cookie (a JWT valid for 30 days).
2. **Consent.** New users accept the terms and choose a visibility: `public`, `anonymous` or `hidden`.
3. **Sync.** `POST /api/sync` fetches the user's top 50 artists and tracks for all three Spotify time
   ranges, saves them, and recalculates how similar this user is to everyone else.
4. **Graph.** `GET /api/graph` returns your closest matches and their closest matches.
   `GET /api/compare?id=…` explains a single match.

The Spotify access token expires after about an hour. The browser keeps the refresh token and quietly gets
a new access token when it needs one, so returning users can re-sync without logging in to Spotify again.

### Matching

A match score is a weighted mix of three overlaps: shared artists (50%), shared genres (30%) and shared
tracks (20%). Higher-ranked items count for more. Medium-term listening counts fully, long-term at 0.75
and short-term at 0.5. Pairs scoring below 0.15 are not stored. All the constants live in
[`shared/matching.ts`](shared/matching.ts), and the `/how-it-works` page reads its numbers from there.

## Project layout

```
api/                 Vercel Functions, one file per route
  session.ts         GET who am I / POST log in / DELETE log out
  consent.ts         POST accept terms + visibility
  sync.ts            POST pull Spotify data and recompute matches
  graph.ts           GET your match graph
  compare.ts         GET why you match someone
  me.ts              GET taste summary / PATCH visibility / DELETE account
  _lib/              auth (JWT cookie), db, schema, Spotify client, similarity
shared/              Types and matching constants used by both the API and the UI
src/
  lib/spotifyAuth.ts PKCE login and token refresh
  lib/api.ts         Typed fetch wrapper for /api
  pages/             Landing, Callback, Terms, Sync, Graph, HowItWorks, Settings
scripts/seed.ts      Creates demo users so the graph isn't empty
```

## Setup

### 1. Spotify app

Create an app at <https://developer.spotify.com/dashboard>, then:

- Add these Redirect URIs:
  - `http://127.0.0.1:3000/callback` (local)
  - `https://<your-domain>/callback` (production)
- Put the app's Client ID in `CLIENT_ID` in [`src/lib/spotifyAuth.ts`](src/lib/spotifyAuth.ts).
- While the app is in **Development mode**, only users listed under *User Management* can log in
  (25 users at most).

The app only asks for the `user-top-read` scope.

### 2. Database and environment

```bash
npm install
vercel link                      # connect this folder to the Vercel project
vercel env pull .env.local       # or: cp .env.example .env.local and fill it in
npm run db:push                  # create the tables in Neon
```

See [`.env.example`](.env.example) for the required variables:

| Variable         | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `DATABASE_URL`   | Neon connection string. `DB_DATABASE_URL` also works.      |
| `SESSION_SECRET` | Signs the session cookie. At least 32 random characters.   |

### 3. Run locally

```bash
npm run dev:full     # app + /api on http://127.0.0.1:3000
```

Use `127.0.0.1`, not `localhost`. It has to match the registered Redirect URI. `npm run dev` runs only
the Vite frontend, without the API.

## Scripts

| Command              | What it does                                            |
| -------------------- | ------------------------------------------------------- |
| `npm run dev:full`   | Run the full app locally through `vercel dev`           |
| `npm run build`      | Type-check and build the frontend                       |
| `npm run lint`       | ESLint                                                  |
| `npm test`           | Unit tests (Vitest)                                     |
| `npm run db:push`    | Apply `api/_lib/schema.ts` to the database              |
| `npm run seed`       | Add 50 synthetic demo listeners (run after a real sync) |
| `npm run seed:clear` | Remove the demo listeners                               |

## Deploying

Push to the connected Git repo, or run `vercel --prod`. Before the first deploy:

- Set `DATABASE_URL` (or keep the integration's `DB_DATABASE_URL`) and `SESSION_SECRET` for Production
  and Preview. Environment changes only take effect on a new deployment.
- Run `npm run db:push` against the production database.
- If Vercel Deployment Protection is on, preview URLs need a Vercel login. Share the production domain
  instead.

## Troubleshooting

- **`/api/session` returns 500.** A required environment variable is missing on that deployment. Check
  `vercel env ls`, then `vercel logs`.
- **"Login session not found".** The login was started on a different origin from the one Spotify
  redirected back to. Use the same host throughout (for example, `127.0.0.1` both times).
- **"INVALID_CLIENT: Invalid redirect URI".** The callback URL isn't registered in the Spotify dashboard.
- **A user can't log in in Development mode.** Add them under *User Management* in the Spotify dashboard.
