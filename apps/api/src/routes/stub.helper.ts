import { Router, type RequestHandler } from "express";

/**
 * Registers an honest "not implemented yet" endpoint instead of a fake/mocked
 * response — the route exists (so the documented API surface in
 * docs/API_REFERENCE.md is complete and the frontend can be built against a
 * stable contract) but returns 501 until its Phase 4 module lands. Per the
 * project's no-mocks rule, a stub must never return fabricated success data.
 */
export function stub(router: Router, method: "get" | "post" | "put", path: string, plannedModule: string): void {
  const handler: RequestHandler = (_req, res) => {
    res.status(501).json({
      error: `Not implemented yet — planned in the "${plannedModule}" Phase 4 module`,
      path,
    });
  };
  router[method](path, handler);
}
