# Estado de la reconstrucción

> Rama: `architecture-v2`  
> Baseline: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`

## Fases

| Fase | Estado | Evidencia |
|---|---|---|
| 0. Congelar y caracterizar | in progress | Baseline reproducido, corpus inicial y contratos legacy. Falta caracterización visual/browser. |
| 1. Esqueleto y dependencias | in progress | Workspaces, paquetes y app widget v2, ESLint tipado, límites automáticos y detección de ciclos. Falta app Worker v2. |
| 2. Contratos y modelo canónico | in progress | Primer `ScoreDocument`, snapshot y schemas v2 de request/widget. |
| 3. Codec y diagnósticos | in progress | Scanner de cabeceras conservador para la primera vertical; no es todavía el codec ABC completo. |
| 4–11 | pending | No iniciadas. |

## Primer corte vertical

La primera vertical implementa:

```text
ABC source
  -> evaluateScoreRequestSchema
  -> EvaluateScore
  -> ScoreCodec port
  -> BaselineAbcCodec adapter
  -> ScoreSnapshot v2 o diagnósticos tipados
  -> validación del snapshot en el widget
  -> ScoreSessionController con revisión y cancelación
  -> AbcjsEngraver adapter
  -> partitura estática en el laboratorio v2
```

Este corte demuestra inversión de dependencias y cierra el comportamiento v2 deseado para tunebooks múltiples sin introducir MCP, Cloudflare, DOM o abcjs en el dominio.

## Limitaciones conscientes

- `BaselineAbcCodec` solo extrae la envolvente necesaria para la primera vertical; aún no representa eventos y compases.
- Las dependencias principales de dominio y aplicación se validan con ESLint; todavía falta una comprobación global de ciclos y ampliar las reglas cuando existan `apps/`.
- No existe todavía `validate_score` en la superficie MCP pública.
- El laboratorio browser ya existe, pero todavía carece de host simulado seleccionable, escenarios y pruebas Playwright.
