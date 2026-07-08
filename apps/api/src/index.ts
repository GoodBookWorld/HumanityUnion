import { bootstrapMongoPersistence } from "./infrastructure/mongodb/bootstrap-mongo-persistence.js";
import { environment } from "./config/environment.js";

async function start(): Promise<void> {
  await bootstrapMongoPersistence();

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
