import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Own .env first; in dev fall back to the monolith's .env so MONGODB_URI / JWT_SECRET are shared.
dotenv.config();
dotenv.config({ path: fileURLToPath(new URL("../../../backend/.env", import.meta.url)) });
