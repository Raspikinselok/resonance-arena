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

Folgen für die Arena:

- 4 GB VRAM teilen sich Modell und 3D-Darstellung. Die Grafikqualität muss sich dynamisch anpassen.
- Modelle über ca. 3 GB laufen teilweise auf der CPU und werden deutlich langsamer.

## PC (laut Christian, noch nicht geprüft)

RTX 4090 mit 24 GB VRAM, 128 GB RAM, LM Studio mit Qwen3.8-27B, dazu das Jarvis-System.

## Messwerte Laptop

Gemessen mit `node tools/model-check.mjs`, Temperatur 0, 200 Tokens Ausgabe.

| Modell | Größe | Laden | Tokens/s | Tool-Call |
|---|---|---|---|---|
| phi-3-mini-4k-instruct | 2,4 GB | 10 s | 22,1 | nein |
| google/gemma-4-e4b | 6,3 GB | 20 s | 3,8 | ja, korrekt |
| gemma-4-e2b-it (Q4_K_M) | 3,1 GB | offen | offen | offen |

Erkenntnis: Phi-3 mini ist schnell, liefert aber keine Tool-Calls über die API. Gemma 4 E4B
liefert saubere Tool-Calls, ist auf diesem Laptop aber zu langsam für flüssige Missionen.
