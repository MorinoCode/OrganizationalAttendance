import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"

/**
 * Injects a strict Content-Security-Policy into the production HTML only.
 *
 * Dev needs inline scripts for React Fast Refresh, so the policy is applied at
 * build time; the packaged renderer then runs without any remote origin.
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join("; ")

  return {
    name: "hozor-csp",
    apply: "build",
    transformIndexHtml(html) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
      return html.replace("<head>", `<head>\n    ${meta}`)
    }
  }
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  base: "./",
  server: {
    port: 5173,
    host: "127.0.0.1"
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          i18n: ["i18next", "react-i18next"]
        }
      }
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react", "i18next", "react-i18next", "clsx", "tailwind-merge"]
  }
})
