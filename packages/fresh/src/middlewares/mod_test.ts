import { runMiddlewares } from "./mod.ts";
import { expect } from "@std/expect";
import { FakeServer } from "../../tests/test_utils.tsx";
import type { Middleware } from "./mod.ts";
import { App } from "../app.ts";
import type { Lazy, MaybeLazy } from "../types.ts";
import { Context } from "../context.ts";
import type { ResolvedFreshConfig } from "../config.ts";
import type { BuildCache } from "../build_cache.ts";

const DEFAULT_CONFIG: ResolvedFreshConfig = {
  root: "",
  mode: "development",
  basePath: "",
};

const STUB_BUILD_CACHE = {
    getEntryAssets: () => [],
} as unknown as BuildCache<unknown>;

Deno.test("runMiddleware", async () => {
  const middlewares: Middleware<{ text: string }>[] = [
    (ctx) => {
      ctx.state.text = "A";
      return ctx.next();
    },
    (ctx) => {
      ctx.state.text += "B";
      return ctx.next();
    },
    async (ctx) => {
      const res = await ctx.next();
      ctx.state.text += "C"; // This should not show up
      return res;
    },
    (ctx) => {
      return new Response(ctx.state.text);
    },
  ];

  const server = new FakeServer(async (req) => {
    const ctx = new Context(
        req,
        new URL(req.url),
        { remoteAddr: { transport: "tcp", hostname: "localhost", port: 8000 } },
        null,
        {},
        DEFAULT_CONFIG,
        () => Promise.resolve(new Response("")),
        STUB_BUILD_CACHE,
    );
    return await runMiddlewares(middlewares, ctx);
  });

  const res = await server.get("/");
  expect(await res.text()).toEqual("AB");
});

Deno.test("runMiddleware - middlewares should only be called once", async () => {
  const A: Middleware<{ count: number }> = (ctx) => {
    if (ctx.state.count === undefined) {
      ctx.state.count = 0;
    } else {
      ctx.state.count++;
    }
    return ctx.next();
  };

  const server = new FakeServer(async (req) => {
    const ctx = new Context(
        req,
        new URL(req.url),
        { remoteAddr: { transport: "tcp", hostname: "localhost", port: 8000 } },
        null,
        {},
        DEFAULT_CONFIG,
        () => Promise.resolve(new Response("")),
        STUB_BUILD_CACHE,
    );
    return await runMiddlewares(
      [A, (ctx) => new Response(String(ctx.state.count))],
      ctx,
    );
  });

  const res = await server.get("/");
  expect(await res.text()).toEqual("0");
});

Deno.test("runMiddleware - runs multiple stacks", async () => {
  type State = { text: string };
  const A: Middleware<State> = (ctx) => {
    ctx.state.text += "A";
    return ctx.next();
  };
  const B: Middleware<State> = (ctx) => {
    ctx.state.text += "B";
    return ctx.next();
  };
  const C: Middleware<State> = (ctx) => {
    ctx.state.text += "C";
    return ctx.next();
  };
  const D: Middleware<State> = (ctx) => {
    ctx.state.text += "D";
    return ctx.next();
  };

  const server = new FakeServer(async (req) => {
    const ctx = new Context<State>(
        req,
        new URL(req.url),
        { remoteAddr: { transport: "tcp", hostname: "localhost", port: 8000 } },
        null,
        {},
        DEFAULT_CONFIG,
        () => Promise.resolve(new Response("")),
        STUB_BUILD_CACHE as BuildCache<State>,
    );
    ctx.state.text = "";
    return await runMiddlewares(
      [
        A,
        B,
        C,
        D,
        (ctx) => new Response(String(ctx.state.text)),
      ],
      ctx,
    );
  });

  const res = await server.get("/");
  expect(await res.text()).toEqual("ABCD");
});

Deno.test("runMiddleware - throws errors", async () => {
  let thrownA: unknown = null;
  let thrownB: unknown = null;
  let thrownC: unknown = null;

  const middlewares: Middleware<{ text: string }>[] = [
    async (ctx) => {
      try {
        return await ctx.next();
      } catch (err) {
        thrownA = err;
        throw err;
      }
    },
    async (ctx) => {
      try {
        return await ctx.next();
      } catch (err) {
        thrownB = err;
        throw err;
      }
    },
    async (ctx) => {
      try {
        return await ctx.next();
      } catch (err) {
        thrownC = err;
        throw err;
      }
    },
    () => {
      throw new Error("fail");
    },
  ];

  const server = new FakeServer(async (req) => {
    const ctx = new Context(
        req,
        new URL(req.url),
        { remoteAddr: { transport: "tcp", hostname: "localhost", port: 8000 } },
        null,
        {},
        DEFAULT_CONFIG,
        () => Promise.resolve(new Response("")),
        STUB_BUILD_CACHE,
    );
    return await runMiddlewares(middlewares, ctx);
  });

  try {
    await server.get("/");
  } catch {
    // ignore
  }
  expect(thrownA).toBeInstanceOf(Error);
  expect(thrownB).toBeInstanceOf(Error);
  expect(thrownC).toBeInstanceOf(Error);
});

Deno.test("runMiddleware - lazy middlewares", async () => {
  type State = { text: string };

  let called = 0;
  // deno-lint-ignore require-await
  const lazy: Lazy<Middleware<State>> = async () => {
    called++;
    return (ctx) => {
      ctx.state.text += "_lazy";
      return ctx.next();
    };
  };

  const middlewares: MaybeLazy<Middleware<State>>[] = [
    async (ctx) => {
      ctx.state.text = "A";
      return await ctx.next();
    },
    lazy,
    (ctx) => {
      ctx.state.text += "_B";
      return new Response(ctx.state.text);
    },
  ];

  const server = new FakeServer(async (req) => {
    const ctx = new Context<State>(
        req,
        new URL(req.url),
        { remoteAddr: { transport: "tcp", hostname: "localhost", port: 8000 } },
        null,
        {},
        DEFAULT_CONFIG,
        () => Promise.resolve(new Response("")),
        STUB_BUILD_CACHE as BuildCache<State>,
    );
    return await runMiddlewares(middlewares, ctx);
  });

  let res = await server.get("/");
  expect(await res.text()).toEqual("A_lazy_B");
  expect(called).toEqual(1);

  // Lazy middlewares should only be initialized ones
  res = await server.get("/");
  expect(await res.text()).toEqual("A_lazy_B");
  expect(called).toEqual(1);
});
