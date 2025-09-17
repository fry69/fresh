# Vite Plugin Tests Design Document

This document outlines the current testing strategy for the Fresh Vite plugin. The tests are located in the `packages/plugin-vite/tests` directory.

## Test Utilities (`test_utils.ts`)

The core of the testing setup is in `packages/plugin-vite/tests/test_utils.ts`. This file provides several utility functions for creating temporary test environments, building the project, and running a development server.

### `setup(testdata: string)`

This function is the foundation for the other test utilities. Its main responsibilities are:

- **Temporary Directory Creation:** It creates a new temporary directory for each test run using `Deno.makeTempDirSync`. However, it creates these directories within the project's root directory, leading to clutter in the repository.
- **Fixture Copying:** It copies a specified `testdata` fixture from the `packages/plugin-vite/tests/fixture` directory into the temporary directory.
- **Working Directory Change:** It changes the current working directory to the newly created temporary directory using `Deno.chdir()`. This is a problematic practice that can lead to flaky tests and difficult debugging.
- **Root Path Calculation:** It calculates the project's root path by traversing up the directory tree from the `test_utils.ts` file's location. This approach is brittle and will break if the directory structure is changed.
- **Cleanup:** It returns a `cleanup` function that reverts the working directory change and removes the temporary directory.

### `withDevServer(fixture: string, fn: (server: Server) => Promise<void>)`

This function is a wrapper around `setup` that starts a development server for a given fixture. It handles the server setup and teardown, allowing tests to focus on interacting with the running server.

### `buildVite(path: string)`

This function is used to test the production build process. It takes a path to a fixture, creates a temporary directory, and runs the Vite build process, outputting the build artifacts into the temporary directory.

### `updateFile(path: string, content: string)`

This utility is used for testing Hot Module Replacement (HMR). It overwrites a file with new content, which should trigger a reload in the development server.

### `spawnDevServer(path: string)`

This function spawns a dev server as a child process. This is used for tests that need to interact with the server as an external process.

## Test Files

### `build_test.ts`

This file contains tests for the production build output. It uses the `buildVite` utility to create a build from a fixture and then asserts that the output is correct. For example, it checks that the correct number of island files are generated and that the generated HTML is valid.

### `dev_server_test.ts`

This file contains tests for the development server. It uses the `withDevServer` and `spawnDevServer` utilities to start a server and then uses a headless browser (via `withBrowser`) to interact with the running application. These tests cover a wide range of functionality, including:

- Serving static files
- Island loading and hydration
- Hot Module Replacement (HMR)
- Tailwind CSS integration
- Partial rendering

## Pain Points

The current testing setup has several pain points:

- **Relative Paths and Temporary Directories:** The use of relative paths and the creation of temporary directories within the project repository make the tests messy and hard to reason about.
- **`Deno.chdir()`:** Changing the current working directory is a major source of flakiness and makes it difficult to run tests in parallel.
- **Redundant Logic:** There is a lot of redundant logic in the test utilities that could be simplified and consolidated.
- **Brittleness:** The way the project root is calculated is brittle and prone to breaking.
- **Hard to Debug:** The complexity of the test utilities and the side effects they produce (like changing the CWD) make debugging failing tests a difficult task.
