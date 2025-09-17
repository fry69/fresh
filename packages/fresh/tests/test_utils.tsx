import {
  withBrowser as withBrowserInternal,
  parseHtml,
  prettyDom,
  assertSelector,
  assertNotSelector,
  waitForText,
  type TestDocument,
  withChildProcessServer,
  browser,
} from "@internal/testing";
import type { Page } from "@astral/astral";
import * as path from "@std/path";
import type { App } from "../src/app.ts";
import { Builder, type BuildOptions } from "../src/dev/builder.ts";
import type { ComponentChildren } from "preact";

export {
  assertNotSelector,
  assertSelector,
  parseHtml,
  prettyDom,
  type TestDocument,
  waitForText,
  withChildProcessServer,
};

export async function withBrowserApp(
  app: App,
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

export async function withBrowser(fn: (page: Page) => void | Promise<void>) {
  await withBrowserInternal(fn);
}

export const ALL_ISLAND_DIR = path.join(
  import.meta.dirname!,
  "fixtures_islands",
);
export const ISLAND_GROUP_DIR = path.join(
  import.meta.dirname!,
  "fixture_island_groups",
);

export async function buildProd(
  options: Omit<BuildOptions, "outDir">,
): Promise<<T>(app: App<T>) => void> {
  const outDir = await Deno.makeTempDir();
  const builder = new Builder({ outDir, ...options });
  return await builder.build({ mode: "production", snapshot: "memory" });
}

export const charset = <meta charSet="utf-8" />;
export const favicon = <link href="data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAYAAABPYyMiAAAABmJLR0T///////8JWPfcAAAACXBIWXMAAABIAAAASABGyWs+AAAAF0lEQVRIx2NgGAWjYBSMglEwCkbBSAcACBAAAeaR9cIAAAAASUVORK5CYII=" rel="icon" type="image/x-icon" />;
export function Doc(props: { children?: ComponentChildren; title?: string }) {
  return (
    <html>
      <head>
        {charset}
        <title>{props.title ?? "Test"}</title>
        {favicon}
      </head>
      <body>
        {props.children}
      </body>
    </html>
  );
}

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
