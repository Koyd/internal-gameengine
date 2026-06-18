import { AppViewport, useAppLocalStorage, type AppStorageRecord } from "@framework/engine"
import type { JSX } from "preact"
import { useEffect, useMemo, useState } from "preact/hooks"
import { exampleApp, exampleAppEffects } from "./app.ts"
import { exampleAppConfig } from "./config.ts"
import "./styles.css"

export function ExampleApp() {
  const storage = useAppLocalStorage()
  const labelsStorage = useMemo(() => storage.collection("labels"), [storage])
  const [labels, setLabels] = useState<ReadonlyArray<AppStorageRecord>>([])
  const [value, setValue] = useState("")
  const [fovDegrees, setFovDegrees] = useState(exampleAppEffects.fovDegrees)
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading")

  useEffect(() => {
    let active = true
    labelsStorage.list().then(
      (storedLabels) => {
        if (!active) return
        setLabels(storedLabels)
        setStatus("ready")
      },
      () => {
        if (active) setStatus("error")
      },
    )
    return () => {
      active = false
    }
  }, [labelsStorage])

  const submit = (event: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const label = value.trim()
    if (!label || status === "saving") return

    setStatus("saving")
    labelsStorage.append(label).then(
      (entry) => {
        setLabels((current) => [...current, entry])
        setValue("")
        setStatus("ready")
      },
      () => setStatus("error"),
    )
  }

  const updateFov = (nextFov: number) => {
    exampleAppEffects.fovDegrees = nextFov
    setFovDegrees(nextFov)
  }

  return (
    <main className="example-app">
      <AppViewport className="example-app__viewport" app={exampleApp} />
      <section className="example-app__hud" aria-label="Example app details">
        <p className="example-app__eyebrow">Framework</p>
        <h1>{exampleAppConfig.title}</h1>
        <p>
          One project surface running through shared web, desktop, and mobile-ready framework
          layers.
        </p>
        <dl>
          <div>
            <dt>Camera</dt>
            <dd>Stationary</dd>
          </div>
          <div>
            <dt>Preprocess</dt>
            <dd>Shader, animation</dd>
          </div>
          <div>
            <dt>Postprocess</dt>
            <dd>FOV</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>Female idle</dd>
          </div>
        </dl>
        <section className="example-app__controls" aria-label="Render controls">
          <label htmlFor="fov-control">
            <span>FOV</span>
            <output htmlFor="fov-control">{fovDegrees}°</output>
          </label>
          <input
            id="fov-control"
            max={95}
            min={35}
            onInput={(event) => updateFov(Number(event.currentTarget.value))}
            step={1}
            type="range"
            value={fovDegrees}
          />
        </section>
        <form className="example-app__labels" onSubmit={submit}>
          <label htmlFor="persistent-label">Persistent label</label>
          <input
            autoComplete="off"
            id="persistent-label"
            onInput={(event) => setValue(event.currentTarget.value)}
            placeholder="Type a label and press Enter"
            value={value}
          />
          <p className="example-app__storage-status">
            {status === "loading" && "Loading saved labels..."}
            {status === "saving" && "Saving..."}
            {status === "error" && "Storage unavailable"}
            {status === "ready" && `${labels.length} saved label${labels.length === 1 ? "" : "s"}`}
          </p>
          <div className="example-app__label-list" aria-live="polite">
            {labels.map((label) => (
              <span key={label.id}>{label.value}</span>
            ))}
          </div>
        </form>
      </section>
    </main>
  )
}
