/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="deno.ns" />

import { start } from "fresh/server.ts";
import manifest from "./fresh.gen.ts";
import config from "./vite.config.ts";

await start(manifest, config);
