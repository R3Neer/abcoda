# Matriz viva de capacidades y defectos

> Baseline: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Estados: `uncharacterized`, `partial`, `characterized`, `implemented`, `parity-proven`, `intentionally-changed`, `deferred`

## Capacidades

| ID | Capacidad | Estado inicial | Evidencia actual | Próxima evidencia requerida |
|---|---|---|---|---|
| CAP-01 | Brief tipado de composición | characterized | `tests/composition-plan.test.ts`, `tests/mcp.test.ts` | Golden contract v2. |
| CAP-02 | Guía por estilo, forma, dificultad e instrumentos | characterized | 34 pruebas de composition plan y golden prompts | Comparador de reglas y `rulesVersion`. |
| CAP-03 | ABC suministrado directamente | characterized | `tests/mcp.test.ts`, corpus de caracterización | Contrato `EvaluateScore`. |
| CAP-04 | Normalización y diagnósticos mecánicos | partial | Diagnósticos v2 tipados con rangos; codec extrae voces, percusión, metro, tonalidad y tempo básico | Eventos/compases, variantes ABC y comparador contra corpus. |
| CAP-05 | Grabado multivoz | partial | abcjs en tests Node y widget construido | Prueba en navegador y screenshots. |
| CAP-06 | Play, pause, rewind y loop | partial | Engine diferido conectado y controles sticky; estados/race probados y controles E2E móvil/escritorio | Audición humana, finalización natural y continuidad real. |
| CAP-07 | Tempo en vivo | partial | Tempo canónico inicial, ratio, carrera y control E2E sin audio | Rebuild abcjs audible y continuidad en navegador. |
| CAP-08 | Instrumento y mute por voz | implemented-v2 | Estado tipado, carreras unitarias y Playwright móvil/escritorio | Falta audición humana de cambios en reproducción real. |
| CAP-09 | Compatibilidad y rango instrumental | implemented-v2 | Catálogo puro, alturas adaptadas desde abcjs, avisos por voz y Playwright | Validar criterios de tesitura musical frente a corpus real. |
| CAP-10 | Transposición de ABC, tonalidad y acordes | implemented-v2 | Operación de borrador revisable, adaptador abcjs y Playwright móvil/escritorio | Sustituir adaptador por operación canónica al ampliar el codec. |
| CAP-11 | Percusión inmune a transposición tonal | implemented-v2 | Fixture y escenario Playwright mixto conservan voz `K:none clef=perc`, notas y kit único | Audición humana del mapa GM. |
| CAP-12 | Editar, copiar, aplicar y restaurar | implemented-v2 | Borrador/último válido/original separados; carreras unitarias y E2E de diagnóstico/revisiones/restauración | Verificar portapapeles dentro del host MCP real. |
| CAP-13 | Cursor y seek por compás | partial | Timeline neutral, matching por fuente/tiempo, cursor DOM y click-to-seek E2E móvil/escritorio | Movimiento durante audio real, reflow y touch explícito. |
| CAP-14 | Tema del host y layout móvil | partial | Contexto neutral, temas/safe areas explícitos, sin mínimo rígido y E2E móvil/escritorio | Dimensiones declaradas del contenedor y matriz de hosts reales. |
| CAP-15 | Transporte siempre accesible | implemented-v2 | Sticky salvo edición móvil; foco visible, recorrido teclado y reduced motion en Playwright | Auditar lector de pantalla dentro del host real. |
| CAP-16 | Demo independiente | implemented | Host simulado v2 y ocho recorridos Playwright móvil/escritorio | Paridad funcional al completar controles interactivos. |
| CAP-17 | Operación stateless | implemented-v2 | Doce evaluaciones MCP y lecturas de health concurrentes verifican revisiones, títulos e identidad de artefacto sin contaminación cruzada en workerd | Ampliar con carga sostenida en preview real. |
| CAP-18 | Claves, transposición sonora y claves de octava | characterized | tests añadidos en `ae36154` | Modelo canónico y pruebas browser/audio. |

## Defectos

| ID | Defecto | Estado | Evidencia de cierre requerida |
|---|---|---|---|
| FIX-01 | CORS permisivo y sin validación Origin/Host | implemented | Worker runtime rechaza origen/host no autorizado; falta preview real. |
| FIX-02 | Tunebooks múltiples mezclan voces y render | implemented | v2 devuelve diagnóstico específico y no crea snapshot. |
| FIX-03 | Resultados asíncronos obsoletos | implemented | Unit tests de revisión/cancelación y escenario browser `race` termina en la revisión más nueva. |
| FIX-04 | `main.ts` concentra responsabilidades | implemented | Composition root pequeño; DOM, host, grabado, reproducción y estados viven en adaptadores/controladores separados con límites de imports. |
| FIX-05 | Sin pruebas reales Worker/browser | implemented | Suites workerd y Playwright móvil/escritorio forman parte de `check:browser` en CI. |
| FIX-06 | Dominio, URI y versiones manuales | implemented | URI/versiones centralizadas; health y recurso MCP exponen SHA-256 del HTML exacto servido. |
| FIX-07 | abcjs completo importado en servidor | implemented | `verify:v2-artifacts` falla si el bundle Worker contiene `abcjs`, `SynthController` o `renderAbc`. |
| FIX-08 | Sin lint/no-floating-promises | implemented | ESLint tipado forma parte de `npm run check`. |
| FIX-09 | Errores UI dispersos | implemented | Estados centralizados; invalidación desmonta efectos y el editor conserva último válido, diagnostica y recupera. |
| FIX-10 | UX evaluada tarde | partial | Laboratorio y escenarios E2E por corte; faltan snapshots y pruebas de interacción/audio. |

## Regla de mantenimiento

Cada commit que implemente, difiera o difiera deliberadamente una capacidad debe actualizar esta matriz. Los estados `parity-proven` e `intentionally-changed` requieren enlazar una prueba o evidencia concreta; no se asignan por inspección informal.
