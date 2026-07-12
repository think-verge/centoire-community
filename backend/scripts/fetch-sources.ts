import { connectDb, disconnectDb } from "../src/config/db.js";
import { fetchAllActiveSources } from "../src/services/ingestionService.js";

async function main(): Promise<void> {
  await connectDb();
  const stats = await fetchAllActiveSources();
  const total = stats.reduce((sum, s) => sum + s.imported, 0);
  console.log(`[ingestion] total imported: ${total}`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
