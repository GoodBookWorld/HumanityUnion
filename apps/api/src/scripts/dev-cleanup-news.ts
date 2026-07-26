import { cleanupExpiredPublicNews } from "../modules/public-news/public-news.service.js";
import { withPublicNewsScriptMongo } from "./dev-public-news-script-lifecycle.js";

async function main(): Promise<void> {
  const result = await withPublicNewsScriptMongo(cleanupExpiredPublicNews);

  console.log(
    `[dev:cleanup-news] marked=${result.marked} deleted=${result.deleted}`,
  );
}

void main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
