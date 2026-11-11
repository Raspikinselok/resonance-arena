# RESONANCE ARENA

Ein lebendiges Labor für lokale KI-Agenten. In einer browserbasierten 3D-Station handelt ein echtes
lokales Sprachmodell als autonomer Wartungsroboter: Es beobachtet, entscheidet, handelt, scheitert
oder gewinnt, wertet seine Erfahrung aus und leitet daraus Skills ab. Die Arena misst, ob dieses
Gedächtnis beim nächsten Versuch tatsächlich hilft.

Alles läuft lokal. Kein Cloud-Dienst, kein Konto, keine Telemetrie.

## Starten (Windows)

Voraussetzungen: [Node.js 22+](https://nodejs.org) und ein lokaler Modellserver, bevorzugt
[LM Studio](https://lmstudio.ai) mit eingeschaltetem Server (Developer → Start Server, Port 1234).
Ollama funktioniert über dieselbe OpenAI-kompatible Schnittstelle (Port 11434).

1. Doppelklick auf **`start.bat`**. Beim ersten Mal installiert das Skript three.js.
2. Der Browser öffnet `http://localhost:4173`.
3. Die Arena sucht den Modellserver selbst und listet dessen Modelle. Modell wählen, **Mission starten**.

Ohne Batch-Datei: `npm install`, dann `npm start`.

## Was du siehst

- **Bühne:** Station Kepler-9 mit Atrium, Reaktorhalle, Kontrollraum, Lager und Labor. Der Roboter
  bewegt sich nur, wenn das Modell es entschieden hat. Lampen an den Geräten zeigen den wahren
  Zustand (Zuschauer-Sicht), den der Agent selbst erst herausfinden muss.
- **Agent (rechts):** jede Entscheidung mit Begründung des Modells, Ergebnis, Antwortzeit und Tokens.
- **Memory & Skills (rechts, zweiter Reiter):** Skills mit Status, Versionen und Belegpunkten.
- **Unten:** jeder Lauf als Balken (Höhe = Aktionen bis zum Ziel, gestrichelt = gescheitert) und
  daneben die Aussage in Worten.

## Die Mission „Kaltstart“

Der Reaktor ist ausgefallen. Die Ursache ist verborgen und hängt vom Seed ab: geschlossenes
Kühlmittelventil, durchgebrannte Sicherung (nur eine von drei Stärken passt) oder widersprüchliche
Drucksensoren. Drei Fehlstarts sperren den Reaktor. Das Aktionsbudget ist begrenzt.

| Variante | Zweck |
|---|---|
| Standard | Training |
| Umgeräumt | Transfer: gleiche Mechanik, aber Ventil und Sicherungen an anderen Orten, Labor verriegelt, der Wegweiser im Atrium ist veraltet |
| Verändert | Unbekannte Prüfvariante: zwei Fehler gleichzeitig und eine neue Startprozedur |

## Memory-Bedingungen

| Bedingung | Der Agent bekommt |
|---|---|
| Ohne Memory | nur den aktuellen Versuch |
| Episodisch | frühere Abläufe mit Aktionen und Ergebnissen |
| Skill-Memory | Skills: Aufgabe, Voraussetzungen, Strategie, Status, Erfolgsbilanz |
| Skills + Reflexion | Skills, verdichtete Lektionen und einen früheren Ablauf |

Ein Skill ist zunächst nur ein **Vorschlag** des Modells. Er wird **im Test** geführt, sobald er
einmal im Einsatz war, und gilt erst als **bewährt**, wenn mindestens zwei gemessene Läufe mit ihm
gelangen und er nicht langsamer ist als die Baseline ohne Memory. Scheitert er wiederholt, wird er
**verworfen**. Alte Versionen und ihre Belege bleiben sichtbar.

## Notizzettel des Agenten

Jeder Schritt ist ein frischer Modellaufruf. Der Agent sieht dabei, was er bisher getan hat, aber
nicht, was er sich dabei gedacht hat. Mit dem Schalter **Notizzettel** schreibt er bei jeder
Entscheidung eine kurze Notiz (Diagnose und restlicher Plan, höchstens 400 Zeichen, rund
100 Tokens), die im nächsten Schritt wieder im Prompt steht und die vorige ersetzt. Der Zettel gilt
nur innerhalb einer Mission und ist eine eigene Versuchsvariable, unabhängig von der
Memory-Bedingung.

## Musik-Modus

Oben rechts **Musik** klicken: aus → Equalizer → Schwarm → beides. Ein Ring aus Balken ums Atrium
und ein großer Außenring zeigen 48 Frequenzbänder, Staubwolke und Raumlicht pumpen mit dem Bass,
der Schwarm umkreist den Roboter. Die Tonquelle wählst du daneben:

- **Tab / System:** Der Browser fragt, was geteilt werden soll. Den Tab mit der Musik (oder den
  ganzen Bildschirm) wählen und **„Tab-Audio teilen“ bzw. „Systemaudio teilen“ anhaken**.
  Funktioniert in Chrome und Edge. Das mitgeteilte Bild wird nicht verwendet.
- **Mikrofon:** nimmt auf, was aus den Lautsprechern kommt.
- **Demo-Signal:** künstliches Signal ohne Ton, zum Ausprobieren.

Der Ton wird nur im Browser analysiert, nicht aufgezeichnet und nicht gesendet. Der Modus ist reine
Darstellung und hat keinen Einfluss auf Agent oder Messwerte, kostet aber etwas GPU-Leistung.

## Der Vergleichsversuch

**Protokoll starten** führt sieben Läufe aus:

1. zwei Prüfaufgaben ohne Memory (Baseline),
2. drei Trainingsaufgaben mit Memory, der Agent lernt,
3. dieselben zwei Prüfaufgaben mit eingefrorenem Memory.

Eine Prüfaufgabe ist die Standard-Variante mit unbekanntem Seed, die andere die Variante
„Verändert“. So zeigt sich, ob ein Skill nur eine Lösung wiederholt oder überträgt. Das Ergebnis
darf negativ sein.

## Echte Modelle, ehrliche Kennzeichnung

- Die Modellkennung kommt vom Server (`/v1/models`). Nach jedem Lauf zeigt die Kopfzeile, welches
  Modell der Server in seiner Antwort tatsächlich gemeldet hat.
- **Denkphase:** Modelle wie Gemma 4 überlegen vor jeder Antwort. Auf dem Laptop kostet das etwa
  das Sechsfache an Zeit, deshalb ist sie standardmäßig aus und als eigene Versuchsvariable schaltbar.
- **Simulationsmodus:** zufällige gültige Aktionen ohne Modell, nur zum Testen der Oberfläche.
  Solche Läufe sind überall als Simulation markiert, lernen nicht und fehlen im Vergleich.

## Tests

```bash
npm test                 # 19 Tests: Welt, Lösbarkeit, Skill-Regeln, kompletter Weg über die HTTP-API
npm run test:live        # echter Lauf gegen den lokalen Modellserver, ohne Browser
npm run test:live -- --model <id> --condition skills --runs 3 --bank test1
npm run test:live -- --model <id> --runs 3 --notepad      # mit Notizzettel
node tools/model-check.mjs <id>     # Tempo und Tool-Call-Fähigkeit eines Modells
node tools/think-probe.mjs <id>     # Wirkung der Denk-Einstellungen
```

`npm test` nutzt eine Modell-Attrappe und prüft die Pipeline, nicht die Modellleistung.

## Konfiguration

`.env.example` nach `.env` kopieren, falls der Server nicht auf dem Standardport läuft:

```
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=<modell-id laut /v1/models>
PORT=4173
```

## Daten

Läufe liegen unter `data/runs/`, Memory-Bänke unter `data/memory/`, beides als lesbares JSON und
nicht im Repository. **Daten exportieren** lädt alles als eine Datei.

## Weiterlesen

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): Aufbau, Agenten- und Memory-Schnittstellen
- [HANDOFF.md](HANDOFF.md): Stand und nächste Schritte
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md): Geräte und Messwerte
- [docs/MISSION.md](docs/MISSION.md): der ursprüngliche Auftrag
