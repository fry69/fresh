import { buildVite, launchProd, ProdOptions } from "./test_utils.ts";

// deno-lint-ignore no-explicit-any
export function testProd(name: string, fn: () => Promise<void>) {
  Deno.test({
    name,
    fn,
    sanitizeOps: false,
    sanitizeResources: false,
  });
}

export interface WithViteProdOptions {
  fixture: string;
  launch?: Partial<ProdOptions>;
}

export async function withViteProd(
  options: WithViteProdOptions,
  fn: (address: string) => void | Promise<void>,
) {
  await using viteResult = await buildVite(options.fixture);
  await launchProd(
    { cwd: viteResult.tmp, ...options.launch },
    fn,
  );
}
