import { walk, type WalkEntry } from "@std/fs/walk";
import * as path from "@std/path";
import type { FsAdapter } from "../../fresh/src/fs.ts";
import type { App } from "../../fresh/src/app.ts";
import type { Page } from "@astral/astral";
import { Builder, type BuildOptions } from "../../fresh/src/dev/builder.ts";
import type { ResolvedFreshConfig } from "../../fresh/src/config.ts";
import type { BuildCache, StaticFile } from "../../fresh/src/build_cache.ts";
import { DEFAULT_CONN_INFO } from "../../fresh/src/app.ts";
import type { Command } from "../../fresh/src/commands.ts";
import {
  fsItemsToCommands,
  type FsRouteFile,
} from "../../fresh/src/fs_routes.ts";
import { Context, type ServerIslandRegistry } from "../../fresh/src/context.ts";
import { createBuilder } from "vite";
import { browser, withChildProcessServer } from "./browser.ts";

const STUB = {} as unknown as Deno.ServeHandlerInfo;

export class FakeServer {
  constructor(
    public handler: (
      req: Request,
      info: Deno.ServeHandlerInfo,
    ) => Response | Promise<Response>,
  ) {}

  async get(path: string, init?: RequestInit): Promise<Response> {
    const url = this.toUrl(path);
    const req = new Request(url, init);
    return await this.handler(req, STUB);
  }
  async post(path: string, body?: BodyInit): Promise<Response> {
    const url = this.toUrl(path);
    const req = new Request(url, { method: "post", body });
    return await this.handler(req, STUB);
  }
  async patch(path: string, body?: BodyInit): Promise<Response> {
    const url = this.toUrl(path);
    const req = new Request(url, { method: "patch", body });
    return await this.handler(req, STUB);
  }
  async put(path: string, body?: BodyInit): Promise<Response> {
    const url = this.toUrl(path);
    const req = new Request(url, { method: "put", body });
    return await this.handler(req, STUB);
  }
  async delete(path: string): Promise<Response> {
    const url = this.toUrl(path);
    const req = new Request(url, { method: "delete" });
    return await this.handler(req, STUB);
  }
  async head(path: string): Promise<Response> {
    const url = this.toUrl(path);
    const req = new Request(url, { method: "head" });
    return await this.handler(req, STUB);
  }
  async options(path: string): Promise<Response> {
    const url = this.toUrl(path);
    const req = new Request(url, { method: "options" });
    return await this.handler(req, STUB);
  }

  async request(req: Request): Promise<Response> {
    return await this.handler(req, STUB);
  }

  private toUrl(path: string) {
    return new URL(path, "http://localhost/");
  }
}

export function createFakeFs(files: Record<string, unknown>): FsAdapter {
  return {
    cwd: () => ".",
    async *walk(_root: string) {
      for (const file of Object.keys(files)) {
        const entry: WalkEntry = {
          isDirectory: false,
          isFile: true,
          isSymlink: false,
          name: file,
          path: file,
        };
        yield entry;
      }
    },
    // deno-lint-ignore require-await
    async isDirectory(dir: string) {
      return Object.keys(files).some((file) => file.startsWith(dir + "/"));
    },
    async mkdirp(_dir: string) {
    },
    readFile: Deno.readFile,
    // deno-lint-ignore require-await
    async readTextFile(path: string) {
      return String(files[String(path)]);
    },
  };
}

export const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export async function withTmpDir(
  options?: Deno.MakeTempOptions,
): Promise<{ dir: string } & AsyncDisposable> {
  const dir = await Deno.makeTempDir(options);
  return {
    dir,
    async [Symbol.asyncDispose]() {
      // Skip pointless cleanup in CI, speed up tests
      if (Deno.env.get("CI") === "true") return;

      try {
        await Deno.remove(dir, { recursive: true });
      } catch {
        // Temp files are not cleaned up automatically on Windows
        // deno-lint-ignore no-console
        console.warn(`Failed to clean up temp dir: "${dir}"`);
      }
    },
  };
}

export async function writeFiles(dir: string, files: Record<string, string>) {
  const entries = Object.entries(files);
  await Promise.all(entries.map(async (entry) => {
    const [pathname, content] = entry;
    const fullPath = path.join(dir, pathname);
    try {
      await Deno.mkdir(path.dirname(fullPath), { recursive: true });
      await Deno.writeTextFile(fullPath, content);
    } catch (err) {
      if (!(err instanceof Deno.errors.AlreadyExists)) {
        throw err;
      }
    }
  }));
}

export class MockBuildCache<State> implements BuildCache<State> {
  #files: FsRouteFile<State>[];
  root = "";
  clientEntry = "";
  islandRegistry: ServerIslandRegistry = new Map();
  features = { errorOverlay: false };

  constructor(files: FsRouteFile<State>[], mode: "development" | "production") {
    this.features.errorOverlay = mode === "development";
    this.#files = files;
  }

  getEntryAssets(): string[] {
    return [];
  }

  getFsRoutes(): Command<State>[] {
    return fsItemsToCommands(this.#files);
  }

  readFile(_pathname: string): Promise<StaticFile | null> {
    return Promise.resolve(null);
  }
}

export async function buildProd(
  options: Omit<BuildOptions, "outDir">,
): Promise<<T>(app: App<T>) => void> {
  const outDir = await Deno.makeTempDir();
  const builder = new Builder({ outDir, ...options });
  return await builder.build({ mode: "production", snapshot: "memory" });
}

export async function withBrowserApp(
  app: App<unknown>,
  fn: (page: Page, address: string) => void | Promise<void>,
) {
  const aborter = new AbortController();
  await using server = Deno.serve({
    hostname: "localhost",
    port: 0,
    signal: aborter.signal,
    onListen: () => {}, // Don't spam terminal with "Listening on..."
  }, app.handler());

  try {
    await using page = await browser.newPage();
    await fn(page, `http://localhost:${server.addr.port}`);
  } finally {
    aborter.abort();
  }
}

const DEFAULT_CONFIG: ResolvedFreshConfig = {
  root: "",
  mode: "production",
  basePath: "",
};

export function serveMiddleware<T>(
  middleware: (ctx: Context<T>) => Response | Promise<Response>,
  options: {
    config?: ResolvedFreshConfig;
    buildCache?: BuildCache<T>;
    next?: () => Promise<Response>;
    route?: string | null;
  } = {},
): FakeServer {
  return new FakeServer(async (req) => {
    const next = options.next ??
      (() => new Response("not found", { status: 404 }));
    const config = options.config ?? DEFAULT_CONFIG;
    const buildCache = options.buildCache ??
      new MockBuildCache<T>([], options.config?.mode ?? "production");

    const ctx = new Context<T>(
      req,
      new URL(req.url),
      DEFAULT_CONN_INFO,
      options.route ?? null,
      {},
      config,
      () => Promise.resolve(next()),
      buildCache,
    );
    return await middleware(ctx);
  });
}

export const DEMO_DIR: string = path.join(import.meta.dirname!, "..", "demo");
export const FIXTURE_DIR: string = path.join(import.meta.dirname!, "fixtures");

export async function updateFile(
  filePath: string,
  fn: (text: string) => string | Promise<string>,
): Promise<{ [Symbol.asyncDispose]: () => Promise<void> }> {
  const original = await Deno.readTextFile(filePath);
  const result = await fn(original);
  await Deno.writeTextFile(filePath, result);

  return {
    async [Symbol.asyncDispose]() {
      await Deno.writeTextFile(filePath, original);
    },
  };
}

async function copyDir(from: string, to: string) {
  const entries = walk(from, {
    includeFiles: true,
    includeDirs: false,
    skip: [/([\\/]+(_fresh|node_modules|vendor)[\\/]+|[\\/]+vite\.config\.ts)/],
  });

  for await (const entry of entries) {
    if (entry.isFile) {
      const relative = path.relative(from, entry.path);
      const target = path.join(to, relative);

      try {
        await Deno.mkdir(path.dirname(target), { recursive: true });
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
          throw err;
        }
      }

      await Deno.copyFile(entry.path, target);
    }
  }
}

export async function prepareDevServer(
  fixtureDir: string,
): Promise<{ dir: string } & AsyncDisposable> {
  const tmp = await withTmpDir({
    dir: path.join(import.meta.dirname!, ".."),
    prefix: "tmp_vite_",
  });

  await copyDir(fixtureDir, tmp.dir);

  await Deno.writeTextFile(
    path.join(tmp.dir, "vite.config.ts"),
    `import { defineConfig } from "vite";
import { fresh } from "@../../fresh/plugin-vite";

export default defineConfig({
  plugins: [
    fresh(),
  ],
});
`,
  );

  return tmp;
}

export async function launchDevServer(
  dir: string,
  fn: (address: string, dir: string) => void | Promise<void>,
  env: Record<string, string> = {},
) {
  await withChildProcessServer(
    {
      cwd: dir,
      args: ["run", "-A", "--cached-only", "npm:vite", "--port", "0"],
      env,
    },
    async (address) => await fn(address, dir),
  );
}

export async function spawnDevServer(
  dir: string,
  env: Record<string, string> = {},
): Promise<
  {
    dir: string;
    promise: Promise<void>;
    address: () => string;
    [Symbol.asyncDispose]: () => Promise<void>;
  }
> {
  const boot = Promise.withResolvers<void>();
  const p = Promise.withResolvers<void>();

  let serverAddress = "";

  const server = withChildProcessServer(
    {
      cwd: dir,
      args: ["run", "-A", "--cached-only", "npm:vite", "--port", "0"],
      env,
    },
    async (address) => {
      serverAddress = address;
      boot.resolve();
      await p.promise;
    },
  );

  await boot.promise;

  return {
    dir,
    promise: server,
    address: () => {
      return serverAddress;
    },
    async [Symbol.asyncDispose]() {
      await p.resolve();
    },
  };
}

export async function withDevServer(
  fixtureDir: string,
  fn: (address: string, dir: string) => void | Promise<void>,
  env: Record<string, string> = {},
) {
  await using tmp = await prepareDevServer(fixtureDir);
  await launchDevServer(tmp.dir, fn, env);
}

export async function buildVite(
  fixtureDir: string,
  options?: { base?: string },
): Promise<{ tmp: string; [Symbol.asyncDispose]: () => Promise<void> }> {
  const tmp = await withTmpDir({
    dir: path.join(import.meta.dirname!, ".."),
    prefix: "tmp_vite_",
  });

  const builder = await createBuilder({
    logLevel: "error",
    root: fixtureDir,
    base: options?.base,
    build: {
      emptyOutDir: true,
    },
    environments: {
      ssr: {
        build: {
          outDir: path.join(tmp.dir, "_fresh", "server"),
        },
      },
      client: {
        build: {
          outDir: path.join(tmp.dir, "_fresh", "client"),
        },
      },
    },
  });
  await builder.buildApp();

  return {
    tmp: tmp.dir,
    async [Symbol.asyncDispose]() {
      return await tmp[Symbol.asyncDispose]();
    },
  };
}

export function usingEnv(
  name: string,
  value: string,
): { [Symbol.dispose]: () => void } {
  const prev = Deno.env.get(name);
  Deno.env.set(name, value);
  return {
    [Symbol.dispose]: () => {
      if (prev === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, prev);
      }
    },
  };
}

export interface ProdOptions {
  cwd: string;
  args?: string[];
  bin?: string;
  env?: Record<string, string>;
}

export async function launchProd(
  options: ProdOptions,
  fn: (address: string) => void | Promise<void>,
): Promise<void> {
  return await withChildProcessServer(
    {
      cwd: options.cwd,
      args: options.args ??
        [
          "serve",
          "-A",
          "--cached-only",
          "--port",
          "0",
          "_../../fresh/server.js",
        ],
    },
    fn,
  );
}
