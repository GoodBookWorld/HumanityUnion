import { bootstrapEventInfrastructure } from "./infrastructure/events/bootstrap-event-infrastructure.js";
import { bootstrapAuthPersistence } from "./infrastructure/mongodb/bootstrap-auth-persistence.js";
import { bootstrapMongoPersistence } from "./infrastructure/mongodb/bootstrap-mongo-persistence.js";
import { environment, initializeEnvironment } from "./config/environment.js";

initializeEnvironment();

async function start(): Promise<void> {
  await bootstrapAuthPersistence();
  await bootstrapEventInfrastructure();
  await bootstrapMongoPersistence();

  const { assertNormalCivicArchiveRuntimeDatabase, logCivicArchiveRuntimeDiagnostic } =
    await import("./modules/public-civic-archive/civic-archive-runtime-diagnostic.js");

  assertNormalCivicArchiveRuntimeDatabase();
  logCivicArchiveRuntimeDiagnostic();

  const { startPublicNewsScheduler } = await import("./modules/public-news/public-news.scheduler.js");
  startPublicNewsScheduler();

  const { startPublicChoiceResultsRetentionScheduler } = await import(
    "./modules/public-choice-results-retention/public-choice-results-retention.scheduler.js"
  );
  startPublicChoiceResultsRetentionScheduler();

  const { default: app } = await import("./app.js");

  app.listen(environment.apiPort, () => {
    console.log(
      `Humanity Union API is running at http://localhost:${environment.apiPort}/api/v1/health`,
    );
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
