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
| 4. Casos de uso | in progress | `EvaluateScore` implementado detrás de `ScoreCodec`. |
| 5. MCP y Worker seguro | in progress | Herramientas separadas `validate_score`/`render_score`, recurso UI, health, límites HTTP, CORS por allowlist y tests workerd. Falta compatibilidad schema 1. |
| 6. Shell y bridge | in progress | `HostBridge` aísla resultados, teardown y contexto visual; adaptadores MCP Apps/standalone comparten sesión. Playwright cubre estados y tema claro/oscuro en móvil/escritorio. |
| 7. Grabado | in progress | Adaptador abcjs estático comprobado en escritorio y 390 px. |
| 8. Reproducción | in progress | Estado discriminado y generaciones contra carreras; engine abcjs diferido conectado al grabado. Controles sticky de play/pause, rewind, loop y tempo adoptan el snapshot. Falta audición humana, cursor e instrumentos. |
| 9–11 | pending | No iniciadas. |

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
