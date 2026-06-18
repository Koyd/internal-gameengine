# Framework

Framework is a TypeScript workspace for iterating on the same interactive project across web,
desktop, and future mobile targets. See [`docs/overview.md`](docs/overview.md) for architecture,
ownership boundaries, and commands.

The example's [`config.ts`](projects/example/src/config.ts) selects Electron as its primary target.
Build the configured target with:

```sh
vp run example:build
```

This produces `dist-desktop/framework-example-0.1.0-x86_64.AppImage`.

Run the explicit web target with:

```sh
vp run example:run
```
