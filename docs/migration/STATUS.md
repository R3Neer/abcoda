# Estado de la reconstrucción

> Rama: `architecture-v2`  
> Baseline: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`

## Fases

| Fase | Estado | Evidencia |
|---|---|---|
| 0. Congelar y caracterizar | in progress | Baseline reproducido, corpus inicial y contratos legacy. Falta caracterización visual/browser. |
| 1. Esqueleto y dependencias | in progress | Workspaces, paquetes, apps Worker/widget, ESLint tipado, límites automáticos y detección de ciclos. |
| 2. Contratos y modelo canónico | in progress | `ScoreDocument` representa voces tipadas, metro, tonalidad, tempo de negra, fuente y snapshot revisionado. |
| 3. Codec y diagnósticos | in progress | Scanner conservador extrae semántica de cabeceras y percusión con rangos; no es todavía el codec ABC completo. |
| 4. Casos de uso | in progress | `EvaluateScore` está detrás de `ScoreCodec`; la política pura `@abcoda/composition` es compartida sin depender de MCP ni Cloudflare. |
| 5. MCP y Worker seguro | in progress | `prepare_composition`, `validate_score` y `render_score`, recurso UI, health, límites HTTP y CORS por allowlist. El adaptador schema 1 preserva preferencias como presentación v2; faltan ejecutar sus pruebas workerd bloqueadas por el runner. |
| 6. Shell y bridge | in progress | `HostBridge` aísla resultados, teardown, tema y safe areas. `DomWidgetView` posee el DOM; Playwright cubre estados, reemplazo válido→inválido y recorridos móvil/escritorio. |
| 7. Grabado | in progress | Adaptador abcjs estático comprobado en escritorio y 390 px. |
| 8. Reproducción | in progress | Engine diferido, transporte, tempo canónico, timeline, cursor y click-to-seek. Falta audición humana. |
| 9. Instrumentos y edición | in progress | Mezcla race-safe, avisos de tesitura, editor revisionado y transposición revisable implementados. Falta sustituir transposición abcjs por operación canónica al ampliar el codec. |
| 10–11 | pending | No iniciadas. |

## Primer corte vertical

La primera vertical implementa:

```text
ABC source
  -> evaluateScoreRequestSchema
  -> EvaluateScore
  -> ScoreCodec port
  -> BaselineAbcCodec adapter
  -> ScoreSnapshot v2 o diagnósticos tipados
  -> recurso MCP Apps autocontenido
  -> HostBridge MCP Apps o standalone
  -> validación del snapshot en el widget
  -> ScoreSessionController con revisión y cancelación
  -> AbcjsEngraver adapter
  -> partitura estática en el laboratorio v2
```

Este corte demuestra inversión de dependencias y cierra el comportamiento v2 deseado para tunebooks múltiples sin introducir MCP, Cloudflare, DOM o abcjs en el dominio o en los casos de uso.

## Limitaciones conscientes

- `BaselineAbcCodec` extrae la envolvente y metadatos necesarios para las primeras verticales; aún no representa eventos, compases ni variantes complejas de `Q:`.
- Los límites de capas y ciclos se validan automáticamente, pero las reglas tendrán que crecer con cada paquete nuevo.
- El HTML autocontenido mide 237,2 kB gzip tras incorporar el SDK MCP Apps; este es el presupuesto de partida del shell con bridge y grabador.
- Los escenarios del laboratorio se seleccionan con `?scenario=ready|invalid|malformed|race` y están automatizados; aún faltan interacciones de edición, audio y snapshots visuales de referencia.
