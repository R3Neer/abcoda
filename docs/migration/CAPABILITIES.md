# Matriz viva de capacidades y defectos

> Baseline: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Auditoría funcional de referencia: `540890c718f7f20c320cb4f8566f214fbd75e9c8`  
> Estados de capacidad: `uncharacterized`, `partial`, `characterized`, `implemented-v2`, `parity-proven`, `intentionally-changed`, `deferred`

## Capacidades

| ID | Capacidad | Estado | Evidencia actual | Próxima evidencia requerida |
|---|---|---|---|---|
| CAP-01 | Brief tipado de composición | parity-proven | Política única en `@abcoda/composition`; schema 4, golden prompts y cobertura combinatoria. | Revalidar si cambia `rulesVersion`. |
| CAP-02 | Guía por estilo, forma, dificultad e instrumentos | parity-proven | Legacy y v2 preservan la intención del ensamblador puro y las combinaciones tipadas. | Calidad musical humana continua, no bloqueo arquitectónico. |
| CAP-03 | ABC suministrado directamente | parity-proven | `CanonicalAbcCodec`, `EvaluateScore`, compatibilidad schema 1 y corpus con source ranges. | Ampliar corpus solo con construcciones reales nuevas. |
| CAP-04 | Normalización y diagnósticos mecánicos | parity-proven | Diagnósticos estructurales/métricos/referenciales, normalización idempotente y separación parseo/consistencia. | Mantener fixtures límite. |
| CAP-05 | Grabado multivoz | implemented-v2 | Playwright desktop/móvil, piano/multivoz, reflow y selección. | Revisión visual final en host real para `parity-proven`. |
| CAP-06 | Play, pause, rewind y loop | implemented-v2 | Engine diferido, estado de transporte y regresiones de navegador. | Audición humana final y host real. |
| CAP-07 | Tempo en vivo | implemented-v2 | Control sincronizado, carreras y navegador. | Validar continuidad audible durante reproducción real. |
| CAP-08 | Instrumento y mute por voz | implemented-v2 | Estado tipado, persistencia entre revisiones locales y pruebas browser. | Audición humana de cambios durante Play/Pause. |
| CAP-09 | Compatibilidad y rango instrumental | implemented-v2 | Catálogo musicológicamente revisado; políticas `bounded/unbounded/percussion`; `usual/extended/unplayable`; selector y notas coloreados; smoke y screenshots Playwright. | Cerrar capacidad técnica del SoundFont por separado y auditar corpus musical real. |
| CAP-10 | Transposición de ABC, tonalidad y acordes | parity-proven | Operaciones canónicas global y por voz; claves/acordes; inversas y percusión preservada. | Ampliar ortografías solo con casos reales. |
| CAP-11 | Percusión inmune a transposición tonal | parity-proven | Operación canónica y UI impiden transposición tonal de voces no afinadas. | Audición del mapa GM como control continuo. |
| CAP-12 | Editar, copiar, aplicar y restaurar | implemented-v2 | Draft/last-good/original separados, historial, carreras y restauración. | Clipboard y flujo dentro del host real. |
| CAP-13 | Cursor y seek por evento musical | implemented-v2 | Timeline, selección, seek y reflow cubiertos por unitarias/Playwright. | Sesión larga con audio real y reflow. |
| CAP-14 | Tema del host y layout móvil | implemented-v2 | Temas, safe areas, responsive, overflow, screenshots y viewport móvil. | Host MCP Apps real. |
| CAP-15 | Transporte siempre accesible | implemented-v2 | Dock responsive, controles accesibles, teclado, foco y reduced motion. | Lector de pantalla y revisión de densidad móvil. |
| CAP-16 | Demo independiente | parity-proven | Host standalone y escenarios Playwright reproducibles. | Mantenerla como laboratorio obligatorio. |
| CAP-17 | Operación stateless | implemented-v2 | Worker por petición, workerd y ausencia de contaminación entre requests. | Preview real/carga moderada. |
| CAP-18 | Claves, transposición sonora y claves de octava | parity-proven | Codec conserva clefs/transposition; caracterización abcjs evita dobles octavas. | Audición humana continua. |

## Defectos y riesgos

| ID | Defecto | Estado | Evidencia de cierre requerida |
|---|---|---|---|
| FIX-01 | CORS permisivo y sin validación Origin/Host | implemented | Workerd lo cubre; preview real antes de `closed`. |
| FIX-02 | Tunebooks múltiples mezclan voces/render | closed | v2 devuelve diagnóstico específico y no crea snapshot. |
| FIX-03 | Resultados asíncronos obsoletos | implemented | Revisiones/cancelación y browser race cubiertos; mantener al introducir `WidgetSessionCoordinator`. |
| FIX-04 | `main.ts` concentra responsabilidades/estado | **reopened** | Los subsistemas ya están separados, pero queda estado transversal de sesión en `main.ts` y `DomWidgetView` concentra demasiada UI. Cierra con M2 + M3. |
| FIX-05 | Sin pruebas reales Worker/browser | closed | Workerd + Playwright forman parte de CI. |
| FIX-06 | Dominio, URI y versiones repetidos manualmente | implemented | Versiones/artifact hash centralizados; cerrar definitivamente junto a M4 para sacar schemaVersion del dominio. |
| FIX-07 | abcjs completo importado en servidor | closed | Grafo/bundle v2 no incluyen synth/engraver server-side. |
| FIX-08 | Sin lint/no-floating-promises | closed | ESLint tipado forma parte de `npm run check`. |
| FIX-09 | Errores UI dispersos | implemented | Estados/controladores y recuperación existen; mantener durante M2/M3. |
| FIX-10 | UX evaluada tarde | partial | Laboratorio, screenshots y browser por corte ya existen; faltan host real, audición y accesibilidad manual final. |

## Deuda arquitectónica no representada como CAP

- **ARCH-01:** imports inter-workspace a `src` en lugar de APIs `@abcoda/*`.
- **ARCH-02:** coordinación transversal aún en `main.ts`.
- **ARCH-03:** `DomWidgetView` demasiado grande.
- **ARCH-04:** snapshot interno acoplado a `schemaVersion` externo.
- **ARCH-05:** `packages/composition/src/index.ts` necesita modularización interna antes de crecer mucho más.
- **ARCH-06:** transformaciones del codec son source-preserving y event-driven, pero siguen siendo lexeme-oriented; no extenderlas con regex globales cuando el modelo deje de ser suficiente.

## Regla de mantenimiento

Una CAP solo pasa a `parity-proven` cuando existe evidencia proporcional al riesgo. Para UI/audio, “los unit tests pasan” no es prueba completa. Para arquitectura, “el código está en otra carpeta” tampoco.
