# Facilities & Operations — Online Service Request Form

Public web form that lets City of Raleigh residents and staff report non-emergency
maintenance problems at City facilities. Submissions create service requests
directly in **Cityworks**, located and routed using **ArcGIS** feature services.

Requests are created in the **Engineering Services (ES)** Cityworks domain, which
handles facility and operations maintenance.

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
   never reaches the browser**; the token does, along with the API path this
   instance uses (see Test vs production).
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

### Coordinates and projection

Cityworks stores request coordinates in **Web Mercator** (ESRI `102100`, the same
CRS EPSG calls `3857`). The ArcGIS layers this app reads are published in **NC
State Plane feet** (ESRI `102719` / EPSG `2264`).

`src/api/gis.js` therefore pins the projection on every query rather than
inheriting it:

- **`outSR=102100`** — geometry comes back as Web Mercator, so the `X`/`Y` sent
  to `ServiceRequest/Create` already match what Cityworks expects. No `WKID` is
  needed on the payload.
- **`inSR=102100`** on the districts query — the point being tested is Web
  Mercator while that layer is State Plane. Without it the server reads the
  point as State Plane, it falls outside every district, the lookup returns no
  match, and `SubmitTo` is silently left unset so the request never routes to a
  crew. No error is raised; requests just stop being assigned.

This is not hypothetical. The facilities layer was republished from Web Mercator
to State Plane around 2026-07-27. Because the queries carried no `outSR`, the app
followed the layer and began writing State Plane coordinates into a Cityworks
that expects Web Mercator — for roughly two weeks, until the pinning above was
added. Requests created in that window have `SRX`/`SRY` around `2105888, 738560`
instead of `-8754499, 4270224` and need reprojecting in place.

The same drift also silently broke the "last five open requests" panel, which
searches Cityworks by extent: the extent was State Plane, so it only matched the
equally-broken recent requests and hid the correct history.

If coordinates ever look wrong again, check the layer's current SR first —
`.../FACILITIES/MapServer/1?f=json` reports it — before suspecting the app.

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

`.env.local` holds a Cityworks service-account login that can reach the AMS API.
It is used **only** by the dev server and is never embedded in a build. It is
gitignored — keep it that way.

Two things in `vite.config.js` make local development work:

- **API proxy** — forwards Cityworks API calls to the configured Cityworks host,
  avoiding CORS. In production this is unnecessary because the app is
  same-origin with the API.
- **`/token.ashx` middleware** — stands in for the ASP.NET handler, since Vite
  can't execute `.ashx`. It returns the same `{ Token, ApiBase }` shape.

Both are built from `CW_HOST` and `CW_PREFIX`, which default to production and
`admin`. To develop against test, set both in `.env.local` along with
credentials that instance accepts:

```bash
CW_HOST=https://cityworkstest.raleighnc.gov
CW_PREFIX=backdoor
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

The app calls the Cityworks API at a root-relative path. **It must therefore be
hosted on the same origin as a Cityworks instance.** Hosting it anywhere else
means those calls 404 or trip CORS — if that's ever needed, the API base in
`src/api/cityworks.js` has to become an absolute URL and Cityworks has to be
configured to allow the origin.

Because the path is relative, the app follows whichever host serves it. The same
build deployed to `cityworkstest.raleighnc.gov` talks to test Cityworks and the
same build on `cityworks.raleighnc.gov` talks to production, with no code change
and no rebuild.

### Test vs production

The two instances differ in more than hostname: **production serves the API from
`/admin/`, the test instance from `/backdoor/`.**

Rather than compile that prefix into the bundle — which would mean two build
artifacts and the chance of deploying the test one to production — the app is
told the prefix at runtime. `token.ashx` returns it alongside the token:

```json
{ "Token": "…", "ApiBase": "/backdoor/Services/AMS/" }
```

and it is derived from `CW_AUTH_URL` (the part before `/Services/`), so there is
no second setting that can disagree with it. Set the auth URL correctly and the
API path follows.

| | Production | Test |
|---|---|---|
| Host | `cityworks.raleighnc.gov` | `cityworkstest.raleighnc.gov` |
| API path | `/admin/Services/AMS/` | `/backdoor/Services/AMS/` |
| `CW_AUTH_URL` | `https://cityworks.raleighnc.gov/admin/Services/…` | `https://cityworkstest.raleighnc.gov/backdoor/Services/…` |
| Credentials | prod service account | whatever that instance accepts |
| Build | identical | identical |

Deploying to test is the same `dist/` with a different `cw-secrets.config` —
provided both are served from the same sub-path. If test uses a different one,
rebuild with `BASE_PATH` (see below).

`CW_API_BASE` overrides the derived prefix for an instance that doesn't follow
the `<prefix>/Services/…` layout. Prefer leaving it unset.

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
| Token works, API calls 404 | Wrong API prefix — `CW_AUTH_URL` says `/admin/` on an instance serving `/backdoor/`, or vice versa. Check `ApiBase` in the `token.ashx` response |
| Facility dropdown empty but no error | ArcGIS buildings layer unreachable, or no features have `WEBFORM = 'Y'` |
| Problem dropdown empty, everything else fine | The service account is in the wrong Cityworks domain. `PROBLEM_SIDS` is specific to Engineering Services (`284010`); an account in another domain returns a different problem set entirely. Decode the token's `DomainId` to check |
| Requests created but never assigned to a crew | District lookup returning no match — usually an `inSR`/layer projection mismatch (see Coordinates and projection) |
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
