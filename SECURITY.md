# Security

Sicherheitsmodell und Härtungsmaßnahmen von MrxDown (Stand: v0.15.0, Q2-Audit-Pass 2026-07-08).

## Bedrohungsmodell

MrxDown öffnet und rendert **nicht vertrauenswürdige Markdown-Dateien** (Downloads, fremde Repos, Anhänge). Der wichtigste Angriffspfad ist deshalb Inhalt, der aus dem Dokument in die Preview, die Exporte oder den Main-Prozess wandert. Die App telefoniert von sich aus nicht nach Hause — es gibt **keine Telemetrie**; der einzige Netzwerkverkehr sind der Auto-Updater (GitHub Releases, nur gepackte Builds) und vom Nutzer explizit geöffnete/eingebettete Remote-Bilder.

## Prozess-Isolation

- **contextIsolation: true, nodeIntegration: false, sandbox: true** für alle Fenster (Hauptfenster und die versteckten PDF-Druckfenster). Das Preload-Skript nutzt ausschließlich `contextBridge`/`ipcRenderer` (sandbox-kompatibel) und exponiert eine geschlossene API-Liste — nie `ipcRenderer` selbst.
- PDF-Druckfenster laden Dokument-HTML **ohne Preload** — gerendertes Markdown sieht `window.electronAPI` nie.
- `setWindowOpenHandler(() => deny)` und `will-navigate`-Prevention: Web-Inhalte können keine Kindfenster öffnen (die sonst das Preload erben würden) und das Fenster nicht wegnavigieren.

## Renderer-Härtung

- **CSP** (`index.html`): `default-src 'none'` — Remote-Skripte, -Styles, -Fonts und jeglicher XHR/WebSocket sind blockiert. `img-src` erlaubt `file:/data:/https:` für Bilder in Dokumenten. **Bekannte Einschränkung:** `script-src` braucht derzeit `'unsafe-inline'`, weil die UI historisch `onclick`-Attribute nutzt; Remote-Skripte bleiben trotzdem blockiert. Der Umbau auf `addEventListener` (und damit strikte CSP) ist als Refactoring vorgemerkt.
- **DOMPurify** an jeder HTML-Senke:
  - Preview-Pipeline: Default-Profil + `FORBID_TAGS: style/form/textarea/select/button/link/meta/base` (`<style>` könnte die App-UI umstylen, Formulare sind Phishing-Fläche). `<input>` bleibt für Task-Listen-Checkboxen erlaubt.
  - hljs-Ausgabe: strikte Allowlist (`span[class]`).
  - Mermaid: `securityLevel: 'strict'` bei der Initialisierung **und** SVG-Profil-Sanitize des gerenderten Outputs (beide Richtungen).
- Externe Links öffnen nie direkt: `http(s)`-Allowlist + Bestätigungsdialog pro Host (Session-scoped).

## Main-Prozess / IPC

- Jeder IPC-Handler validiert seine Inputs (Typen, Whitelists, Größen-Caps): Export-Formate (Format-Whitelist, 64-MB-Feld-Cap, sanitisierte PDF-Optionen), DOCX-Import (Uint8Array-Check, 50-MB-Cap), Vault-Index/Backlinks (String-Checks, Tiefen-/Datei-/Größen-Limits), Clipboard-Bilder (`path.basename`-Härtung).
- **Pfad-Traversal-Guards**: Bild-Einbettung beim Export bleibt im Verzeichnisbaum der Markdown-Datei (blockt `![](../../etc/passwd)`); PDF-Template-Namen und beim Wiki-Link-Anlegen erzeugte Dateinamen werden gegen Traversal gefiltert.
- Remote-Bilder beim Export: Timeout, 10-MB-Limit, Redirect-Limit.

## Gepackte Builds (Electron Fuses)

`scripts/after-pack-fuses.js` (electron-builder `afterPack`, alle Plattformen):

| Fuse | Zustand | Warum |
|------|---------|-------|
| `RunAsNode` | aus | `ELECTRON_RUN_AS_NODE=1` machte die Binary sonst zum freien Node-Interpreter |
| `EnableNodeCliInspectArguments` | aus | `--inspect` öffnete sonst einen Debug-Port mit Vollzugriff |
| `EnableNodeOptionsEnvironmentVariable` | aus | `NODE_OPTIONS` konnte sonst Code injizieren |
| `OnlyLoadAppFromAsar` | an | verhindert Unterschieben eines `app/`-Ordners neben dem asar |
| `EnableCookieEncryption` | an | Session-Daten via OS-Keyring verschlüsselt |

Verifiziert per `getCurrentFuseWire` gegen die gepackte Binary und Funktionstest (`ELECTRON_RUN_AS_NODE` ist wirkungslos, CLI-Konvertierung läuft).

## Supply-Chain

- **Alle `vendor/`-Dateien sind reproduzierbar**: esbuild-Bundles über `npm run build:editor|build:hljs|build:turndown`, kopierte Libs (marked, DOMPurify, morphdom, mermaid, KaTeX inkl. Fonts) über `npm run build:vendor-libs` — Quelle ist immer die `package-lock.json`-gepinnte Dependency. Kein Vendor-File hat mehr unklare Herkunft.
- **`npm audit --omit=dev --audit-level=high`** läuft als Gate in beiden CI-Workflows (build + release).
- CLI-Sandbox bleibt AN (`mrxdown-cli.sh` setzt bewusst kein `--no-sandbox`).

## Schwachstelle melden

Bitte per E-Mail an martin@pepperonas.com (kein öffentliches Issue für ungefixte Lücken). Reproduktionsschritte + betroffene Version genügen.
