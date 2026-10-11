import type { RequestHandler } from "express";

/**
 * Ordinary-public Initiative detail must not be stored by an HTTP cache.
 * A later administrative block cannot evict a response that was already stored.
 */
export const ordinaryPublicNoStore: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};
