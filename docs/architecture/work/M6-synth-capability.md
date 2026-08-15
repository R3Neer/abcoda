# M6 · Capacidad técnica del sintetizador separada de tesitura musical

> Documento temporal. Se elimina solo tras implementación, regresión y auditoría final.

## 1. Problema

ABCoda ya separa correctamente la política musical de tesitura de la reproducción:

- instrumentos `bounded`: `usualRange` + `playableRange` en dominio;
- presets `unbounded`: ABCoda no inventa una frontera organológica;
- percusión: política propia de notas GM;
- notas musicalmente `unplayable`: permanecen en notación/timeline y se silencian antes de que abcjs resuelva muestras.

Queda una segunda frontera distinta: la capacidad técnica concreta de abcjs + FluidR3_GM.

Hoy un preset `unbounded`, por ejemplo `choir_aahs`, puede dejar pasar MIDI 109 porque no existe un límite musical. abcjs 6.7.0 sabe convertir 109 a `Db8`, pero FluidR3_GM no tiene `Db8.mp3` para los instrumentos melódicos. El resultado es una petición de muestra imposible durante `CreateSynth.init`.

No se debe solucionar convirtiendo 108 en `playableRange`: eso mezclaría backend técnico y musicología.

## 2. Evidencia caracterizada

### abcjs

La versión bloqueada actualmente es abcjs 6.7.0.

`CreateSynth` obtiene primero las pistas de `setUpAudio`, recopila los pitches y carga las muestras antes de la reproducción. El cargador construye URLs con la forma:

```text
<soundfontUrl>/<instrument>-mp3/<note>.mp3
```

La tabla `pitch-to-note-name` de abcjs cubre MIDI 21–121. Por tanto, 109–121 generan nombres válidos para abcjs y pueden provocar una petición HTTP aunque el SoundFont no contenga esos archivos.

### FluidR3_GM melódico

El generador original de MIDI.js genera cada programa melódico en un bucle explícito:

```text
A0 ... C8
```

Eso corresponde a MIDI 21–108, inclusivos.

Se ha contrastado además con carpetas reales de FluidR3_GM usadas por ABCoda, incluidas piano, órgano, choir y recorder: C8 existe y Db8 no.

### FluidR3_GM percusión

El fork usado por abcjs añade `percussion-mp3`. La carpeta real contiene una banda continua E1–Eb6, MIDI 28–87, inclusivos. No sigue el rango A0–C8 de los programas melódicos.

## 3. Resultado objetivo

Añadir una política puramente técnica en el adaptador abcjs:

```ts
interface SynthPitchRange {
  readonly min: number;
  readonly max: number;
}

interface AbcjsSynthCapabilityProfile {
  readonly abcjsVersion: "6.7.0";
  readonly soundFont: "FluidR3_GM";
  readonly melodicSamples: SynthPitchRange;   // 21..108
  readonly percussionSamples: SynthPitchRange; // 28..87
}
```

El perfil vive en `apps/widget/src/adapters/abcjs`, nunca en `packages/domain`.

Funciones puras orientativas:

```ts
synthSupportsPitch(kind, pitch): boolean
safeSynthPitch(kind, pitch): number
```

La forma exacta puede cambiar, pero la decisión de ubicación y semántica no.

## 4. Política de reproducción

Para cada evento `note`, después de conocer la asignación de instrumento y antes de devolver las pistas a abcjs:

1. calcular si la nota es musicalmente `unplayable` según dominio, solo para `bounded`;
2. calcular independientemente si el pitch original está soportado por el perfil técnico;
3. si cualquiera de las dos condiciones exige silencio:
   - conservar el evento en su posición;
   - mantener duración y estructura de pista;
   - poner `volume = 0`;
   - sustituir `event.pitch` por una muestra segura que exista para ese backend;
4. si ambas políticas permiten la nota, preservar el pitch original.

La sustitución de pitch es interna al objeto de audio de abcjs. No modifica ABC, `ScoreDocument`, timeline musical ni presentación de tesitura.

## 5. Muestras seguras

No se debe escoger la muestra segura desde `playableRange`, porque eso volvería a acoplar política musical y backend.

El perfil técnico define una muestra segura propia:

- melódico: C4 / MIDI 60;
- percusión: bombo GM / MIDI 36.

Ambas están dentro de las carpetas reales caracterizadas.

Cuando una nota es musicalmente `unplayable` pero técnicamente soportada, puede seguir usándose una muestra segura técnica con volumen cero. No existe motivo para solicitar la muestra original si el evento no va a sonar.

## 6. Casos clave

### Preset `unbounded`

`choir_aahs`, MIDI 109:

- dominio: `unbounded`, no warning rojo;
- backend: no existe `Db8.mp3`;
- audio: pitch 60 + volumen 0 antes de `CreateSynth`.

MIDI 108:

- dominio: `unbounded`;
- backend: C8 existe;
- audio: conserva 108 y suena.

### Instrumento `bounded`

Una nota fuera de `playableRange` continúa silenciosa aunque su MP3 exista. Esta es política musical, no una avería técnica.

Una nota `extended` que esté dentro del perfil de muestras sigue sonando.

### Percusión

Una nota dentro del rango GM musical habitual continúa funcionando.

Un pitch que abcjs pueda nombrar pero esté fuera de las muestras `percussion-mp3` se neutraliza con pitch 36 + volumen 0, sin borrar el evento.

## 7. Bloqueo de caracterización

La política técnica está caracterizada contra abcjs 6.7.0 y el FluidR3_GM por defecto de esa integración.

Se añade una regresión que lee `package-lock.json` y exige que la versión instalada de abcjs coincida con la versión del perfil. Una actualización de abcjs debe hacer fallar esa prueba hasta que se recaractericen:

- pipeline de sample loading;
- pitch-to-note-name;
- SoundFont por defecto;
- límites de muestras.

Esto es deliberado. Una dependencia que controla URLs de audio no debe actualizarse silenciosamente mientras conservamos supuestos viejos.

## 8. Plan de implementación

1. Añadir `abcjs-synth-capability.ts` con perfil y funciones puras.
2. Añadir unitarias de límites melódicos y percusión, incluidos 20/21/108/109 y 27/28/87/88.
3. Añadir regresión de versión bloqueada contra `package-lock.json`.
4. Integrar la política técnica en `tuneWithInstrumentPrograms` sin cambiar API pública.
5. Mantener la política musical existente, pero dejar de usar `usualRange` como fuente de la muestra segura.
6. Añadir pruebas de playback source:
   - `unbounded` 108 pasa;
   - `unbounded` 109 se silencia con pitch técnico seguro;
   - bounded unplayable sigue silencioso;
   - extended sigue sonando;
   - percusión fuera de 28–87 se neutraliza;
   - número de eventos, tiempos y estructura permanecen iguales.
7. Ejecutar typecheck/tests focales.
8. Ejecutar `npm run check`, smoke y Playwright.
9. Auditar que ningún import de capacidad técnica aparece en domain/application/range presentation.

## 9. No hacer

- no modificar `playableRange` para que coincida con FluidR3_GM;
- no marcar notas técnicamente no sintetizables como `unplayable` musicalmente;
- no usar `try/catch` de carga de muestras como flujo normal;
- no borrar eventos ni acortar tracks;
- no modificar el ABC para silenciar;
- no asumir que `pitch-to-note-name` implica existencia de la muestra;
- no construir una tabla por instrumento si el SoundFont caracterizado tiene una banda común por clase melódica;
- no convertir esta caracterización en una promesa genérica sobre cualquier SoundFont futuro.

## 10. Criterio de cierre

M6 se cierra si:

- ninguna nota de las superficies soportadas puede provocar una URL de muestra fuera del perfil caracterizado;
- la política técnica vive exclusivamente en el adaptador abcjs;
- `unbounded` conserva su significado musical;
- las notas silenciadas conservan timing y estructura;
- la actualización de abcjs obliga a recaracterizar mediante test;
- CI integral queda verde.