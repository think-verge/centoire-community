import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, { dbName: env.JOBS_DB_NAME });
  console.log(`[db] connected to ${env.JOBS_DB_NAME}`);
}
