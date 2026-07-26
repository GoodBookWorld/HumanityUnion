/**
 * Side-effect bootstrap imported before any email/auth modules in verification scripts.
 * Must remain free of imports that initialize the email provider singleton.
 */
import { loadApiEnvironment } from "../config/load-api-environment.js";

process.env.HU_VERIFICATION_MODE = "true";

loadApiEnvironment();

if (process.env.ALLOW_REAL_EMAIL_IN_TESTS !== "true") {
  process.env.EMAIL_PROVIDER = "mock";
}
