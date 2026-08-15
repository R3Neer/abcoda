# ARCH-07 · Correlación de petición y observabilidad mínima

> Documento temporal. Se elimina solo tras implementación, regresión y auditoría final.

## 1. Diferencia entre arquitectura deseada y actual

### Promesa original

La arquitectura original exigía:

- `requestId` por petición y trazabilidad correlacionable;
- eventos estructurados;
- diagnóstico operativo sin registrar ABC, prompts o estado privado;
- un envelope de herramienta con `requestId`, versiones, diagnósticos y error normalizado.

El diseño vigente rebajó deliberadamente esta deuda a baja-media: completar solo lo necesario para preview/candidato y no construir telemetría antes de que exista una necesidad operativa real.

### Estado actual

El Worker ya dispone de una base correcta:

- crea un UUID por petición;
- devuelve `X-Request-Id`;
- registra `request.completed` y `request.failed` con método, ruta, estado y duración;
- no registra el body;
- el servidor MCP se crea por petición;
- `/health` expone las versiones y el hash del artefacto desde la fuente compartida.

La carencia real es que la correlación se detiene en la frontera HTTP. Los callbacks MCP no reciben el `requestId`, sus resultados no lo exponen como metadato y no existen eventos por herramienta. Reintroducir literalmente el antiguo `ToolSuccess<T>`/`ToolFailure` dentro de `structuredContent` rompería contratos públicos ya estabilizados y no es necesario para el candidato.

## 2. Decisiones

### D1. No cambiar `structuredContent`

`prepare_composition`, `validate_score` y `render_score` conservan exactamente sus schemas públicos actuales.

El `requestId` es metadato de operación, no parte del resultado musical. Se expone mediante `_meta` del resultado MCP:

```ts
_meta: {
  "abcoda/requestId": requestId,
}
```

Esto permite al host/operador correlacionar una llamada con `X-Request-Id` sin contaminar el contexto del modelo ni versionar de nuevo los DTO musicales.

### D2. Observabilidad pertenece al adaptador Worker/MCP

No se añade un paquete de telemetría ni una dependencia a `domain`/`application`.

`createV2McpServer` recibe un contexto opcional de observabilidad por petición. Ese contexto puede:

- aportar `requestId`;
- emitir eventos de herramienta allowlisted.

Los casos de uso siguen sin conocer logs, Cloudflare ni request IDs.

### D3. Eventos mínimos

Para candidato solo se añaden:

- `mcp.tool.completed`;
- `mcp.tool.failed`.

Campos permitidos:

```text
event, timestamp, requestId, toolName, outcome, durationMs,
appVersion, schemaVersion, rulesVersion
```

No se registran:

- ABC;
- prompts;
- títulos;
- argumentos MCP;
- texto de diagnósticos;
- contenido de errores procedente de la entrada.

`outcome` es una categoría cerrada (`success`, `invalid`, `unsupported`, `failure`) o `failure` para excepciones de input/adapter.

### D4. El log HTTP existente se conserva

`request.completed` y `request.failed` continúan siendo el evento de transporte. Se les pueden añadir `timestamp` y versiones compartidas, pero no se duplica el contenido del request ni se intenta reconstruir `toolName` parseando el body en `index.ts`.

### D5. Errores HTTP

`X-Request-Id` sigue siendo la fuente de correlación para errores de frontera HTTP. No se reescriben todos los JSON de seguridad para meter el ID dentro del body: el header ya está presente incluso en rechazos mediante `finalizeResponse` y está expuesto por CORS.

El body conserva sus códigos actuales (`HOST_MISMATCH`, `ORIGIN_*`, `REQUEST_TOO_LARGE`, etc.). Cambiar esa forma no aporta capacidad operativa proporcional al riesgo.

## 3. Forma propuesta

```ts
export type McpToolName =
  | "prepare_composition"
  | "validate_score"
  | "render_score";

export interface McpToolObservation {
  readonly event: "mcp.tool.completed" | "mcp.tool.failed";
  readonly requestId: string;
  readonly toolName: McpToolName;
  readonly outcome: "success" | "invalid" | "unsupported" | "failure";
  readonly durationMs: number;
}

export interface McpRequestObservability {
  readonly requestId: string;
  readonly emit: (observation: McpToolObservation) => void;
}
```

La forma exacta puede variar durante implementación si el SDK exige una adaptación, pero deben mantenerse estos límites: contexto por petición, evento tipado y sin payload musical.

## 4. Implementación

1. Añadir un módulo pequeño de observabilidad en `apps/worker/src` o `apps/worker/src/mcp`.
2. Hacer que `createV2McpServer` acepte observabilidad opcional sin romper los call sites de tests/adaptadores que no la necesiten.
3. Añadir helper para adjuntar `abcoda/requestId` a `_meta` de todos los resultados de las tres herramientas, incluidos `isError`.
4. Medir cada callback con un reloj local y emitir exactamente un evento terminal por llamada.
5. Para `validate_score`/`render_score`, derivar `outcome` del resultado tipado; para `prepare_composition`, `success` o `failure`.
6. En `apps/worker/src/index.ts`, crear el sink que serializa los eventos con timestamp y versiones compartidas mediante `console.log`/`console.error`.
7. Mantener los logs HTTP existentes y enriquecerlos solo con campos no sensibles si resulta útil.
8. No añadir almacenamiento, sampling propio, OpenTelemetry, métricas agregadas ni servicios nuevos.

## 5. Regresiones obligatorias

### Correlación

- cada respuesta HTTP conserva `X-Request-Id` único;
- un `tools/call` de `prepare_composition`, `validate_score` y `render_score` devuelve `_meta["abcoda/requestId"]` igual al header `X-Request-Id` de esa misma respuesta;
- un resultado `isError` conserva el mismo metadato de correlación.

### Eventos

Pruebas unitarias del wrapper/sink demuestran:

- exactamente un evento terminal por llamada;
- `toolName`, `requestId`, `outcome` y duración correctos;
- las versiones proceden de `@abcoda/contracts`;
- la forma del evento no acepta campos arbitrarios con contenido sensible.

### Privacidad

Una regresión usa un ABC y/o texto marcador deliberadamente reconocible y comprueba que el objeto de observación emitido no lo contiene serializado.

No se intenta inspeccionar los logs internos del SDK MCP, solo los eventos propios de ABCoda.

### Contrato

- `structuredContent` de las tres herramientas permanece profundamente compatible con las pruebas actuales;
- sus `outputSchema` no cambia;
- el widget no necesita conocer `requestId` para funcionar.

## 6. Auditoría final

ARCH-07 se cierra si:

- una petición puede correlacionarse desde el header HTTP hasta el resultado MCP y el evento de herramienta;
- no existe estado de observabilidad global mutable;
- dominio y aplicación siguen sin conocer request IDs o logging;
- los logs propios no contienen ABC, prompt ni argumentos;
- no se ha alterado el contrato musical de `structuredContent`;
- no se ha añadido infraestructura operativa prematura;
- Worker real/workerd, tests de contratos y Playwright quedan verdes.

El envelope antiguo se considera una inspiración histórica, no una obligación literal. La capacidad exigida para candidato es correlación segura y comprobable, no envolver datos ya versionados una segunda vez.