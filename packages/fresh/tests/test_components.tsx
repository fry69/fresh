import type { ComponentChildren } from "preact";

export const charset = <meta charset="utf-8" />;

export const favicon = (
  <link
    href="data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAYAAABPYyMiAAAABmJLR0T///////8JWPfcAAAACXBIWXMAAABIAAAASABGyWs+AAAAF0lEQVRIx2NgGAWjYBSMglEwCkbBSAcACBAAAeaR9cIAAAAASUVORK5CYII="
    rel="icon"
    type="image/x-icon"
  />
);

export function Doc(props: { children?: ComponentChildren; title?: string }) {
  return (
    <html>
      <head>
        {charset}
        <title>{props.title ?? "Test"}</title>
        {favicon}
      </head>
      <body>
        {props.children}
      </body>
    </html>
  );
}
