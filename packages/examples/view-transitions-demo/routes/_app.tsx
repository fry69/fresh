import { AppProps } from "$fresh/server.ts";
import { Partial } from "$fresh/runtime.ts";

export default function App({ Component }: AppProps) {
  return (
    <html class="h-full bg-white">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>view-transitions-demo</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.25s;
}

.slide-forward::view-transition-old(root) {
  animation-name: slide-out;
}
.slide-forward::view-transition-new(root) {
  animation-name: slide-in;
}

.slide-backward::view-transition-old(root) {
  animation-name: slide-in-rev;
}
.slide-backward::view-transition-new(root) {
  animation-name: slide-out-rev;
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes slide-out {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}
@keyframes slide-in-rev {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
@keyframes slide-out-rev {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}
`,
          }}
        >
        </style>
      </head>
      <body f-client-nav>
        <Partial name="body">
          <Component />
        </Partial>
      </body>
    </html>
  );
}
