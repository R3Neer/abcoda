# Matriz viva de capacidades y defectos

> Baseline: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Estados: `uncharacterized`, `partial`, `characterized`, `implemented`, `parity-proven`, `intentionally-changed`, `deferred`

## Capacidades

| ID | Capacidad | Estado inicial | Evidencia actual | Próxima evidencia requerida |
|---|---|---|---|---|
| CAP-01 | Brief tipado de composición | characterized | `tests/composition-plan.test.ts`, `tests/mcp.test.ts` | Golden contract v2. |
| CAP-02 | Guía por estilo, forma, dificultad e instrumentos | characterized | 34 pruebas de composition plan y golden prompts | Comparador de reglas y `rulesVersion`. |
| CAP-03 | ABC suministrado directamente | characterized | `tests/mcp.test.ts`, corpus de caracterización | Contrato `EvaluateScore`. |
| CAP-04 | Normalización y diagnósticos mecánicos | characterized | `tests/abc-lint.test.ts`, fixtures ABC | Diagnósticos tipados y source ranges v2. |
| CAP-05 | Grabado multivoz | partial | abcjs en tests Node y widget construido | Prueba en navegador y screenshots. |
| CAP-06 | Play, pause, rewind y loop | partial | `tests/transport.test.ts`, `tests/deferred-audio.test.ts` | Navegador con gesto humano y reloj falso. |
| CAP-07 | Tempo en vivo | partial | tests de transport y continuidad | Carrera tempo/rebuild en navegador. |
| CAP-08 | Instrumento y mute por voz | partial | `tests/score.test.ts`, markup | Interacción completa en navegador. |
| CAP-09 | Compatibilidad y rango instrumental | characterized | `tests/score.test.ts` | Política de dominio independiente de abcjs. |
| CAP-10 | Transposición de ABC, tonalidad y acordes | characterized | `tests/abc-edit.test.ts` | Operación canónica e inversa. |
| CAP-11 | Percusión inmune a transposición tonal | characterized | lint, edit y score tests | Invariante de dominio v2. |
| CAP-12 | Editar, copiar, aplicar y restaurar | partial | tests de markup y funciones | E2E de revisiones y diagnóstico. |
| CAP-13 | Cursor y seek por compás | partial | `tests/cursor.test.ts` y transport | Reloj, reflow y click/touch en navegador. |
| CAP-14 | Tema del host y layout móvil | partial | código y build del widget | Matriz visual y capacidades de host. |
| CAP-15 | Transporte siempre accesible | partial | markup y CSS | Screenshots y teclado en viewports límite. |
| CAP-16 | Demo independiente | partial | `tests/standalone.test.ts`, build | Host simulado oficial v2. |
| CAP-17 | Operación stateless | characterized | inspección de Worker/servidor | Pruebas de aislamiento en runtime. |
| CAP-18 | Claves, transposición sonora y claves de octava | characterized | tests añadidos en `ae36154` | Modelo canónico y pruebas browser/audio. |

## Defectos

| ID | Defecto | Estado | Evidencia de cierre requerida |
|---|---|---|---|
| FIX-01 | CORS permisivo y sin validación Origin/Host | open | Worker runtime rechaza origen/host no autorizado. |
| FIX-02 | Tunebooks múltiples mezclan voces y render | characterized | v2 devuelve diagnóstico específico y no crea snapshot. |
| FIX-03 | Resultados asíncronos obsoletos | open | Matriz de carreras por revisión y `AbortSignal`. |
| FIX-04 | `main.ts` concentra responsabilidades | open | Límites de imports y store/effects separados. |
| FIX-05 | Sin pruebas reales Worker/browser | open | Suites Worker y Playwright obligatorias en CI. |
| FIX-06 | Dominio, URI y versiones manuales | characterized | Manifiesto único probado en health, MCP y widget. |
| FIX-07 | abcjs completo importado en servidor | characterized | Bundle Worker sin módulos de synth/engraving. |
| FIX-08 | Sin lint/no-floating-promises | open | ESLint obligatorio y CI. |
| FIX-09 | Errores UI dispersos | open | Estados de error y recuperación probados. |
| FIX-10 | UX evaluada tarde | open | Laboratorio, escenarios y gates visuales por corte. |

## Regla de mantenimiento

Cada commit que implemente, difiera o difiera deliberadamente una capacidad debe actualizar esta matriz. Los estados `parity-proven` e `intentionally-changed` requieren enlazar una prueba o evidencia concreta; no se asignan por inspección informal.

