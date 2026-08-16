# M8 · Revisión humana final de UX, accesibilidad y audio

> Documento temporal. La subfase visual está cerrada. El documento permanece mientras M7 no produzca una preview pública y falten audición + host MCP Apps real.

## 1. Estado

M1–M6 están cerrados. M7 tiene build, sonda pública y workflow manual de deploy, pero sigue abierto hasta disponer de una preview pública autenticada en Cloudflare.

M8 se divide deliberadamente en:

1. revisión visual/geométrica reproducible;
2. revisión humana de audio y ejecución dentro de un host MCP Apps real.

La primera está **cerrada**. La segunda sigue bloqueada por M7.

## 2. Hallazgo inicial: supuesto solapamiento móvil

La primera inspección del artifact visual mostraba el transporte sticky cubriendo parte del mixer en un viewport móvil intermedio. El CSS relevante es:

```css
.transport {
  position: sticky;
  bottom: 0;
}
```

La captura aislada sugería que podía existir un problema de alcanzabilidad de controles.

No se modificó CSS inmediatamente. Se creó primero una regresión geométrica permanente:

`tests/browser/mobile-transport-clearance.e2e.ts`

que:

- usa el proyecto `mobile-chromium`;
- abre `scenario=ranges`;
- despliega el mixer;
- desplaza el último control de la última voz;
- exige que su borde inferior quede al menos 8 px por encima del transporte sticky;
- vuelve a comprobar ausencia de overflow horizontal.

## 3. Resultado de caracterización

La regresión **pasa con el CSS existente**.

Por tanto, el supuesto defecto no era una pérdida real de alcanzabilidad. El dock puede ocluir contenido durante una posición intermedia de scroll, que es comportamiento normal de un elemento sticky, pero el contenido puede desplazarse completamente fuera de esa oclusión.

Conclusión de diseño:

- **no añadir padding ni clearance artificial**;
- no convertir el dock en `static`;
- no introducir cálculo JS de altura;
- conservar el layout actual y la regresión geométrica.

Modificar CSS aquí habría sido un parche a una impresión visual, no a un fallo reproducible.

## 4. Evidencia visual añadida

`tests/browser/visual-review.e2e.ts` genera ahora, además de las capturas existentes, una captura móvil después de desplazar el último control fuera del dock:

```text
ranges-light-clearance-mobile-chromium.png
```

La revisión humana del artifact del run verde `5b8ac8a0` confirma:

- las tres voces `USUAL`, `EXTENDED` y `UNPLAYABLE` están completamente visibles;
- los tres controles de transposición quedan íntegros;
- la jerarquía visual normal / naranja / rojo sigue clara;
- `Edit ABC` queda separado del mixer;
- el transporte permanece sticky y visible sin tapar el último control en ese estado de scroll;
- no aparece overflow horizontal.

## 5. Cobertura visual vigente

La suite mantiene artifacts para:

- ready desktop light/dark;
- ready mobile light/dark;
- mixed desktop/mobile;
- ranges desktop/mobile;
- ranges mobile con estado de clearance explícito.

Los gates browser existentes siguen cubriendo:

- responsive y reflow;
- navegación por teclado y focus visible;
- cursor/seek;
- transposición;
- mezcla pitched + percusión;
- forced-colors;
- zoom/no-overflow;
- severidad de rangos sin depender únicamente del color.

El CI integral del cambio de revisión visual está verde.

## 6. Audio y host real pendientes

No se declararán estas comprobaciones como hechas mediante mocks:

1. audición humana de reproducción;
2. cambio de instrumentos durante reproducción;
3. comprobación perceptiva de notas `extended` audibles y `unplayable` silenciosas;
4. comprobación de presets `unbounded` fuera de capacidad técnica sin errores audibles/404;
5. ejecución dentro del host MCP Apps real contra una preview HTTPS;
6. comprobación de CSP/audio en ese host real.

La lógica subyacente sí está cubierta por pruebas de eventos, mute, tesitura y capacidad técnica del SoundFont, pero M8 exige además percepción humana.

## 7. Dependencia de M7

M7 ya dispone de:

- `npm run deploy:v2-preview`;
- `npm run verify:v2-preview -- <url>`;
- `.github/workflows/deploy-preview.yml` manual;
- comparación `artifactHash` local/remoto;
- verificación real de `/health`, MCP, tools, resource, CORS, CSP y request IDs.

El cierre operacional requiere credenciales Cloudflare válidas y una URL pública de `abcoda-v2-preview`.

Hasta entonces:

- M7 permanece abierto;
- M8 permanece abierto únicamente por host/audio humanos;
- no se elimina este documento.

## 8. Criterio final de cierre

M8 se cerrará cuando, además de la subfase visual ya completada:

- M7 haya producido una preview pública validada;
- la preview se haya abierto en el host MCP Apps real;
- una persona haya escuchado reproducción y cambios de instrumento;
- se hayan probado perceptivamente los límites musical y técnico de audio;
- cualquier defecto encontrado haya vuelto a pasar por diseño → implementación → regresión → revisión;
- después se eliminará este MD temporal.