---
description: |
  Learn how to test Fresh applications including middlewares, routes, handlers, and islands.
---

# Testing Fresh Applications

To ensure that your application works as expected we can write tests. Any aspect
of Fresh can be tested as a whole together or in isolation. We use Deno's
built-in [test runner](https://docs.deno.com/runtime/fundamentals/testing/) to
write tests.

Fresh provides flexible testing patterns that allow you to test different parts
of your application in isolation or as integrated units. The main approach uses
the Fresh [`App`](/docs/concepts/app) class to create testable instances of your
application components.

## What You Can Test

- **[Middlewares](./middlewares)** - Test middleware logic, state management,
  and request/response transformations
- **[App Wrappers and Layouts](./layouts)** - Test your application's HTML
  structure and layout components
- **[Routes and Handlers](./routes)** - Test route logic, API endpoints, and
  request handling
- **[Islands](./islands)** - Test both server-side rendering and client-side
  interactivity

## Getting Started

All tests use the same basic pattern with the Fresh `App` class:

```ts tests/basic-test.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";

Deno.test("Basic Fresh test", async () => {
  const handler = new App()
    .get("/", () => new Response("Hello World"))
    .handler();

  const res = await handler(new Request("http://localhost"));
  const text = await res.text();

  expect(text).toEqual("Hello World");
});
```

This pattern allows you to create isolated test environments without needing to
start a full server or build process.

## Test Organization

We recommend organizing your tests in a dedicated `tests/` folder to keep them
separate from your application code and avoid potential conflicts with Fresh's
file-based routing:

```
tests/
  middleware/
    auth.test.ts
  routes/
    index.test.ts
    api/
      users.test.ts
  islands/
    Counter.test.tsx
  layouts/
    MainLayout.test.tsx
```

## Running Tests

Use Deno's built-in test runner to execute your tests:

```bash
# Run all tests
deno test

# Run specific test files
deno test tests/routes/api/users.test.ts

# Run tests with watch mode
deno test --watch
```

## Next Steps

- **[Testing Middlewares](./middlewares)** - Learn how to test middleware
  functions and their effects on requests and responses
- **[Testing Layouts](./layouts)** - Learn how to test app wrappers and layout
  components
- **[Testing Routes](./routes)** - Learn how to test route handlers, API
  endpoints, and request processing
- **[Testing Islands](./islands)** - Learn how to test both server-side
  rendering and client-side behavior of islands
