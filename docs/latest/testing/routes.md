---
description: |
  Learn how to test Fresh routes and handlers to ensure your application logic works correctly.
---

# Testing Routes and Handlers

For testing your route handlers and business logic, you can use the Fresh
[`App`](/docs/concepts/app) pattern. Fresh 2.0 makes it easy to test individual
routes without needing a full build process.

## Testing Basic Routes

```ts tests/routes/my-routes.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";

// Import your route handlers
import { handler as indexHandler } from "../../routes/index.ts";
import { handler as apiHandler } from "../../routes/api/users.ts";

Deno.test("Index route returns homepage", async () => {
  const app = new App().get("/", indexHandler);
  const handler = app.handler();

  const response = await handler(new Request("http://localhost/"));
  const text = await response.text();

  expect(text).toContain("Welcome");
});

Deno.test("API route returns JSON", async () => {
  const app = new App().get("/api/users", apiHandler);
  const handler = app.handler();

  const response = await handler(new Request("http://localhost/api/users"));
  const json = await response.json();

  expect(json).toEqual({ users: [] });
});
```

## Testing Route Parameters

```ts tests/routes/dynamic-routes.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";

const userHandler = (ctx) => {
  const { id } = ctx.params;
  return new Response(JSON.stringify({ userId: id, name: `User ${id}` }), {
    headers: { "Content-Type": "application/json" },
  });
};

Deno.test("User route with dynamic parameter", async () => {
  const app = new App().get("/users/:id", userHandler);
  const handler = app.handler();

  const response = await handler(new Request("http://localhost/users/123"));
  const json = await response.json();

  expect(json.userId).toBe("123");
  expect(json.name).toBe("User 123");
});
```

## Testing POST Handlers

```ts tests/routes/post-handler.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";

const createUserHandler = async (ctx) => {
  const body = await ctx.req.json();

  // Simulate user creation
  const newUser = {
    id: Date.now(),
    name: body.name,
    email: body.email,
  };

  return new Response(JSON.stringify(newUser), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

Deno.test("Create user POST handler", async () => {
  const app = new App().post("/users", createUserHandler);
  const handler = app.handler();

  const userData = { name: "John Doe", email: "john@example.com" };
  const response = await handler(
    new Request("http://localhost/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    }),
  );

  expect(response.status).toBe(201);

  const json = await response.json();
  expect(json.name).toBe("John Doe");
  expect(json.email).toBe("john@example.com");
  expect(json.id).toBeDefined();
});
```

## Testing Error Handling

```ts tests/routes/error-handling.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";

const errorProneHandler = (ctx) => {
  const { id } = ctx.params;

  if (id === "invalid") {
    return new Response(
      JSON.stringify({ error: "Invalid user ID" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ userId: id }), {
    headers: { "Content-Type": "application/json" },
  });
};

Deno.test("Handler returns 400 for invalid input", async () => {
  const app = new App().get("/users/:id", errorProneHandler);
  const handler = app.handler();

  const response = await handler(
    new Request("http://localhost/users/invalid"),
  );

  expect(response.status).toBe(400);

  const json = await response.json();
  expect(json.error).toBe("Invalid user ID");
});
```

## Testing Handlers with State

Test handlers that depend on middleware state:

```ts tests/routes/stateful-handler.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";

const authMiddleware = define.middleware((ctx) => {
  // Simulate authentication
  ctx.state.user = { id: 1, name: "Test User" };
  return ctx.next();
});

const profileHandler = (ctx) => {
  if (!ctx.state.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response(JSON.stringify(ctx.state.user), {
    headers: { "Content-Type": "application/json" },
  });
};

Deno.test("Profile handler uses authenticated user", async () => {
  const app = new App()
    .use(authMiddleware)
    .get("/profile", profileHandler);
  const handler = app.handler();

  const response = await handler(new Request("http://localhost/profile"));
  const json = await response.json();

  expect(json.id).toBe(1);
  expect(json.name).toBe("Test User");
});
```

## Testing Query Parameters

Test handlers that process URL query parameters:

```ts tests/routes/query-params.test.ts
import { expect } from "@std/expect";
import { App } from "fresh";

const searchHandler = (ctx) => {
  const url = new URL(ctx.req.url);
  const query = url.searchParams.get("q");
  const limit = parseInt(url.searchParams.get("limit") || "10");

  return new Response(
    JSON.stringify({
      query,
      limit,
      results: [`Result for "${query}"`],
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
};

Deno.test("Search handler processes query parameters", async () => {
  const app = new App().get("/search", searchHandler);
  const handler = app.handler();

  const response = await handler(
    new Request("http://localhost/search?q=test&limit=5"),
  );
  const json = await response.json();

  expect(json.query).toBe("test");
  expect(json.limit).toBe(5);
  expect(json.results).toEqual(['Result for "test"']);
});
```
