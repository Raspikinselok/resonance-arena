# CLAUDE.md - Projektkontext für RESONANCE ARENA

Diese Datei reist mit dem Repo. Lies sie zu Beginn jeder Sitzung, egal auf welchem Gerät.

## Mission

Eine browserbasierte 3D-Arena, in der echte lokale Sprachmodelle als autonome Agenten handeln.
Schauplatz ist eine verlassene Forschungsstation in einer fremden Welt. Der Agent bekommt
Beobachtungen, handelt über definierte Werkzeuge und kennt die versteckten Lösungen nicht.

Entscheidend ist das Experiment: Der Agent wertet Läufe aus, leitet Erinnerungen und Skills ab,
und derselbe Versuch lässt sich mit und ohne Gedächtnis wiederholen. Christian will auf einen
Blick sehen, ob Agenten besser werden (z. B. Aktionen bis zum Ziel, mit und ohne Skill, auch in
unbekannten Varianten).

Der vollständige Auftrag gehört nach `docs/MISSION.md`. **Offen: Die bisher gelieferte Fassung
bricht in Abschnitt 5 ab, die vollständige fehlt noch.**

## Leitplanken aus dem Auftrag

- Echte Experimentierumgebung, kein geskriptetes KI-Theater. Scheitern ist erlaubt.
- Funktionierende KI-Integration geht vor Optik. Die Optik soll trotzdem begeistern:
  dunkles Sci-Fi-Forschungszentrum, filmisches Licht, Hologramme, eigene visuelle Sprache.
- Die 3D-Welt ist die Bühne, Daten und Kontrollen ergänzen sie. Keine Admin-Oberfläche.
- Modellanbindung über eine OpenAI-kompatible API, zuerst LM Studio. Laptop und PC müssen ohne
  Umbau der Kernarchitektur funktionieren: Adresse und Modell kommen aus der `.env`.
- Alles läuft lokal. Keine externen Dienste, keine Cloud-Konten, keine Telemetrie.

## Geräte

Details und Messwerte: `docs/ENVIRONMENT.md`. Kurzfassung: Der Laptop hat nur 4 GB VRAM für
Modell und Grafik zusammen, der PC eine RTX 4090. Grafikqualität dynamisch anpassen.

## Stand

- Angelegt: Repo-Grundgerüst, `.gitignore`, `tools/model-check.mjs`.
- Noch nicht entschieden: Architektur und Tech-Stack der Arena. Erst festlegen, wenn der
  vollständige Auftrag vorliegt, und die Entscheidung dann hier festhalten.
- Auf dem Laptop gibt es kein brauchbares Python (nur 3.7, 32 Bit). Node 22 ist vorhanden.

## Arbeitsweise

- Vor dem Arbeiten `git pull`, am Ende committen und pushen. Branch: `main`.
- Niemals committen: `.env`, Modelle, Laufzeitdaten, Agenten-Gedächtnis (siehe `.gitignore`).
- Sprache: Doku und Kommentare auf Deutsch, Bezeichner im Code auf Englisch.
- Diese Datei aktuell halten: Entscheidungen, Stand und offene Punkte nachtragen.
