import { withDevServer } from "./test_utils.ts";

export function testDev(
  name: string,
  fn: () => Promise<void> | void,
  ignore = false,
) {
  Deno.test({
    name,
    fn,
    ignore,
    sanitizeOps: false,
    sanitizeResources: false,
  });
}

export async function withViteDev(
  fixture: string,
  fn: (address: string, dir: string) => void | Promise<void>,
  env: Record<string, string> = {},
) {
  await withDevServer(fixture, fn, env);
}
