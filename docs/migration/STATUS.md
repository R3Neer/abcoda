# Estado de la reconstrucción

> Rama: `architecture-v2`  
> Baseline legacy: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Arquitectura normativa: [`docs/architecture/ABCoda-arquitectura-objetivo.md`](../architecture/ABCoda-arquitectura-objetivo.md)  
> Plan vigente: [`docs/architecture/ABCoda-plan-implementacion-y-migracion.md`](../architecture/ABCoda-plan-implementacion-y-migracion.md)

## Resumen

La reconstrucción arquitectónica de `architecture-v2` está esencialmente terminada. Las siete deudas ARCH detectadas en la auditoría se han cerrado mediante refactors pequeños, cada uno con diseño temporal, regresiones y CI integral.

Ya no queda una deuda estructural que justifique otra reescritura general.

El trabajo pendiente es operacional y de validación humana:

- **M7:** publicar y validar una preview real Cloudflare/MCP Apps;
- **M8:** audición y prueba dentro del host real. La subfase visual de M8 ya está cerrada.

## Fases

| Fase | Estado | Evidencia / pendiente |
|---|---|---|
| 0. Congelar y caracterizar | **complete** | Baseline, CAP/FIX, corpus y compatibilidad legacy registrados. |
| 1. Esqueleto y dependencias | **complete** | Fronteras `@abcoda/*` reales, dependencias declaradas y prueba estructural contra imports privados/ciclos. |
| 2. Contratos y modelo canónico | **complete for current schema** | Modelo interno `RevisionedScore` separado de `ScoreSnapshotDto`; mappers explícitos y roundtrip probado. |
| 3. Codec y diagnósticos | **complete for current corpus** | Parser source-preserving, opaque nodes, fields/ranges estructurados, validación, normalización y operaciones sin reescaneo global de armaduras. |
| 4. Casos de uso | **complete for current scope** | Casos de uso y puertos aislados de infraestructura. |
| 5. MCP y Worker seguro | **implemented, preview pending** | Seguridad HTTP, MCP, request IDs, logs redactados, workerd y artefactos pasan. Preview pública aún no ejecutada. |
| 6. Shell y bridge | **complete** | `WidgetSessionCoordinator` posee coordinación transversal; `main.ts` es composition root; vistas DOM divididas por responsabilidad. |
| 7. Grabado | **implemented** | Multivoz, reflow, cursor, selección y responsive cubiertos por navegador. |
| 8. Reproducción | **implemented + technically hardened** | Transporte, tempo, loop, seek, pause/resume y capacidad SoundFont separada de tesitura; falta audición humana final. |
| 9. Instrumentos y edición | **implemented for current scope** | Editor revisionado, mix persistente, transposición global/por voz y política `bounded/unbounded/percussion`. |
| 10. Paridad, UX y robustez | **visual automation complete; human review pending** | Playwright, screenshots, forced-colors, móvil y clearance sticky auditados. Falta host/audio humanos. |
| 11. Candidato y sustitución | **pending M7/M8** | No se sustituye `main` hasta preview pública, revisión humana y rollback. |

## Cierre de la deuda arquitectónica

| ID | Estado | Resultado |
|---|---|---|
| ARCH-01 | **closed** | Workspaces consumidos mediante APIs públicas; prueba permanente de fronteras y ciclos. |
| ARCH-02 | **closed** | `WidgetSessionCoordinator` posee estado/coordinación cruzada; `main.ts` queda como composition root. |
| ARCH-03 | **closed** | UI DOM separada en vistas cohesionadas; prueba de fronteras de vista. |
| ARCH-04 | **closed** | Snapshot interno y DTO externo separados; versión de protocolo fuera del dominio. |
| ARCH-05 | **closed** | `packages/composition` modularizado; `index.ts` vuelve a ser una API pequeña. |
| ARCH-06 | **closed** | Campos ABC modelados con source ranges; transposición de tonalidad deja de reescanear texto globalmente. |
| ARCH-07 | **closed** | Correlación request→tool, eventos estructurados y privacidad de logs sin wrappers públicos innecesarios. |

## Milestones posteriores

### M6 · capacidad técnica del sintetizador

**Cerrado.** El adaptador abcjs caracteriza la cobertura FluidR3_GM por separado de la musicología:

- melódicos: MIDI 21–108;
- percusión: MIDI 28–87;
- versión abcjs caracterizada bloqueada por regresión;
- pitches fuera de capacidad se neutralizan antes de sample loading sin borrar eventos ni marcar falsamente la nota como musicalmente imposible.

### M7 · preview real

**Abierto por dependencia externa.** El repo ya contiene:

- `deploy:v2-preview`;
- `verify:v2-preview`;
- sonda HTTPS que compara artifact hash y prueba `/health`, MCP, tools, resource, CORS, CSP y request IDs;
- workflow manual `.github/workflows/deploy-preview.yml` con secrets Cloudflare.

Falta una ejecución autenticada que produzca una URL pública y un `v2-preview-validation.json` válido.

### M8 · revisión humana

**Visual: cerrada. Host/audio: pendiente.**

La inspección de artifacts desktop/mobile/light/dark no ha encontrado un defecto estructural pendiente. El supuesto solapamiento del dock móvil se caracterizó con una regresión geométrica y resultó no ser pérdida de alcanzabilidad; no se añadió un parche CSS innecesario.

Queda:

- abrir la preview en un host MCP Apps real;
- audición de reproducción, instrumentos, mute, tempo, pause/resume y seek;
- audición específica de límites `extended/unplayable` y capacidad técnica del SoundFont;
- revisión manual final de accesibilidad.

## Decisiones confirmadas

- Controladores especializados + coordinador de sesión, no reducer global obligatorio.
- Monolito modular, no microservicios ni paquetes decorativos.
- El codec crece por casos reales y preserva fuente; no usa regex globales como modelo musical.
- `abcjs` pertenece al borde navegador.
- Dominio musical, capacidad técnica del sintetizador y presentación visual son políticas distintas.
- Los presets ambiguos no reciben límites organológicos inventados.
- CI verde es necesario, pero cada cierre arquitectónico requiere además una prueba que exprese la frontera correspondiente.

## Próxima secuencia

```text
M7 deploy preview real
  → ejecutar verify:v2-preview
  → host MCP Apps real
  → M8 audición/accesibilidad humana
  → clasificación final CAP/FIX
  → candidate + rollback
```

## Criterio de actualización

Este fichero cambia cuando se cierra/reabre una puerta real, una CAP cambia de estado o queda identificado un preview/candidato por SHA y artifact hash. No es un diario por commit.