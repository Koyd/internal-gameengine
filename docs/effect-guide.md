# Effect Guide for a Web App With an Electron Shell

This guide describes how to use Effect as the runtime architecture for an application that primarily
ships as a web app and also provides an Electron desktop shell.

It is intentionally limited to Effect. It does not prescribe a UI framework, router, database,
transport, build tool, or packaging system. The goal is to establish consistent boundaries so those
choices can change without rewriting domain logic.

## Goals

Use Effect to provide:

- Explicit dependencies through services and Layers.
- Typed, recoverable failures.
- Safe resource acquisition and cleanup.
- Structured concurrency for background work.
- Runtime validation at untrusted boundaries.
- Shared contracts between browser, server, and Electron processes.
- One observability model for logs, spans, and metrics.
- Deterministic tests with replaceable dependencies.

Do not use Effect merely as a different syntax for `Promise`. The main value comes from keeping
dependencies, errors, lifetimes, and concurrency visible in program types.

## Recommended Architecture

```text
Shared schemas and domain values
                |
                v
       Domain service interfaces
                |
                v
      Live and test Layer implementations
                |
        +-------+-------+
        |               |
        v               v
 Server process    Electron main process
        |               |
        +-------+-------+
                |
                v
      Browser-facing imperative APIs
        backed by ManagedRuntime
```

Effect should own long-lived runtime behavior in server and Electron processes. In the browser,
Effect should own infrastructure and shared asynchronous state, while UI components can continue to
use ordinary framework APIs.

## Suggested Project Layout

Use names appropriate to the repository, but keep these ownership boundaries:

```text
apps/
  server/
    src/
      main.ts
      runtime.ts
      features/
  web/
    src/
      effect/
        runtime.ts
        api.ts
  desktop/
    src/
      main.ts
      effect/
        runtime.ts
      electron/
packages/
  contracts/
    src/
  domain/
    src/
  shared/
    src/
```

Recommended responsibilities:

- `packages/contracts`: Effect Schemas and types that cross process or persistence boundaries. Keep
  this package free of application runtime behavior.
- `packages/domain`: Domain services and pure domain logic shared by multiple applications.
- `packages/shared`: Reusable Effect runtime utilities such as worker helpers and observability
  helpers.
- `apps/server`: Live server Layers and the server process entrypoint.
- `apps/web`: Browser runtime, browser-specific Layers, and imperative adapters for UI code.
- `apps/desktop`: Electron service wrappers, desktop Layers, and the Electron main-process
  entrypoint.

Keep service interfaces close to the domain that owns them. Keep platform implementations close to
the application or adapter that provides them.

## Core Rules

Apply these rules consistently:

1. Use `Effect.gen` for one-off programs.
2. Use `Effect.fn("stable.operation.name")` for reusable Effect-returning functions.
3. Model significant capabilities as `Context.Service` services.
4. Construct implementations with `Layer`.
5. Run Effects only at explicit application boundaries.
6. Use `Schema.TaggedErrorClass` for recoverable errors that may cross boundaries.
7. Use `Effect.acquireRelease`, scoped Layers, and `Effect.forkScoped` for resources.
8. Compile Schema decoders and encoders once at module scope.
9. Use `Stream` for effectful sequences over time.
10. Use `Queue`, `PubSub`, `Deferred`, and `Ref` instead of ad hoc concurrency state.
11. Give each process one top-level Layer graph.
12. Prefer test Layers over module mocks.

## Effect Types as Design Documentation

Read an Effect type as:

```ts
Effect.Effect<Success, Error, Requirements>
```

For example:

```ts
declare const loadDocument: (
  id: DocumentId,
) => Effect.Effect<Document, DocumentNotFoundError | DocumentReadError, DocumentRepository>
```

This communicates:

- The successful result is `Document`.
- Expected failures are known and typed.
- The operation requires a `DocumentRepository` service.

Do not erase the error or requirements channels prematurely. They are useful architecture signals.

## Shared Schemas and Domain Values

Use Effect Schema for values entering from:

- HTTP, WebSocket, or IPC messages.
- Persistence.
- Environment variables and configuration files.
- Browser storage.
- External processes.
- User-provided structured input.

Use branded schemas for identifiers so unrelated string IDs cannot be mixed accidentally:

```ts
import * as Schema from "effect/Schema"

const NonEmptyString = Schema.String.check(Schema.isNonEmpty())

export const DocumentId = NonEmptyString.pipe(Schema.brand("DocumentId"))
export type DocumentId = typeof DocumentId.Type

export const WorkspaceId = NonEmptyString.pipe(Schema.brand("WorkspaceId"))
export type WorkspaceId = typeof WorkspaceId.Type
```

Define process-boundary messages as schemas:

```ts
export const OpenDocumentRequest = Schema.Struct({
  documentId: DocumentId
})
export type OpenDocumentRequest = typeof OpenDocumentRequest.Type

export const OpenDocumentResult = Schema.Struct({
  documentId: DocumentId,
  content: Schema.String,
  version: Schema.Int
})
export type OpenDocumentResult = typeof OpenDocumentResult.Type
```

Compile decoders once:

```ts
const decodeOpenDocumentRequest = Schema.decodeUnknownEffect(OpenDocumentRequest)

export const decodeRequest = Effect.fn("decodeOpenDocumentRequest")(function* (input: unknown) {
  return yield* decodeOpenDocumentRequest(input)
})
```

Do not create `Schema.decodeUnknownEffect(...)`, `Schema.is(...)`, or equivalent compiled helpers
inside frequently called functions.

## Typed Errors

Expected failures belong in the Effect error channel:

```ts
import * as Schema from "effect/Schema"

export class DocumentNotFoundError extends Schema.TaggedErrorClass<DocumentNotFoundError>()(
  "DocumentNotFoundError",
  {
    documentId: DocumentId
  }
) {
  override get message(): string {
    return `Document not found: ${this.documentId}`
  }
}

export class DocumentReadError extends Schema.TaggedErrorClass<DocumentReadError>()(
  "DocumentReadError",
  {
    documentId: DocumentId,
    cause: Schema.Defect()
  }
) {
  override get message(): string {
    return `Failed to read document: ${this.documentId}`
  }
}
```

Use distinct errors when callers need distinct recovery behavior. Do not collapse all failures into a
generic application error near the source.

Handle errors at the layer that can make a meaningful decision:

```ts
repository.get(documentId).pipe(
  Effect.catchTag("DocumentNotFoundError", () => createDefaultDocument(documentId))
)
```

Use defects for broken invariants and programmer errors. Do not silently convert defects into
recoverable failures unless the boundary has a deliberate containment policy.

## Service Design

Create a service for a capability when:

- Multiple features use it.
- It owns mutable state or a resource.
- It wraps external I/O.
- Tests need to replace it.
- It defines a meaningful domain boundary.

Avoid services for small pure functions.

Define the service interface around domain operations, not platform mechanics:

```ts
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type * as Stream from "effect/Stream"

export interface DocumentRepositoryShape {
  readonly get: (
    documentId: DocumentId
  ) => Effect.Effect<Document, DocumentNotFoundError | DocumentReadError>

  readonly save: (
    document: Document
  ) => Effect.Effect<void, DocumentWriteError>

  readonly changes: Stream.Stream<DocumentChanged>
}

export class DocumentRepository extends Context.Service<
  DocumentRepository,
  DocumentRepositoryShape
>()("my-app/domain/DocumentRepository") {}
```

Service methods should return Effects or Streams. Avoid exposing raw mutable resources, sockets,
process handles, or database clients unless the service specifically represents that low-level
capability.

## Implementing Services With Layers

Build a live implementation by acquiring dependencies in an Effect and returning the service shape:

```ts
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Stream from "effect/Stream"

const makeDocumentRepository = Effect.gen(function* () {
  const storage = yield* DocumentStorage
  const changes = yield* PubSub.unbounded<DocumentChanged>()

  const get = Effect.fn("DocumentRepository.get")(function* (documentId: DocumentId) {
    return yield* storage.read(documentId)
  })

  const save = Effect.fn("DocumentRepository.save")(function* (document: Document) {
    yield* storage.write(document)
    yield* PubSub.publish(changes, {
      type: "document.changed",
      documentId: document.id
    })
  })

  return DocumentRepository.of({
    get,
    save,
    changes: Stream.fromPubSub(changes)
  })
})

export const DocumentRepositoryLive = Layer.effect(
  DocumentRepository,
  makeDocumentRepository
)
```

Separate interface and implementation files when the service is substantial or has multiple
implementations. For smaller services, a static `layer` property on the service can be sufficient.

## Layer Composition

Treat Layer composition as the application dependency graph.

Build small domain Layers first:

```ts
const PersistenceLive = Layer.mergeAll(
  DocumentStorageLive,
  SettingsStorageLive
)

const DomainLive = Layer.mergeAll(
  DocumentRepositoryLive,
  WorkspaceServiceLive
).pipe(
  Layer.provide(PersistenceLive)
)
```

Then compose process-specific Layers:

```ts
export const ServerRuntimeLive = ServerApplicationLive.pipe(
  Layer.provideMerge(DomainLive),
  Layer.provideMerge(ServerTransportLive),
  Layer.provideMerge(ServerObservabilityLive),
  Layer.provide(PlatformServicesLive)
)
```

Use:

- `Layer.provide` when satisfying requirements without exposing the provided services.
- `Layer.provideMerge` when satisfying requirements and retaining the provided services.
- `Layer.mergeAll` for independent Layers.
- `Layer.unwrap` when Layer construction depends on configuration or another Effect.
- `Layer.effectDiscard` for scoped startup behavior that does not expose a service.

Do not build Layers inside request handlers or UI renders. Layers represent runtime construction and
should usually be created once.

## Process Entrypoints

Each long-running process should have one explicit Effect entrypoint.

For a server-style process:

```ts
import * as Layer from "effect/Layer"
import { NodeRuntime } from "@effect/platform-node"

const run = Layer.launch(ServerRuntimeLive)

NodeRuntime.runMain(run)
```

For an application program that performs startup logic and then waits:

```ts
const program = Effect.gen(function* () {
  const app = yield* Application
  yield* app.start
  return yield* Effect.never
})

program.pipe(
  Effect.provide(ApplicationRuntimeLive),
  NodeRuntime.runMain
)
```

Avoid scattered `Effect.runPromise` and `Effect.runFork` calls throughout server or Electron code.
They create unmanaged mini-runtimes and make shutdown behavior difficult to reason about.

## Browser Integration

The browser is usually controlled by an external UI runtime. Use one `ManagedRuntime` as the bridge
between UI code and Effect services:

```ts
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"

const BrowserRuntimeLive = Layer.mergeAll(
  BrowserApiClientLive,
  BrowserStorageLive,
  BrowserObservabilityLive
)

export const browserRuntime = ManagedRuntime.make(BrowserRuntimeLive)
```

Expose narrow imperative functions to UI code:

```ts
export function openDocument(input: OpenDocumentRequest): Promise<OpenDocumentResult> {
  return browserRuntime.runPromise(
    Effect.gen(function* () {
      const api = yield* BrowserApiClient
      return yield* api.openDocument(input)
    })
  )
}
```

For subscriptions, keep cancellation explicit:

```ts
export function subscribeToDocumentChanges(
  listener: (event: DocumentChanged) => void
): () => void {
  const fiber = browserRuntime.runFork(
    Stream.runForEach(
      DocumentChangeStream,
      (event) => Effect.sync(() => listener(event))
    )
  )

  return () => {
    browserRuntime.runFork(Fiber.interrupt(fiber))
  }
}
```

The browser boundary should translate Effect into the UI framework's expected shape:

- Effects become Promises or explicit result values.
- Streams become subscriptions with teardown functions.
- Typed errors become deliberate UI states.
- Runtime disposal happens during application teardown or test reset.

Do not create a `ManagedRuntime` per request, component, or hook.

## Electron Main-Process Integration

Treat Electron's main process as a long-running Effect application. Wrap Electron APIs behind
services rather than importing and calling them throughout feature code.

Example window service:

```ts
export interface DesktopWindowShape {
  readonly createMain: Effect.Effect<void, DesktopWindowCreateError>
  readonly revealMain: Effect.Effect<void>
  readonly closeAll: Effect.Effect<void>
}

export class DesktopWindow extends Context.Service<
  DesktopWindow,
  DesktopWindowShape
>()("my-app/desktop/DesktopWindow") {}
```

Its live Layer can own internal state through `Ref`:

```ts
const makeDesktopWindow = Effect.gen(function* () {
  const mainWindow = yield* Ref.make<Option.Option<NativeWindow>>(Option.none())

  const createMain = Effect.fn("DesktopWindow.createMain")(function* () {
    const window = yield* Effect.try({
      try: () => createNativeWindow(),
      catch: (cause) => new DesktopWindowCreateError({ cause })
    })
    yield* Ref.set(mainWindow, Option.some(window))
  })

  return DesktopWindow.of({
    createMain,
    revealMain: revealCurrentWindow(mainWindow),
    closeAll: closeAllWindows(mainWindow)
  })
})

export const DesktopWindowLive = Layer.effect(DesktopWindow, makeDesktopWindow)
```

Create separate services for capabilities such as:

- Application lifecycle.
- Window management.
- Dialogs.
- Shell integration.
- Updates.
- Secure storage.
- Menus.
- Protocol registration.
- Backend process supervision.
- IPC registration.

Then compose one desktop runtime:

```ts
const ElectronAdaptersLive = Layer.mergeAll(
  DesktopWindowLive,
  DesktopDialogLive,
  DesktopShellLive,
  DesktopUpdatesLive
)

const DesktopRuntimeLive = DesktopApplicationLive.pipe(
  Layer.provideMerge(ElectronAdaptersLive),
  Layer.provideMerge(DesktopObservabilityLive),
  Layer.provide(PlatformServicesLive)
)
```

This keeps desktop behavior testable without starting a real Electron process.

## Electron IPC

Treat IPC as an untrusted process boundary:

1. Decode request payloads with shared Schemas.
2. Authorize the operation if needed.
3. Call domain or desktop services.
4. Encode the response using a shared Schema.
5. Convert typed errors into a declared response error format.

Keep IPC handlers thin. They should not own business logic or long-lived mutable state.

Register handlers as scoped resources so they are removed during shutdown or test cleanup:

```ts
const registerHandler = Effect.acquireRelease(
  Effect.sync(() => {
    ipc.handle("document.open", handler)
  }),
  () => Effect.sync(() => {
    ipc.removeHandler("document.open")
  })
)

export const DesktopIpcHandlersLive = Layer.effectDiscard(registerHandler)
```

## Managing a Desktop-Owned Backend Process

If Electron launches a local backend, model the backend as a supervised scoped resource.

The supervising service should own:

- Process spawn.
- Readiness checks.
- Captured output streams.
- Restart policy.
- Graceful termination.
- Forced termination timeout.
- Current process state.
- Application shutdown integration.

Use `Effect.acquireRelease` to tie process lifetime to a scope:

```ts
const acquireBackend = Effect.gen(function* () {
  const process = yield* spawnBackend
  yield* waitUntilReady(process)
  return process
})

const releaseBackend = (process: BackendProcess) =>
  terminateBackend(process).pipe(
    Effect.timeout("5 seconds"),
    Effect.catch(() => forceKillBackend(process))
  )

const backendResource = Effect.acquireRelease(acquireBackend, releaseBackend)
```

Use `Schedule` for restart backoff. Use a `Ref` or `SynchronizedRef` for supervisor state. Use
scoped fibers for readiness probes and output drains. Never leave raw process listeners or timers
outside the owning scope.

## Resource Management

Any operation that opens, registers, starts, or subscribes should have a corresponding cleanup path.

Use `Effect.acquireRelease`:

```ts
const socket = Effect.acquireRelease(
  connectSocket,
  (socket) => closeSocket(socket)
)
```

Use scoped fibers for background work:

```ts
yield* consumeEvents.pipe(
  Effect.forever,
  Effect.forkScoped
)
```

Use `Layer.scoped` or a scoped service constructor when the service owns resources:

```ts
export const ConnectionLive = Layer.scoped(
  Connection,
  Effect.acquireRelease(connect, disconnect)
)
```

Finalizers must be:

- Idempotent when practical.
- Bounded by a timeout when external resources may hang.
- Tolerant of partially initialized resources.
- Safe during interruption.

## Concurrency Patterns

### Mutable State

Use:

- `Ref` for atomic in-memory state updates.
- `SynchronizedRef` when updates themselves are effectful.
- `Semaphore` for bounded or exclusive access.
- Transactional structures when multiple state changes must be atomic together.

Do not combine ordinary mutable variables with concurrent fibers unless the variable is strictly
confined to one serialized worker.

### Queued Work

Use a `Queue` when work must be buffered or serialized:

```ts
const queue = yield* Queue.unbounded<Job>()

yield* Queue.take(queue).pipe(
  Effect.flatMap(processJob),
  Effect.forever,
  Effect.forkScoped
)
```

Add an explicit drain or completion signal when tests or shutdown need to know when queued work has
finished.

### Request Completion

Use `Deferred` when one fiber starts work and another waits for its result:

```ts
const result = yield* Deferred.make<JobResult, JobError>()
yield* Queue.offer(queue, { job, result })
return yield* Deferred.await(result)
```

### Fan-Out Events

Use `PubSub` when one producer broadcasts to multiple independent consumers:

```ts
const events = yield* PubSub.unbounded<DomainEvent>()

const publish = (event: DomainEvent) => PubSub.publish(events, event)
const stream = Stream.fromPubSub(events)
```

Do not use `PubSub` as durable storage. Subscribers joining later do not receive historical events
unless replay is implemented separately.

### Parallel Work

Use explicit concurrency limits:

```ts
yield* Effect.forEach(items, processItem, {
  concurrency: 4,
  discard: true
})
```

Avoid `"unbounded"` unless the input size is tightly controlled and the downstream dependency can
handle the load.

## Streams

Use `Stream` for values produced over time, including:

- Server events.
- IPC events.
- Process stdout and stderr.
- File watching.
- Polling.
- Paginated reads.
- Live domain changes.

Keep streams lazy. Starting and stopping consumption should be controlled by scope.

Expose domain streams from services:

```ts
export interface ActivityServiceShape {
  readonly events: Stream.Stream<ActivityEvent, ActivityStreamError>
}
```

Translate streams into callbacks only at external boundaries such as UI framework subscriptions.

When a stream must recover from transient failures, define the policy explicitly with `Schedule`,
retry operators, or a reconnecting transport service. Do not hide infinite retries in low-level
helpers.

## Configuration

Represent configuration as a service or Effect configuration source so production and tests can
provide different values.

Separate:

- Raw environment or file configuration.
- Validated runtime configuration.
- Feature-specific configuration.

Build dynamic Layers with `Layer.unwrap`:

```ts
export const StorageLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ApplicationConfig
    return config.storageMode === "memory"
      ? MemoryStorageLive
      : FileStorageLive(config.storagePath)
  })
)
```

Do not read environment variables throughout domain code.

## Observability

Use Effect's built-in operation naming, logs, spans, and metrics rather than inventing a parallel
observability model.

Name important operations:

```ts
export const saveDocument = Effect.fn("DocumentService.save")(function* (document: Document) {
  yield* Effect.annotateCurrentSpan({
    "document.id": document.id
  })
  // ...
})
```

Use stable, low-cardinality operation names. Put identifiers in attributes, not span names.

Use structured logging:

```ts
yield* Effect.logInfo("Document saved").pipe(
  Effect.annotateLogs({
    documentId: document.id,
    version: document.version
  })
)
```

Record metrics for behavior that must be monitored:

- Request count and duration.
- Queue depth and processing duration.
- Background worker failures.
- Process restarts.
- Reconnects.
- Persistence latency.
- Stream disconnects.

Provide observability as a Layer so server, browser, and desktop can install platform-appropriate
exporters without changing domain services.

## Testing

Use Effect-aware tests and test Layers. Test the service through its public interface.

A typical test provides a fake dependency:

```ts
const DocumentStorageTest = Layer.succeed(
  DocumentStorage,
  DocumentStorage.of({
    read: () => Effect.succeed(testDocument),
    write: () => Effect.void
  })
)

const TestLayer = DocumentRepositoryLive.pipe(
  Layer.provide(DocumentStorageTest)
)
```

Then run the test Effect with the test Layer:

```ts
it.effect("loads a document", () =>
  Effect.gen(function* () {
    const repository = yield* DocumentRepository
    const document = yield* repository.get(testDocument.id)
    expect(document).toEqual(testDocument)
  }).pipe(Effect.provide(TestLayer))
)
```

Prefer:

- Test clock control over real sleeps.
- Test Layers over module-level mocks.
- In-memory service implementations over broad integration mocks.
- Explicit worker drain signals over timing-based assertions.
- Scoped tests for resources and background fibers.

Avoid manually creating runtimes in each test. Use a test runtime integration and Layers so
resources are cleaned up consistently.

## Boundary Policy

Effect should be run only at these boundaries:

- Server process entrypoint.
- Electron main-process entrypoint.
- Browser `ManagedRuntime` adapter.
- External framework callback adapter.
- CLI entrypoint.
- Worker entrypoint.

Within Effect-owned code, return an Effect instead of running it.

Bad:

```ts
export async function save(document: Document): Promise<void> {
  await Effect.runPromise(repository.save(document))
}
```

Preferred:

```ts
export const save = (document: Document) => repository.save(document)
```

Convert to a Promise only in the adapter called by non-Effect code.

## Anti-Patterns

Avoid these patterns:

### Scattered Runtimes

Do not call `Effect.runPromise` throughout business logic. It breaks dependency propagation,
cancellation, tracing, and resource ownership.

### Giant Services

Do not create one `ApplicationService` containing every operation. Services should represent
coherent capabilities with clear ownership.

### Layer Construction Per Operation

Do not build database, transport, or desktop Layers per request. Construct long-lived Layers once
unless the resource is intentionally request-scoped.

### Catching Everything Too Early

Do not convert every failure to `Effect.void`, `null`, or a generic error. Preserve typed failures
until a boundary can make a deliberate recovery or presentation decision.

### Unscoped Background Fibers

Do not use detached background fibers for runtime-owned work. Fork them into a scope and ensure
shutdown interrupts them.

### Raw Platform APIs in Domain Code

Do not call Electron, filesystem, process, browser storage, or network APIs directly from domain
services. Wrap them behind Effect services.

### Schemas Everywhere

Schemas are valuable at boundaries. Do not repeatedly decode values that are already trusted,
validated domain values.

### Effect for Pure Logic

Keep deterministic transformations and reducers as ordinary pure functions. Wrap them in Effect only
when they require dependencies, can fail meaningfully, perform I/O, or participate in Effect
concurrency.

## Incremental Adoption Plan

Do not rewrite the entire application at once. Adopt Effect along ownership boundaries.

### Phase 1: Establish Conventions

- Add Effect and platform packages.
- Create a shared contracts package using Effect Schema.
- Define naming and error conventions.
- Add Effect-aware test support.
- Add one browser `ManagedRuntime`.
- Create one server and one Electron top-level Layer graph.

### Phase 2: Wrap External I/O

Start with capabilities that benefit most from lifecycles and test replacement:

- Persistence.
- Network clients.
- Filesystem.
- Child processes.
- Electron windows and lifecycle.
- Browser storage.

Expose domain-oriented services rather than raw clients.

### Phase 3: Move Domain Workflows

Move workflows with retries, partial failures, or multiple dependencies into `Effect.fn` programs.
Keep pure computation outside Effect.

### Phase 4: Structure Background Work

Replace ad hoc timers, event emitters, and unmanaged Promise loops with:

- Scoped fibers.
- Queues.
- PubSub.
- Streams.
- Schedules.
- Explicit drain and shutdown behavior.

### Phase 5: Strengthen Boundaries

- Decode every untrusted process-boundary payload.
- Declare transport and IPC error contracts.
- Add structured tracing and metrics.
- Ensure every resource has a finalizer.
- Ensure every long-running process has bounded shutdown.

## Review Checklist

Use this checklist when adding or reviewing Effect code:

- Is pure logic kept pure?
- Does the operation return an Effect instead of running it internally?
- Are dependencies represented as services?
- Are recoverable failures typed?
- Are untrusted values decoded exactly at the boundary?
- Are compiled Schema helpers hoisted to module scope?
- Does every acquired resource have cleanup?
- Are background fibers scoped?
- Is concurrency bounded?
- Are retries explicit and bounded where appropriate?
- Is the operation named with `Effect.fn` or a span?
- Can tests replace dependencies using Layers?
- Does the browser expose a narrow imperative adapter?
- Are Electron APIs isolated behind desktop services?
- Is there one understandable top-level Layer graph per process?

## Definition of Done

An Effect-based feature is complete when:

- Domain logic does not directly depend on platform APIs.
- Required services and expected failures are visible in types.
- All external input is validated at its boundary.
- Runtime resources and background work shut down predictably.
- Browser and Electron adapters expose only the APIs their callers need.
- Important operations have structured observability.
- Tests use Layers and do not depend on real time or unmanaged runtimes.

The intended result is not maximum Effect usage. The intended result is a system where failures,
dependencies, concurrency, and lifetimes remain predictable as the web application grows and the
Electron shell becomes more capable.
