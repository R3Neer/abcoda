# Matriz viva de capacidades y defectos

> Baseline: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Estados de capacidad: `uncharacterized`, `partial`, `characterized`, `implemented-v2`, `parity-proven`, `intentionally-changed`, `deferred`

## Capacidades

| ID | Capacidad | Estado | Evidencia actual | Próxima evidencia requerida |
|---|---|---|---|---|
| CAP-01 | Brief tipado de composición | parity-proven | Política modular en `@abcoda/composition`; schema 4, golden prompts y cobertura combinatoria. | Revalidar si cambia `rulesVersion`. |
| CAP-02 | Guía por estilo, forma, dificultad e instrumentos | parity-proven | Catálogos/políticas/planner separados y golden prompts estables. | Calidad musical humana continua. |
| CAP-03 | ABC suministrado directamente | parity-proven | `CanonicalAbcCodec`, compatibilidad schema 1 y corpus source-preserving. | Ampliar corpus con casos reales nuevos. |
| CAP-04 | Normalización y diagnósticos mecánicos | parity-proven | Diagnósticos estructurales/métricos/referenciales y normalización idempotente. | Mantener fixtures límite. |
| CAP-05 | Grabado multivoz | implemented-v2 | Playwright desktop/móvil, reflow, selección, piano y multivoz. | Host real para `parity-proven`. |
| CAP-06 | Play, pause, rewind y loop | implemented-v2 | Engine diferido, transporte y regresiones browser. | Audición humana final y host real. |
| CAP-07 | Tempo en vivo | implemented-v2 | Control sincronizado, carreras y navegador. | Continuidad audible real. |
| CAP-08 | Instrumento y mute por voz | implemented-v2 | Estado tipado, persistencia y pruebas browser/audio estructural. | Audición humana durante Play/Pause. |
| CAP-09 | Compatibilidad y rango instrumental | implemented-v2 | Catálogo musicológicamente revisado; `bounded/unbounded/percussion`; `usual/extended/unplayable`; UI + playback + SoundFont capability separados y probados. | Audición humana de límites. |
| CAP-10 | Transposición de ABC, tonalidad y acordes | parity-proven | Operaciones canónicas global/por voz; keys/chords; source fields y sin reescaneo global de `K:`. | Ampliar ortografías con casos reales. |
| CAP-11 | Percusión inmune a transposición tonal | parity-proven | Operación canónica y UI impiden transposición tonal no afinada. | Audición GM continua. |
| CAP-12 | Editar, copiar, aplicar y restaurar | implemented-v2 | Draft/last-good/original, historial y restauración. | Clipboard dentro del host real. |
| CAP-13 | Cursor y seek por evento musical | implemented-v2 | Timeline, selección, seek, reflow y continuidad cubiertos. | Sesión larga con audio real. |
| CAP-14 | Tema del host y layout móvil | implemented-v2 | Temas, safe areas, responsive, no-overflow y artifacts visuales auditados. | Host MCP Apps real. |
| CAP-15 | Transporte siempre accesible | implemented-v2 | Dock sticky, teclado/foco/reduced motion y regresión geométrica móvil de clearance. | Lector de pantalla/revisión manual. |
| CAP-16 | Demo independiente | parity-proven | Host standalone y escenarios Playwright reproducibles. | Mantener como laboratorio obligatorio. |
| CAP-17 | Operación stateless | implemented-v2 | Worker por petición, workerd, request IDs y preview pública real con sonda MCP completa. | Carga moderada solo si se convierte en requisito de candidato. |
| CAP-18 | Claves, transposición sonora y claves de octava | parity-proven | Codec/abcjs caracterizados para pitch sonante y octave clefs. | Audición humana continua. |

## Defectos y riesgos

| ID | Defecto | Estado | Evidencia de cierre / pendiente |
|---|---|---|---|
| FIX-01 | CORS permisivo y sin validación Origin/Host | **closed** | Workerd + preview pública: origin permitido reflejado, origen atacante rechazado y sin `*`. |
| FIX-02 | Tunebooks múltiples mezclan voces/render | closed | Diagnóstico específico, sin snapshot ambiguo. |
| FIX-03 | Resultados asíncronos obsoletos | closed | Revisiones/cancelación y browser race; coordinación encapsulada en sesión. |
| FIX-04 | `main.ts` concentra responsabilidades/estado | **closed** | `WidgetSessionCoordinator` posee coordinación; vistas DOM separadas; `main.ts` composition root. |
| FIX-05 | Sin pruebas reales Worker/browser | closed | Workerd + Playwright obligatorios en CI. |
| FIX-06 | Dominio, URI y versiones repetidos manualmente | **closed** | `RevisionedScore` interno separado de DTO versionado; manifest/versiones centralizados y roundtrip de frontera probado. |
| FIX-07 | abcjs completo importado en servidor | closed | Grafo/bundle servidor prohíbe `abcjs`. |
| FIX-08 | Sin lint/no-floating-promises | closed | ESLint tipado forma parte de `npm run check`. |
| FIX-09 | Errores UI dispersos | closed for current scope | Controladores/coordinador y estados de recuperación con propietario explícito. |
| FIX-10 | UX evaluada tarde | partial | Laboratorio, screenshots, geometría móvil, browser y preview pública existen; faltan host, audición y accesibilidad manual. |

## Deuda arquitectónica auditada

| ID | Estado | Evidencia permanente |
|---|---|---|
| ARCH-01 | **closed** | APIs `@abcoda/*`, manifiestos de dependencias y test estructural de fronteras/ciclos. |
| ARCH-02 | **closed** | `WidgetSessionCoordinator`; ausencia de estado transversal en `main.ts`. |
| ARCH-03 | **closed** | `WidgetShellView`, `TransportView`, `MixerView`, `EditorView` y fronteras cohesionadas. |
| ARCH-04 | **closed** | `RevisionedScore` interno + mapper explícito a `ScoreSnapshotDto`; roundtrip probado. |
| ARCH-05 | **closed** | `packages/composition` dividido en catálogos/políticas/planner; barrel público pequeño. |
| ARCH-06 | **closed** | `ScoreField`/source ranges y transformaciones estructuradas de keys; guard contra reescaneo global. |
| ARCH-07 | **closed** | requestId correlacionable HTTP↔MCP, eventos estructurados y logs redactados sin cambiar schemas públicos. |

## Hardening posterior

### M6 · SoundFont

**closed.** `abcjs` + FluidR3_GM se caracteriza en el adaptador, independientemente de tesitura musical:

- melódicos MIDI 21–108;
- percusión MIDI 28–87;
- versión abcjs bloqueada por prueba;
- sample requests imposibles neutralizados sin borrar eventos.

### M7 · preview

**closed.** La preview Cloudflare `abcoda-v2-preview` pasó la sonda pública completa en el deploy run `32068849961`, con SHA `541eedc343df87c1d176b570d681615257ee4374` y artifact hash local/remoto `9e6785eb96dd7da4350526b310c466b09cecbacea049a700cb2a8351d5d1320d`. El informe permanente está resumido en `STATUS.md` y el artifact de validación es `9300946092`.

La primera ejecución real descubrió un 404 de routing en `/health`; se corrigió haciendo al Worker propietario de todas las rutas antes de assets (`run_worker_first = true`) y se añadió una regresión para esa frontera. La segunda ejecución quedó verde.

### M8 · revisión humana

**visual automation/review complete; host/audio pending.** El supuesto solapamiento del dock móvil se caracterizó y no era un defecto de alcanzabilidad. La regresión permanente evita que sí lo sea en el futuro.

Queda validar dentro del host MCP Apps real, escuchar audio/cambios/rangos y realizar la revisión manual final de accesibilidad.

## Regla de mantenimiento

Una CAP solo pasa a `parity-proven` cuando existe evidencia proporcional al riesgo. Para UI/audio, unit tests no bastan. Para arquitectura, mover código de carpeta tampoco: la frontera debe estar expresada y protegida por una regresión.
