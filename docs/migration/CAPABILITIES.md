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
| CAP-08 | Instrumento y mute por voz | partial | `tests/score.test.ts`, markup | Interacción completa en navegador. |
| CAP-09 | Compatibilidad y rango instrumental | characterized | `tests/score.test.ts` | Política de dominio independiente de abcjs. |
| CAP-10 | Transposición de ABC, tonalidad y acordes | characterized | `tests/abc-edit.test.ts` | Operación canónica e inversa. |
| CAP-11 | Percusión inmune a transposición tonal | characterized | lint, edit y score tests | Invariante de dominio v2. |
| CAP-12 | Editar, copiar, aplicar y restaurar | partial | tests de markup y funciones | E2E de revisiones y diagnóstico. |
| CAP-13 | Cursor y seek por compás | partial | `tests/cursor.test.ts` y transport | Reloj, reflow y click/touch en navegador. |
| CAP-14 | Tema del host y layout móvil | partial | Contexto neutral `HostPresentationContext`, temas explícitos y E2E móvil/escritorio | Safe areas, dimensiones del contenedor y matriz de hosts reales. |
| CAP-15 | Transporte siempre accesible | partial | markup y CSS | Screenshots y teclado en viewports límite. |
| CAP-16 | Demo independiente | implemented | Host simulado v2 y ocho recorridos Playwright móvil/escritorio | Paridad funcional al completar controles interactivos. |
| CAP-17 | Operación stateless | characterized | inspección de Worker/servidor | Pruebas de aislamiento en runtime. |
| CAP-18 | Claves, transposición sonora y claves de octava | characterized | tests añadidos en `ae36154` | Modelo canónico y pruebas browser/audio. |

## Defectos

| ID | Defecto | Estado | Evidencia de cierre requerida |
|---|---|---|---|
| FIX-01 | CORS permisivo y sin validación Origin/Host | implemented | Worker runtime rechaza origen/host no autorizado; falta preview real. |
| FIX-02 | Tunebooks múltiples mezclan voces y render | implemented | v2 devuelve diagnóstico específico y no crea snapshot. |
| FIX-03 | Resultados asíncronos obsoletos | implemented | Unit tests de revisión/cancelación y escenario browser `race` termina en la revisión más nueva. |
| FIX-04 | `main.ts` concentra responsabilidades | open | Límites de imports y store/effects separados. |
| FIX-05 | Sin pruebas reales Worker/browser | implemented | Suites workerd y Playwright móvil/escritorio forman parte de `check:browser` en CI. |
| FIX-06 | Dominio, URI y versiones manuales | partial | Manifiesto v2 compartido por health y MCP; falta artifact hash del recurso UI. |
| FIX-07 | abcjs completo importado en servidor | implemented | Bundle Worker v2 comprobado sin `abcjs`, `SynthController` ni `renderAbc`. |
| FIX-08 | Sin lint/no-floating-promises | implemented | ESLint tipado forma parte de `npm run check`. |
| FIX-09 | Errores UI dispersos | partial | Estados inválido, malformed y fallo de grabado centralizados; falta recuperación interactiva. |
| FIX-10 | UX evaluada tarde | partial | Laboratorio y escenarios E2E por corte; faltan snapshots y pruebas de interacción/audio. |

## Regla de mantenimiento

Cada commit que implemente, difiera o difiera deliberadamente una capacidad debe actualizar esta matriz. Los estados `parity-proven` e `intentionally-changed` requieren enlazar una prueba o evidencia concreta; no se asignan por inspección informal.
