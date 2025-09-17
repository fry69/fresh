import * as path from "@std/path";
import { expect } from "@std/expect";
import {
  waitFor,
  waitForText,
  withBrowser,
} from "../../fresh/tests/test_utils.tsx";
import {
  DEMO_DIR,
  FIXTURE_DIR,
  updateFile,
} from "./test_utils.ts";
import { testDev, withViteDev } from "./test_dev_utils.ts";

testDev("vite dev - launches", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(`${address}/tests/it_works`);
    const text = await res.text();
    expect(text).toContain("it works");
  });
});

testDev("vite dev - serves static files", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(`${address}/test_static/foo.txt`);
    const text = await res.text();
    expect(text).toContain("it works");
  });
});

testDev("vite dev - loads islands", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
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

testDev("vite dev - starts without static/ dir", async () => {
  const fixture = path.join(FIXTURE_DIR, "no_static");
  await withViteDev(fixture, async (address) => {
    const res = await fetch(`${address}/`);
    const text = await res.text();
    expect(text).toContain("ok");
  });
});

testDev("vite dev - starts without islands/ dir", async () => {
  const fixture = path.join(FIXTURE_DIR, "no_islands");
  await withViteDev(fixture, async (address) => {
    const res = await fetch(`${address}/`);
    const text = await res.text();
    expect(text).toContain("ok");
  });
});

testDev("vite dev - starts without routes/ dir", async () => {
  const fixture = path.join(FIXTURE_DIR, "no_routes");
  await withViteDev(fixture, async (address) => {
    const res = await fetch(`${address}/`);
    const text = await res.text();
    expect(text).toContain("ok");
  });
});

testDev("vite dev - can apply HMR to islands (hooks)", async () => {
  await withViteDev(DEMO_DIR, async (address, dir) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/island_hooks`, {
        waitUntil: "networkidle2",
      });
      await waitForText(page, "button", "count: 0");
      await page.locator("button").click();
      await waitForText(page, "button", "count: 1");

      const island = path.join(
        dir,
        "islands",
        "tests",
        "CounterHooks.tsx",
      );
      await using _ = await updateFile(
        island,
        (text) => text.replace("count:", "hmr:"),
      );

      await waitForText(page, "button", "hmr: 1");
      await page.locator("button").click();
      await waitForText(page, "button", "hmr: 2");
    });
  });
}, true);

testDev("vite dev - can import json in npm package", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/mime`, {
        waitUntil: "networkidle2",
      });
      await page.locator(".ready").wait();
    });
  });
});

testDev("vite dev - inline env vars", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/env`, {
        waitUntil: "networkidle2",
      });
      await page.locator(".ready").wait();

      const res = await page.locator("pre").evaluate((el) =>
        (el as any).textContent ?? ""
      );

      expect(JSON.parse(res)).toEqual({ deno: "foobar", nodeEnv: "foobar" });
    });
  }, { FRESH_PUBLIC_FOO: "foobar" });
});

testDev("vite dev - serves imported assets", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    let res = await fetch(`${address}/tests/assets`);
    await res.body?.cancel();

    res = await fetch(`${address}/assets/deno-logo.png`);
    expect(res.status).toEqual(200);
    expect(res.headers.get("Content-Type")).toEqual("image/png");
  });
});

testDev("vite dev - tailwind no _app", async () => {
  const fixture = path.join(FIXTURE_DIR, "tailwind_no_app");
  await withViteDev(fixture, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}`, {
        waitUntil: "networkidle2",
      });
      await page.locator("style[data-vite-dev-id$='style.css']").wait();
    });
  });
});

testDev("vite dev - tailwind _app", async () => {
  const fixture = path.join(FIXTURE_DIR, "tailwind_app");
  await withViteDev(fixture, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}`, {
        waitUntil: "networkidle2",
      });
      await page.locator("style[data-vite-dev-id$='style.css']").wait();
    });
  });
});

testDev("vite dev - partial island", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
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

testDev("vite dev - json from jsr dependency", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(`${address}/tests/dep_json`);
    const json = await res.json();
    expect(json.name).toEqual("@marvinh-test/import-json");
  });
});

testDev("vite dev - import node:*", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(`${address}/tests/feed`);
    await res.body?.cancel();
    expect(res.status).toEqual(200);
  });
});

testDev("vite dev - css modules", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/css_modules`, {
        waitUntil: "networkidle2",
      });

      await waitFor(async () => {
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
        return true;
      });
    });
  });
});

testDev("vite dev - route css import", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
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

testDev("vite dev - nested islands", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    await withBrowser(async (page) => {
      await page.goto(`${address}/tests/island_nested`, {
        waitUntil: "networkidle2",
      });

      await page.locator(".outer-ready").wait();
      await page.locator(".inner-ready").wait();
    });
  });
});

testDev("vite dev - remote island", async () => {
  const fixture = path.join(FIXTURE_DIR, "remote_island");
  await withViteDev(fixture, async (address) => {
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

testDev("vite dev - error on 'node:process' import", async () => {
  const fixture = path.join(FIXTURE_DIR, "node_builtin");
  await withViteDev(fixture, async (address) => {
    let res = await fetch(`${address}`);
    await res.body?.cancel();

    res = await fetch(`${address}/@id/fresh-island::NodeIsland`);
    await res.body?.cancel();

    expect(res.status).toEqual(500);
  });
});

testDev("vite dev - allow routes looking like static paths", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(
      `${address}/tests/api/@marvinh@infosec.exchange`,
    );
    const text = await res.text();
    expect(text).toEqual("ok");
  });
});

testDev("vite dev - npm:pg", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(`${address}/tests/pg`);
    const text = await res.text();
    expect(text).toContain("<h1>pg</h1>");
  });
});

testDev("vite dev - npm:ioredis", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(`${address}/tests/ioredis`);
    const text = await res.text();
    expect(text).toContain("<h1>ioredis</h1>");
  });
});

testDev("vite dev - radix", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(`${address}/tests/radix`);
    const text = await res.text();
    expect(text).toContain("click me</button>");
  });
});

testDev("vite dev - static index.html", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(`${address}/test_static/foo`);
    const text = await res.text();
    expect(text).toContain("<h1>ok</h1>");
  });
});

testDev("vite dev - load .env files", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
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

testDev("vite dev - support _middleware Array", async () => {
  await withViteDev(DEMO_DIR, async (address) => {
    const res = await fetch(`${address}/tests/middlewares`);
    const text = await res.text();
    expect(text).toEqual("AB");
  });
});
