import React from "react"
import ReactDOM from "react-dom/client"
import "./i18n/config"
import "./index.css"
import App from "./App"
import { ErrorBoundary } from "./components/ErrorBoundary"

window.addEventListener("unhandledrejection", event => {
  console.error("Unhandled promise rejection in renderer:", event.reason)
})

window.addEventListener("error", event => {
  console.error("Uncaught error in renderer:", event.error)
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
