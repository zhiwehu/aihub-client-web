# AIHub Web Client

Independent static text/voice/recording client. No administrator modules, Python
imports, backend source checkout or frontend framework is required.

```sh
npm test
npm run build
npm run dev                      # localhost:8788/demo/
```

`dist/` is the release artifact: five static files, license and protocol-version/SHA256
manifest. Deploy that directory via the core server's `scripts/install-client.py`,
or transfer it to a static host. Core never reads this repository's source path.
When developing on port 8788, configure the backend's exact
`AIHUB_CLIENT_ORIGINS=http://127.0.0.1:8788` and enter its client-listener address.
Microphone use requires localhost or HTTPS. Keep administrator ingress separate.

The server creates/revokes dedicated browser credentials in its admin console.
Credentials stay in page memory and are required for client HTTP and WebSocket
requests. Recording/audio/minutes access is scoped to authenticated identity.
Source history derives from the former aihub-server clients/web-demo subtree;
full provenance is documented in the core repository's docs/source-map.json.

The HTML expects `/demo/assets/` resource URLs. The included dev server and core
mount use that layout; configure independent static hosting accordingly. Client
HTTP APIs remain `/client/v1/`; WebSocket hello is protocol version 1. Existing
recording pause/resume, cancellation and server-side ownership rules are preserved.
A browser client update is deployed as an artifact, independently of core source.
