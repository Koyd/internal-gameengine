# Framework Overview

## Intent

This repository is a project-oriented, multi-target TypeScript framework. It keeps iteration fast
by letting the same project move between web, desktop, and mobile hosts while retaining
shared contracts, runtime behavior, project configuration, rendering APIs, asset loading, and
persistence semantics.

The architecture borrows Godot's separation of foundational core facilities from platform and
scene concerns, rather than attempting to reproduce Godot's feature set. Godot's current
[`core`](https://github.com/godotengine/godot/tree/master/core) tree separates object, I/O,
configuration, math, templates, and variant facilities. This repository applies that principle at a
smaller TypeScript package scale.

## System Shape

```text
projects/example
      |
      v
packages/engine ---> packages/three ---> maintained Three.js fork
      |
      v
apps/web ---> apps/clientstate ---> packages/contracts <--- apps/runtime
                                                 |
                                                 v
                                      packages/runtime-domain
                                                 |
                                                 v
                                         SQLite live Layer
```

The frame loop never crosses RPC. Rendering, input, animation, scene updates, and profiling are
latency-sensitive browser-local work. Persistence, project management, import/build work, and
platform capabilities belong behind runtime contracts.

## Workspace Ownership

| Area                      | Responsibility                                                           | Code                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                | Preact UI, browser composition root, canvas ownership                    | [`App.tsx`](../apps/web/src/ui/App.tsx), [`runtime.ts`](../apps/web/src/effect/runtime.ts)                                                                                                                      |
| `apps/clientstate`        | Browser-facing runtime client and shared asynchronous client state       | [`runtime-client.ts`](../apps/clientstate/src/runtime-client.ts)                                                                                                                                                |
| `apps/runtime`            | Canonical web server process and platform Layers                         | [`main.ts`](../apps/runtime/src/main.ts), [`runtime-server.ts`](../apps/runtime/src/runtime-server.ts), [`filesystem-app-assets.ts`](../apps/runtime/src/services/filesystem-app-assets.ts)                     |
| `packages/contracts`      | Effect RPC and Schema definitions shared by every transport              | [`runtime-rpcs.ts`](../packages/contracts/src/runtime-rpcs.ts)                                                                                                                                                  |
| `packages/runtime-domain` | Transport-neutral handlers and runtime service interfaces                | [`runtime-handlers.ts`](../packages/runtime-domain/src/runtime-handlers.ts), [`app-storage.ts`](../packages/runtime-domain/src/app-storage.ts), [`app-assets.ts`](../packages/runtime-domain/src/app-assets.ts) |
| `packages/three`          | Sole import boundary for upstream or forked Three.js                     | [`index.ts`](../packages/three/src/index.ts)                                                                                                                                                                    |
| `packages/engine`         | Public project API, Preact viewport, and browser-local rendering systems | [`app.ts`](../packages/engine/src/app.ts), [`app-viewport.tsx`](../packages/engine/src/preact/app-viewport.tsx), [`frame-pipeline.ts`](../packages/engine/src/rendering/frame-pipeline.ts)                      |
| `projects/*`              | TypeScript projects: exported config, Preact UI, and framework imports   | [`projects/example/src/app.ts`](../projects/example/src/app.ts), [`projects/example/src/App.tsx`](../projects/example/src/App.tsx)                                                                              |

Although `clientstate` is under `apps` as requested, it is intentionally headless and importable.
It is the client-side composition boundary, not a second visual application.

## Runtime Portability

The web runtime exposes `RuntimeRpcs` over Effect RPC's HTTP protocol. The runtime process composes
the transport, handlers, and SQLite service as explicit Layers:

- The portable wire contract is [`RuntimeRpcs`](../packages/contracts/src/runtime-rpcs.ts).
- Portable behavior is [`RuntimeHandlers`](../packages/runtime-domain/src/runtime-handlers.ts).
- The canonical HTTP adapter is [`RuntimeServer`](../apps/runtime/src/runtime-server.ts).
- The scoped [`SqliteDatabase`](../apps/runtime/src/services/sqlite-database.ts) owns the connection,
  data-folder database creation, and idempotent table migrations.
- [`SqliteAppStorage`](../apps/runtime/src/services/sqlite-app-storage.ts) implements app-scoped
  named collections, while [`SqliteUserState`](../apps/runtime/src/services/sqlite-user-state.ts)
  implements framework user settings.
- Tests replace SQLite with [`AppStorage.memory`](../packages/runtime-domain/src/app-storage.ts)
  and [`UserState.memory`](../packages/runtime-domain/src/user-state.ts).

An Electron main process imports `RuntimeHandlers`, provides the same platform services, and hosts
the operations over an IPC protocol adapter. The mobile runtime uses the same tagged request schema
over `/mobile/android` or `/mobile/ios`, preserving the same operation names, payload fields, and
typed asset failures as the RPC and IPC adapters.

The current desktop host follows that model:

- [`packages/desktop`](../packages/desktop/src/index.ts) owns Electron lifecycle, the isolated
  preload bridge, and IPC dispatch into the shared runtime-domain services.
- [`apps/desktop/src/main.ts`](../apps/desktop/src/main.ts) only imports the selected project's config
  and starts the desktop library.
- [`projects/example/src/config.ts`](../projects/example/src/config.ts) is the source of truth for
  target and title. Project code may import it directly.
- The web host selects HTTP RPC for a `web` build, Electron IPC for an `electron` build, and the
  mobile route for `android` or `ios` builds without exposing that choice to project UI or storage
  code.

## Rendering

Projects import the public API from `@framework/engine` and rendering types from `@framework/three`.
Direct imports from upstream `three` outside [`packages/three`](../packages/three/src/index.ts) are
forbidden by convention so the fork can evolve without touching project packages.

[`FramePipeline`](../packages/engine/src/rendering/frame-pipeline.ts) owns:

1. Bind the framework framebuffer and run named preprocess render processes.
2. Rendering the scene into the framework-owned `WebGLRenderTarget` framebuffer.
3. Running postprocess render processes after the framebuffer is populated.
4. Presenting that framebuffer to the canvas.

Every render process receives the renderer, bound framebuffer, camera, scene, frame delta, and
elapsed time. The example defines framebuffer-bound camera-orbit and cube-translation preprocesses
in [`projects/example/src/app.ts`](../projects/example/src/app.ts).

## Projects

A project is a TypeScript package under `projects/`. Its entry point exports a configuration created
with [`defineApp`](../packages/engine/src/app.ts). A world owns its scene, camera, and render
processes. A project may also export a Preact UI composed around the framework's
[`AppViewport`](../packages/engine/src/preact/app-viewport.tsx), as the example does in
[`projects/example/src/App.tsx`](../projects/example/src/App.tsx).

Project UI accesses persistent state through the transport-neutral
[`AppLocalStorage`](../packages/engine/src/local-storage.ts) API and
[`useAppLocalStorage`](../packages/engine/src/preact/app-local-storage.tsx) Preact hook. The web
host supplies the RPC adapter and project ID; projects do not import Effect, RPC, or SQLite. Named
collections are isolated by app ID and persist in `.data/framework.sqlite`.

Each project exports a typed [`config.ts`](../projects/example/src/config.ts). Its `target` selects the
default build, and `title` is available to project code and host integrations. Valid targets are
`web`, `electron`, `android`, and `ios`. For the example, `vp run example:build` syncs the Android
Capacitor project because its target is `android`; changing the target to `ios` routes the same
command to the iOS sync task. Explicit target tasks fail before building if the config target does
not match.

## Assets

Assets remain project-owned. Each project config declares a workspace-relative `assetsDirectory`, as
the example does in [`config.ts`](../projects/example/src/config.ts). Project code addresses files
through opaque `://assets/...` paths and receives the transport-neutral
[`AppAssets`](../packages/engine/src/assets.ts) API in its world creation context. The example
loads `://assets/adamHead/adamHead.gltf` in
[`app.ts`](../projects/example/src/app.ts); project code never sees a host filesystem path.

`ResolveAppAsset` primes the runtime cache through the shared
[`AppAssets`](../packages/runtime-domain/src/app-assets.ts) service. The filesystem Layer
validates ownership and prevents directory traversal before lazily copying a requested source file
to the host cache. Relative GLTF dependencies such as `.bin` files and textures pass through the
same resolver as Three.js requests them.

The portable asset contract is intentionally explicit:

- `resolve` primes the cache and returns normalized path, byte size, MIME type, and a source
  `version`. `AppAssetError` exposes `UnknownApp`, `InvalidPath`, `NotFound`, `NotFile`,
  `RangeNotSatisfiable`, and `Io` as expected failures in
  [`runtime-rpcs.ts`](../packages/contracts/src/runtime-rpcs.ts).
- A cache entry remains valid while its byte size matches and its modification time is at least the
  configured source's modification time. A source size or modification-time change refreshes the
  cached copy and changes its version. Hosts send `Cache-Control: no-cache` plus that version as an
  ETag, and honor `If-None-Match` with `304`.
- `open` must stream bytes; buffering an entire asset is not part of the host contract. It supports
  one standard `bytes` range, including open-ended and suffix ranges, and describes partial streams
  with `206`, `Accept-Ranges`, and `Content-Range`.
- MIME behavior is shared by [`appAssetContentType`](../packages/runtime-domain/src/app-assets.ts).
  Known model, image, audio, video, and JSON extensions receive stable types; unknown extensions
  use `application/octet-stream`.
- Every new runtime adapter should run
  [`runAppAssetsConformance`](../packages/runtime-domain/src/app-assets-conformance.ts), which
  checks errors, MIME behavior, invalidation, full streams, and range streams without depending on
  a particular transport.

The canonical web runtime serves cached files under `/app-assets/...` in
[`runtime-server.ts`](../apps/runtime/src/runtime-server.ts). Electron packages the configured
source directory as a resource and serves cached files through a secure `app-asset://` protocol
in [`packages/desktop`](../packages/desktop/src/index.ts). Both adapters translate the same Effect
stream and response metadata rather than reading whole files. The browser composition root selects
the correct delivery URL without exposing RPC or IPC to the project. Desktop IPC wraps expected asset
failures with [`RuntimeIpcFailure`](../packages/contracts/src/runtime-ipc.ts), preserving the typed
error instead of flattening it into an unstructured invocation failure.
The mobile route wraps the same expected asset failures with
[`RuntimeMobileFailure`](../packages/contracts/src/runtime-mobile.ts).

## Toolchain

The repository uses Vite+ as the root workflow surface. [`vite.config.ts`](../vite.config.ts)
enables Oxfmt, Oxlint, type-aware checks, and Preact-aware linting. Type checks use the latest installed
native TypeScript preview through `tsgo`. Workspace tasks are declared in
[`vite.config.ts`](../vite.config.ts).

Common commands:

```sh
vp run dev
vp check
vp test
vp run example:build
vp run example:run
vp run example:build-desktop
vp run example:build-android
vp run example:build-ios
```

`vp run example:run` builds the example first, then starts the Effect runtime and serves the
production web build at `http://127.0.0.1:4173`.

`vp run example:build-desktop` builds the renderer in Electron mode, bundles the minimal desktop
main/preload processes, and produces an executable AppImage in `dist-desktop/`.

`vp run example:build-android` builds the renderer in Android mode, copies project assets into the
Capacitor web bundle, runs `cap sync android`, and then runs Gradle's `assembleRelease`. The
Android release build reads signing settings from
environment variables or untracked Gradle properties: `frameworkAndroidKeystorePath`,
`frameworkAndroidKeystorePassword`, `frameworkAndroidKeyAlias`, and
`frameworkAndroidKeyPassword`. The matching environment variables are
`FRAMEWORK_ANDROID_KEYSTORE_PATH`, `FRAMEWORK_ANDROID_KEYSTORE_PASSWORD`,
`FRAMEWORK_ANDROID_KEY_ALIAS`, and `FRAMEWORK_ANDROID_KEY_PASSWORD`. `vp run example:build-ios`
builds the renderer in iOS mode, copies project assets into the Capacitor web bundle, and runs
`cap sync ios`.

## Near-Term Systems

Implement systems as narrow framework modules with explicit ownership:

1. Scene lifecycle and stable node/entity identity.
2. Input and event queues, separated from React synthetic events.
3. Animation clock, mixers, and deterministic update ordering.
4. Render-pass graph for preprocess and postprocess effects.
5. CPU/GPU profiling spans and a debug overlay.
6. Project discovery and configuration loading.

Physics is explicitly out of scope.
