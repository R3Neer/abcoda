# ABCoda: plan de implementación y migración vigente

> Estado: cierre de reconstrucción y preparación de candidato  
> Rama: `architecture-v2`  
> Baseline legacy: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Corte arquitectónico cerrado: `2a40b50318a00ee6965cc4903a7b31c7a2339e5e`  
> Arquitectura normativa: [ABCoda: arquitectura vigente](./ABCoda-arquitectura-objetivo.md)  
> Estado operativo: [migration/STATUS.md](../migration/STATUS.md)  
> Matriz viva: [migration/CAPABILITIES.md](../migration/CAPABILITIES.md)

## 1. Qué es este documento ahora

El plan original sirvió para levantar `architecture-v2` y después para auditarla. Esa etapa está esencialmente terminada.

ARCH-01…ARCH-07 y M6 ya no son trabajo futuro: fueron ejecutados mediante refactors pequeños con diseño temporal, pruebas y auditoría. Mantenerlos escritos como tareas pendientes convertiría el plan en ficción histórica, que es una forma particularmente cara de documentación.

Este documento pasa a tener tres funciones:

1. registrar qué hitos estructurales se completaron y qué evidencia los protege;
2. definir los pasos exactos que quedan para una candidata real;
3. definir sustitución y rollback sin destruir el baseline antes de tiempo.

No se abrirán más refactors estructurales generales salvo que aparezca una nueva desviación demostrable respecto a la arquitectura normativa.

## 2. Resultado buscado

`architecture-v2` será candidata cuando:

- las fronteras arquitectónicas internas permanezcan verdes;
- el mismo artefacto probado se publique en una preview separada;
- el host MCP Apps real consuma esa preview;
- audio e interacción hayan pasado revisión humana;
- CAP/FIX estén clasificados de forma final;
- exista procedimiento de rollback verificable.

La arquitectura interna ya cumple su parte. El cuello de botella restante es evidencia operacional.

## 3. Estado de las fases originales

| Fase | Estado actual | Evidencia / pendiente |
|---|---|---|
| 0. Congelar y caracterizar | **complete** | Baseline legacy, matriz CAP/FIX y corpus reproducible. |
| 1. Esqueleto y dependencias | **complete** | Workspaces consumidos mediante APIs públicas y test estructural de fronteras/ciclos. |
| 2. Contratos y modelo canónico | **complete for current schema** | DTO externo separado de proyección interna revisionada; mappers y roundtrip. |
| 3. Codec y diagnósticos | **complete for current corpus** | Parser source-preserving, fields/ranges, opaque nodes, validación y transformaciones estructuradas. |
| 4. Casos de uso | **complete for current scope** | Casos de uso/puertos aislados de infraestructura. |
| 5. MCP y Worker seguro | **implemented; preview pending** | Workerd, límites HTTP, Origin/Host, request IDs, logs estructurados, recurso y manifest. Falta M7 público. |
| 6. Shell y bridge | **complete** | Coordinador de sesión y vistas DOM cohesionadas; `main.ts` composition root. |
| 7. Grabado | **implemented** | Multivoz, reflow, cursor, selección y navegador real. |
| 8. Reproducción | **implemented + hardened** | Transporte y capacidad técnica SoundFont separada de tesitura. Falta audición humana. |
| 9. Instrumentos y edición | **implemented for current scope** | Mix persistente, editor revisionado, transposición y rangos musicológicos. |
| 10. Paridad, UX y robustez | **automation/visual review complete; human pending** | CI, workerd, Playwright, artifacts y revisión móvil. Falta host/audio/accesibilidad humanos. |
| 11. Candidato y sustitución | **pending M7/M8** | Preview aprobada + clasificación final + rollback. |

## 4. Hitos estructurales completados

### M1 · fronteras reales de workspace

**Estado: cerrado.**

Resultado:

- imports inter-package mediante `@abcoda/*`;
- manifests expresan dependencias internas;
- prohibición permanente de imports privados a `packages/*/src` desde otro workspace;
- detección de ciclos/dependencias prohibidas.

La implementación confirmó que el grafo conceptual original ya era correcto: el problema era encapsulación física, no inversión de dependencias.

### M2 · coordinador de sesión

**Estado: cerrado.**

`WidgetSessionCoordinator` posee la coordinación transversal. Los controladores especializados permanecen como propietarios de sus estados. `main.ts` queda reducido a composition root, bindings DOM, `ResizeObserver` y teardown.

No se sustituyó todo por un reducer global porque la evidencia de implementación mostró que habría empeorado la separación.

### M3 · vistas DOM cohesionadas

**Estado: cerrado.**

La fachada `DomWidgetView` delega en superficies independientes para shell, transporte, mixer y editor. Cursor/rangos mantienen adaptadores específicos.

Los tests arquitectónicos impiden que las vistas vuelvan a acoplarse indiscriminadamente.

### M4 · snapshot interno frente a DTO externo

**Estado: cerrado.**

Aplicación/dominio usan una proyección revisionada sin versión de protocolo. `ScoreSnapshotDto` vive en contratos y los adapters realizan el mapeo explícito.

Una regresión directa prueba el roundtrip de frontera.

### M5 · modularización de composición

**Estado: cerrado.**

`@abcoda/composition` separa schema, catálogos, política, planner e instrucciones. `index.ts` vuelve a ser una API pública pequeña. Golden prompts y combinatoria protegen el comportamiento.

### M6 · capacidad técnica del sintetizador

**Estado: cerrado.**

Se caracterizó la integración concreta abcjs 6.7.0 + FluidR3_GM:

- muestras melódicas MIDI 21–108;
- percusión MIDI 28–87.

El adaptador neutraliza requests técnicamente imposibles antes de sample loading sin:

- alterar el ABC;
- borrar eventos;
- confundir capacidad del backend con tesitura musical.

Una actualización de abcjs hace fallar una regresión hasta recaracterizar el backend.

## 5. Deudas ARCH cerradas

| ID | Estado | Cambio de arquitectura |
|---|---|---|
| ARCH-01 | closed | fronteras públicas reales entre workspaces |
| ARCH-02 | closed | coordinación transversal con propietario explícito |
| ARCH-03 | closed | vistas DOM separadas |
| ARCH-04 | closed | modelo interno desacoplado de schema externo |
| ARCH-05 | closed | composition modularizado |
| ARCH-06 | closed | campos ABC/source ranges como base de transformaciones de tonalidad |
| ARCH-07 | closed | observabilidad request-scoped y privada en el borde Worker/MCP |

No se conservan los documentos temporales de estas deudas porque su propósito era conducir el refactor, no convertirse en una segunda arquitectura paralela.

## 6. M7 · preview real de Worker/MCP Apps

**Estado: abierto por autenticación/despliegue externo.**

El código necesario está ya en repo.

### 6.1 Preparación existente

- Worker separado: `abcoda-v2-preview`;
- config: `apps/worker/wrangler.jsonc`;
- `npm run deploy:v2-preview`;
- `npm run verify:v2-preview -- <url>`;
- workflow manual `.github/workflows/deploy-preview.yml`;
- artifact verification previa al deploy;
- sonda pública que compara el hash remoto con `dist/v2-widget/index.html`.

La sonda real verifica:

- `/health` y versiones;
- artifact hash local/remoto;
- security headers;
- Origin permitido y rechazado;
- MCP `initialize`;
- `tools/list`;
- `validate_score` sin UI;
- `render_score`;
- correlación `X-Request-Id` ↔ `_meta`;
- `resources/read` del widget;
- MIME MCP Apps;
- CSP/allowlist;
- ausencia de score de prueba incrustado en la plantilla UI.

### 6.2 Ejecución preferida

Usar el workflow manual **Deploy v2 preview** con:

- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`;

almacenados como GitHub Secrets.

El workflow:

```text
checkout
  → npm ci
  → build:v2-worker
  → verify:v2-artifacts
  → wrangler deploy apps/worker/wrangler.jsonc
  → verify:v2-preview <deployment-url>
  → upload v2-preview-validation.json
```

No poner tokens, account IDs ni `.dev.vars` en Git.

### 6.3 Evidencia requerida para cerrar M7

Conservar en la historia operativa:

- Git SHA desplegado;
- URL pública de preview;
- app/schema/rules versions;
- `artifactHash`;
- `localArtifactHash` idéntico;
- fecha de comprobación;
- todos los checks de `v2-preview-validation.json = ok`.

Después actualizar `STATUS.md` y `CAPABILITIES.md` y eliminar `docs/architecture/work/M7-real-preview.md`.

### 6.4 Si falla M7

Clasificación del fallo:

- **build/hash distinto:** volver a build/deploy design; no aceptar artefactos reconstruidos silenciosamente;
- **CORS/headers/HTTP:** volver a Worker boundary;
- **MCP/tool/resource:** volver a adapter MCP/contratos;
- **Cloudflare auth/config únicamente:** corregir despliegue, no tocar dominio/widget;
- **CSP/audio host:** registrar para M8 si requiere navegador/host real.

## 7. M8 · UX, accesibilidad y audio humanos

**Estado: subfase visual cerrada; host/audio pendientes.**

### 7.1 Evidencia visual ya cerrada

La suite genera artifacts para desktop/móvil y light/dark, incluidos escenarios de tesitura y mezcla.

Durante la revisión se sospechó que el dock sticky móvil hacía inalcanzables controles del mixer. Antes de modificar CSS se añadió una regresión geométrica. La prueba demostró que los controles pueden desplazarse íntegramente por encima del dock con margen suficiente.

Conclusión correcta: **no había defecto reproducible y no se añadió un parche CSS innecesario**.

Se mantiene permanentemente:

- `mobile-transport-clearance.e2e.ts`;
- screenshot móvil en estado de clearance;
- no-overflow;
- forced-colors;
- focus/keyboard;
- reflow/zoom;
- estados `usual/extended/unplayable`.

### 7.2 Revisión humana pendiente

Una vez M7 produzca URL pública:

1. abrir el MCP en el host objetivo;
2. renderizar una pieza tonal sencilla y una multivoz;
3. verificar play/pause/rewind/loop;
4. cambiar tempo durante playback y escuchar continuidad;
5. cambiar instrumento durante reproducción y confirmar continuidad/sin reinicio;
6. mutear/desmutear voces;
7. seek por nota/compás y observar cursor;
8. probar una nota `extended`: naranja y audible;
9. probar una `unplayable`: roja, silenciosa y con timeline intacto;
10. probar preset `unbounded` cerca/fuera del límite técnico de muestras y confirmar ausencia de error audible/request imposible;
11. abrir/cerrar editor, editar/aplicar/restaurar;
12. revisar móvil y desktop dentro del host;
13. revisar teclado/foco y, si está disponible, lector de pantalla.

### 7.3 Evidencia para cerrar M8

Registrar fecha, host/cliente, SHA/hash y resultado de la checklist. Si aparece un defecto, volver al ciclo:

```text
hallazgo
  → análisis
  → diseño temporal si afecta arquitectura/comportamiento no trivial
  → regresión
  → implementación
  → CI
  → nueva revisión humana
```

Solo entonces eliminar `docs/architecture/work/M8-human-review.md`.

## 8. Cierre final de CAP/FIX

Tras M7/M8:

- cada CAP debe quedar `parity-proven`, `intentionally-changed` o `deferred` con decisión explícita;
- ningún CAP dependiente de audio/host debe pasar a `parity-proven` únicamente por unit tests;
- FIX-01 puede cerrarse tras CORS/Origin real en preview;
- FIX-10 puede cerrarse tras la revisión humana final;
- no debe quedar ningún FIX alto/crítico abierto sin aceptación explícita.

Actualizar `docs/migration/CAPABILITIES.md` en un commit focal.

## 9. Preparación de candidato

Cuando M7/M8 estén cerrados:

1. elegir un SHA exacto de `architecture-v2`;
2. ejecutar CI integral sin cambios posteriores;
3. conservar artifacts de browser y preview validation;
4. registrar artifact hash del widget;
5. etiquetar/documentar el candidato;
6. congelar cambios funcionales hasta completar la sustitución.

No mezclar “último pequeño arreglo” con el mismo commit de promoción. Si hace falta un arreglo, vuelve a ser un candidato nuevo.

## 10. Sustitución de `main`

La migración final debe preservar rollback sencillo.

### 10.1 Antes de sustituir

- `main` legacy debe seguir identificable por SHA/tag;
- candidato v2 debe estar verde y validado públicamente;
- no eliminar inmediatamente rutas/archivos legacy solo para embellecer el árbol;
- documentar cualquier cambio de URL Worker/host.

### 10.2 Estrategia recomendada

```text
architecture-v2 candidate
  → merge/fast-forward controlado a main
  → deploy producción
  → smoke público equivalente a M7
  → smoke humano mínimo equivalente a M8
  → observar
```

La forma Git concreta dependerá del estado de `main` en ese momento. Lo normativo es que el commit candidato siga identificable y no se mezcle con cambios no auditados.

### 10.3 Rollback

Si el deploy de producción presenta un defecto crítico:

1. identificar si es host/deploy o código;
2. si afecta servicio, redeploy inmediato del último artefacto legacy/conocido bueno;
3. revertir/promover Git después, sin dejar al usuario esperando una investigación arquitectónica;
4. conservar la preview v2 defectuosa para reproducir el fallo si no contiene riesgo de seguridad;
5. abrir nuevo corte de corrección con regresión.

Rollback es una capacidad operacional, no un acto de vergüenza. El verdadero fracaso sería no poder hacerlo porque alguien decidió “limpiar” todas las rutas de vuelta cinco minutos antes.

## 11. Evolución futura del codec

Después de candidato se mantiene la misma disciplina:

1. fixture real;
2. parseo/source range;
3. comprobar si el modelo contiene semántica suficiente;
4. enriquecer modelo si no;
5. transformar desde estructura parseada;
6. round-trip/inversa cuando proceda.

Una necesidad creciente de regex sobre `document.source.text` es señal para enriquecer el modelo, no para escribir una regex más heroica.

## 12. Regla de commits y refactors futuros

Cada cambio debe cerrar una idea verificable. Si aparece deuda arquitectónica nueva, se reutiliza el proceso que cerró ARCH-01…07:

1. diferencia actual/deseada;
2. MD temporal detallado;
3. plan + regresiones;
4. implementación;
5. pruebas;
6. auditoría contra el diseño;
7. iteración desde diseño o implementación según origen del fallo;
8. eliminación del MD al cierre.

No crear documentos temporales para cambios triviales. El proceso es proporcional al riesgo, no una religión con formularios.

## 13. Checklist de candidato

### Arquitectura

- [x] dominio independiente de infraestructura;
- [x] imports inter-workspace mediante APIs públicas;
- [x] dependencias/ciclos protegidos por regresión;
- [x] `main.ts` como composition root;
- [x] coordinación transversal con propietario;
- [x] vistas DOM separadas;
- [x] snapshot interno separado de DTO externo;
- [x] composition modularizado;
- [x] codec sin reescaneo global de estructura para tonalidad;
- [x] request observability en borde;
- [x] tesitura musical y capacidad técnica separadas.

### Automatización

- [x] lint/typecheck/unit;
- [x] builds Widget/Worker;
- [x] workerd;
- [x] Playwright desktop/móvil;
- [x] forced colors/no-overflow;
- [x] artifacts visuales;
- [x] synth capability regression;
- [x] script de sonda pública;
- [x] workflow manual de preview.

### Operacional/humano

- [ ] deploy de `abcoda-v2-preview` autenticado;
- [ ] `v2-preview-validation.json` completamente verde;
- [ ] host MCP Apps real;
- [ ] audición humana;
- [ ] accesibilidad manual final;
- [ ] CAP/FIX finalizados;
- [ ] candidato identificado por SHA/hash;
- [ ] rollback documentado y practicable.

## 14. Próximo paso real

No hay otro refactor estructural que hacer por inercia.

El siguiente paso es ejecutar **Deploy v2 preview** con credenciales Cloudflare válidas, descargar/leer `v2-preview-validation.json` y continuar M8 contra esa URL. Cualquier trabajo que no acerque a esa evidencia debe justificar por qué merece entrar antes del candidato.