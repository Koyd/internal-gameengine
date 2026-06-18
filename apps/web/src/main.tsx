import { render } from "preact"
import { App } from "./ui/App.tsx"
import "./ui/styles.css"

const root = document.querySelector("#root")
if (!(root instanceof HTMLElement)) throw new Error("Missing #root")

render(<App />, root)
