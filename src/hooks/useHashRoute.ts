import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_ROUTE,
  parseHash,
  serializeRoute,
  type PageId,
  type Route,
} from "../routes";

export type NavTarget = {
  page: PageId;
  entity?: string | null;
  query?: Record<string, string>;
};

export type HashRouteApi = {
  route: Route;
  /** Push by default; pass `{ replace: true }` to stay out of the history. */
  navigate: (next: NavTarget, opts?: { replace?: boolean }) => void;
  /** Push a bare page — clears the entity and every query param. */
  setPage: (page: PageId) => void;
  /** Set one query param on the current route. Always replaces. */
  setParam: (key: string, value: string | null) => void;
};

const canUseDom = () => typeof window !== "undefined";

function currentHash(): string {
  return canUseDom() ? window.location.hash : "";
}

/**
 * Reads and writes the location hash as the app's single navigation state.
 *
 * All the parsing lives in the pure `routes` module; this is deliberately a thin
 * shell because Vitest runs in node here (no jsdom) so the hook itself cannot be
 * tested. Keep logic out of it.
 *
 * Two write paths, and the difference is the point:
 *   - push    — assign `location.hash` and let the `hashchange` listener be the
 *               single source of truth for state.
 *   - replace — `history.replaceState` fires no `hashchange`, so state has to be
 *               set by hand. This is what keeps filter and range churn out of
 *               the back button.
 */
export function useHashRoute(): HashRouteApi {
  const [route, setRoute] = useState<Route>(() =>
    canUseDom() ? parseHash(window.location.hash) : DEFAULT_ROUTE,
  );

  // Mirrors `route` for the benefit of `setParam`, which has to read the current
  // value and write history in one go. A state updater can't do that: StrictMode
  // double-invokes updaters in development, and history writes are side effects.
  const routeRef = useRef(route);
  routeRef.current = route;

  const apply = useCallback((next: Route) => {
    routeRef.current = next;
    setRoute(next);
  }, []);

  useEffect(() => {
    if (!canUseDom()) return;
    const onHashChange = () => apply(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    // Re-read on mount: the hash may have changed between the initial render and
    // this effect firing.
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [apply]);

  // Canonicalize a bare or legacy URL to `#/overview` without adding a history
  // entry, so back never lands on a hash-less page showing the same view.
  useEffect(() => {
    if (!canUseDom()) return;
    const hash = window.location.hash;
    if (hash === "" || hash === "#" || hash === "#/") {
      window.history.replaceState(null, "", serializeRoute(DEFAULT_ROUTE));
    }
  }, []);

  const commit = useCallback(
    (next: Route, replace: boolean) => {
      const hash = serializeRoute(next);
      if (!canUseDom()) {
        apply(next);
        return;
      }
      const unchanged = hash === currentHash();

      if (replace) {
        // Skip only the history write when nothing changed — repeated
        // `replaceState` calls hit Safari's ~100-per-30s throttle. State is
        // still applied so the ref and React stay in step.
        if (!unchanged) window.history.replaceState(null, "", hash);
        apply(next); // replaceState fires no hashchange
      } else {
        // Assigning an unchanged hash fires no hashchange, so a push would
        // silently do nothing — apply directly instead.
        if (unchanged) apply(next);
        else window.location.hash = hash; // the listener picks it up
      }
    },
    [apply],
  );

  const navigate = useCallback(
    (next: NavTarget, opts?: { replace?: boolean }) => {
      commit(
        {
          page: next.page,
          entity: next.entity ?? null,
          query: next.query ?? {},
        },
        opts?.replace ?? false,
      );
    },
    [commit],
  );

  const setPage = useCallback(
    (page: PageId) => {
      commit({ page, entity: null, query: {} }, false);
    },
    [commit],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const current = routeRef.current;
      const query = { ...current.query };
      if (value === null || value === "") delete query[key];
      else query[key] = value;
      // `commit` updates the ref, so two setParam calls in the same tick compose
      // instead of the second clobbering the first (see `toggleSort`).
      commit({ ...current, query }, true);
    },
    [commit],
  );

  return { route, navigate, setPage, setParam };
}
