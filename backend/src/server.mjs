import { resolve } from "node:path";
import { createApp } from "./app.mjs";

const port = Number(process.env.PORT ?? 3000);
const app = await createApp({ databasePath: resolve("data/database.json") });

app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`);
});
