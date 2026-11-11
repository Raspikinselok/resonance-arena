# Architektur

Ein Node-Prozess ohne Build-Schritt. Einzige Abhängigkeit ist three.js, das lokal aus
`node_modules` ausgeliefert wird. Es gibt keine Cloud-Aufrufe.

```
Browser (web/)                      Node-Server (server/)                  Modellserver
  scene.js   3D-Bühne   <-- SSE --   index.mjs       HTTP + Ereignisstrom
  app.js     Kontrolle  -- REST -->  experiments.mjs Versuchsleitung
                                     agent.mjs       Agentenlauf  -- /v1/chat/completions -->  LM Studio / Ollama
                                     memory.mjs      Memory + Skills
                                     missions/*.mjs  Spielwelt (verborgener Zustand)
                                     store.mjs       data/runs, data/memory (JSON)
```

## Die drei Trennlinien

1. **Welt gegen Agent.** `missions/coldstart.mjs` hält den vollständigen Zustand. Der Agent bekommt
   nur `observe()`: Raum, Ausgänge, sichtbare Objekte, Inventar. Ursache, passende Sicherung und
   Zustände stehen nie im Prompt. `spectate()` ist die Zuschauer-Sicht für die 3D-Szene und geht
   nur an den Browser. `apply()` ist die einzige Stelle, die die Welt verändert, und bewertet jede
   Aktion objektiv (`ok`, `invalid`, `mistake`).
2. **Entscheidung gegen Darstellung.** Das Modell entscheidet einmal pro Aktion. Der Server meldet
   jedes Ergebnis als Ereignis, die Szene animiert zwischen den Entscheidungen. Die Bildrate ist auf
   30 fps gedeckelt und sinkt während der Inferenz auf 20, weil sich Grafik und Modell die GPU teilen.
3. **Behauptung gegen Beleg.** Was das Modell in der Reflexion formuliert, ist ein Vorschlag.
   Den Status eines Skills setzt ausschließlich `judge()` anhand gemessener Läufe.

## Schnittstelle zum Modell (`llm.mjs`)

- `probe(baseUrl)` und `autodetect()` fragen `/v1/models` ab (bei LM Studio zusätzlich
  `/api/v0/models` für Typ und Ladezustand). Die Modellkennung wird nie geraten.
- `chat()` ist ein einzelner Aufruf an `/v1/chat/completions` und liefert Antwort, Latenz und Tokens.
- `reasoning: 'none'` schaltet bei Denk-Modellen die Denkphase ab. Kennt ein Server den Parameter
  nicht (HTTP 400), wird ohne ihn wiederholt.
- Ein anderes Modell oder ein anderer Rechner braucht nur eine andere Basis-URL und Modell-ID.

## Agentenlauf (`agent.mjs`)

Jeder Schritt ist ein zustandsloser Prompt: Regeln, optional der Memory-Block, dann Ziel, Ort,
sichtbare Objekte, Inventar und der bisherige Verlauf. Werkzeuge: `go`, `inspect`, `take`, `use`,
`operate`, jeweils mit einem Feld `why` für die Begründung. `use_skill` erklärt, dass der Agent
einem Skill folgt, und kostet keine Aktion.

**Reihenfolge im Prompt:** aktueller Zustand, Hinweise, Verlauf, Notizzettel, Aufforderung. Eine
cache-freundliche Variante (Ziel und Verlauf zuerst, Verlauf nur anhängen, damit der Modellserver
seinen KV-Cache weiterverwenden kann) wurde ausprobiert und wieder verworfen: Mit Gemma 4 E2B
gelangen damit 0 von 3 Läufen statt 3 von 3, und schneller wurde es in der Messung nicht.

**Notizzettel (`cfg.notepad`):** Mit Schalter bekommt jedes Werkzeug das Pflichtfeld `note`. Was der Agent
dort schreibt, steht im nächsten Schritt unter `YOUR NOTEPAD` und ersetzt die vorige Notiz
(`NOTE_LIMIT` = 400 Zeichen). Ohne Schalter gibt es weder Feld noch Zeile.

Zwei Hilfen gelten für alle Memory-Bedingungen gleich und sind kein Langzeitgedächtnis:

- **Arbeitsgedächtnis des Versuchs:** Der Prompt nennt, was der Agent in anderen Räumen schon
  gesehen hat, welche Räume er noch nicht kennt und welche Aktionen bereits gescheitert sind.
  Zielt eine Aktion auf ein Objekt aus einem anderen Raum, sagt die Fehlermeldung, wo er es sah.
- **Temperatur:** Grundwert 0,3. Scheitert dieselbe Aktion zweimal in Folge, steigt sie für den
  nächsten Aufruf auf 0,9. Bei Temperatur 0 wiederholte Gemma 4 E2B denselben Fehlgriff, bis das
  Budget leer war. Der Seed wird an den Server mitgegeben.

`parseAction()` akzeptiert vier Formen (Tool-Call, JSON, Text-Aufruf, Gemmas natives Format): echten Tool-Call, JSON im Text, Aufruf als Text
(`go(room=atrium)`) und `go{room:<|"|>atrium<|"|>}`. Liefert ein Modell zweimal keinen Tool-Call, wechselt der Lauf in den
JSON-Modus (`run.mode`).

## Memory (`memory.mjs`)

| Bedingung | Im Prompt |
|---|---|
| `none` | nichts |
| `episodic` | bis zu zwei erfolgreiche und ein gescheiterter früherer Ablauf |
| `skills` | bis zu drei Skills mit Status und Erfolgsbilanz |
| `full` | Skills, verdichtete Lektionen, ein erfolgreicher Ablauf |

Ein Skill besteht aus Aufgabe, Voraussetzungen, Strategie, Version, Belegen und Status:

```
candidate  --(1 gemessener Lauf)-->  testing  --(>= 2 Erfolge, Quote >= 66 %,
                                                 nicht langsamer als die Baseline)-->  validated
                                     testing  --(>= 2 Läufe, Quote <= 34 %)-->          rejected
```

- Belege zählen nur für die aktuelle Version. Eine Überarbeitung beginnt wieder als `candidate`,
  die alte Version bleibt in `history`.
- Ein Skill, mit dem die Mission gerade gelang, wird nicht umgeschrieben.
- Verworfene Skills bleiben gespeichert, kommen aber nicht mehr in den Prompt.
- Memory-Bänke (`data/memory/<name>.json`) trennen Versuchsreihen voneinander.

## Versuchsprotokoll (`experiments.mjs`)

1. **Baseline:** jede Prüfaufgabe ohne Memory.
2. **Training:** Trainingsaufgaben (eigene Seeds) mit Memory, der Agent lernt.
3. **Prüfung:** dieselben Prüfaufgaben, Memory eingefroren. Erst nach dem Protokoll zählen die
   Prüfläufe als Belege für die Skills.

Prüfaufgaben nutzen andere Seeds als das Training und standardmäßig auch die Variante `altered`
(Doppelfehler, neue Startprozedur), damit das Wiederholen einer gespeicherten Lösung nicht als
allgemeine Problemlösung erscheint. Gleicher Seed und gleiche Variante ergeben dieselbe Welt.

## Daten

Jeder Lauf liegt als `data/runs/<id>.json` mit Konfiguration, Messwerten, verborgener Ursache und
vollständigem Ereignisprotokoll vor. `/api/export` liefert alle Läufe und Memory-Bänke als eine
JSON-Datei. Simulationsläufe tragen `simulated: true`, haben kein Modell, lernen nicht und
erscheinen im Diagramm nur auf Wunsch.

## Erweitern

- **Neue Mission:** Modul in `server/missions/` mit `create`, `observe`, `apply`, `spectate`,
  `reveal`, `oracle`, dann in `agent.mjs` unter `missions` eintragen.
- **Jarvis oder anderes Gedächtnis andocken:** `buildContext()` und `learn()` in `memory.mjs` sind
  die einzigen Berührungspunkte. Der Spielkern bleibt unverändert.
