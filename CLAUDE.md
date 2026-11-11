# CLAUDE.md - Projektkontext für RESONANCE ARENA

Diese Datei reist mit dem Repo. Lies sie zu Beginn jeder Sitzung, egal auf welchem Gerät.
Danach `HANDOFF.md` für den aktuellen Stand.

## Mission

Eine browserbasierte 3D-Arena, in der echte lokale Sprachmodelle als autonome Agenten handeln.
Der Agent kennt die verborgenen Lösungen nicht, bekommt Beobachtungen und handelt über definierte
Werkzeuge. Entscheidend ist das Experiment: Hilft Gedächtnis (Episoden, Skills, Reflexion) beim
nächsten Versuch, und überträgt es sich auf unbekannte Varianten? Christian will das auf einen
Blick sehen. Der vollständige Auftrag steht in `docs/MISSION.md`.

## Leitplanken

- Echte Experimentierumgebung, kein geskriptetes KI-Theater. Scheitern ist erlaubt, negative
  Ergebnisse sind Ergebnisse.
- Technische Ehrlichkeit geht vor Umfang: nie Simulation als Modellleistung ausgeben, nie Tests
  oder Messungen behaupten, die nicht gelaufen sind.
- Alles lokal. Keine externen Dienste, keine Cloud-Konten, keine Telemetrie, kein CDN.
- Die 3D-Welt ist die Bühne, Daten und Kontrollen ergänzen sie. Keine Admin-Oberfläche.
- Getrennt von Jarvis: keine Jarvis-Dateien oder -Datenbanken anfassen. Das Andocken ist für
  später vorgesehen und läuft über `server/memory.mjs`.

## Aufbau in einem Satz je Datei

Details: `docs/ARCHITECTURE.md`.

- `server/missions/coldstart.mjs` Spielwelt mit verborgenem Zustand, drei Varianten, Seeds
- `server/agent.mjs` Agentenlauf, Prompt, Werkzeuge, Antwort-Parser, Simulationsmodus
- `server/llm.mjs` OpenAI-kompatibler Client, Modellerkennung
- `server/memory.mjs` Memory-Bedingungen, Skill-Lebenszyklus (`judge`), Reflexion
- `server/experiments.mjs` Einzellauf, Lernschritt, Vergleichsprotokoll
- `server/index.mjs` HTTP-API, Ereignisstrom, statische Dateien
- `web/scene.js` three.js-Szene, `web/app.js` Oberfläche
- `test/` 18 Tests, `tools/` Messskripte für echte Modelle

## Entscheidungen, die nicht ohne Grund kippen sollten

- **Kein Build-Schritt, eine Abhängigkeit (three.js).** Node 22 reicht. Auf dem Laptop gibt es kein
  brauchbares Python.
- **Zustandsloser Prompt je Schritt** statt wachsendem Chat: kurzer Kontext für kleine Modelle.
- **Texte der Spielwelt und Prompts auf Englisch**, Oberfläche und Doku auf Deutsch.
- **Prompt-Reihenfolge: Zustand, dann Verlauf, dann Notizzettel.** Die cache-freundliche Reihenfolge
  (Verlauf zuerst) schnitt mit Gemma 4 E2B deutlich schlechter ab, siehe `HANDOFF.md`.
- **Skill-Status nur aus Messungen.** Die Reflexion darf vorschlagen, nicht bestätigen.
- **Denkphase standardmäßig aus** (`reasoning_effort: "none"`): auf dem Laptop sonst 6-mal langsamer.
- **Bildrate gedeckelt:** Modell und Grafik teilen sich auf dem Laptop 4 GB VRAM.

## Arbeitsweise

- Vor dem Arbeiten `git pull`, am Ende committen und pushen. Branch: `main`.
- Nach Änderungen `npm test`. Verhalten mit echtem Modell prüfen: `npm run test:live`.
- Ändert sich die Spielwelt (Texte, Regeln), sind ältere Läufe in `data/` nicht mehr vergleichbar:
  dann `data/` leeren oder eine neue Memory-Bank verwenden und das in `HANDOFF.md` notieren.
- Niemals committen: `.env`, Modelle, `data/`.
- Bezeichner im Code Englisch, Kommentare und Doku Deutsch.
- `HANDOFF.md` am Ende jeder Sitzung aktualisieren.
