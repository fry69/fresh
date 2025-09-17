import { launch, type Page } from "@astral/astral";
import * as colors from "@std/fmt/colors";
import { DOMParser, HTMLElement } from "linkedom";
import { TextLineStream } from "@std/streams/text-line-stream";
import * as path from "@std/path";
import { mergeReadableStreams } from "@std/streams";

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
        console.warn(`Failed to clean up temp dir, ignoring: ${err.message}`);
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
          console.warn(`Failed to clean up temp dir, ignoring: ${err.message}`);
          return;
        }
        throw err;
      }
    },
  };
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

  for (const attr of node.attributes) {
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
  const doc = new DOMParser().parseFromString(input, "text/html") as TestDocument;
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
    const el = await page.evaluateHandle((sel) => document.querySelector(sel), selector);
    const content = await el.evaluate((el) => el?.textContent);
    el.dispose();
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
