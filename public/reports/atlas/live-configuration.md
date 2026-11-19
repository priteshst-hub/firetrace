# Recent detections: credential configuration and verification

The Worker endpoint is `GET /api/firms`, with a fixed Australia-region bounding box and MODIS_NRT / VIIRS_SNPP_NRT sources for two UTC days. S-NPP may be unavailable after its source coverage ends; the API exposes each source's status and partial results. No NOAA platform is silently substituted.

Get your authorized NASA MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/area/ . Set it only as a Cloudflare Worker secret:

```sh
npx wrangler secret put FIRMS_MAP_KEY --config wrangler.cloudflare.jsonc
```

Paste the key into the interactive prompt. Never put it in browser variables, public assets, source control, a URL shared in chat or a command-line argument. The key is read only in `worker/firms.ts`. The Worker never returns upstream request URLs or exception strings that could contain the key.

Authenticated verification has **not** been completed without an authorized key. After setting the secret on a staging Worker using the same bindings, fetch `/api/firms` and verify a NASA `ok` source status, schema-parsed records or a valid header-only zero-detection response, acquisition times and retrieval time. Record the date and non-sensitive source status. A mocked test is not an authenticated verification.

The API caches successful/partial results for five minutes, errors for 30 seconds, coalesces concurrent same-isolate requests, uses the existing Worker rate-limit binding for cache misses (Cloudflare location scoped, not a guaranteed worldwide NASA quota), and bounds requests to fixed sources/area/day range. Cross-isolate concurrent cold cache misses can still issue duplicate upstream requests. No client-supplied NASA URL or source is accepted. Separate source errors are shown; an error never becomes an empty successful feed. Detection time, application retrieval and unavailable per-record publication time are separate fields. No periodic browser polling occurs; manual refresh is available.

COMMAND's recent-evidence review provides source-specific confidence, timestamps, observation age, transparent analyst category and downloadable evidence/decision brief. Other-sensor observations within 5 km/30 minutes are shown as proximity corroboration only. Authorities still need field confirmation, actual weather, land cover, exposure, incident status and response capability. No automatic dispatch, evacuation instruction or modeled risk probability is generated.
