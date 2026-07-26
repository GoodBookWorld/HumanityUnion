import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptDir, "../..");

dotenv.config({ path: path.join(apiRoot, "../../.env") });
dotenv.config({ path: path.join(apiRoot, ".env") });

/** Test runs must never consume external SMTP quota or depend on live mail delivery. */
process.env.NODE_TEST_ENV = "true";
process.env.EMAIL_PROVIDER = "mock";
process.env.EMAIL_CONFIRMATION_CODE_TTL_MINUTES = "1440";
process.env.HU_VERIFICATION_MODE = "true";
process.env.OUTBOX_DISPATCH_ENABLED = "false";
