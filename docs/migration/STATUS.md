# Estado de la reconstrucción

> Rama: `architecture-v2`  
> Baseline: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`

## Fases

| Fase | Estado | Evidencia |
|---|---|---|
| 0. Congelar y caracterizar | in progress | Baseline reproducido, corpus inicial y contratos legacy. Falta caracterización visual/browser. |
| 1. Esqueleto y dependencias | in progress | Workspaces, paquetes, apps Worker/widget, ESLint tipado, límites automáticos y detección de ciclos. |
| 2. Contratos y modelo canónico | in progress | Primer `ScoreDocument`, snapshot y schemas v2 de request/widget. |
| 3. Codec y diagnósticos | in progress | Scanner de cabeceras conservador para la primera vertical; no es todavía el codec ABC completo. |
| 4. Casos de uso | in progress | `EvaluateScore` implementado detrás de `ScoreCodec`. |
| 5. MCP y Worker seguro | in progress | Herramientas separadas `validate_score`/`render_score`, recurso UI, health, límites HTTP, CORS por allowlist y tests workerd. Falta compatibilidad schema 1. |
| 6. Shell y bridge | in progress | `HostBridge` aísla el shell; adaptadores MCP Apps y standalone comparten sesión revisionada y teardown idempotente. Falta el host simulado por escenarios. |
| 7. Grabado | in progress | Adaptador abcjs estático comprobado en escritorio y 390 px. |
| 8–11 | pending | No iniciadas. |

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

- `BaselineAbcCodec` solo extrae la envolvente necesaria para la primera vertical; aún no representa eventos y compases.
- Los límites de capas y ciclos se validan automáticamente, pero las reglas tendrán que crecer con cada paquete nuevo.
- El HTML autocontenido mide 237,2 kB gzip tras incorporar el SDK MCP Apps; este es el presupuesto de partida del shell con bridge y grabador.
- El laboratorio browser ya existe, pero todavía carece de host simulado seleccionable, escenarios y pruebas Playwright.
