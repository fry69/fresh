import { launch, type Page } from "@astral/astral";
import * as colors from "@std/fmt/colors";
import { DOMParser, HTMLElement } from "linkedom";
import { TextLineStream } from "@std/streams/text_line_stream";
import * as path from "@std/path";
import { mergeReadableStreams } from "@std/streams";
import { walk, type WalkEntry } from "@std/fs/walk";

// --- TYPE DECOUPLING ---
export interface TestApp<State = unknown> {
  handler: () => (
    req: Request,
    connInfo?: Deno.ServeHandlerInfo,
  ) => Response | Promise<Response>;
}

export interface FsAdapter {
    cwd(): string;
    // deno-lint-ignore no-explicit-any
    readFile(path: string): Promise<any>;
    readTextFile(path: string): Promise<string>;
    // deno-lint-ignore no-explicit-any
    isDirectory(path: string): Promise<any>;
    mkdirp(dir: string): Promise<void>;
    walk(
        dir: string,
        // deno-lint-ignore no-explicit-any
        options?: any,
    ): AsyncIterableIterator<WalkEntry>;
}


// --- GENERIC HELPERS ---

export const browser = await launch({
  args: [
    "--window-size=1280,720",
    ...((Deno.env.get("CI") && Deno.build.os === "linux")
      ? ["--no-sandbox"]
      : []),
  ],
  headless: Deno.env.get("HEADLESS") !== "false",
});

export async function withTmpDir(fn: (dir: string) => Promise<void> | void) {
  const CWD = Deno.cwd();
  const ROOT_TMP_DIR = path.join(CWD, ".tmp");
  await Deno.mkdir(ROOT_TMP_DIR, { recursive: true });

  const tmpDir = await Deno.makeTempDir({
    dir: ROOT_TMP_DIR,
    prefix: "fresh-test-",
  });

  try {
    await fn(tmpDir);
  } finally {
    try {
      await Deno.remove(tmpDir, { recursive: true });
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) return;
      if (Deno.build.os === "windows") {
        console.warn(`Failed to clean up temp dir, ignoring: ${(err as Error).message}`);
        return;
      }
      throw err;
    }
  }
}

export async function withTmpDirDisposable(): Promise<
  { dir: string } & AsyncDisposable
> {
  const CWD = Deno.cwd();
  const ROOT_TMP_DIR = path.join(CWD, ".tmp");
  await Deno.mkdir(ROOT_TMP_DIR, { recursive: true });

  const dir = await Deno.makeTempDir({
    dir: ROOT_TMP_DIR,
    prefix: "fresh-test-",
  });

  return {
    dir,
    async [Symbol.asyncDispose]() {
      try {
        await Deno.remove(dir, { recursive: true });
      } catch (err) {
        if (err instanceof Deno.errors.NotFound) return;
        if (Deno.build.os === "windows") {
          console.warn(`Failed to clean up temp dir, ignoring: ${(err as Error).message}`);
          return;
        }
        throw err;
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

export async function withBrowser(fn: (page: Page) => void | Promise<void>) {
  await using page = await browser.newPage();
  try {
    await fn(page);
  } catch (err) {
    const raw = await page.content();
    if (raw) {
      const doc = parseHtml(raw);
      const html = prettyDom(doc);
      console.log(html);
    }
    throw err;
  }
}

export interface TestChildServerOptions {
  cwd: string;
  args: string[];
  bin?: string;
  env?: Record<string, string>;
}

export async function withChildProcessServer(
  options: TestChildServerOptions,
  fn: (address: string) => void | Promise<void>,
) {
  const aborter = new AbortController();
  const command = new Deno.Command(options.bin ?? Deno.execPath(), {
    args: options.args,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    cwd: options.cwd,
    signal: aborter.signal,
    env: options.env,
  });
  const cp = command.spawn();

  const lines = mergeReadableStreams(
    cp.stdout.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream()),
    cp.stderr.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream()),
  );

  const output: string[] = [];
  let address = "";
  let found = false;
  for await (const raw of lines) {
    const line = colors.stripAnsiCode(raw);
    output.push(line);
    const match = line.match(/https?:\/\/[^:]+:\d+/g);
    if (match) {
      address = match[0];
      found = true;
      break;
    }
  }

  if (!found) {
    cp.kill();
    await cp.status;
    throw new Error(`Could not find server address in output:\n${output.join("\n")}`);
  }

  try {
    await fn(address);
  } finally {
    aborter.abort();
    await cp.status;
  }
}

// --- DOM HELPERS ---

export const VOID_ELEMENTS = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;

export function prettyDom(doc: Document) {
  let out = colors.dim(`<!DOCTYPE ${doc.doctype?.name ?? ""}>\n`);
  const node = doc.documentElement;
  out += _printDomNode(node, 0);
  return out;
}

function _printDomNode(node: Node, indent: number): string {
  const space = "  ".repeat(indent);
  if (node.nodeType === 3) { // TEXT_NODE
    return space + colors.dim(node.textContent ?? "") + "\n";
  }
  if (node.nodeType === 8) { // COMMENT_NODE
    return space + colors.dim(`<!--${node.textContent}-->`) + "\n";
  }
  if (!(node instanceof HTMLElement)) {
    return "";
  }

  let out = space;
  out += colors.dim(colors.cyan("<"));
  out += colors.cyan(node.localName);

  for (const attr of (node as HTMLElement).attributes) {
    out += " " + colors.yellow(attr.name);
    out += colors.dim("=");
    out += colors.green(`"${attr.value}"`);
  }

  if (VOID_ELEMENTS.test(node.localName)) {
    out += colors.dim(colors.cyan(">")) + "\n";
    return out;
  }

  out += colors.dim(colors.cyan(">"));
  if (node.childNodes.length > 0) {
    out += "\n";
    for (const child of node.childNodes) {
      out += _printDomNode(child, indent + 1);
    }
    out += space;
  }

  out += colors.dim(colors.cyan("</"));
  out += colors.cyan(node.localName);
  out += colors.dim(colors.cyan(">"));
  out += "\n";
  return out;
}


export interface TestDocument extends Document {
  debug(): void;
}

export function parseHtml(input: string): TestDocument {
  const doc = new DOMParser().parseFromString(input, "text/html") as unknown as TestDocument;
  Object.defineProperty(doc, "debug", {
    value: () => console.log(prettyDom(doc)),
    enumerable: false,
  });
  return doc;
}

export function assertSelector(doc: Document, selector: string) {
  if (doc.querySelector(selector) === null) {
    throw new Error(`Selector "${selector}" not found in document.`);
  }
}

export function assertNotSelector(doc: Document, selector: string) {
  if (doc.querySelector(selector) !== null) {
    throw new Error(`Selector "${selector}" found in document.`);
  }
}

export function assertMetaContent(doc: Document, nameOrProperty: string, expected: string) {
    let el = doc.querySelector(`meta[name="${nameOrProperty}"]`) as HTMLMetaElement | null;
    if (el === null) {
        el = doc.querySelector(`meta[property="${nameOrProperty}"]`) as HTMLMetaElement | null;
    }
    if (el === null) {
        throw new Error(`<meta>-tag with name or property "${nameOrProperty}" not found`);
    }
    if (el.content !== expected) {
        throw new Error(`<meta>-tag "${nameOrProperty}" has content "${el.content}" but expected "${expected}"`);
    }
}


export async function waitForText(page: Page, selector: string, text: string) {
  await page.waitForSelector(selector);
  try {
    await page.waitForFunction(
      (sel, value) => {
        const el = document.querySelector(sel);
        return el ? el.textContent === value : false;
      },
      { args: [selector, text] },
    );
  } catch (err) {
    const content = await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        return el?.textContent ?? null;
    }, selector);
    console.error(`Text "${text}" not found for selector "${selector}". Found "${content}" instead.`);
    throw err;
  }
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

export function getStdOutput(
  out: Deno.CommandOutput,
): { stdout: string; stderr: string } {
  const decoder = new TextDecoder();
  const stdout = colors.stripAnsiCode(decoder.decode(out.stdout));

  const decoderErr = new TextDecoder();
  const stderr = colors.stripAnsiCode(decoderErr.decode(out.stderr));

  return { stdout, stderr };
}

export async function waitFor(
  fn: () => Promise<unknown> | unknown,
): Promise<void> {
  let now = Date.now();
  const limit = now + 2000;

  while (now < limit) {
    try {
      if (await fn()) return;
    } catch (err) {
      if (now > limit) {
        throw err;
      }
    } finally {
      await new Promise((r) => setTimeout(r, 250));
      now = Date.now();
    }
  }

  throw new Error(`Timed out`);
}

export function createFakeFs(files: Record<string, unknown>): FsAdapter {
  return {
    cwd: () => ".",
    async *walk(_root) {
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
    async isDirectory(dir) {
      return Object.keys(files).some((file) => file.startsWith(dir + "/"));
    },
    async mkdirp(_dir: string) {
    },
    readFile: Deno.readFile,
    // deno-lint-ignore require-await
    async readTextFile(path) {
      return String(files[String(path)]);
    },
  };
}

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
