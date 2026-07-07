import { getArchiveRecordById } from "../modules/public-civic-archive/public-civic-archive.store.js";

const archiveRecordId = process.argv[2];
const expectedStatus = process.argv[3];

if (!archiveRecordId || !expectedStatus) {
  process.exit(1);
}

const record = getArchiveRecordById(archiveRecordId);

if (!record || record.status !== expectedStatus) {
  process.exit(1);
}
