---
description: |
  Learn how to test Fresh app wrappers and layouts to ensure proper rendering and functionality.
---

# Testing App Wrappers and Layouts

Both the [app wrapper](/docs/advanced/app-wrapper) component and
[layouts](/docs/advanced/layouts) can be tested using the same pattern with the
Fresh `App`.

## Testing App Wrappers

You can test that your app wrapper renders correctly and includes the expected
HTML structure:

```tsx tests/layouts/_app.test.tsx
import { expect } from "@std/expect";
import { App } from "fresh";
import { define, type State } from "../utils.ts";

const AppWrapper = define.layout(function AppWrapper({ Component }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>My App</title>
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
});

Deno.test("App Wrapper - renders title and content", async () => {
  const handler = new App<State>()
    .appWrapper(AppWrapper)
    .get("/", (ctx) => ctx.render(<h1>hello</h1>))
    .handler();

  const res = await handler(new Request("http://localhost"));
  const text = await res.text();

  expect(text).toContain("My App");
  expect(text).toContain("hello");
});
```

## Testing Layouts

Layouts can be tested in the same way as app wrappers:

```tsx tests/layouts/_layout.test.tsx
import { expect } from "@std/expect";
import { App } from "fresh";
import { define, type State } from "../utils.ts";

const MyLayout = define.layout(function MyLayout({ Component }) {
  return (
    <div>
      <h1>My Layout</h1>
      <Component />
    </div>
  );
});

Deno.test("MyLayout - renders heading and content", async () => {
  const handler = new App<State>()
    .appWrapper(MyLayout)
    .get("/", (ctx) => ctx.render(<h1>hello</h1>))
    .handler();

  const res = await handler(new Request("http://localhost"));
  const text = await res.text();

  expect(text).toContain("My Layout");
  expect(text).toContain("hello");
});
```

## Testing Nested Layouts

You can also test more complex layout hierarchies:

```tsx tests/layouts/nested-layout.test.tsx
import { expect } from "@std/expect";
import { App } from "fresh";
import { define, type State } from "../utils.ts";

const AppWrapper = define.layout(function AppWrapper({ Component }) {
  return (
    <html>
      <body>
        <nav>Navigation</nav>
        <main>
          <h1>Page Header</h1>
          <Component />
        </main>
      </body>
    </html>
  );
});

Deno.test("Nested layouts render correctly", async () => {
  const handler = new App<State>()
    .appWrapper(AppWrapper)
    .get("/page/content", (ctx) => ctx.render(<p>Page content</p>))
    .handler();

  const res = await handler(new Request("http://localhost/page/content"));
  const html = await res.text();

  expect(html).toContain("Navigation");
  expect(html).toContain("Page Header");
  expect(html).toContain("Page content");
});
```

## Testing Layout Props

```tsx tests/layouts/layout-props.test.tsx
import { expect } from "@std/expect";
import { App } from "fresh";
import { define, type State } from "../utils.ts";

interface AppState extends State {
  user?: { name: string };
}

const Layout = define.layout(function Layout({ Component, state }) {
  const appState = state as AppState;
  return (
    <div>
      <header>
        Welcome, {appState.user?.name || "Guest"}!
      </header>
      <Component />
    </div>
  );
});

Deno.test("Layout receives data props", async () => {
  const handler = new App<State>()
    .use((ctx) => {
      // Add user data to the state via middleware
      (ctx.state as AppState).user = { name: "John" };
      return ctx.next();
    })
    .layout("*", Layout)
    .get("/", (ctx) => ctx.render(<p>Content</p>))
    .handler();

  const res = await handler(new Request("http://localhost"));
  const html = await res.text();

  expect(html).toContain("Welcome, John!");
});
```
