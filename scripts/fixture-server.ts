/** Serves the Northwind Coffee demo site. Usage: pnpm fixture  (PORT=3101 by default) */
import path from "node:path";
import { startFixtureServer } from "../fixtures/northwind/server";

const port = Number(process.env.FIXTURE_PORT ?? 3101);
const widgetConfigFile = process.env.FIXTURE_WIDGET_FILE ?? path.resolve(".data/fixture-widget.json");
// Bind on all interfaces so both http://localhost:3101 and http://127.0.0.1:3101 work
// (the e2e test uses the second one as a "different, non-allowed" origin).
const server = await startFixtureServer({ port, host: "0.0.0.0", widgetConfigFile });
console.log(`Northwind Coffee demo site running at http://localhost:${port} (widget config: ${widgetConfigFile})`);

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
