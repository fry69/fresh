import { expect } from "@std/expect";
import {
  waitFor,
  waitForText,
  withBrowser,
} from "../../fresh/tests/test_utils.tsx";
import {
  buildVite,
  DEMO_DIR,
  FIXTURE_DIR,
  usingEnv,
} from "./test_utils.ts";
import * as path from "@std/path";
import { testProd, withViteProd } from "./test_prod_utils.ts";

testProd("vite build - launches", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    const res = await fetch(address);
    const text = await res.text();
    expect(text).toEqual("it works");
  });
});

testProd("vite build - creates compiled entry", async () => {
  await using viteResult = await buildVite(DEMO_DIR);
  const stat = await Deno.stat(
    path.join(viteResult.tmp, "_fresh", "compiled-entry.js"),
  );
  expect(stat.isFile).toEqual(true);
});

testProd("vite build - serves static files", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    const res = await fetch(`${address}/test_static/foo.txt`);
    const text = await res.text();
    expect(text).toEqual("it works");
  });
});

testProd("vite build - loads islands", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/island_hooks`, {
        waitUntil: "networkidle2",
      });
      await waitForText(page, "button", "count: 0");
      await page.locator("button").click();
      await waitForText(page, "button", "count: 1");
    });
  });
});

testProd("vite build - nested islands", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/island_nested`, {
        waitUntil: "networkidle2",
      });
      await page.locator(".outer-ready").wait();
      await page.locator(".inner-ready").wait();
    });
  });
});

testProd("vite build - without static/ dir", async () => {
  const fixture = path.join(FIXTURE_DIR, "no_static");
  await withViteProd({ fixture }, async (address) => {
    const res = await fetch(`${address}/ok`);
    const text = await res.text();
    expect(text).toEqual("ok");
  });
});

testProd("vite build - without islands/ dir", async () => {
  const fixture = path.join(FIXTURE_DIR, "no_islands");
  await withViteProd({ fixture }, async (address) => {
    const res = await fetch(`${address}`);
    const text = await res.text();
    expect(text).toContain("ok");
  });
});

testProd("vite build - without routes/ dir", async () => {
  const fixture = path.join(FIXTURE_DIR, "no_routes");
  await withViteProd({ fixture }, async (address) => {
    const res = await fetch(`${address}`);
    const text = await res.text();
    expect(text).toEqual("ok");
  });
});

testProd("vite build - load json inside npm package", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/mime`, {
        waitUntil: "networkidle2",
      });
      await page.locator(".ready").wait();
    });
  });
});

testProd("vite build - fetch static assets", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/assets`, {
        waitUntil: "networkidle2",
      });
      const url = await page.locator("img").evaluate((el) => (el as any).src);
      const res = await fetch(url);
      await res.body?.cancel();
      expect(res.status).toEqual(200);
      expect(res.headers.get("Content-Type")).toEqual("image/png");
    });
  });
});

testProd("vite build - tailwind no _app", async () => {
  const fixture = path.join(FIXTURE_DIR, "tailwind_no_app");
  await withViteProd({ fixture }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}`, {
        waitUntil: "networkidle2",
      });
      const href = await page
        .locator("link[rel='stylesheet']")
        .evaluate((el) => (el as any).href);
      expect(href).toMatch(/\/assets\/client-entry-.*\.css(\?.*)?$/);
    });
  });
});

testProd("vite build - tailwind _app", async () => {
  const fixture = path.join(FIXTURE_DIR, "tailwind_app");
  await withViteProd({ fixture }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}`, {
        waitUntil: "networkidle2",
      });
      const href = await page
        .locator("link[rel='stylesheet']")
        .evaluate((el) => (el as any).href);
      expect(href).toMatch(/\/assets\/client-entry-.*\.css/);
    });
  });
});

testProd("vite build - partial island", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/partial`, {
        waitUntil: "networkidle2",
      });
      await page.locator(".ready").wait();
      await page.locator("a").click();
      await page.locator(".counter-hooks").wait();
      await page.locator(".counter-hooks button").click();
      await waitForText(page, ".counter-hooks button", "count: 1");
    });
  });
});

testProd("vite build - build ID uses env variables when set", async () => {
  const revision = "test-commit-hash-123";
  Deno.env.delete("GITHUB_SHA");

  for (
    const key of [
      "DENO_DEPLOYMENT_ID",
      "GITHUB_SHA",
      "CI_COMMIT_SHA",
      "OTHER",
    ]
  ) {
    using _ = usingEnv(key, revision);
    await withViteProd({ fixture: DEMO_DIR }, async (address) => {
      const res = await fetch(`${address}/tests/build_id`);
      const text = await res.text();
      if (key === "OTHER") {
        expect(text).not.toEqual(revision);
      } else {
        expect(text).toEqual(revision);
      }
    });
  }
});

testProd("vite build - import json from jsr dependency", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    const res = await fetch(`${address}/tests/dep_json`);
    const json = await res.json();
    expect(json.name).toEqual("@marvinh-test/import-json");
  });
});

testProd("vite build - import node:*", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    const res = await fetch(`${address}/tests/feed`);
    await res.body?.cancel();
    expect(res.status).toEqual(200);
  });
});

testProd("vite build - css modules", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/css_modules`, {
        waitUntil: "networkidle2",
      });
      let color = await page
        .locator(".red > h1")
        .evaluate((el) => window.getComputedStyle(el as any).color);
      expect(color).toEqual("rgb(255, 0, 0)");
      color = await page
        .locator(".green > h1")
        .evaluate((el) => window.getComputedStyle(el as any).color);
      expect(color).toEqual("rgb(0, 128, 0)");
      color = await page
        .locator(".blue > h1")
        .evaluate((el) => window.getComputedStyle(el as any).color);
      expect(color).toEqual("rgb(0, 0, 255)");
      color = await page
        .locator(".route > h1")
        .evaluate((el) => window.getComputedStyle(el as any).color);
      expect(color).toEqual("rgb(255, 218, 185)");
    });
  });
});

testProd("vite build - route css import", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/css`, {
        waitUntil: "networkidle2",
      });
      await waitFor(async () => {
        const color = await page
          .locator("h1")
          .evaluate((el) => window.getComputedStyle(el as any).color);
        expect(color).toEqual("rgb(255, 0, 0)");
        return true;
      });
    });
  });
});

testProd("vite build - remote island", async () => {
  const fixture = path.join(FIXTURE_DIR, "remote_island");
  await withViteProd({ fixture }, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}`, {
        waitUntil: "networkidle2",
      });
      await page.locator(".remote-island").wait();
      await page.locator(".increment").click();
      await waitForText(page, ".result", "Count: 1");
    });
  });
});

testProd("vite build - error on 'node:process' import", async () => {
  const fixture = path.join(FIXTURE_DIR, "node_builtin");
  await expect(buildVite(fixture)).rejects.toThrow(
    "Node built-in modules cannot be imported in the browser",
  );
});

testProd("vite build - static index.html", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    const res = await fetch(`${address}/test_static/foo`);
    const text = await res.text();
    expect(text).toContain("<h1>ok</h1>");
  });
});

testProd("vite build - base path asset handling", async () => {
  await using res = await buildVite(DEMO_DIR, { base: "/my-app/" });
  const serverJs = await Deno.readTextFile(
    path.join(res.tmp, "_fresh", "server.js"),
  );
  expect(serverJs).toContain('"/my-app/assets/');
});

testProd("vite build - env files", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    const res = await fetch(`${address}/tests/env_files`);
    const json = await res.json();
    expect(json).toEqual({
      MY_ENV: "MY_ENV test value",
      VITE_MY_ENV: "VITE_MY_ENV test value",
      MY_LOCAL_ENV: "MY_LOCAL_ENV test value",
      VITE_MY_LOCAL_ENV: "VITE_MY_LOCAL_ENV test value",
    });
  });
});

testProd("vite build - support _middleware Array", async () => {
  await withViteProd({ fixture: DEMO_DIR }, async (address) => {
    const res = await fetch(`${address}/tests/middlewares`);
    const text = await res.text();
    expect(text).toEqual("AB");
  });
});
