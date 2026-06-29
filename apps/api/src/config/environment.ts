import dotenv from "dotenv";

dotenv.config();

export const environment = {
  apiPort: Number(process.env.API_PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
};
