import type { BaseEntity } from "../common/base-entity.js";
import type { MemberId } from "./member.js";

export type AuthUserId = string;

export type AuthProvider = "email" | "google" | "apple" | "github";

export type AuthAccountStatus = "active" | "pending" | "disabled" | "archived";

export type AuthRole = "member" | "moderator" | "admin" | "institution";

export interface AuthIdentity extends BaseEntity {
  email: string;
  provider: AuthProvider;
  status: AuthAccountStatus;
  roles: AuthRole[];
  memberId: MemberId;
}
