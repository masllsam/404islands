/**
 * Hash routing.
 *
 * The atlas has to work when it is dropped on a static host with no server
 * rewrites, and every island needs a URL a person can send to someone else.
 * Hash routes give both, for about sixty lines.
 */

export class Router {
  /**
   * @param {Array<{path: RegExp|string, view: Function, name?: string}>} routes
   * @param {object} options
   * @param {HTMLElement} options.outlet
   * @param {Function} [options.onNavigate]
   */
  constructor(routes, { outlet, onNavigate } = {}) {
    this.routes = routes.map((r) => ({
      ...r,
      matcher: r.path instanceof RegExp ? r.path : new RegExp(`^${r.path}$`),
    }));
    this.outlet = outlet;
    this.onNavigate = onNavigate;
    this.current = null;
    this.currentTeardown = null;
    this.handle = () => this.#resolve();
  }

  start() {
    window.addEventListener('hashchange', this.handle);
    this.#resolve();
  }

  stop() {
    window.removeEventListener('hashchange', this.handle);
    this.currentTeardown?.();
  }

  /** Current path, without the leading `#`. Always starts with `/`. */
  static path() {
    const raw = location.hash.replace(/^#/, '');
    return raw.startsWith('/') ? raw : `/${raw}`;
  }

  static go(path, { replace = false } = {}) {
    const target = `#${path.startsWith('/') ? path : `/${path}`}`;
    if (location.hash === target) return;
    if (replace) history.replaceState(null, '', target);
    else location.hash = target;
  }

  async #resolve() {
    const path = Router.path();
    const [pathname, queryString] = path.split('?');
    const query = new URLSearchParams(queryString || '');

    for (const route of this.routes) {
      const match = route.matcher.exec(pathname);
      if (!match) continue;

      // Tear the previous view down before the next one allocates anything —
      // the renderer canvas is shared, and two views must never hold it.
      this.currentTeardown?.();
      this.currentTeardown = null;
      this.current = route;

      const context = { params: match.slice(1), query, path: pathname, route };
      const result = await route.view(context, this.outlet);
      if (typeof result === 'function') this.currentTeardown = result;

      this.onNavigate?.(context);
      return;
    }

    // Nothing matched. In an atlas of 404 islands, this deserves better than
    // a browser default, so route it to the piece's own not-found.
    this.currentTeardown?.();
    this.currentTeardown = null;
    const fallback = this.routes[this.routes.length - 1];
    const context = { params: [], query, path: pathname, route: fallback };
    const result = await fallback.view(context, this.outlet);
    if (typeof result === 'function') this.currentTeardown = result;
    this.onNavigate?.(context);
  }
}
