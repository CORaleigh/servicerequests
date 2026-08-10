# Facilities & Operations — Online Service Request Form

Public web form that lets City of Raleigh residents and staff report non-emergency
maintenance problems at PRCR facilities. Submissions create service requests
directly in **Cityworks**, located and routed using **ArcGIS** feature services.

Built and maintained by the City of Raleigh GIS division.

---

## Stack

| | |
|---|---|
| Frontend | React 18, Bootstrap 5, Bootstrap Icons |
| Build | Vite 5 |
| Backend | None of its own — Cityworks AMS REST API + ArcGIS MapServer queries |
| Auth broker | `token.ashx` (ASP.NET handler) in production, Vite middleware in dev |
| Host | IIS 10 on `cityworks.raleighnc.gov`, served from `/servicerequests/` |

## Layout

```
index.html                  Vite entry
src/
  main.jsx                  React root
  App.jsx                   All application state and the submit flow
  api/cityworks.js          Cityworks AMS calls (Problems, QA, Create, Search, ById)
  api/gis.js                ArcGIS queries — facility points, park districts
  lib/format.js             Shared timestamp formatting
  components/               Presentational components
  index.css                 The handful of styles Bootstrap doesn't cover
public/                     Copied verbatim into the build output
  token.ashx                Server-side credential → token exchange (production)
  web.config                IIS MIME types, SPA rewrite, appSettings
  img/                      Footer logos
vite.config.js              Base path, dev API proxy, dev token middleware
cw-secrets.example.config   Template for the server-side config (credentials, auth URL)
```

## How it works

1. On load the app POSTs to `token.ashx`, which exchanges a stored Cityworks
   service-account credential for a short-lived token. **The credential itself
   never reaches the browser**; the token does.
2. In parallel it fetches the Cityworks problem list and the facility list
   (ArcGIS buildings layer, filtered to `WEBFORM = 'Y'`).
3. Selecting a facility looks up its point geometry and address, derives a
   bounding extent, and loads up to five nearby open requests.
4. Selecting a problem fetches that problem's question tree. Questions are
   revealed one at a time, chained through each answer's `NextQuestionId`.
5. On submit, if any chosen answer carries a `SubmitToFieldName`, a
   point-in-polygon district query resolves the crew to route the request to.
   Then `ServiceRequest/Create` is called and the new request ID is shown.

Residents can also check status: `?id=<requestId>` in the URL, or the search box
in the header.

The problem types offered by the form are whitelisted by `PROBLEM_SIDS` in
`src/App.jsx` — Cityworks exposes many more than belong on a public form.

---

## Local development

Requires Node 18+.

```bash
npm install
cp .env.example .env.local     # then fill in CW_USERNAME / CW_PASSWORD
npm run dev
```

`.env.local` holds a Cityworks service-account login that can reach
`/admin/Services/AMS/`. It is used **only** by the dev server and is never
embedded in a build. It is gitignored — keep it that way.

Two things in `vite.config.js` make local development work:

- **`/admin/` proxy** — forwards Cityworks API calls to the configured
  Cityworks host, avoiding CORS. In production this is unnecessary because the
  app is same-origin with the API.
- **`/token.ashx` middleware** — stands in for the ASP.NET handler, since Vite
  can't execute `.ashx`.

Both follow `CW_HOST`, which defaults to production. To develop against test,
set it in `.env.local` along with credentials that instance accepts:

```bash
CW_HOST=https://cityworkstest.raleighnc.gov
```

`npm run build` writes to `dist/`; `npm run preview` serves that build locally.

---

## Deploying to IIS

### Prerequisites (one time, per server)

- **ASP.NET 4.x** registered in IIS, and the application pool set to
  **.NET CLR v4.0 / Integrated** pipeline. `token.ashx` is a runtime-compiled
  handler and will not work without this.
- **[URL Rewrite module](https://www.iis.net/downloads/microsoft/url-rewrite)**
  — `web.config` uses `<rewrite>` for the SPA fallback. Without it IIS returns
  a 500 on every request because it cannot parse the config section.
- The deploy folder configured as an **IIS application** (not just a virtual
  directory) so it gets its own app pool and handler mappings.

### Same-origin requirement

The app calls the Cityworks API at the root-relative path
`/admin/Services/AMS/`. **It must therefore be hosted on the same origin as a
Cityworks instance.** Hosting it anywhere else means those calls 404 or trip
CORS — if that's ever needed, the API base in `src/api/cityworks.js` has to
become an absolute URL and Cityworks has to be configured to allow the origin.

Because those paths are relative, the app follows whichever host serves it. The
same build deployed to `cityworkstest.raleighnc.gov` talks to test Cityworks and
the same build on `cityworks.raleighnc.gov` talks to production, with no code
change and no rebuild.

The one exception is `CW_AUTH_URL`, which is absolute because `token.ashx` calls
it server-side. It lives in `cw-secrets.config` and **must name the same
instance that hosts the app** — otherwise the app authenticates against one
Cityworks and sends the resulting token to another, and every API call fails.

### Test vs production

| | Production | Test |
|---|---|---|
| Host | `cityworks.raleighnc.gov` | `cityworkstest.raleighnc.gov` |
| `CW_AUTH_URL` | `https://cityworks.raleighnc.gov/...` | `https://cityworkstest.raleighnc.gov/...` |
| Credentials | prod service account | whatever that instance accepts |
| Build | identical | identical |

Deploying to test is the same `dist/` with a different `cw-secrets.config` —
provided both are served from the same sub-path. If test uses a different one,
rebuild with `BASE_PATH` (see below).

ArcGIS is not mirrored: `src/api/gis.js` points at `cityworksgisprd.raleighnc.gov`
(note `prd`) with absolute URLs, so a test deploy still reads facility and
district data from production GIS. These are read-only queries, and using real
facility data on test is usually what you want. They are cross-origin
everywhere — including from `localhost` during development, which works — so
that server's CORS policy is permissive enough for the test origin.

### Base path

The production build is compiled for the `/servicerequests/` sub-path
(`base` in `vite.config.js`). Asset URLs, the favicon, the footer logos and the
`token.ashx` call are all prefixed with it.

**Deploying to a different sub-path requires a rebuild**, not just a file copy:

```bash
BASE_PATH=/some-other-path/ npm run build     # trailing slash required
```

Symptom of getting this wrong: a blank page with 404s for `/assets/*.js` in the
browser console.

### First deploy

1. Build:
   ```bash
   npm ci
   npm run build
   ```
2. Copy the **contents** of `dist/` into the IIS application folder.
3. Create the config file in that same folder, alongside `web.config`:
   ```bash
   cp cw-secrets.example.config <iis-folder>/cw-secrets.config
   ```
   Fill in `CW_USERNAME`, `CW_PASSWORD`, and `CW_AUTH_URL` for **this** server.
   `CW_AUTH_URL` must name the instance hosting the app — see Same-origin above.
4. Restrict that file to the application pool identity — it holds a plaintext
   password. IIS already refuses to serve `.config` over HTTP, so it is not
   web-readable, but NTFS permissions should be tightened anyway.
5. Load the site and confirm the facility dropdown populates. That only happens
   after a successful token exchange, so it doubles as an auth check.

> **Upgrading a server that predates `cw-secrets.config`:** earlier versions
> kept `CW_USERNAME`/`CW_PASSWORD` inline in `web.config`, set by hand on the
> server. Copy those values out **before** overwriting it — the new `web.config`
> does not contain them, so a straight file copy takes the site down until
> `cw-secrets.config` exists.

### Subsequent deploys

Build and copy `dist/` over the existing folder. Nothing else is needed.

Everything environment-specific lives in `cw-secrets.config`, which is **not**
part of the build output, so a deploy cannot overwrite it. That is why
`web.config` carries no settings of its own: it means one build deploys
unchanged to any server, and a deploy can neither blank out credentials nor
silently re-point test at production.

Hashed asset filenames change every build, so old `dist/assets/*` files
accumulate. Clearing the folder before copying is fine as long as
`cw-secrets.config` is preserved.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Blank page, 404s on `/assets/*.js` | Built for the wrong base path — rebuild with `BASE_PATH=` |
| "Could not connect to the Cityworks service" | Token exchange failed — open `token.ashx` directly; it returns a JSON `error` explaining why |
| 500 on every request | URL Rewrite module not installed |
| `token.ashx` downloads as a file, or 404s | ASP.NET 4.x not registered, or the folder isn't an IIS application |
| Token works, API calls 401 | `CW_AUTH_URL` names a different Cityworks instance than the one hosting the app, so the token is valid but not here. Otherwise: service-account password expired, or the account lost AMS access |
| Facility dropdown empty but no error | ArcGIS buildings layer unreachable, or no features have `WEBFORM = 'Y'` |
| Icons render as boxes | `.woff`/`.woff2` MIME types missing — `web.config` sets these, so check it deployed |

## Notes

- `PROBLEM_SIDS` in `src/App.jsx` contains one SID (`24068`) that no longer
  exists in Cityworks. It's inert — the filter simply never matches it — but it
  can be dropped next time the list is revised.
- The footer credits and the phone number (919-996-3420) are hardcoded in
  `src/components/Footer.jsx` and `src/components/EmergencyAlert.jsx`.
- Cityworks 23 stopped accepting API tokens as URL query parameters.
  `src/api/cityworks.js` sends the token in both the request body and an
  `Authorization: cityworks <token>` header, which works on either side of that
  upgrade.
