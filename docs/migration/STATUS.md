# Estado de la reconstrucción

> Rama: `architecture-v2`  
> Baseline legacy: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Último corte funcional auditado: `540890c718f7f20c320cb4f8566f214fbd75e9c8`  
> CI asociado: run #42, completo y verde  
> Arquitectura normativa: [`docs/architecture/ABCoda-arquitectura-objetivo.md`](../architecture/ABCoda-arquitectura-objetivo.md)  
> Plan vigente: [`docs/architecture/ABCoda-plan-implementacion-y-migracion.md`](../architecture/ABCoda-plan-implementacion-y-migracion.md)

## Resumen

`architecture-v2` ya no es un experimento vacío. El núcleo, Worker, codec, widget, edición, reproducción, transposición y política instrumental existen y pasan CI. La auditoría de agosto de 2026 confirma que la dirección arquitectónica es buena, pero reabre algunas puertas que se habían marcado como completas con demasiado optimismo.

La deuda actual no exige otra reescritura. Exige terminar de materializar las fronteras previstas.

## Fases

| Fase | Estado | Evidencia / deuda pendiente |
|---|---|---|
| 0. Congelar y caracterizar | **complete** | Baseline, CAP/FIX, corpus y compatibilidad legacy registrados. |
| 1. Esqueleto y dependencias | **reopened** | Workspaces, ESLint, CI y builds existen; falta dejar de importar directamente `packages/*/src/**` entre workspaces y declarar dependencias workspace reales. |
| 2. Contratos y modelo canónico | **implemented, debt** | Contratos v2, compatibilidad schema 1, IDs nominales y documento rico existen. `ScoreSnapshot` aún mezcla proyección interna y versión de protocolo. |
| 3. Codec y diagnósticos | **complete for current corpus** | Parser source-preserving, opaque nodes, validación, normalización, round-trip y operaciones canónicas cubren el corpus actual. |
| 4. Casos de uso | **complete for current scope** | `PrepareComposition`, `EvaluateScore`, `PresentScore`, operaciones y export ABC se prueban sin MCP/DOM. |
| 5. MCP y Worker seguro | **implemented, preview pending** | Seguridad HTTP, MCP, health, artefacto, request ID y workerd pasan; falta preview público real y cierre operativo. |
| 6. Shell y bridge | **reopened for cleanup** | HostBridge y controladores existen. Falta encapsular coordinación transversal hoy residente en `main.ts` y dividir `DomWidgetView`. |
| 7. Grabado | **implemented** | Multivoz, reflow, cursor, selección y responsive pasan navegador; debe mantenerse estable durante M2/M3. |
| 8. Reproducción | **implemented, hardening pending** | Transporte, tempo, loop, seek, pause/resume y carreras están cubiertos. Falta audición final y política técnica explícita de capacidad SoundFont separada de tesitura. |
| 9. Instrumentos y edición | **implemented for current scope** | Editor revisionado, mix persistente, transposición global/por voz y tesituras `usual/extended/unplayable` están operativos. Presets ambiguos usan política `unbounded`. |
| 10. Paridad, UX y robustez | **in progress** | Playwright, screenshots, forced colors y móvil existen. Faltan refactors arquitectónicos, preview, accesibilidad/audio humanos y clasificación final CAP/FIX. |
| 11. Candidato y sustitución | **pending** | No existe aún un artefacto preview aprobado con rollback probado. |

## Deuda arquitectónica prioritaria

1. **ARCH-01 / M1:** imports inter-workspace a APIs públicas y `workspace:*`.
2. **ARCH-02 / M2:** `WidgetSessionCoordinator`; `main.ts` solo composition root.
3. **ARCH-03 / M3:** dividir `DomWidgetView` por editor/mixer/transporte/shell.
4. **ARCH-04 / M4:** separar snapshot interno y DTO versionado.
5. **ARCH-05 / M5:** modularizar `packages/composition` cuando vuelva a crecer esa superficie.
6. **M6:** caracterizar y proteger capacidad técnica del SoundFont independientemente de tesitura musical.

## Decisiones confirmadas

- No se fuerza un reducer global: controladores especializados son una desviación deliberada y aceptada del diseño inicial.
- No se crean paquetes vacíos para reproducir un diagrama.
- El codec crece por corpus real y conserva sintaxis desconocida de forma opaca cuando es seguro.
- `abcjs` queda en adaptadores de navegador.
- El dominio musical decide compatibilidad y tesitura; el backend de audio decide capacidad técnica de síntesis.
- `church_organ`, `string_ensemble_1`, `choir_aahs` y `recorder` genérico no reciben límites organológicos inventados.
- CI verde es condición necesaria, no prueba suficiente de que una puerta arquitectónica esté cerrada.

## Siguiente secuencia recomendada

```text
M1 workspace boundaries
  → M2 session coordinator
  → M3 split DOM views

M1
  → M4 internal/external snapshot

M2
  → M6 synth capability hardening

M3 + M4 + M6
  → preview real
  → UX/accessibility/audio review
  → candidate + rollback
```

## Criterio de actualización

Este fichero debe cambiar cuando:

- se cierre o reabra una puerta de fase;
- aparezca una deuda arquitectónica que limite crecimiento;
- una CAP cambie de estado;
- un preview/candidato quede identificado por SHA y artifact hash.

No debe actualizarse para cada commit menor. La historia del repo ya cumple esa función sin necesidad de hacer cosplay de diario de a bordo.
