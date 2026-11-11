# RESONANCE ARENA

Ein lebendiges Labor für lokale KI-Agenten: eine browserbasierte 3D-Arena, in der echte lokale
Sprachmodelle als autonome Agenten eine verlassene Forschungsstation erkunden, Missionen lösen
und aus ihren Erfahrungen wiederverwendbare Skills ableiten.

Die Kernfrage: **Werden die Agenten tatsächlich besser**, wenn man Gedächtnis, Skill-System,
Werkzeuge oder Modell austauscht? Jeder Lauf soll messbar und mit anderen Läufen vergleichbar sein.

> Status: Projekt angelegt, Umgebung geprüft. Die Anwendung selbst ist noch nicht gebaut.

## Voraussetzungen

- Node.js 22 oder neuer
- Ein lokaler Modellserver mit OpenAI-kompatibler API, bevorzugt [LM Studio](https://lmstudio.ai) auf Port 1234
- Git

## Einrichten

```bash
git clone https://github.com/Raspikinselok/resonance-arena.git
cd resonance-arena
copy .env.example .env    # dann LLM_MODEL an das Gerät anpassen
```

## Modelle prüfen

Das Skript misst Ladezeit und Tokens pro Sekunde und testet, ob ein Modell saubere Tool-Calls liefert:

```bash
node tools/model-check.mjs                       # listet die Modelle des Servers
node tools/model-check.mjs gemma-4-e2b-it        # testet ein Modell
```

Messwerte der beiden Geräte stehen in [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Arbeiten auf zwei Geräten

GitHub ist die Drehscheibe, Laptop und PC sind Arbeitskopien.

```bash
git pull                              # vor dem Arbeiten
git add . && git commit -m "..."      # nach dem Arbeiten
git push
```

Modelle, `.env`, Laufzeitdaten und Agenten-Gedächtnis bleiben lokal und stehen in der `.gitignore`.
