# نظام التحكم في محطة التعبئة — Filling Station Control Panel

Arabic-first (RTL) control panel for a bulk filling station. Operators drive
the ports live over a socket.io gateway; administrators review the operation
log, pull reports, and commission ports and operator accounts.

Built with React 19, Vite 7, Tailwind CSS v4 and shadcn/ui primitives.

---

## Getting started

```bash
npm install
npm run dev        # dev server with HMR
npm run build      # type-check (tsc -b) + production bundle
npm run preview    # serve the production build
npm run lint       # eslint over .js/.jsx/.ts/.tsx
```

### Configuration

Copy `.env.example` to `.env` and point it at your backend:

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_URL` | REST API origin. Requests go to `${VITE_API_URL}/api/…` | `http://localhost:3000` |
| `VITE_SOCKET_URL` | socket.io gateway. Blank derives it from the browser host | derived |
| `VITE_SOCKET_PORT` | Port used when `VITE_SOCKET_URL` is blank | `5000` |
| `VITE_ALLOW_OFFLINE_LOGIN` | Enables the built-in demo accounts in a production build | dev only |
| `VITE_OFFLINE_OPERATOR_ID` | Real `operator(id)` to attribute demo-account fills to | unset |

Both endpoints can also be changed at runtime from **إعدادات الاتصال** in the
admin panel — useful on a commissioned machine where rebuilding is not an
option. The override is stored per-device in `localStorage` and takes priority
over the env vars.

### Demo accounts

When no auth backend is reachable (and only in a dev build, or with
`VITE_ALLOW_OFFLINE_LOGIN=true`), two built-in accounts are accepted:

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin` | admin |
| `operator` | `operator` | operator |

A backend that *is* reachable and rejects the credentials is always the final
word — the fallback never overrides a real 401.

---

## Backend contract

### REST — `${VITE_API_URL}/api`

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/login` | `{ username, password }` → `{ token?, user: { id, name, username, role } }` |
| `GET` | `/ports` | Array of port config objects |
| `POST` / `PUT` / `DELETE` | `/ports[/:id]` | Port CRUD |
| `GET` | `/operators` | Array of operators |
| `POST` / `PUT` / `DELETE` | `/operators[/:id]` | Operator CRUD |
| `GET` | `/history?port&from&to` | Operation log rows |
| `GET` | `/reports?port&from&to` | Per-port aggregates |

`from`/`to` are **local** `YYYY-MM-DD HH:mm:ss` strings rather than UTC ISO;
the service also accepts ISO. `port` is a port name or `all_ports`.

`/auth/login` and `/reports` are **not implemented on the service yet** — the
login screen falls back to demo accounts in dev builds, and the reports page
says so plainly instead of showing a network error.

The service never writes to `history` on its own, so the operator console
opens a row on start and closes it when the device confirms it has stopped.

[API.md](API.md) documents what the service actually implements;
[BACKEND.md](BACKEND.md) lists what the frontend still needs from it.

### Realtime — socket.io

Emitted by the client: `start_filling`, `stop_filling`, `update_field`,
`toggle_ai_mode` (plus `join_port` / `leave_port` / `stop_all_ports`, which
the gateway ignores today — nothing depends on them).

Received from the gateway: `availability`, `state`, `valve_state`,
`flowmeter`, `update_field`, `ai_mode_status`. Every port-scoped payload
carries `{ port, data }` and is matched by port name on arrival. There are no
rooms — every client receives every frame and filters locally.

---

## Structure

```
src/
  lib/          api client, shared socket, formatters, CSV export
  hooks/        useApi (fetch + cancel + refetch), useSocketEvent, useSocketStatus
  context/      auth, theme, toast providers
  components/
    ui/         shadcn primitives (button, dialog, table, sidebar, …)
    custom_ui/  app components (port card, tank, tables, filters, states)
    pages/      login, operator console, admin screens
```

### Conventions worth knowing

- **One socket for the whole app** (`lib/socket.js`). Never call `io()` in a
  component — a five-port screen would open six connections.
- **Detach listeners by reference.** `useSocketEvent` does this; calling
  `socket.off("flowmeter")` would deafen every other port card on screen.
- **Fetch through `useApi`.** It cancels in-flight requests, derives its
  loading state, and keys off the *serialized* query so an effect can never
  re-trigger itself on its own result.
- **No `alert()`.** Use `useToast()` for feedback and `<ConfirmDialog>` for
  anything destructive.
- **Colours come from tokens.** `bg-card`, `text-muted-foreground`,
  `text-success` … Hardcoded `bg-white` / `text-gray-700` break dark mode.
- **Logical properties for RTL.** `ps-*`/`pe-*`, `start-*`/`end-*` rather than
  `pl-*`/`left-*`.

---

## Printing

The history and reports screens are print-ready: A4 landscape, controls and
sidebar hidden, a header showing the active filters, and repeated table
headers across pages. Use the **طباعة** button (or Ctrl/⌘-P).
