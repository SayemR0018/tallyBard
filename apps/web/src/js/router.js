// Minimal History-API router. Routes are path patterns; the Render static
// site rewrites /* -> /index.html so deep links survive refresh.

export function matchRoute(routes, path) {
  const clean = path.replace(/\/+$/, "") || "/";
  for (const r of routes) {
    const params = match(r.path, clean);
    if (params) return { route: r, params };
  }
  return null;
}

function match(pattern, path) {
  const pp = pattern.split("/").filter(Boolean);
  const sp = path.split("/").filter(Boolean);
  if (pattern.endsWith("/*")) {
    const base = pp.slice(0, -1);
    if (sp.length < base.length) return null;
    for (let i = 0; i < base.length; i++) if (base[i] !== sp[i]) return null;
    return { rest: sp.slice(base.length).join("/") };
  }
  if (pp.length !== sp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(":")) params[pp[i].slice(1)] = decodeURIComponent(sp[i]);
    else if (pp[i] !== sp[i]) return null;
  }
  return params;
}

export function createRouter(routes, onChange) {
  function resolve() {
    const m = matchRoute(routes, location.pathname);
    onChange(m, location);
  }
  function navigate(to, { replace = false } = {}) {
    if (to === location.pathname + location.search + location.hash) return;
    history[replace ? "replaceState" : "pushState"]({}, "", to);
    resolve();
    if (!location.hash) window.scrollTo({ top: 0, behavior: "instant" });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return; // in-page anchor
    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });
  addEventListener("popstate", resolve);
  return { navigate, resolve };
}
