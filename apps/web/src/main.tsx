import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./ui/App.tsx"
import "./ui/styles.css"

const root = document.querySelector("#root")
if (!(root instanceof HTMLElement)) throw new Error("Missing #root")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
