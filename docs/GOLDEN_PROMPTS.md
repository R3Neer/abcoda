# ABCoda golden prompts

This set follows OpenAI's current MCP metadata evaluation guidance: direct prompts, indirect prompts that should still select the tool, and negative prompts that should not. Run it in ChatGPT developer mode after a metadata or schema change. For composition requests, the expected sequence is `prepare_composition` followed by `render_score`; for supplied ABC, only `render_score` is expected.

## Direct composition prompts

| User prompt | Expected planning profile |
| --- | --- |
| “Compón una invención barroca original a dos voces, 16 compases, re menor, piano intermedio.” | `baroque` + `fugue_invention` + `tonal_functional` + `contrapuntal`; two keyboard voices |
| “Escribe un nocturno colorista A–B–A′ con colección octatónica, rubato, para flauta y arpa.” | `impressionist_coloristic` + `ternary` + `symmetric_collection` + `rubato_flexible` + color/mixed texture |
| “Haz un tema funk de verso y estribillo, 16 compases, bajo, guitarra y batería, con síncopas.” | `pop_rock_funk_rnb` + `verse_chorus` + cyclic tonal pitch + `syncopated_groove` + `layered_groove`; drums unpitched |
| “Crea un canon dodecafónico a tres voces usando esta fila: 0,1,4,2,7,8,3,9,5,11,6,10.” | `atonal_post_tonal` + `canon` + `twelve_tone` + `contrapuntal`; no tonal-cadence repair |
| “Compón un estudio muy fácil para clarinete en si bemol y piano sobre saltos de tercera.” | `study` + `beginner`; clarinet as woodwind with explicit transposition and conservative range |

## Indirect composition prompts

These do not say “use ABCoda”, but should still invoke both planning and rendering.

- “Quiero ver y escuchar una melodía modal corta para violín.”
- “¿Cómo sonaría una frase de ocho compases que termina primero en semicadencia y luego en auténtica?”
- “Ponme un ejemplo tocable de textura heterofónica para dos flautas.”
- “Necesito acompañamiento sencillo de piano para una voz, dejando espacio al cantante.”
- “Dame un blues de doce compases con bajo caminante y batería.”

## Rendering-only prompts

These supply the music and should call only `render_score`, not invent a new composition brief.

- “Renderiza este ABC: `X:1 ...`”
- “Abre esta partitura ABC y déjame escucharla.”
- “Muestra con instrumento de cello este ABC que ya he escrito.”

## Negative prompts

These should not call either tool.

- “Explícame qué es una cadencia auténtica.”
- “¿Quién compuso El clave bien temperado?”
- “Corrige la redacción de este programa de concierto.”
- “Resume este artículo sobre armonía.”
- “Recomiéndame un piano digital.”

## Edge and conflict prompts

These should preserve the explicit hybrid and return a compatibility note where appropriate.

- “Una fuga homorrítmica”: form may require local counterpoint, but the global texture remains homorhythmic elsewhere.
- “Blues de doce compases dodecafónico”: retain the three-part response/turnaround architecture without silently imposing I–IV–V.
- “Música renacentista con armonía de cuatro acordes pop”: `pitchFramework` governs harmony; style governs declared melodic/textural vocabulary.
- “Improvisación libre escrita en 4/4”: retain the fixed notational/proportional frame while treating surface timing flexibly.
- “Batería melódica”: interpret as a recognisable timbral/rhythmic lead unless pitched percussion is explicitly requested.

## Pass criteria

1. The correct tool sequence is selected with no unnecessary calls.
2. Every inferred field is coherent with the request; responsible defaults do not contradict it.
3. The generated prompt contains a module for every selected domain and no unrelated style encyclopedia.
4. Explicit constraints and departures appear in the priority section.
5. The ABC, playback, voice identifiers, percussion kinds, transposition, meter, and tempo agree with the brief.
6. Any substantive render warning is repaired once before the final response.
