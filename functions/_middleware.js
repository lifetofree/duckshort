// Pages Function: hostname-conditional redirect for the legacy Pages hostname.
//
// Why this exists:
// The legacy Pages hostname (duckshort.pages.dev) served the SPA shell for
// /<short-id>, which then rendered the React Router `*` 404 page (the SPA
// has no concept of short links). We need every path on pages.dev to 301
// to the canonical Worker hostname (duckshort.cc), where the Worker's
// `/:id` handler runs the actual redirect + short-link lookup.
//
// Why a Function instead of `_redirects`:
// Workers Static Assets also reads `_redirects` from the same dist and
// applies its rules to Worker-served requests. The catch-all
// `/* https://duckshort.cc/:splat 301` is correct for pages.dev (forward
// to the Worker) but causes a 301 self-loop on duckshort.cc/* (it points
// to itself). Pages Functions are scoped to Pages-only execution, so this
// hostname-conditional redirect applies to duckshort.pages.dev/* and never
// to duckshort.cc/*.
//
// 301 (permanent) — pages.dev is a legacy alias and should not be used
// long-term; this encourages clients to update bookmarks.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === 'duckshort.pages.dev') {
    return Response.redirect(
      `https://duckshort.cc${url.pathname}${url.search}`,
      301,
    );
  }
  return context.next();
}
