---
description: |
  Learn how to test Fresh middlewares in isolation and as part of your application.
---

# Testing Middlewares

To test [middlewares](/docs/concepts/middleware) we're going to create a dummy
app and return the relevant info we want to check in a custom `/` handler.

```ts tests/middleware/auth.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";
import { authMiddleware } from "../../middleware/auth.ts";

Deno.test("Auth middleware - sets user context", async () => {
  const handler = new App()
    .use(authMiddleware)
    .get("/", (ctx) => new Response(JSON.stringify(ctx.state.user)))
    .handler();

  const res = await handler(new Request("http://localhost"));
  const user = await res.json();

  expect(user.id).toBeDefined();
});
```

You can extend this pattern for other middlewares. When you have a middleware
that adds a header to the returned response, you can assert against that too.

## Testing middleware that modifies headers

```ts tests/middleware/header-middleware.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";

const headerMiddleware = define.middleware((ctx) => {
  const response = ctx.next();
  response.headers.set("X-Custom-Header", "test-value");
  return response;
});

Deno.test("Header middleware - adds custom header", async () => {
  const handler = new App()
    .use(headerMiddleware)
    .get("/", () => new Response("Hello"))
    .handler();

  const res = await handler(new Request("http://localhost"));

  expect(res.headers.get("X-Custom-Header")).toEqual("test-value");
});
```

## Testing middleware order

You can also test that middlewares execute in the correct order:

```ts tests/middleware/middleware-order.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";

const firstMiddleware = define.middleware((ctx) => {
  ctx.state.order = ["first"];
  return ctx.next();
});

const secondMiddleware = define.middleware((ctx) => {
  ctx.state.order.push("second");
  return ctx.next();
});

Deno.test("Middleware order", async () => {
  const handler = new App()
    .use(firstMiddleware)
    .use(secondMiddleware)
    .get("/", (ctx) => new Response(JSON.stringify(ctx.state.order)))
    .handler();

  const res = await handler(new Request("http://localhost"));
  const order = await res.json();

  expect(order).toEqual(["first", "second"]);
});
```
