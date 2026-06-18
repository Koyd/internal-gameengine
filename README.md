# Framework

Framework is a TypeScript workspace for iterating on the same interactive project across web,
desktop, and mobile targets. See [`docs/overview.md`](docs/overview.md) for architecture,
ownership boundaries, and commands.

The example's [`config.ts`](projects/example/src/config.ts) selects Android as its primary target.
Build the configured target with:

```sh
vp run example:build
```

This builds the web surface in Android mode, syncs it into the Capacitor Android project, and runs
the Android release build.

Run the explicit web target with:

```sh
vp run example:run
```
