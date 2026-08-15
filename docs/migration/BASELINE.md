# Baseline de la migración architecture-v2

> Estado: baseline inicial reproducido  
> Fecha: 2026-08-15  
> Rama de trabajo: `architecture-v2`  
> `BASELINE_SHA`: `ae361541f05fd52abbd0fe1dc0f1240e3d627320`  
> Rama remota de origen: `origin/main`

## Propósito

Este documento fija la implementación heredada que actúa como oráculo temporal durante la reconstrucción de ABCoda. No convierte todos sus comportamientos en requisitos: los defectos conocidos se caracterizan para poder demostrar su corrección.

## Entorno reproducido

| Elemento | Valor observado |
|---|---|
| Sistema | Windows |
| Node.js | `v24.16.0` |
| npm | `11.13.0` |
| Instalación | `npm ci` desde `package-lock.json` |
| Paquetes instalados | 188 |
| Vulnerabilidades npm | 0 |
| Vitest resuelto por lockfile | `3.2.7` |
| Vite resuelto por lockfile | `7.3.6` |
| Wrangler resuelto por lockfile | `4.123.0` |

El proyecto declara Node.js `>=20` y CI usa Node.js 22. La caracterización deberá ejecutarse también en Node.js 22 dentro de CI; el resultado local con Node.js 24 no sustituye esa evidencia.

## Validación limpia

Comando:

```text
npm ci
npm run check
```

Resultado de `npm run check`:

- typecheck: correcto;
- 11 archivos de prueba correctos;
- 114 pruebas correctas;
- build del widget: correcto;
- build TypeScript del servidor: correcto;
- dry-run del Worker: correcto.

## Artefactos observados

| Artefacto | Tamaño sin comprimir | Tamaño gzip informado |
|---|---:|---:|
| Widget single-file `dist/widget/index.html` | 917.547 bytes | 253,90 kB |
| Worker dry-run `dist/worker/index.js` | 2.479.805 bytes | no aplicable al archivo local |
| Upload Worker informado por Wrangler | 3.317,73 KiB | 687,50 KiB |

Estos valores son métricas del baseline, no presupuestos definitivos. La arquitectura v2 deberá separar el código de grabado y síntesis del bundle servidor y registrar sus propios presupuestos.

## Contrato externo observado

### Herramientas

- `prepare_composition`;
- `render_score`.

Ambas se anuncian como read-only, no destructivas, idempotentes y closed-world. `render_score` enlaza el recurso UI mediante `ui.resourceUri` y el metadato heredado de OpenAI.

### Versiones dispersas

| Superficie | Valor |
|---|---|
| `package.json` | `0.1.0` |
| servidor MCP | `0.12.0` |
| health del Worker | `0.12.0` |
| aplicación del widget | `0.9.0` |
| URI del widget | `ui://abcoda/score-v18.html` |

La divergencia queda registrada como defecto de arquitectura. No se debe reproducir en v2.

### Dominio y CORS heredados

- Dominio UI hard-coded: `https://abcoda.mud-repo-patcher-mcp-probe.workers.dev`.
- Worker y servidor Node devuelven `Access-Control-Allow-Origin: *`.
- No existe validación explícita de `Origin` o `Host` antes del transporte MCP.

Estos valores sirven para reproducir el baseline, no para definir la política segura de v2.

## Defecto tunebook reproducido

Entrada con dos melodías:

```abc
X:1
T:One
V:A
K:C
[V:A] C4|]

X:2
T:Two
V:B
K:C
[V:B] D4|]
```

La normalización heredada:

1. acepta ambas melodías;
2. agrega las voces `A` y `B` como si pertenecieran al mismo score;
3. inserta `%%score { A B }` dentro de la primera melodía;
4. no emite un diagnóstico específico sobre tunebooks múltiples.

La conducta se conserva en una prueba de caracterización legacy para demostrar posteriormente que v2 la reemplaza por un error explícito de “una melodía por snapshot”.

## Fuentes de evidencia

- `tests/`: caracterización unitaria existente;
- `tests/characterization/`: fixtures y expectativas heredadas añadidas por la migración;
- `docs/migration/CAPABILITIES.md`: estado vivo de paridad;
- salida local de `npm run check` sobre `BASELINE_SHA`;
- artefactos de `dist/`, que permanecen ignorados por Git.

## Regla de actualización

Si antes del primer commit estructural se decide cambiar el baseline, este documento, los fixtures y la matriz de capacidades deben actualizarse juntos. Después del primer commit estructural, los cambios de `main` se portarán por intención y con una prueba que represente el comportamiento deseado.

