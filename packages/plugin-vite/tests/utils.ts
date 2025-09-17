import * as path from "@std/path";
import { walk } from "@std/fs/walk";
import { createBuilder } from "vite";
import { withChildProcessServer } from "../../fresh/src/test_utils.ts";

export const DEMO_DIR = path.join(import.meta.dirname!, "..", "demo");
export const FIXTURE_DIR = path.join(import.meta.dirname!, "fixtures");

async function withTmpDir(
  fn: (dir: string) => Promise<void> | void,
) {
  const tmpDir = await Deno.makeTempDir();
  try {
    await fn(tmpDir);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
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

export async function updateFile(
  filePath: string,
  fn: (text: string) => string | Promise<string>,
) {
  const original = await Deno.readTextFile(filePath);
  const result = await fn(original);
  await Deno.writeTextFile(filePath, result);

  return {
    async [Symbol.asyncDispose]() {
      await Deno.writeTextFile(filePath, original);
    },
  };
}

export async function prepareDevServer(fixtureDir: string) {
  const tmpDir = await Deno.makeTempDir();

  await copyDir(fixtureDir, tmpDir);

  await Deno.writeTextFile(
    path.join(tmpDir, "vite.config.ts"),
    `import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";

export default defineConfig({
  plugins: [
    fresh(),
  ],
});
`,
  );

  return {
    dir: tmpDir,
    async [Symbol.asyncDispose]() {
      await Deno.remove(tmpDir, { recursive: true });
    },
  };
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
) {
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
      p.resolve();
      await server;
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
) {
  const outDir = await Deno.makeTempDir();

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
          outDir: path.join(outDir, "_fresh", "server"),
        },
      },
      client: {
        build: {
          outDir: path.join(outDir, "_fresh", "client"),
        },
      },
    },
  });
  await builder.buildApp();

  return {
    outDir,
    async [Symbol.asyncDispose]() {
      await Deno.remove(outDir, { recursive: true });
    },
  };
}

export function usingEnv(name: string, value: string) {
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
) {
  return await withChildProcessServer(
    {
      cwd: options.cwd,
      args: options.args ??
        ["serve", "-A", "--cached-only", "--port", "0", "_fresh/server.js"],
    },
    fn,
  );
}
