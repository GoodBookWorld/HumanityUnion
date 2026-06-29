import type { Identifier } from "./identifier.js";
import type { Timestamps } from "./timestamps.js";

export interface BaseEntity extends Timestamps {
  id: Identifier;
}
