# Estado de la reconstrucción

> Rama: `architecture-v2`
>
> Baseline: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`
>
> Última auditoría: 2026-08-15, commit `ff8de78`
>
> Validación: `npm run check:browser` verde (187 unitarias/integración, 11 Worker y 64 navegador)

## Fases

| Fase | Estado | Evidencia |
|---|---|---|
| 0. Congelar y caracterizar | complete | Baseline reproducido desde `ae36154`; contratos legacy, corpus ABC, defecto tunebook y capacidades/defectos quedaron registrados antes del primer corte. La suite browser posterior conserva los escenarios de UX que se decidió mantener o corregir. |
| 1. Esqueleto y dependencias | complete | Workspaces, tsconfigs, apps Worker/widget, ESLint tipado, límites automáticos, detección de ciclos, CI Node 22 y builds legacy/v2 simultáneos pasan en `check:browser`. Versiones y URI v2 proceden de `packages/contracts`. |
| 2. Contratos y modelo canónico | complete | Contratos externos v2 versionados y adaptador schema 1; aggregate rico con IDs nominales de melodía/voz/compás/evento/revisión; snapshot compacto; `PlaybackProfile`, `ScoreOperation`, diagnósticos con corrección y resultados discriminados. Worker, widget y aplicación compilan sin importarse entre sí. |
| 3. Codec y diagnósticos | complete | `CanonicalAbcCodec` modela corpus, rangos y nodos opacos con round-trip lossless; validadores distinguen sintaxis de consistencia; normalización es idempotente; `ApplyScoreOperation` transpone tonalidad/notas/acordes, preserva percusión y aplica instrumento/mute/restauración sin revisiones parciales. `abcjs` ya no transforma borradores. |
| 4. Casos de uso | in progress | `EvaluateScore` está detrás de `ScoreCodec`; la política pura `@abcoda/composition` es compartida sin depender de MCP ni Cloudflare. |
| 5. MCP y Worker seguro | in progress | `prepare_composition`, `validate_score` y `render_score`, recurso UI, health, límites HTTP y CORS por allowlist pasan 11 pruebas en workerd. Faltan completar headers/telemetría de petición y la prueba en preview real. |
| 6. Shell y bridge | complete | `HostBridge` aísla resultados, teardown, tema y safe areas; los controladores poseen estado y efectos por revisión; `DomWidgetView` posee el DOM. El laboratorio cubre carga, error, recuperación y carreras en móvil/escritorio. |
| 7. Grabado | in progress | Adaptador abcjs, piano/multivoz, selección por nota, cursor continuo y saltos de sistema pasan Playwright. Faltan corpus visual versionado, zoom/contraste alto y reflow largo. |
| 8. Reproducción | in progress | Engine diferido, transporte, tempo vivo, loop, timeline, cursor y click-to-seek tienen pruebas de carrera y navegador. Falta audición humana y completar la matriz con fallos de muestras/reflow. |
| 9. Instrumentos y edición | in progress | Mezcla race-safe, avisos de tesitura, editor revisionado, commits explícitos, historial y transposición revisable están implementados. Falta sustituir la transformación abcjs/textual por operaciones canónicas. |
| 10. Paridad, UX y robustez | in progress | Las iteraciones de UX y `check:browser` ya aportan cobertura semántica; faltan clasificación final CAP/FIX, propiedades del codec, auditoría accesible y pruebas manuales/audio/carga. |
| 11. Candidato y sustitución | pending | No existe aún un preview integrado y aprobado ni procedimiento probado de rollback. |

## Decisiones de cierre

- Las fases solo pasan a `complete` cuando satisfacen su puerta de salida y la evidencia está en el repositorio o en el pipeline reproducible.
- La Fase 6 usa controladores de sesión pequeños con propiedad explícita del estado en lugar de un reducer global; conserva el límite arquitectónico y evita un store central innecesario.
- No se crearán paquetes vacíos solo para reproducir el árbol propuesto: se introducen cuando exista un caso de uso y una prueba que justifiquen el límite.

## Primer corte vertical

La primera vertical implementa:

```text
ABC source
  -> evaluateScoreRequestSchema
  -> EvaluateScore
  -> ScoreCodec port
  -> CanonicalAbcCodec adapter
  -> ScoreSnapshot v2 o diagnósticos tipados
  -> recurso MCP Apps autocontenido
  -> HostBridge MCP Apps o standalone
  -> validación del snapshot en el widget
  -> ScoreSessionController con revisión y cancelación
  -> AbcjsEngraver adapter
  -> partitura estática en el laboratorio v2
```

Este corte demuestra inversión de dependencias y cierra el comportamiento v2 deseado para tunebooks múltiples sin introducir MCP, Cloudflare, DOM o abcjs en el dominio o en los casos de uso.

## Limitaciones conscientes actuales

- El codec canónico conserva construcciones desconocidas como nodos opacos seguros; ampliar el corpus seguirá siendo trabajo incremental, no un bloqueo de la migración.
- `abcjs` queda deliberadamente limitado a grabado, timeline y síntesis del navegador; la edición/transposición ya usa operaciones canónicas propias.
- El HTML v2 autocontenido mide 253,25 kB gzip y el Worker v2 245,26 kB gzip; ambos están dentro de los presupuestos automatizados.
- Las 64 pruebas browser cubren interacciones y responsive, pero aún faltan referencias visuales focalizadas, lector de pantalla, contraste alto y audición real.
- La rama local está diez commits por delante de `origin/architecture-v2` antes del siguiente push de migración.
