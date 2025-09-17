# Vite Plugin Test Refactoring Proposal

This document outlines a plan to refactor the tests for the `plugin-vite` package. The goal is to address several pain points in the current test suite, making the tests cleaner, more robust, and easier to maintain.

## Current Pain Points

1.  **Temporary Directories in Project Folder**: Tests create temporary directories (e.g., `tmp_vite_*`) inside the `packages/plugin-vite` directory. This clutters the project structure with temporary artifacts.
2.  **Redundant Code**:
    -   Every test definition includes `{ sanitizeOps: false, sanitizeResources: false }`, which is verbose and repetitive.
    -   The setup logic for building the project and launching a production server is repeated in many tests, often with slight variations.
3.  **Lack of Test Isolation**: Many tests in `build_test.ts` run against a single, shared build artifact created at the module's top level. This makes the tests interdependent and can lead to hard-to-debug issues.
4.  **Poor Readability**: The significant amount of boilerplate for server and browser setup in each test obscures the actual test's intent.
5.  **Monolithic Test Files**: Files like `build_test.ts` have grown to include tests for many unrelated features, making them difficult to navigate.

## Proposed Solution

To address these issues, I propose the following changes:

### 1. Use System-Level Temporary Directories

I will modify the `withTmpDir` utility in `packages/plugin-vite/tests/test_utils.ts` to create temporary directories in the operating system's default temporary location (e.g., `/tmp`). This will be achieved by removing the `dir` option from the `withTmpDir` call, letting it use the system default.

### 2. Introduce a New Test Abstraction Layer

I will create a new file, `packages/plugin-vite/tests/test_prod_utils.ts`, to house higher-level abstractions for production build tests.

-   **`testProd()` function**: A wrapper around `Deno.test` that will automatically apply the `{ sanitizeOps: false, sanitizeResources: false }` options, removing this boilerplate from the test files.
-   **`withViteProd()` helper**: A comprehensive helper that encapsulates the entire lifecycle of a production test. It will:
    1.  Accept a fixture directory path.
    2.  Build the fixture using Vite.
    3.  Launch the production server.
    4.  Pass the server's address to the test function.
    5.  Handle all cleanup of temporary directories and child processes.

### 3. Refactor Existing Tests

I will refactor `build_test.ts` and `dev_server_test.ts` to use these new abstractions.

-   **`build_test.ts`**: Each test will become self-contained, building its own fixture using `withViteProd`. This will improve test isolation. The tests will be rewritten using `testProd` to remove redundant options.
-   **`dev_server_test.ts`**: Similar abstractions will be created (e.g., `withViteDev`) to simplify dev server tests, reducing boilerplate and improving readability.

### 4. (Optional) Split Test Files

While not a primary goal for this task, the new abstractions will make it much easier to split large test files like `build_test.ts` into smaller, feature-focused files (e.g., `build_islands_test.ts`, `build_css_test.ts`, etc.) in the future.

By implementing these changes, the test suite will become significantly cleaner, more robust, and easier for developers to work with.
