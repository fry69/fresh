import { TextLineStream } from "@std/streams/text-line-stream";
import { mergeReadableStreams } from "@std/streams/merge-readable-streams";
import * as colors from "@std/fmt/colors";

export interface TestChildServerOptions {
  cwd: string;
  args: string[];
  bin?: string;
  env?: Record<string, string>;
}

export async function withChildProcessServer(
  options: TestChildServerOptions,
  fn: (address: string) => void | Promise<void>,
) {
  const aborter = new AbortController();
  const cp = await new Deno.Command(options.bin ?? Deno.execPath(), {
    args: options.args,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    cwd: options.cwd,
    signal: aborter.signal,
    env: options.env,
  }).spawn();

  const linesStdout: ReadableStream<string> = cp.stdout
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());

  const linesStderr: ReadableStream<string> = cp.stderr
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());

  const lines = mergeReadableStreams(linesStdout, linesStderr);

  const output: string[] = [];
  let address = "";
  let found = false;
  // @ts-ignore yes it does
  for await (const raw of lines.values({ preventCancel: true })) {
    const line = colors.stripAnsiCode(raw);
    output.push(line);
    const match = line.match(
      /https?:\/\/[^:]+:\d+(\/\w+[-\w]*)*/g,
    );
    if (match) {
      address = match[0];

      // Found a URL. Now, let's verify if the server is actually ready.
      const maxRetries = 50; // 5 seconds
      for (let i = 0; i < maxRetries; i++) {
        try {
          await fetch(address);
          found = true;
          break;
        } catch {
          // Server not ready yet, wait and retry.
          await new Promise(r => setTimeout(r, 100));
        }
      }
      if(found) break;
    }
  }

  if (!found) {
    // deno-lint-ignore no-console
    console.log(output);
    throw new Error(`Could not find server address or server not ready in time.`);
  }

  let failed = false;
  try {
    await fn(address);
  } catch (err) {
    // deno-lint-ignore no-console
    console.log(output);
    failed = true;
    throw err;
  } finally {
    aborter.abort();
    await cp.status;
    for await (const line of lines) {
      output.push(line);
    }

    if (failed) {
      // deno-lint-ignore no-console
      console.log(output);
    }
  }
}
