/**
 * 404 Islands — entry point.
 *
 * Builds the application context, mounts the masthead, and hands the outlet to
 * the router. Everything else is a view.
 */

import { App } from './ui/app.js';
import { Router } from './ui/router.js';
import { masthead } from './ui/components.js';
import { h } from './ui/dom.js';
import { getIsland } from './core/catalog.js';

import { overture } from './ui/views/overture.js';
import { atlas } from './ui/views/atlas.js';
import { islandView } from './ui/views/island.js';
import { acquire } from './ui/views/acquire.js';
import { about } from './ui/views/about.js';
import { notFound } from './ui/views/notfound.js';

function boot() {
  const app = new App();
  const root = document.getElementById('app');

  const bar = masthead(app);
  const outlet = h('main#view', { tabIndex: -1 });

  root.append(
    h('a.skip-link', { href: '#view' }, 'Skip to content'),
    bar.node,
    outlet,
    h('div.grain', { 'aria-hidden': 'true' })
  );

  const router = new Router(
    [
      { path: '/', view: overture(app) },
      { path: '/atlas', view: atlas(app) },
      { path: '/island/(\\d+)', view: islandView(app) },
      { path: '/acquire', view: acquire(app) },
      { path: '/about', view: about(app) },
      { path: '.*', view: notFound(app) },
    ],
    {
      outlet,
      onNavigate: (context) => {
        bar.setCurrent(context.path);
        updateTitle(context);
        updatePill(app, context);
      },
    }
  );

  // The masthead pill follows whichever island is on screen.
  app.addEventListener('climate', () => updatePill(app, { path: Router.path() }));
  app.addEventListener('tick', () => updatePill(app, { path: Router.path() }));

  function updatePill(app, context) {
    const match = /\/island\/(\d+)/.exec(context.path || '');
    const island = match ? getIsland(Number(match[1])) : app.islands[0];
    if (!island) return bar.setPill(null);
    bar.setPill(app.provenance(island));
  }

  function updateTitle(context) {
    const match = /\/island\/(\d+)/.exec(context.path);
    if (match) {
      const island = getIsland(Number(match[1]));
      document.title = island
        ? `${island.name} · No. ${island.id} · 404 Islands`
        : '404 Islands';
      return;
    }
    const names = {
      '/': '404 Islands — a living atlas of the ocean',
      '/atlas': 'The atlas · 404 Islands',
      '/acquire': 'Acquisition · 404 Islands',
      '/about': 'The work · 404 Islands',
    };
    document.title = names[context.path] || '404 Islands';
  }

  router.start();

  // Warm the feed for the first screenful while the visitor reads the title.
  const warm = () => app.refresh(app.islands.slice(0, 50));
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warm, { timeout: 3000 });
  } else {
    setTimeout(warm, 1200);
  }

  // Expose the context for debugging and for anyone curious enough to open
  // the console — this is that kind of project.
  window.atlas404 = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
