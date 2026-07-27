import { fileURLToPath } from "node:url";
import { createApp } from "../../../backend/src/app.mjs";

const databasePath = fileURLToPath(new URL("./backend-http-db.json", import.meta.url));
const port = 43123;
const app = await createApp({ databasePath });
app.listen(port, () => console.log(`QA server listening ${port}`));
setInterval(() => {}, 1000);
