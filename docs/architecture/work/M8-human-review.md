# M8 · Revisión humana final de UX, accesibilidad y audio

> Documento temporal. La subfase visual está cerrada. M7 también está cerrado; este documento permanece únicamente hasta completar host MCP Apps + audición + accesibilidad manual.

## 1. Estado

M1–M7 están cerrados. La preview que debe usarse para esta revisión es:

```text
URL: https://abcoda-v2-preview.mud-repo-patcher-mcp-probe.workers.dev
SHA validado: 541eedc343df87c1d176b570d681615257ee4374
Worker Version ID: d67a4b98-a105-4496-bf62-7747347891ec
appVersion: 0.13.0-alpha.1
schemaVersion: 2
rulesVersion: 4
artifactHash: 9e6785eb96dd7da4350526b310c466b09cecbacea049a700cb2a8351d5d1320d
```

La sonda pública M7 ya confirmó `/health`, headers, CORS/Origin, MCP initialize, tools, `validate_score`, `render_score`, recurso widget, CSP y coincidencia exacta del artifact hash.

M8 se divide deliberadamente en:

1. revisión visual/geométrica reproducible, **cerrada**;
2. revisión humana de audio, accesibilidad e integración dentro del host MCP Apps real, **pendiente**.

## 2. Revisión visual ya cerrada

La primera inspección del artifact visual mostraba el transporte sticky cubriendo parte del mixer en una posición intermedia de scroll móvil. Antes de tocar CSS se creó la regresión:

`tests/browser/mobile-transport-clearance.e2e.ts`

La prueba demuestra que el último control puede desplazarse al menos 8 px por encima del transporte sticky y que no aparece overflow horizontal.

Conclusión:

- no había pérdida de alcanzabilidad;
- no se añadió padding artificial;
- no se convirtió el dock en `static`;
- no se introdujo cálculo JS de altura.

`tests/browser/visual-review.e2e.ts` conserva además `ranges-light-clearance-mobile-chromium.png` para inspección humana explícita.

La cobertura visual vigente incluye desktop/móvil, light/dark, mixed, ranges, forced-colors, focus, responsive/reflow y no-overflow.

## 3. Objetivo de la revisión humana

No demostrar de nuevo lo que Playwright ya sabe, sino comprobar lo que necesita un host real y oídos humanos:

- que el MCP se integra correctamente en ChatGPT/MCP Apps;
- que el widget se comporta correctamente dentro de ese host;
- que audio, cursor y controles permanecen sincronizados perceptivamente;
- que la semántica de rangos se corresponde con lo que se oye;
- que la interacción móvil real sigue siendo cómoda;
- que la accesibilidad manual no descubre un defecto que los gates automáticos no expresan.

## 4. Checklist host MCP Apps

1. conectar el endpoint MCP de la preview;
2. comprobar que aparecen `prepare_composition`, `validate_score` y `render_score`;
3. renderizar una pieza tonal sencilla;
4. renderizar una pieza multivoz;
5. comprobar que el widget aparece dentro del host;
6. abrir/cerrar mixer y editor;
7. confirmar que no aparece overflow o corte grave en el viewport del host.

## 5. Checklist de audio

### Transporte

- Play inicia desde la posición esperada.
- Pause conserva posición.
- Reanudar no reinicia la pieza.
- Rewind vuelve al comienzo.
- Loop repite sin perder sincronía visual.

### Tempo

- cambiar tempo durante reproducción no reinicia el audio;
- cursor y audio siguen coordinados;
- el valor mostrado coincide con la percepción de cambio.

### Instrumentos y mezcla

- cambiar instrumento durante reproducción conserva la posición;
- mute/unmute no reinicia la pieza;
- voces independientes siguen correctamente asignadas;
- percusión no recibe transposición tonal accidental.

### Rangos

Probar explícitamente:

1. una nota `usual`: aspecto normal y audible;
2. una nota `extended`: naranja y audible;
3. una nota `unplayable`: roja y silenciosa, sin romper duración/cursor;
4. un preset `unbounded` cerca del límite técnico del SoundFont: no debe aparecer una falsa advertencia organológica;
5. un pitch técnicamente no disponible para el backend: no debe provocar error de muestra ni romper playback.

No hace falta evaluar virtuosismo instrumental aquí. Eso ya pertenece a la política musicológica revisada y sus regresiones.

## 6. Edición e interacción

Comprobar en host real:

- editar ABC;
- aplicar;
- restaurar;
- historial local;
- copiar si el host permite clipboard;
- transposición global;
- transposición por voz;
- instrumento/mute persistentes entre revisiones locales;
- seek sobre la partitura;
- cursor correcto tras seek/reflow.

## 7. Accesibilidad manual

Cuando el dispositivo/host lo permita:

- foco visible y orden lógico de controles;
- nombres accesibles de Play/Pause, Loop, mute e instrumentos;
- controles táctiles cómodos en móvil;
- VoiceOver/lector de pantalla para al menos transporte y mixer;
- estados naranja/rojo comprensibles sin depender exclusivamente del color.

Forced-colors y ARIA ya tienen regresiones automáticas; esta revisión busca problemas de experiencia real, no duplicar aserciones.

## 8. Si aparece un defecto

Aplicar el mismo ciclo de trabajo:

```text
hallazgo
  → localizar capa responsable
  → análisis de diferencia con arquitectura/comportamiento deseado
  → MD temporal si el cambio es no trivial
  → regresión
  → implementación
  → CI integral
  → redeploy preview si cambia código desplegado
  → repetir la comprobación humana afectada
```

No se alteran límites musicológicos para esconder limitaciones de muestras y no se mueve lógica de host al dominio.

## 9. Criterio final de cierre

M8 se cierra cuando:

- la preview validada se ha abierto dentro del host MCP Apps real;
- una persona ha escuchado reproducción, tempo, seek, mute y cambio de instrumento;
- se han comprobado perceptivamente `usual`, `extended`, `unplayable` y el límite técnico del backend;
- se ha realizado una pasada manual razonable de accesibilidad/interacción;
- cualquier defecto encontrado ha completado el ciclo de regresión y nueva revisión;
- se actualizan CAP/FIX;
- después se elimina este MD temporal.
