# M7 · Preview real y verificable de Worker/MCP Apps

> Documento temporal. Se elimina solo cuando exista una preview pública real validada contra el artefacto identificado. La preparación de repo por sí sola no cierra M7.

## 1. Estado de partida

ABCoda v2 ya tiene un Worker de preview separado en `apps/worker/wrangler.jsonc`:

- nombre `abcoda-v2-preview`;
- entrada `apps/worker/src/index.ts`;
- assets desde `dist/v2-widget`;
- `/mcp` y `/health` ejecutan primero el Worker;
- allowlist para ChatGPT y desarrollo local;
- observabilidad de Cloudflare activada.

El CI actual construye y prueba ese Worker mediante `wrangler deploy --dry-run`, workerd y Playwright, pero no lo publica.

El repositorio tuvo anteriormente un Worker legacy conectado directamente a Cloudflare Builds desde GitHub. No existe un GitHub Deployment visible ni un workflow de deploy v2 en esta rama. El conector GitHub usado por esta sesión tampoco puede inspeccionar secrets de Actions, por lo que no se asumirá que existen credenciales CI.

## 2. Objetivo

M7 no busca simplemente “conseguir una URL”. Debe demostrar que una revisión concreta de `architecture-v2` produjo un artefacto identificable y que esa misma preview pública satisface las fronteras de Worker/MCP Apps.

Una validación produce este registro mínimo:

```json
{
  "gitSha": "...",
  "baseUrl": "https://...workers.dev",
  "checkedAt": "...",
  "appVersion": "...",
  "schemaVersion": 2,
  "rulesVersion": 4,
  "artifactHash": "...",
  "localArtifactHash": "...",
  "checks": {
    "health": "ok",
    "mcpInitialize": "ok",
    "toolsList": "ok",
    "validateWithoutUi": "ok",
    "renderTool": "ok",
    "widgetResource": "ok",
    "securityHeaders": "ok",
    "originPolicy": "ok"
  }
}
```

`artifactHash` remoto debe ser idéntico al SHA-256 de `dist/v2-widget/index.html` que se está validando.

## 3. Separar build, deploy y validación

### Build

El artefacto se crea y pasa CI antes del deploy. `verify-v2-artifacts.mjs` sigue siendo el gate local de tamaño/empaquetado/separación servidor-navegador.

### Deploy

El comando canónico v2 será explícito y no reutilizará `deploy:worker` legacy:

```text
npm run deploy:v2-preview
```

Ese script ejecuta Wrangler con `apps/worker/wrangler.jsonc` y presupone autenticación válida proporcionada por Cloudflare/CLI/CI. No contiene tokens ni account IDs.

La configuración conserva `abcoda-v2-preview` y `workers.dev`; no toca el Worker `abcoda` legacy ni producción.

### Validación

`npm run verify:v2-preview -- <baseUrl>` ejecuta una sonda de red contra la URL ya desplegada. No despliega ni modifica nada.

La sonda compara la preview con el artefacto local ya construido. Si `dist/v2-widget/index.html` no existe, falla en vez de reconstruirlo silenciosamente. Esto permite probar “el mismo artefacto” y no otro build parecido hecho cinco segundos después.

## 4. Sonda pública

La sonda debe verificar al menos:

### `/health`

- HTTP 200;
- JSON con `name = ABCoda`, `status = ok`, `runtime = cloudflare-worker`;
- `appVersion`, `schemaVersion`, `rulesVersion`, `artifactHash` presentes;
- `artifactHash` igual al SHA-256 local;
- `X-Request-Id` válido;
- `Cache-Control: no-store`;
- `X-Content-Type-Options: nosniff`;
- CSP defensiva de endpoint JSON.

### Política Origin/Host

Con `Origin: https://chatgpt.com`:

- respuesta permitida;
- `Access-Control-Allow-Origin` refleja el origen permitido;
- nunca usa `*`.

Con un origen deliberadamente no permitido:

- rechazo 403 con código estable;
- no refleja el origen atacante.

No se falsifica `Host` sobre Internet porque intermediarios pueden normalizarlo; esa condición ya queda cubierta en workerd.

### MCP

Usando POST JSON-RPC real sobre `/mcp`:

1. `initialize` responde con protocolo y servidor ABCoda;
2. `tools/list` expone `prepare_composition`, `validate_score`, `render_score`;
3. `validate_score` funciona como herramienta de datos sin depender de UI y devuelve `structuredContent` útil;
4. `render_score` devuelve su snapshot/presentación y referencia al recurso UI;
5. el `requestId` de resultado MCP coincide con el `X-Request-Id` HTTP de su llamada.

### Recurso widget

Leer el recurso `ui://abcoda/score-schema-2.html` mediante MCP y comprobar:

- MIME de MCP Apps correcto;
- HTML no vacío;
- `abcoda/artifactHash` igual al de `/health`;
- metadatos CSP presentes;
- el recurso no inserta el ABC de la sonda como HTML.

## 5. Audio/CSP

La preview real debe servir un recurso cuya CSP autorice la dependencia de samples que usa abcjs y no dominios adicionales arbitrarios.

La sonda automatizada puede comprobar los metadatos CSP del recurso. La comprobación de que un navegador/host real carga muestras sin bloqueo pertenece también a M8 de audición/host humano; M7 no simula audio WebAudio desde Node para aparentar más cobertura de la que tiene.

## 6. Privacidad

La sonda usa un marcador ABC reconocible para `validate_score`, pero ese marcador nunca se imprime en el informe persistido.

La ausencia de ABC/prompts en los logs propios está cubierta por ARCH-07 y sus regresiones. La validación operacional adicional en Cloudflare Logs requiere acceso al proyecto Cloudflare; si el conector/usuario proporciona ese acceso se inspecciona, pero M7 no añadirá endpoints de debug ni telemetría que devuelva logs al cliente.

## 7. Reproducibilidad del deploy

El despliegue debe poder repetirse desde el mismo checkout/artefacto sin cambiar código:

1. `npm run check` deja `dist/v2-widget/index.html` validado;
2. calcular y registrar su hash;
3. `npm run deploy:v2-preview` publica usando ese directorio, sin ejecutar `build:v2-widget` dentro del script;
4. `verify:v2-preview` exige el mismo hash remoto;
5. el informe registra `git rev-parse HEAD` y versiones remotas.

Una segunda ejecución de `deploy:v2-preview` desde el mismo árbol puede producir otro Worker version ID de Cloudflare, pero el `artifactHash` servido debe permanecer idéntico.

## 8. Mecanismo de autenticación

Orden de preferencia:

1. conector Cloudflare autenticado disponible para la sesión;
2. Cloudflare Builds/Git integration configurada explícitamente para `architecture-v2` y el comando/config v2;
3. GitHub Actions manual con `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` almacenados como secrets;
4. Wrangler local autenticado.

No se guardan credenciales en Git, `.dev.vars`, documentación ni scripts.

Si esta sesión no dispone de acceso autenticado a Cloudflare, se completan build, scripts y regresiones, pero **M7 permanece abierto** hasta ejecutar la sonda contra una preview real.

## 9. Implementación en repo

1. Añadir `deploy:v2-preview` al `package.json`, sin build implícito.
2. Añadir `scripts/verify-v2-preview.mjs`.
3. Añadir pruebas unitarias de helpers puros de la sonda cuando proceda; no mockear una “preview real” y llamarla M7.
4. Añadir documentación corta de ejecución, preferiblemente en `docs/migration`, solo si queda como procedimiento permanente.
5. Ejecutar CI integral.
6. Desplegar preview separada.
7. Ejecutar la sonda contra la URL pública.
8. Guardar evidencia del informe y, si es posible, Worker version/deployment ID.
9. Comprobar la preview dentro del host MCP Apps real o dejar esa parte explícitamente para M8 si requiere interacción humana.
10. Solo entonces eliminar este MD.

## 10. Criterio de cierre

M7 queda cerrado cuando:

- existe una URL pública separada de producción;
- `/health`, `/mcp` y recurso widget pasan la sonda real;
- Origin/CORS real de ChatGPT funciona;
- el hash remoto coincide con el artefacto local probado;
- git SHA + versiones + artifactHash quedan registrados;
- no se han introducido secretos en repo;
- el mismo checkout puede redeployarse sin reconstruir el widget;
- cualquier parte que requiera juicio humano está explícitamente trasladada a M8, no fingida mediante mocks.