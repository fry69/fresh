---
description: |
  Learn how to test Fresh islands including server-side rendering and client-side interactivity.
---

# Testing Islands

Testing islands requires different approaches for server-side and client-side
behavior. Most of the time, testing server-side rendering is sufficient for
validating your islands work correctly.

## Server-side Rendering of Islands

You can test that your islands render correctly on the server using the Fresh
[`App`](/docs/concepts/app) pattern. Note: this requires a `.tsx` file extension
to use JSX:

```tsx tests/islands/island-ssr.test.tsx
import { expect } from "@std/expect";
import { App } from "fresh";
import Counter from "../../islands/Counter.tsx";

Deno.test("Counter page renders island", async () => {
  const app = new App().get("/counter", (ctx) => {
    return ctx.render(
      <div className="p-8">
        <h1>Counter Test Page</h1>
        <Counter />
      </div>,
    );
  });
  const handler = app.handler();

  const response = await handler(new Request("http://localhost/counter"));
  const html = await response.text();

  // Verify the island's initial HTML is present
  expect(html).toContain('class="counter"');
  expect(html).toContain("count: 0");
});
```

## Testing Island Props

You can test that islands receive and render props correctly:

```tsx tests/islands/island-props.test.tsx
import { expect } from "@std/expect";
import { App } from "fresh";
import UserCard from "../../islands/UserCard.tsx";

Deno.test("UserCard island renders with props", async () => {
  const userData = { name: "John Doe", email: "john@example.com" };

  const app = new App().get("/user", (ctx) => {
    return ctx.render(
      <div>
        <h1>User Profile</h1>
        <UserCard user={userData} />
      </div>,
    );
  });
  const handler = app.handler();

  const response = await handler(new Request("http://localhost/user"));
  const html = await response.text();

  expect(html).toContain("John Doe");
  expect(html).toContain("john@example.com");
});
```

## Testing Multiple Islands

You can test pages that contain multiple islands:

```tsx tests/islands/multiple-islands.test.tsx
import { expect } from "@std/expect";
import { App } from "fresh";
import Header from "../../islands/Header.tsx";
import Sidebar from "../../islands/Sidebar.tsx";
import Footer from "../../islands/Footer.tsx";

Deno.test("Dashboard renders all islands", async () => {
  const app = new App().get("/dashboard", (ctx) => {
    return ctx.render(
      <div>
        <Header user={{ name: "Admin" }} />
        <main className="flex">
          <Sidebar />
          <div className="content">
            <h1>Dashboard Content</h1>
          </div>
        </main>
        <Footer />
      </div>,
    );
  });
  const handler = app.handler();

  const response = await handler(new Request("http://localhost/dashboard"));
  const html = await response.text();

  // Check that all island components are present
  expect(html).toContain('class="header"');
  expect(html).toContain('class="sidebar"');
  expect(html).toContain('class="footer"');
  expect(html).toContain("Admin");
});
```

## Client-side Island Interactivity

For testing client-side island behavior (clicks, state changes, etc.), you need
a full build and browser environment. You can use the approach similar to
Fresh's own tests:

```tsx tests/islands/island-client.test.tsx
import { expect } from "@std/expect";
import { createBuilder } from "vite";
import * as path from "@std/path";

// Create a production build
const builder = await createBuilder({
  logLevel: "error",
  root: "./",
  build: { emptyOutDir: true },
  environments: {
    ssr: { build: { outDir: path.join("_fresh", "server") } },
    client: { build: { outDir: path.join("_fresh", "client") } },
  },
});
await builder.buildApp();

const app = await import("./_fresh/server.js");

Deno.test("Counter island renders correctly", async () => {
  // Start production server
  const server = Deno.serve({
    port: 0,
    handler: app.default.fetch,
  });

  const { port } = server.addr as Deno.NetAddr;
  const address = `http://localhost:${port}`;

  try {
    // Basic smoke test: verify the island HTML is served
    const response = await fetch(`${address}/counter`);
    const html = await response.text();

    expect(html).toContain('class="counter"');
    expect(html).toContain("count: 0");

    // For full browser interactivity testing, you would need:
    // - Browser automation tools (Puppeteer, Playwright)
    // - withBrowser utility from Fresh's test suite
  } finally {
    await server.shutdown();
  }
});
```

## Testing Island Error Boundaries

You can test that islands handle errors gracefully:

```tsx tests/islands/island-errors.test.tsx
import { expect } from "@std/expect";
import { App } from "fresh";

// Island component that might throw an error
function ProblematicIsland({ shouldError }: { shouldError?: boolean }) {
  if (shouldError) {
    throw new Error("Island error");
  }

  return <div>Island content</div>;
}

Deno.test("Island error handling", async () => {
  const app = new App().get("/test", (ctx) => {
    return ctx.render(
      <div>
        <h1>Test Page</h1>
        <ProblematicIsland shouldError={false} />
      </div>,
    );
  });
  const handler = app.handler();

  const response = await handler(new Request("http://localhost/test"));
  const html = await response.text();

  expect(html).toContain("Island content");
  expect(response.status).toBe(200);
});
```

## Testing Island Data Fetching

If your islands fetch data on the server-side, you can test this behavior:

```tsx tests/islands/data-island.test.tsx
import { expect } from "@std/expect";
import { App } from "fresh";

// Mock data fetching function
async function fetchUserData(userId: string) {
  return { id: userId, name: `User ${userId}` };
}

function DataIsland({ userId }: { userId: string }) {
  // In a real island, this might be done with server-side data fetching
  const userData = { id: userId, name: `User ${userId}` };

  return (
    <div className="user-data">
      <p>ID: {userData.id}</p>
      <p>Name: {userData.name}</p>
    </div>
  );
}

Deno.test("DataIsland displays user information", async () => {
  const app = new App().get("/user/:id", (ctx) => {
    const { id } = ctx.params;
    return ctx.render(
      <div>
        <h1>User Details</h1>
        <DataIsland userId={id} />
      </div>,
    );
  });
  const handler = app.handler();

  const response = await handler(new Request("http://localhost/user/123"));
  const html = await response.text();

  expect(html).toContain("ID: 123");
  expect(html).toContain("Name: User 123");
});
```

**Note:** For most applications, testing the server-side rendering is
sufficient. Only test client-side interactivity if you have complex island logic
that needs verification or if you're building a highly interactive application
where client-side behavior is critical.

## Browser Testing Setup

For comprehensive client-side testing, you'll need browser automation tools
like:

- **Puppeteer**: For controlling Chrome/Chromium
- **Playwright**: For cross-browser testing
- **deno_dom**: For DOM manipulation testing without a browser

These tools allow you to:

- Test user interactions (clicks, form submissions)
- Verify dynamic state changes
- Test island communication
- Validate accessibility features
- Test responsive behavior
