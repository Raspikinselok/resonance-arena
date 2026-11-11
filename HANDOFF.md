# HANDOFF

Stand: 11.11.2026 abends, entwickelt und getestet auf dem Dell XPS (Gemma 4 E2B in LM Studio).

## Starten

`start.bat` doppelklicken, dann `http://localhost:4173`. LM Studio muss laufen (Server an, Port 1234).
Auf dem PC: Repo klonen, `start.bat`, in der Arena Qwen wählen. Am Code ist nichts zu ändern.

## Was nachweislich funktioniert

- `npm test`: 17 von 17 Tests grün (Laptop). Sie prüfen Welt, Lösbarkeit aller Varianten für
  40 Seeds, Skill-Regeln und den kompletten Weg über die HTTP-API gegen eine Modell-Attrappe.
- **Echter Modelltest mit `gemma-4-e2b-it@q4_k_m`:** verbinden, Mission, Beobachtung,
  Modellentscheidung, Aktion, Ergebnis, Reflexion, Skill speichern, neuer Lauf mit Skill im
  Kontext, Vergleich ohne Memory. Alles über die Oberfläche im Browser gelaufen.
- 3D-Szene im eingebauten Browser der Claude-App geprüft: lädt ohne Konsolenfehler, 19 bis 28 fps
  bei Qualität „Mittel“, Roboter, Log und Diagramm reagieren live auf den Lauf.

## Erstes echtes Ergebnis (ein Protokoll, Gemma 4 E2B, Denkphase aus, Skill-Memory)

| Phase | Aufgabe | Ursache | Ergebnis |
|---|---|---|---|
| Baseline ohne Memory | Standard, Seed 201 | Sensor | Erfolg in 13 Aktionen |
| Baseline ohne Memory | Verändert, Seed 301 | Sensor + Kühlmittel | gescheitert, Reaktor gesperrt nach 27 |
| Training | Standard, Seed 101 | Sensor | gescheitert, Budget (30) |
| Training | Standard, Seed 102 | Kühlmittel | gescheitert, Budget (30), Skill S1 erklärt |
| Training | Standard, Seed 103 | Sensor | Erfolg in 21, Skill S1 erklärt |
| Prüfung mit Skills | Standard, Seed 201 | Sensor | gescheitert, Budget (30), Skill S3 erklärt |
| Prüfung mit Skills | Verändert, Seed 301 | Sensor + Kühlmittel | gescheitert, Budget (36), Skill S3 erklärt |

Lesart: In dieser Stichprobe hat Skill-Memory **nicht geholfen, sondern geschadet**. Die Aufgabe,
die ohne Memory in 13 Aktionen gelang, scheiterte mit drei selbst geschriebenen Skills. Die
unbekannte Variante scheiterte in beiden Bedingungen. Die Skills
sind sehr allgemein („Locate_Item“, „Locate_and_Verify“) und enthalten keinen Reaktor-spezifischen
Ablauf. Dazu stieg die Antwortzeit je Entscheidung von rund 5 auf rund 9 Sekunden, weil der Prompt
länger wurde. Kein Skill wurde bewährt: S1 und S2 stehen „im Test“, S3 ist „Vorschlag“.

Das ist ein Lauf je Aufgabe mit Temperatur 0,3. Die Streuung ist groß (dieselbe Ursache gelang
einmal in 13 und scheiterte einmal am Budget). Für eine belastbare Aussage braucht es mehrere
Seeds je Bedingung.

Technische Anmerkung: Das Protokoll wurde nach Lauf 4 unterbrochen, weil der Serverprozess
beendet wurde. Die Läufe 5 bis 7 wurden mit derselben Protokoll-ID und Memory-Bank nachgeholt.
Die nachträgliche Wertung der Prüfläufe als Skill-Belege ist dabei nicht gelaufen.

## Der erste interessante Versuch für dich

Dasselbe Protokoll noch einmal, aber mit **„Skills + Reflexion“** oder **„Episodisch“** statt
Skill-Memory. Frage: Hilft ein konkreter früherer Ablauf einem kleinen Modell mehr als ein
abstrakter, selbst formulierter Skill? Danach dasselbe mit eingeschalteter Denkphase (dauert etwa
sechsmal so lang) und am Wochenende mit Qwen3.8-27B.

## Offene Punkte und Grenzen

- **Skills kleiner Modelle sind zu vage und doppeln sich.** Die Reflexion von E2B liefert drei fast
  gleiche Skills unter verschiedenen Namen. Nächster Schritt: Reflexions-Prompt mit Beispiel für
  einen konkreten Skill, Ähnlichkeitsprüfung vor dem Anlegen.
- **Statistik:** Das Protokoll macht einen Lauf je Aufgabe. Es fehlt eine Option für n
  Wiederholungen mit Mittelwert und Streuung im Diagramm.
- **Nur eine Mission** (Kaltstart, drei Varianten). Die Schnittstelle für weitere steht.
- **Ollama** ist angebunden (gleiche API, Port 11434 wird automatisch probiert), aber ungetestet:
  auf dem Laptop ist kein Ollama installiert.
- **MTP** ist nicht gemessen. Die Datei liegt neben dem Modell, siehe `docs/ENVIRONMENT.md`.
- **Tool-Calls von Gemma 4 E2B** kommen in LM Studio nur teilweise strukturiert an. Die Arena
  fängt das ab (Parser, JSON-Modus), sauberer wäre ein LM-Studio-Update oder ein anderes Template.
- **Grafik:** Geräte und Roboter sind schlichte Körper. Sie ist bisher nur im schmalen
  Browser-Panel geprüft, nicht im Vollbild auf dem Laptop-Display.
- **Git auf dem Laptop** hat ein abgelaufenes GitHub-Login. Der erste `git push` oder `git pull`
  dort öffnet das Anmeldefenster. Die bisherigen Commits wurden über die Claude-Sitzung gepusht.
- Der Agent bekommt Hilfen innerhalb eines Versuchs (Gesehenes, gescheiterte Aktionen, Temperatur
  gegen Schleifen). Ohne sie scheiterte E2B in jedem Lauf am Budget. Das gilt für alle
  Bedingungen gleich, verändert aber die absolute Schwierigkeit.

## Nächste Schritte am Wochenende (PC)

1. `git clone https://github.com/Raspikinselok/resonance-arena.git`, `start.bat`.
2. Protokoll mit Qwen3.8-27B: Baseline ansehen, dann alle drei Memory-Bedingungen.
3. Wiederholungen je Aufgabe einbauen, dann die Skill-Qualität angehen.
4. Jarvis-Memory über `buildContext()` und `learn()` in `server/memory.mjs` andocken.
