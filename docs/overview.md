# Internal Game Engine Overview

## Intent

This repository is a small, project-oriented 3D engine. The web build is canonical. Desktop and
mobile hosts should replace platform Layers and transports while retaining contracts, runtime
behavior, game configuration, and rendering APIs.

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

| Area                      | Responsibility                                                          | Code                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                | React 19 UI, browser composition root, canvas ownership                 | [`App.tsx`](../apps/web/src/ui/App.tsx), [`runtime.ts`](../apps/web/src/effect/runtime.ts)                                                                                                                          |
| `apps/clientstate`        | Browser-facing runtime client and shared asynchronous client state      | [`runtime-client.ts`](../apps/clientstate/src/runtime-client.ts)                                                                                                                                                    |
| `apps/runtime`            | Canonical web server process and platform Layers                        | [`main.ts`](../apps/runtime/src/main.ts), [`runtime-server.ts`](../apps/runtime/src/runtime-server.ts), [`filesystem-game-assets.ts`](../apps/runtime/src/services/filesystem-game-assets.ts)                       |
| `packages/contracts`      | Effect RPC and Schema definitions shared by every transport             | [`runtime-rpcs.ts`](../packages/contracts/src/runtime-rpcs.ts)                                                                                                                                                      |
| `packages/runtime-domain` | Transport-neutral handlers and runtime service interfaces               | [`runtime-handlers.ts`](../packages/runtime-domain/src/runtime-handlers.ts), [`game-storage.ts`](../packages/runtime-domain/src/game-storage.ts), [`game-assets.ts`](../packages/runtime-domain/src/game-assets.ts) |
| `packages/three`          | Sole import boundary for upstream or forked Three.js                    | [`index.ts`](../packages/three/src/index.ts)                                                                                                                                                                        |
| `packages/engine`         | Public game API, React viewport, and browser-local engine systems       | [`game.ts`](../packages/engine/src/game.ts), [`game-viewport.tsx`](../packages/engine/src/react/game-viewport.tsx), [`frame-pipeline.ts`](../packages/engine/src/rendering/frame-pipeline.ts)                       |
| `projects/*`              | TypeScript game projects: exported config, React UI, and engine imports | [`projects/example/src/game.ts`](../projects/example/src/game.ts), [`projects/example/src/App.tsx`](../projects/example/src/App.tsx)                                                                                |

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
- [`SqliteGameStorage`](../apps/runtime/src/services/sqlite-game-storage.ts) implements game-scoped
  named collections, while [`SqliteUserState`](../apps/runtime/src/services/sqlite-user-state.ts)
  implements engine user settings.
- Tests replace SQLite with [`GameStorage.memory`](../packages/runtime-domain/src/game-storage.ts)
  and [`UserState.memory`](../packages/runtime-domain/src/user-state.ts).

An Electron main process should import `RuntimeHandlers`, provide the same platform services, and
host `RuntimeRpcs` over an IPC protocol adapter. A future native mobile backend must implement the
same schemas and semantics, even if it does not run Effect or TypeScript.

The current desktop host follows that model:

- [`packages/desktop`](../packages/desktop/src/index.ts) owns Electron lifecycle, the isolated
  preload bridge, and IPC dispatch into the shared runtime-domain services.
- [`apps/desktop/src/main.ts`](../apps/desktop/src/main.ts) only imports the selected game's config
  and starts the desktop library.
- [`projects/example/src/config.ts`](../projects/example/src/config.ts) is the source of truth for
  target and title. Game code may import it directly.
- The web host selects HTTP RPC for a `web` build and Electron IPC for an `electron` build without
  exposing that choice to game UI or storage code.

## Rendering

Games import the public API from `@internal/engine` and rendering types from `@internal/three`.
Direct imports from upstream `three` outside [`packages/three`](../packages/three/src/index.ts) are
forbidden by convention so the fork can evolve without touching game projects.

[`FramePipeline`](../packages/engine/src/rendering/frame-pipeline.ts) owns:

1. Bind the engine framebuffer and run named preprocess render processes.
2. Rendering the scene into the engine-owned `WebGLRenderTarget` framebuffer.
3. Running postprocess render processes after the framebuffer is populated.
4. Presenting that framebuffer to the canvas.

Every render process receives the renderer, bound framebuffer, camera, scene, frame delta, and
elapsed time. The example defines framebuffer-bound camera-orbit and cube-translation preprocesses
in [`projects/example/src/game.ts`](../projects/example/src/game.ts).

## Game Projects

A game is a TypeScript package under `projects/`. Its entry point exports a configuration created
with [`defineGame`](../packages/engine/src/game.ts). A world owns its scene, camera, and render
processes. A project may also export a React UI composed around the engine's
[`GameViewport`](../packages/engine/src/react/game-viewport.tsx), as the example does in
[`projects/example/src/App.tsx`](../projects/example/src/App.tsx).

Game UI accesses persistent state through the transport-neutral
[`GameLocalStorage`](../packages/engine/src/local-storage.ts) API and
[`useGameLocalStorage`](../packages/engine/src/react/game-local-storage.tsx) React hook. The web
host supplies the RPC adapter and game ID; projects do not import Effect, RPC, or SQLite. Named
collections are isolated by game ID and persist in `.data/game-engine.sqlite`.

Each game exports a typed [`config.ts`](../projects/example/src/config.ts). Its `target` selects the
default build, and `title` is available to game code and host integrations. For the example,
`vp run example:build` aliases to desktop packaging because its target is `electron`;
`vp run example:build-desktop` fails before building if that target is changed. The explicit
`vp run example:run` command builds the web development target.

## Assets

Assets remain project-owned. Each game config declares a workspace-relative `assetsDirectory`, as
the example does in [`config.ts`](../projects/example/src/config.ts). Game code addresses files
through opaque `://assets/...` paths and receives the transport-neutral
[`GameAssets`](../packages/engine/src/assets.ts) API in its world creation context. The example
loads `://assets/adamHead/adamHead.gltf` in
[`game.ts`](../projects/example/src/game.ts); game code never sees a host filesystem path.

`ResolveGameAsset` primes the runtime cache through the shared
[`GameAssets`](../packages/runtime-domain/src/game-assets.ts) service. The filesystem Layer
validates ownership and prevents directory traversal before lazily copying a requested source file
to the host cache. Relative GLTF dependencies such as `.bin` files and textures pass through the
same resolver as Three.js requests them.

The portable asset contract is intentionally explicit:

- `resolve` primes the cache and returns normalized path, byte size, MIME type, and a source
  `version`. `GameAssetError` exposes `UnknownGame`, `InvalidPath`, `NotFound`, `NotFile`,
  `RangeNotSatisfiable`, and `Io` as expected failures in
  [`runtime-rpcs.ts`](../packages/contracts/src/runtime-rpcs.ts).
- A cache entry remains valid while its byte size matches and its modification time is at least the
  configured source's modification time. A source size or modification-time change refreshes the
  cached copy and changes its version. Hosts send `Cache-Control: no-cache` plus that version as an
  ETag, and honor `If-None-Match` with `304`.
- `open` must stream bytes; buffering an entire asset is not part of the host contract. It supports
  one standard `bytes` range, including open-ended and suffix ranges, and describes partial streams
  with `206`, `Accept-Ranges`, and `Content-Range`.
- MIME behavior is shared by [`gameAssetContentType`](../packages/runtime-domain/src/game-assets.ts).
  Known model, image, audio, video, and JSON extensions receive stable types; unknown extensions
  use `application/octet-stream`.
- Every new runtime adapter should run
  [`runGameAssetsConformance`](../packages/runtime-domain/src/game-assets-conformance.ts), which
  checks errors, MIME behavior, invalidation, full streams, and range streams without depending on
  a particular transport.

The canonical web runtime serves cached files under `/game-assets/...` in
[`runtime-server.ts`](../apps/runtime/src/runtime-server.ts). Electron packages the configured
source directory as a resource and serves cached files through a secure `game-asset://` protocol
in [`packages/desktop`](../packages/desktop/src/index.ts). Both adapters translate the same Effect
stream and response metadata rather than reading whole files. The browser composition root selects
the correct delivery URL without exposing RPC or IPC to the game. Desktop IPC wraps expected asset
failures with [`RuntimeIpcFailure`](../packages/contracts/src/runtime-ipc.ts), preserving the typed
error instead of flattening it into an unstructured invocation failure.

## Toolchain

The repository uses Vite+ as the root workflow surface. [`vite.config.ts`](../vite.config.ts)
enables Oxfmt, Oxlint, type-aware checks, and React linting. Type checks use the latest installed
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
```

`vp run example:run` builds the example first, then starts the Effect runtime and serves the
production web build at `http://127.0.0.1:4173`.

`vp run example:build-desktop` builds the renderer in Electron mode, bundles the minimal desktop
main/preload processes, and produces an executable AppImage in `dist-desktop/`.

## Near-Term Systems

Implement systems as narrow engine modules with explicit ownership:

1. Scene lifecycle and stable node/entity identity.
2. Input and event queues, separated from React synthetic events.
3. Animation clock, mixers, and deterministic update ordering.
4. Render-pass graph for preprocess and postprocess effects.
5. CPU/GPU profiling spans and a debug overlay.
6. Project discovery and configuration loading.

Physics is explicitly out of scope.
