/// <reference types="vite/client" />

// Pulls in Vite's own typing for `import.meta.env`, which the app reads to
// tell a dev server apart from a production build. Without this the project
// compiled against the bare DOM ImportMeta, which has no `env`.
