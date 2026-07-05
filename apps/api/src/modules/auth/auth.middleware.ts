import type { AuthIdentity } from "@hu/types";
import type { NextFunction, Request, Response } from "express";

import { bootstrapSessionContext } from "./session.context.js";

/* eslint-disable @typescript-eslint/no-namespace -- Express Request augmentation requires a global namespace. */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthIdentity;
    }
  }
}

export function authenticationMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.auth = bootstrapSessionContext.getCurrentIdentity();
  next();
}
