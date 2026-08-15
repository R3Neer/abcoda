# Matriz viva de capacidades y defectos

> Baseline: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Estados: `uncharacterized`, `partial`, `characterized`, `implemented`, `parity-proven`, `intentionally-changed`, `deferred`

## Capacidades

| ID | Capacidad | Estado inicial | Evidencia actual | Próxima evidencia requerida |
|---|---|---|---|---|
| CAP-01 | Brief tipado de composición | parity-proven | Política única en `@abcoda/composition`; schema 4 y `prepare_composition` pasan unitarias, cobertura combinatoria y contrato workerd v2 | Revalidar únicamente si cambia `rulesVersion`. |
| CAP-02 | Guía por estilo, forma, dificultad e instrumentos | parity-proven | Legacy y v2 invocan el mismo ensamblador puro; la suite cubre perfiles golden y 576 combinaciones tipadas | Revisión musical humana queda como calidad continua, no como bloqueo de migración. |
| CAP-03 | ABC suministrado directamente | implemented-v2 | `CanonicalAbcCodec`, `EvaluateScore`, adaptador schema 1, contrato workerd y corpus preservan fuente, voces, compases, eventos y presentación con source maps y round-trip | Alcanzar paridad mecánica al completar validadores y operaciones. |
| CAP-04 | Normalización y diagnósticos mecánicos | partial | Diagnósticos v2 tipados con rangos y corrección; codec modela headers, voces, percusión, compases, notas, silencios, acordes, tupletas, decorations, cambios inline y opacos seguros | Implementar validación métrica/referencial y normalización canónica idempotente. |
| CAP-05 | Grabado multivoz | implemented-v2 | Playwright móvil/escritorio verifica grabado, dos pentagramas de piano con llave completa y voces independientes sin agrupación falsa | Añadir corpus visual focalizado para `parity-proven`. |
| CAP-06 | Play, pause, rewind y loop | implemented-v2 | Engine diferido, estados/race y 64 recorridos Playwright cubren inicio, pausa, seek, final natural, loop y retorno | Audición humana y continuidad real para `parity-proven`. |
| CAP-07 | Tempo en vivo | implemented-v2 | Ratio, carreras, slider y campo BPM sincronizado pasan unitarias y Playwright móvil/escritorio | Validar continuidad audible durante reproducción. |
| CAP-08 | Instrumento y mute por voz | implemented-v2 | Estado tipado, carreras unitarias y Playwright móvil/escritorio | Falta audición humana de cambios en reproducción real. |
| CAP-09 | Compatibilidad y rango instrumental | implemented-v2 | Catálogo puro, alturas adaptadas desde abcjs, avisos por voz y Playwright | Validar criterios de tesitura musical frente a corpus real. |
| CAP-10 | Transposición de ABC, tonalidad y acordes | implemented-v2 | Operación de borrador revisable, adaptador abcjs y Playwright móvil/escritorio | Sustituir adaptador por operación canónica al ampliar el codec. |
| CAP-11 | Percusión inmune a transposición tonal | implemented-v2 | Fixture y escenario Playwright mixto conservan voz `K:none clef=perc`, notas y kit único | Audición humana del mapa GM. |
| CAP-12 | Editar, copiar, aplicar y restaurar | implemented-v2 | Borrador/último válido/original separados; carreras unitarias y E2E de diagnóstico/revisiones/restauración | Verificar portapapeles dentro del host MCP real. |
| CAP-13 | Cursor y seek por evento musical | implemented-v2 | Selección por coordenadas escoge la nota más cercana, coloca el cursor inmediatamente antes y reproduce desde su tiempo; unitarias, Playwright móvil/escritorio y prueba interactiva desde nota intermedia | Añadir regresión específica de reflow durante reproducción larga. |
| CAP-14 | Tema del host y layout móvil | implemented-v2 | Contexto neutral, temas/safe areas explícitos, sin mínimo rígido, control de overflow y E2E móvil/escritorio | Dimensiones declaradas y host MCP real para `parity-proven`. |
| CAP-15 | Transporte siempre accesible | implemented-v2 | Sticky salvo edición móvil; iconos con nombre accesible, mixer colapsable operable por teclado, mute como botón con estado, foco visible y reduced motion en Playwright | Auditar lector de pantalla dentro del host real. |
| CAP-16 | Demo independiente | parity-proven | Host simulado v2 y 64 recorridos Playwright móvil/escritorio cubren estados e interacciones productivas | Mantenerla como laboratorio obligatorio en cada corte UI. |
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
| FIX-07 | abcjs completo importado en servidor | implemented | `verify:v2-artifacts` rechaza imports de `abcjs` en el grafo fuente servidor y APIs browser (`SynthController`/`renderAbc`) en el bundle, sin confundir documentación musical con código. |
| FIX-08 | Sin lint/no-floating-promises | implemented | ESLint tipado forma parte de `npm run check`. |
| FIX-09 | Errores UI dispersos | implemented | Estados centralizados; invalidación desmonta efectos y el editor conserva último válido, diagnostica y recupera. |
| FIX-10 | UX evaluada tarde | partial | Laboratorio y escenarios E2E por corte; faltan snapshots y pruebas de interacción/audio. |

## Regla de mantenimiento

Cada commit que implemente, difiera o difiera deliberadamente una capacidad debe actualizar esta matriz. Los estados `parity-proven` e `intentionally-changed` requieren enlazar una prueba o evidencia concreta; no se asignan por inspección informal.
