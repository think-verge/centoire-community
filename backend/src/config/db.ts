import mongoose from "mongoose";
import { env } from "./env.js";
import "../models/index.js";

export async function connectDb(): Promise<void> {
  mongoose.connection.on("error", (err) => {
    console.error("[db] connection error:", err.message);
  });
  await mongoose.connect(env.MONGODB_URI);
  console.log(`[db] connected to ${mongoose.connection.name}`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
