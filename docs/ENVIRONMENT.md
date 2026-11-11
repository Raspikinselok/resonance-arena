# Geräte und Modelle

## Laptop: Dell XPS 15 9570 (geprüft am 11.11.2026)

| Bauteil | Wert |
|---|---|
| CPU | Intel Core i9-8950HK, 6 Kerne / 12 Threads |
| RAM | 32 GB |
| GPU | NVIDIA GTX 1050 Ti Max-Q, 4 GB VRAM (plus Intel UHD 630) |
| System | Windows 11 Home |
| Tools | Node 22.17, Git 2.44, LM Studio mit `lms`-CLI |
| Python | nur 3.7.3 (32 Bit), für das Projekt nicht geeignet |
| Ollama | nicht installiert |

Folgen für die Arena:

- 4 GB VRAM teilen sich Modell und 3D-Darstellung. Gemma 4 E2B belegt geladen rund 3,4 GB.
  Die Szene läuft deshalb mit gedeckelter Bildrate (30 fps, 20 während der Inferenz) und
  anpassbarer Qualität. Gemessen im Browser-Panel bei Qualität „Mittel“: 19 bis 28 fps.
- Modelle über ca. 3 GB laufen teilweise auf der CPU und werden deutlich langsamer.

## PC (laut Christian, noch nicht geprüft)

RTX 4090 mit 24 GB VRAM, 128 GB RAM, LM Studio mit Qwen3.8-27B, dazu das Jarvis-System.

## Modelle auf dem Laptop

Gemessen mit `node tools/model-check.mjs`, Temperatur 0, 200 Tokens Ausgabe.

| Modell-ID in LM Studio | Größe | Laden | Tokens/s | Tool-Call |
|---|---|---|---|---|
| `gemma-4-e2b-it@q4_k_m` | 3,1 GB | 16 s | 16,2 | ja |
| `google/gemma-4-e4b` | 6,3 GB | 20 s | 3,8 | ja |
| `phi-3-mini-4k-instruct` | 2,4 GB | 10 s | 22,1 | nein |

LM Studio listet zusätzlich `gemma-4-e2b-it@q8_0`. Dahinter steht keine Modelldatei, nur die
MTP-Zusatzdatei im selben Ordner trägt „Q8_0“ im Namen. Diese ID nicht verwenden.

## Denkphase von Gemma 4

Gemessen mit `node tools/think-probe.mjs gemma-4-e2b-it@q4_k_m` (eine Entscheidung mit Tool-Call):

| Anfrage | Dauer | Tokens | davon Denken |
|---|---|---|---|
| Standard | 18,5 s | 196 | 156 |
| `reasoning_effort: "none"` | 3,0 s | 32 | 0 |
| `reasoning_effort: "low"` | 15,8 s | 190 | 156 |
| `chat_template_kwargs.enable_thinking: false` | 14,9 s | 190 | 156 |

Nur `reasoning_effort: "none"` schaltet das Denken in LM Studio ab. Die Arena sendet das
standardmäßig mit; in der Oberfläche lässt sich die Denkphase als Versuchsvariable einschalten.

## Beobachtungen zum Verhalten von Gemma 4 E2B

- Etwa jeder dritte Tool-Call kommt nicht als strukturierter Aufruf an, sondern roh im Text, in
  Gemmas eigenem Format: `go{room:<|"|>reactor<|"|>,why:<|"|>…<|"|>}`. `parseAction()` liest das.
- Nach zwei solchen Antworten wechselt ein Lauf in den JSON-Modus. Dort antwortet das Modell stabil.
- Eine Entscheidung dauert ohne Denkphase meist 3 bis 6 Sekunden, mit wachsendem Verlauf bis ca. 12.

## MTP

Die MTP-Datei (`mtp-gemma-4-E2B-it-Q8_0.gguf`) liegt neben dem Modell. LM Studio kann sie beim
Laden als Entwurfsmodell nutzen: `lms load <id> --speculative-draft-mtp`. Ob das auf diesem Laptop
etwas bringt, ist noch nicht gemessen. Die Arena erfasst Antwortzeit und Tokens je Aufruf, damit
lässt sich das direkt vergleichen.
