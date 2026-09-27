# Artifacts

An infinite canvas for viewing React components. Drop a component into `artifacts/`, and it shows up on the canvas where you can move, resize, rename, and tune it with live [DialKit](https://github.com/joshpuckett/dialkit) controls.

## Getting started

Requires Node.js 20.9+.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding an artifact

Create a `.tsx` file in `artifacts/` (subfolders work too) with a default-exported component. It appears on the canvas immediately — no registration or reload needed.

```tsx
// artifacts/hello.tsx
export const meta = { title: "hello", width: 360, height: 240 }; // optional

export default function Hello() {
  return <div className="flex h-full items-center justify-center">Hello</div>;
}
```

- `meta.title` sets the default card name (otherwise the file name is used).
- `meta.width` / `meta.height` set the initial card size (default 360×480).
- Tailwind classes work inside artifacts. Add `"use client"` if the component uses state or effects.
- If an artifact throws, only its card shows the error; the rest of the canvas keeps working.

## Live controls with DialKit

Use `useArtifactDial` to give an artifact a control panel. The panel appears when the artifact is selected (or expanded) and hides otherwise.

```tsx
"use client";

import { motion } from "motion/react";
import { toMotion, useArtifactDial } from "@/app/lib/dial";

export default function Card() {
  const dial = useArtifactDial("Card", {
    radius: [16, 0, 48], // slider: [default, min, max, step?]
    color: "#a78bfa", // color picker
    shadow: true, // toggle
    title: "Hello", // text
    spring: { type: "spring", visualDuration: 0.3, bounce: 0.2 },
  });

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      transition={toMotion(dial.spring)}
      style={{ borderRadius: dial.radius, background: dial.color }}
    >
      {dial.title}
    </motion.div>
  );
}
```

`useArtifactDial` takes the same arguments as DialKit's `useDialKit`, but scopes the panel to the artifact it's rendered in and persists values across reloads by default. `toMotion` converts DialKit spring/easing values into Motion transitions. See the [DialKit docs](https://github.com/joshpuckett/dialkit#controls) for all control types.

## Using the canvas

| Action                  | How                                                          |
| ----------------------- | ------------------------------------------------------------ |
| Pan                     | Drag empty space, two-finger scroll, Space + drag, or middle-click drag |
| Zoom                    | Pinch, or ⌘/Ctrl + scroll                                    |
| Zoom controls           | Bottom-right toolbar · ⌘0 resets to 100% · ⇧1 fits everything |
| Move a card             | Drag its title bar                                           |
| Resize a card           | Drag its bottom-right corner                                 |
| Rename                  | Double-click the title or click the pencil icon (Enter saves, Esc cancels) |
| Expand                  | Click the expand icon · Esc closes                           |
| Deselect                | Click empty space or press Esc                               |
| Add text                | Double-click empty space, press T, or use the T button       |
| Edit text               | Double-click it · Esc or ⌘Enter finishes (empty text is removed) |
| Move / scale text       | Drag it to move · drag its corner handle to scale up or down |
| Delete text             | Select it and press Delete/Backspace                         |
| Draw an arrow           | Press A or use the arrow button, then drag (hold Shift to snap to 45°) |
| Edit an arrow           | Drag it to move · drag an end handle to reposition · Delete/Backspace removes |
| Place an image          | Paste or drop a PNG, GIF, JPEG, or WebP (or paste an image URL) |
| Place a link            | Paste or drop a URL — the page is shown in an iframe          |
| Edit an image           | Drag to move · select it and drag any corner handle to resize (keeps aspect ratio) · Delete/Backspace removes |
| Edit a link             | Drag its header to move · drag the bottom-right corner to resize · Delete/Backspace removes |
| Interact with a link    | Select it first — the page only receives clicks while selected |

Card positions, sizes, names, text notes, arrows, images, links, and the camera are saved in `localStorage`. Pasted and dropped image files are uploaded to `uploads/` (gitignored) and served from `/api/uploads`.

## Project structure

```
artifacts/                 your components (auto-discovered)
registry.ts                import.meta.glob of artifacts/ (must live at the project root)
app/
  page.tsx                 renders the canvas (client-only)
  components/
    Canvas.tsx             viewport, selection, toolbar, expanded view
    ArtifactCard.tsx       card chrome: drag, resize, rename, error boundary
    DialPanel.tsx          DialKit panel for the selected artifact
    TextNode.tsx           text notes: edit, move, drag-to-scale
    ArrowNode.tsx          arrows: move, drag endpoints
    MediaNode.tsx          images and website iframes: move, resize
    useCamera.ts           smooth pan/zoom camera
  api/
    uploads/               POST saves an image to uploads/, GET serves it
    preview/               fetches a URL's title/favicon and whether it can be iframed
    frame/                 proxies pages that block iframes (sandboxed, links open in a new tab)
  lib/
    artifacts.ts           turns registry modules into artifact entries
    dial.ts                useArtifactDial + toMotion
    media.ts               media types, URL parsing, upload/preview clients
uploads/                   uploaded images (gitignored)
```

Artifact discovery uses Turbopack's `import.meta.glob`, so the dev server must run with Turbopack (the default for `next dev`).

## License

Copyright 2026 Hitarth Chudgar. Licensed under the [Apache License, Version 2.0](LICENSE).

Artifacts is a personal project, built independently on personal time. Companies that use this code — including the author's employer — do so as licensees under Apache 2.0; they are users of the source, not its creators or owners. See [NOTICE](NOTICE).

### Third-party

- `app/components/grid-reveal.tsx` is [Grid Reveal](https://rareui.com) from [Rare UI](https://rareui.com) by Swami Malode, used under its own [MIT + Commons Clause + Attribution license](https://github.com/swamimalode07/rare-ui/blob/main/LICENSE). It is not covered by Apache 2.0 and may not be sold or redistributed as a standalone component.
