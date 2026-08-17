# ABCoda: plan de implementación y migración vigente

> Estado: cierre de reconstrucción y preparación de candidato  
> Rama: `architecture-v2`  
> Baseline legacy: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Arquitectura normativa: [ABCoda: arquitectura vigente](./ABCoda-arquitectura-objetivo.md)  
> Estado operativo: [migration/STATUS.md](../migration/STATUS.md)  
> Matriz viva: [migration/CAPABILITIES.md](../migration/CAPABILITIES.md)

## 1. Estado actual

La reconstrucción estructural ha terminado. ARCH-01…ARCH-07 y M6 están cerrados y protegidos por regresiones permanentes. M7 también está cerrado mediante una preview Cloudflare pública validada de extremo a extremo.

No queda un refactor arquitectónico general pendiente. El siguiente trabajo es **M8 humano**, seguido de clasificación final CAP/FIX, candidato, promoción y rollback.

## 2. Hitos cerrados

| Hito | Estado | Evidencia principal |
|---|---|---|
| M1 · fronteras workspace | **closed** | imports `@abcoda/*`, dependencias explícitas, test de fronteras/ciclos |
| M2 · coordinador de sesión | **closed** | `WidgetSessionCoordinator`, `main.ts` composition root |
| M3 · vistas DOM | **closed** | shell/transporte/mixer/editor separados y test de cohesión |
| M4 · modelo interno vs DTO | **closed** | `RevisionedScore`, mappers y roundtrip |
| M5 · composition | **closed** | schema/catálogos/política/planner separados, barrel pequeño |
| M6 · synth capability | **closed** | capacidad FluidR3_GM separada de tesitura y bloqueada por pruebas |
| M7 · preview real | **closed** | Cloudflare público + sonda completa + hash local/remoto idéntico |

Las deudas ARCH-01…ARCH-07 están igualmente cerradas. Sus documentos temporales se eliminaron al completar cada ciclo de análisis → diseño → implementación → pruebas → auditoría.

## 3. M7 · evidencia pública cerrada

La preview validada es:

```text
Worker: abcoda-v2-preview
URL: https://abcoda-v2-preview.mud-repo-patcher-mcp-probe.workers.dev
SHA validado: 541eedc343df87c1d176b570d681615257ee4374
Worker Version ID: d67a4b98-a105-4496-bf62-7747347891ec
appVersion: 0.13.0-alpha.1
schemaVersion: 2
rulesVersion: 4
artifactHash: 9e6785eb96dd7da4350526b310c466b09cecbacea049a700cb2a8351d5d1320d
GitHub Actions run: 32068849961
validation artifact: 9300946092
```

La sonda real confirmó:

- `/health`;
- security headers;
- Origin/CORS permitido y rechazado;
- MCP `initialize`;
- `tools/list`;
- `validate_score` sin UI;
- `render_score`;
- correlación request HTTP ↔ resultado MCP;
- `resources/read` del widget;
- metadatos MCP Apps/CSP;
- hash remoto idéntico al artefacto local.

La primera ejecución real detectó un defecto que CI/workerd no podían observar: el routing selectivo de assets daba 404 para `/health` en Cloudflare. Se volvió al plan de M7, se simplificó la propiedad del routing y `assets.run_worker_first` pasó a `true`. El Worker recibe toda petición y delega assets explícitamente mediante `env.ASSETS.fetch()`. Una regresión estructural fija esa decisión.

Tras el segundo deploy toda la sonda quedó verde. El trigger temporal de push fue retirado y el workflow de preview volvió a `workflow_dispatch` únicamente.

## 4. M8 · revisión humana final

**Estado: visual automatizado cerrado; host/audio/accesibilidad manual pendientes.**

La revisión debe hacerse contra la preview M7 identificada arriba. No debe reconstruirse ni desplegarse otra versión durante la checklist salvo que aparezca un defecto que requiera corrección.

### 4.1 Host real

1. conectar el endpoint MCP público en el host MCP Apps objetivo;
2. verificar que `prepare_composition`, `validate_score` y `render_score` aparecen y funcionan;
3. renderizar una pieza tonal sencilla;
4. renderizar una pieza multivoz;
5. comprobar que el widget aparece dentro del host y no solo en standalone.

### 4.2 Audio

Comprobar perceptivamente:

1. play/pause sin reinicio inesperado;
2. rewind;
3. loop;
4. cambio de tempo durante playback sin desincronización;
5. cambio de instrumento durante playback sin reiniciar el audio;
6. mute/unmute por voz;
7. seek y sincronía con cursor;
8. nota `extended`: naranja y audible;
9. nota `unplayable`: roja, silenciosa y con timeline intacto;
10. presets `unbounded` en extremos técnicos sin errores de muestras.

Los unit tests de eventos y SoundFont no sustituyen esta escucha.

### 4.3 Edición e interacción

Comprobar:

- abrir/cerrar editor;
- editar/aplicar/restaurar;
- historial local;
- transposición global y por voz;
- mixer en móvil;
- targets táctiles;
- foco/teclado cuando el host lo permita;
- lector de pantalla o equivalente para controles críticos si está disponible.

La subfase visual standalone ya demostró desktop/móvil, light/dark, forced-colors, no-overflow y alcanzabilidad del contenido bajo el dock sticky. No se repite por ritual, pero sí se observa que el host no introduzca una regresión nueva.

### 4.4 Si aparece un defecto

```text
hallazgo
  → clasificar capa responsable
  → diseño temporal si el cambio es no trivial
  → regresión
  → implementación
  → CI integral
  → nueva preview si cambia código desplegado
  → repetir la parte humana afectada
```

No se parchea el host en dominio ni se altera musicología para esconder limitaciones del backend.

## 5. Cierre CAP/FIX

Después de M8:

- cada CAP debe quedar `parity-proven`, `intentionally-changed` o `deferred` con decisión explícita;
- FIX-10 solo se cierra después de la revisión humana;
- no queda ningún FIX crítico/alto abierto sin aceptación explícita;
- capacidades de audio/host no pasan a `parity-proven` únicamente porque CI sea verde.

Actualizar `docs/migration/CAPABILITIES.md` en un commit focal.

## 6. Preparación de candidato

Cuando M8 cierre:

1. elegir un SHA exacto de `architecture-v2`;
2. ejecutar CI integral sin cambios posteriores;
3. construir y validar preview desde ese SHA si el candidato difiere del SHA de M7;
4. conservar artifacts visuales y `v2-preview-validation`;
5. registrar `appVersion`, `schemaVersion`, `rulesVersion` y `artifactHash`;
6. congelar cambios funcionales hasta promoción.

Un arreglo después de elegir candidato produce un candidato nuevo. “Es solo una línea” es una frase que Git ya ha escuchado demasiadas veces.

## 7. Sustitución de `main`

Antes de promover:

- el legacy debe seguir identificable por SHA/tag;
- candidato v2 debe estar verde y validado públicamente;
- debe conocerse qué Worker/URL de producción se modificará;
- no se eliminan rutas de rollback antes de verificar producción.

Secuencia recomendada:

```text
candidate SHA
  → promoción controlada a main
  → deploy producción
  → smoke público equivalente a M7
  → smoke humano mínimo equivalente a M8
  → observación
```

La forma Git exacta se decidirá con el estado real de `main` en ese momento. Lo normativo es conservar un commit candidato identificable y no mezclarlo con cambios no auditados.

## 8. Rollback

Si producción falla de forma crítica:

1. restaurar/redeployar primero el último artefacto conocido bueno;
2. resolver Git después si es necesario;
3. conservar evidencia suficiente para reproducir el fallo;
4. abrir un nuevo corte con regresión;
5. no mantener al usuario en una versión rota mientras se debate la elegancia del revert.

Rollback es una capacidad operacional, no un fracaso moral.

## 9. Disciplina futura

### Codec

Antes de ampliar una transformación:

1. fixture real;
2. parseo/source range;
3. comprobar semántica disponible;
4. enriquecer modelo si hace falta;
5. transformar desde estructura parseada;
6. roundtrip/inversa cuando proceda.

Regex globales sobre `document.source.text` no vuelven a ser el modelo musical.

### Arquitectura

No se abre otra reescritura general por estética. Una nueva deuda arquitectónica necesita:

- diferencia demostrable respecto a la arquitectura normativa;
- impacto real en crecimiento/corrección;
- diseño explícito;
- regresión que proteja la frontera.

## 10. Definición de terminado del proyecto de migración

La migración termina cuando:

- M8 humano está cerrado;
- CAP/FIX están clasificados definitivamente;
- existe candidato por SHA + artifact hash;
- producción pasa smoke público y humano;
- rollback ha quedado practicable/documentado;
- los documentos temporales `docs/architecture/work/` están vacíos.

Hasta entonces `architecture-v2` es técnicamente muy avanzada, pero no se le concede el título ceremonial de “terminada” solo porque tenga una cantidad intimidante de tests.
