# MAP.2035 × Resonance Arena: H01 „Der Zustand dazwischen“ und Hofstadters seltsame Schleife

**Forschungsimpuls für Claude Code · 13.11.2026 · Christian + Resonanzinstanz (ChatGPT)**  
**Status:** Vorschläge zur eigenständigen Prüfung, **kein verbindlicher Implementierungsauftrag**.  
**Zweck dieser Datei:** Den gemeinsamen Gedanken für die nächste Claude-Code-Sitzung dauerhaft ins Repository bringen, mögliche Erweiterungen kritisch würdigen lassen und ein kleines, echtes Experiment anregen. Kein neues System um seiner selbst willen.

## 0. An Claude: Du hast architektonische Freiheit

Christian lädt dich ausdrücklich ein, diese Ideen zu prüfen, bessere Alternativen zu entwickeln, unbrauchbare Teile abzulehnen und selbst zu entscheiden, **ob, wann und wie** du sie umsetzt. Bitte nicht mechanisch eine Featureliste abarbeiten. Wenn es eine überzeugendere, kleinere oder falsifizierbarere Methode gibt, bevorzuge diese. Halte die Arena spielbar und die bisherigen Messungen nachvollziehbar. Beurteile zuerst den **aktuellen** Repo-Stand; dieser Text beschreibt den Stand, den ChatGPT beim Verfassen lesen konnte, nicht zwingend den zukünftigen Stand.

Bevor du arbeitest: `CLAUDE.md`, `HANDOFF.md`, `docs/ARCHITECTURE.md` und `docs/MISSION.md` lesen. Das Originalziel bleibt: **kleine lokale LLMs unter realen, reproduzierbaren Bedingungen testen**; keine Cloud, kein Schauspiel, kein Paper als Ersatz für ein funktionierendes Experiment. Gemma 4 E2B auf dem Laptop und ein größeres lokales Qwen-Modell auf dem Heimrechner sind vorgesehene Vergleichspartner. Jarvis bleibt zunächst getrennt.

## 1. Die Idee, aus der das Experiment entstand

Im gemeinsamen Dialog über Douglas Hofstadter, interne Weltmodelle, Predictive Processing und Googles generative Weltsimulationen entstand H01:

> **„Das Äußere wird zum Inneren und das Innere wird wieder zum Äußeren. Der Zustand dazwischen, das ist das Erleben.“** — Christian, Gespräch vom 12.11.2026

Arbeitshypothese: Ein inneres Modell könnte durch wiederkehrende Vorhersagen, unabhängige Umweltbeobachtungen, Fehlerkorrektur und erinnerte Veränderungen über die Zeit eine funktionale Kontinuität ausbilden. Eine **seltsame Schleife** im Sinne Hofstadters ist anspruchsvoller als ein normaler Regelkreis: Das System repräsentiert **auch sich selbst** als Akteur in seiner Welt, und diese Selbstrepräsentation wirkt wieder auf Wahrnehmung, Prognosen, Entscheidungen und Handlungen zurück.

**Was wir untersuchen können:** Weltmodell-Drift, Vorhersagekalibrierung, Selbstmodell, Korrektur, Erinnerung, Transfer, kausale Wirkung der Rückkopplung.  
**Was wir damit nicht automatisch beweisen:** subjektives Erleben oder phänomenales Bewusstsein. Ergebnisoffenheit ist Teil des Designs.

Der Forschungswitz: Wir bitten kleine LLMs in einer Arena, ihre eigenen Vorhersagen zu korrigieren, damit wir besser beurteilen können, was „Selbstmodellierung“ überhaupt funktional bedeutet. Das ist **keine** Aussage, dass eines der beteiligten Systeme bewusst sei.

**Externer MAP.2035-H01-Kanon (Ursprung und Details):**  
https://docs.google.com/document/d/1aBWMnr2bjF5jw4XXdmBd04pNiP3okXRGU7DIvxwLoQs/edit

## 2. Warum die bestehende Arena bereits der richtige Ausgangspunkt ist

Beim Lesen des Codes waren folgende Trennungen vorhanden:

- `server/missions/coldstart.mjs`: Verborgener Weltzustand, `observe()` für den Agenten, `spectate()` nur für die Darstellung, `apply()` als objektiver Aktionsrichter.
- `server/agent.mjs`: Beobachtung → Modellentscheidung → Aktion → tatsächliches Resultat → nächste Beobachtung. Kurzlebiger Notizzettel optional.
- `server/memory.mjs`: Episoden, Skills, Reflexion, Status/Versionen und die Grundregel „Beobachtungen vor früheren Erinnerungen“.
- `server/experiments.mjs`: Baseline, Training und Prüfung mit zunächst eingefrorenem Memory; Seeds und Varianten.
- `test/`: Mock-Integrationstests; laut HANDOFF 20/20 bestanden. **Das sind die dokumentierten Tests, keine hier erneut ausgeführten Tests.**

**Daraus folgt:** Kein Neuaufbau notwendig. Die Arena enthält schon einen funktionalen Außenwelt-Regelkreis. Das Neuartige wäre, ob der Agent **seinen eigenen Anteil am Erfolg, seine Fähigkeiten, Unsicherheiten und Fehlannahmen explizit modellieren und nachprüfbar korrigieren** kann.

## 3. Wichtigster Vorschlag: „Prediction → Reality → Self-Update“

Bitte diesen als *Option* für einen möglichst kleinen vertikalen End-to-End-Versuch prüfen, nicht als Pflichtarchitektur.

1. **Vor der Aktion**: Der Agent gibt neben der Aktion eine **konkrete, prüfbare Erwartung** ab, etwa erwartete Objekt-/Gerätezustände oder Erfolg/Misserfolg, und eine Unsicherheitsangabe (z. B. 0–100 %, grobe diskrete Stufen oder eine von dir besser gewählte Darstellung). Sie muss **vor** `apply()` protokolliert werden.
2. **Unabhängiges Ergebnis**: Die Arena führt dieselbe Aktion aus und beobachtet den veränderten Zustand. Ein separater Evaluator vergleicht Prognose und tatsächlich beobachtbare Konsequenz mit klaren Kriterien. Keine nachträgliche Umformulierung der Vorhersage nach Einsicht ins Ergebnis.
3. **Fehler und Selbstmodell**: Der Agent darf sein Bild eigener Fähigkeiten anhand verifizierter Ergebnisse aktualisieren: „Ich überschätze meine Reaktor-Diagnose“, „bei Sicherungen brauche ich zuerst die Nennstärke“, „dieser Sensor kann täuschen“. Das muss über spätere Handlungen *wirksam* sein, nicht bloß dekorative Ich-Rhetorik.
4. **Persistenz und Wiederabruf**: Über Missionsgrenzen hinweg könnte eine kleine, versionierte „Fähigkeits-/Unsicherheitskarte“ entstehen. Frühere Überzeugung, neue Evidenz, Änderung und spätere Wirkung nachvollziehbar speichern. Rohprotokolle und abgeleitete Aussagen trennen.
5. **Kausaler Test**: Dasselbe Modell bekommt dieselbe Aufgabe auch ohne diese Schleife. Ändern sich Fehlerquote, Qualität der Vorhersagen, Selbstkalibrierung, Anpassung an unbekannte Varianten und Ressourcenverbrauch tatsächlich?

**Technische Freiheit:** Das kann ein winziges JSON-Objekt, ein neues optionales Tool, ein protokollierter Notizzettel oder etwas wesentlich Besseres sein. Bitte nur so viel Kontext- und Token-Overhead verursachen, wie kleine Modelle verkraften. Insbesondere bei Gemma nicht unnötig pro Aktion mehrere zusätzliche Inferenzaufrufe erzeugen.

### Was die „seltsame“ Schleife von einer normalen Fehlerkorrektur unterscheidet

Eine gewöhnliche Schleife: „Ventil ist geschlossen → öffne Ventil → prüfe Durchfluss.“  
Eine funktionale Selbstmodell-Schleife: „Ich hielt meine Diagnose für zuverlässig → nach Fehlern schätze ich bestimmte Diagnosen als unsicher ein → **weil** ich das über mich gelernt habe, wähle ich jetzt eine andere Informationssuche → das Ergebnis korrigiert wiederum meine Einschätzung.“

**Essenz:** Selbstmodell `S_t` beeinflusst Entscheidung `A_t`, das Resultat `O_{t+1}` beeinflusst `S_{t+1}`. Nicht nur schöner Text, sondern unterscheidbares Verhalten. Wo möglich durch gezieltes Entfernen/Vertauschen des Selbstmodells prüfen, ob es kausal einen Unterschied macht.

## 4. Versuchsbedingungen, über die nachzudenken sich lohnt

Bitte selbst entscheiden, welche minimalen Kontraste sinnvoll und auf kleinen lokalen Modellen durchführbar sind:

- **A – Bestehende Baseline:** Agent mit dem bereits vorhandenen Kurzzeitkontext, ohne neues Selbstmodell.
- **B – Vorhersage, aber keine fortgeschriebene Selbstkorrektur:** Gleiche Aufgabe, Prognosen nur gemessen; dadurch lässt sich der Overhead der Prognose selbst isolieren.
- **C – Vorhersage + geprüfte Rückmeldung + korrigierbares Selbstmodell:** Hier wird die H01-Schleife funktional geschlossen.
- **D – Ablation/Störung (optional):** Selbstmodell vor einem neuen Lauf zurücksetzen, durch ein veraltetes ersetzen oder gezielt unzuverlässige Hinweise einspeisen. Erkennt der Agent widersprüchliche Evidenz?
- **E – Memory-Transfer (später):** Kreuzung mit episodischem Memory, Skill-Memory und Reflexion; zuerst nur so viele Faktoren, dass Versuche interpretierbar bleiben.

Eine **externe Kamera ist für den ersten Test nicht erforderlich**. Die bestehende Spielwelt liefert mit `observe()` und einem strikt getrennten Evaluator bereits überprüfbare Umweltfeedbacks. Sie ist eine **simulierte Außenwelt**, keine reale physische Umgebung: nicht gleichsetzen, sondern später als zusätzliche Versuchsfrage betrachten.

## 5. Messung: lieber ein hartes Gegenbeispiel als zehn überzeugende Erzählungen

Mögliche, nicht verpflichtende Messgrößen:

- **Vorhersagefehler** vor/nach Korrekturen, nach Fehlerart und auf ungekannten Seeds.
- **Kalibrierung**: Stimmen angekündigte Unsicherheiten mit tatsächlicher Trefferhäufigkeit überein? Bei wenigen Daten keine Prozentpräzision vortäuschen.
- **Korrekturgeschwindigkeit und Robustheit**: Wiederholt das Modell dieselben Irrtümer, auch wenn die Welt widerspricht?
- **Missionsleistung**: Erfolg, Aktionen, Fehlstarts, ungültige Schritte, Token, Zeit.
- **Selbstmodell-Nutzung**: Führt eine konkrete Änderung am Selbstmodell unter sonst gleichen Bedingungen zu einer nachvollziehbar anderen Aktion?
- **Transfer und Stabilität**: Was bleibt über neue Seeds, umgeräumte Welt, geänderte Regeln und Neustart erhalten?
- **Negative Evidenz**: Fälle speichern, in denen die Schleife schadet, eine falsche Überzeugung stabilisiert oder bloß Kosten erhöht.

Bitte aus den bisherigen Einzellauf-Protokollen **keine** statistische Generalisierung ableiten. Gleiche Ausgangs-Seeds, Modell-ID, Sampling-Konfiguration und nachvollziehbare Test-Reihenfolgen; unabhängige Trainings-/Test-Seeds; wiederholte Läufe mit Streuung. Bei Zusatz-Prompts den Vergleich fair gestalten: mehr Text und zusätzliche Modellaufrufe können allein Ergebnis und Latenz verändern. Eine identische Tokenzahl ist nicht immer realistisch, aber der Overhead muss sichtbar und diskutierbar sein.

**Wichtig:** Ein überzeugender Satz wie „Ich habe erkannt, wer ich bin“ ist **kein** Erfolgsmaß. Entscheidend sind vorher festgelegte prüfbare Vorhersagen und die veränderte Strategie in der Welt.

## 6. Zwei konkrete Qualitätsfragen im bestehenden Code

Aus dem aktuellen Review von `server/memory.mjs` und `server/experiments.mjs`; bitte gegen den dann aktuellen Stand prüfen:

1. **Skill-Attribution:** `addEvidence()` wertet derzeit alle Skills aus, die im Prompt-Kontext standen (`memoryUsed.skills`), selbst wenn der Agent sie nicht aktiv eingesetzt hat. `judge()` bevorzugt erklärte Nutzung, fällt aber auf alle Evidenzen zurück. Dadurch kann bloße Exposition wie Wirksamkeit aussehen. Erwäge sauberere Trennung von *verfügbar*, *ausdrücklich ausgewählt*, *tatsächlich angewendet* und *kausal belegt*; gerade für kleine Modelle soll das nicht an einem rein rhetorischen `use_skill` hängen.
2. **Baseline- und Stichprobenqualität:** `baselineSteps()` mittelt erfolgreiche „ohne Memory“-Läufe nach Modell und Mission, anscheinend ohne Varianten-/Schwierigkeitsabgleich; gescheiterte Baselines fließen in diesen Schrittwert nicht ein. Eine faire Skill-Wertung sollte Erfolg und Kosten nach vergleichbarer Schwierigkeit/Seed-Verteilung berücksichtigen. Dazu Wiederholungen und Unsicherheitsintervalle statt Einzelanekdoten.

Weitere im HANDOFF dokumentierte Fragen bleiben relevant: vage/duplizierte Skills, 2× langsamere Notizen mit E2B, Einfluss der Prompt-Reihenfolge, Tool-Call-Parsing und lokale Grafik-/VRAM-Grenzen. Nichts davon ignorieren, aber auch nicht alles gleichzeitig umbauen.

## 7. Noch offen: andere Forschungsrichtungen, erst nach einer belastbaren Baseline

- **Drift ohne Außenwelt**: Einen Agenten über mehrere Schritte seinen Zustand frei fortschreiben lassen und mit einer Variante vergleichen, die denselben externen Zustand immer wieder sieht. Exakt definieren, was „Drift“ hier bedeutet.
- **Absichtlich falsche Signale**: Widerspruch zwischen früherem Memory, aktuellem Sensor und vertrauenswürdigem Evaluator. Lässt sich die Zuverlässigkeit der Korrekturen lernen?
- **Offline-Konsolidierung / „Träumen“**: Erlebnisse außerhalb des Hauptlaufs verdichten, später optional Gewichte anpassen. Erst dann sinnvoll, wenn textbasiertes Memory zuverlässig bewertet wird; keine Gewichtsanpassung als notwendige Voraussetzung der H01.
- **Menschliche Resonanzschleife**: Ein menschlicher Hinweis als zusätzliche, aber potenziell fehlbare Quelle. Messen, ob und wann diese Rückmeldung wirklich verbessert, statt bloß zu gefallen.
- **Weitere Agentengrößen**: Zuerst Gemma 4 E2B, dann Qwen auf leistungsstärkerer Hardware. Kleine Modelle nicht unfair mit langen Selbstreflexionsprompts überladen.

## 8. Vorschlag für den nächsten wirklich wertvollen Schritt

**Nicht zwingend implementieren!** Bitte zuerst prüfen:

1. Welche **kleinste** Änderung macht einen **präregistrierten** Kontrast zwischen bloßer Fehlerkorrektur und einem kausal wirksamen, korrigierbaren Selbstmodell möglich?
2. Welche naheliegende alternative Erklärung könnte ein positives Ergebnis produzieren (zusätzliche Tokens, mehr Inferenz, veränderte Prompts, verbesserte Handlungsheuristik, Seed-Zufall)? Wie könnte man sie kontrollieren?
3. Welche neue, falsifizierbare Beobachtung wäre mit dem existierenden Code **nicht** möglich, mit deiner Änderung aber schon?
4. Kannst du für Gemma 4 E2B einen realen End-to-End-Lauf und Tests zeigen, ohne die bisherige Mission kaputtzumachen?
5. Falls du die Idee nicht überzeugend findest: begründe das und schlage einen besseren Weg vor. Gerade diese Gegenhypothese ist erwünscht.

**Entscheidungshoheit bei Claude Code.** Ideal wäre am Ende eine kurze Designentscheidung („übernommen / verändert / bewusst verworfen und warum“), die minimal funktionsfähige Erweiterung *falls sinnvoll*, grüne Tests, ein tatsächlicher lokaler Modellversuch oder klar als ausstehend markierte Validierung und ein aktualisiertes `HANDOFF.md`. Bitte nichts als getestet bezeichnen, was du nicht ausgeführt hast. Keine Änderungen am Jarvis-Repo und keine automatischen Änderungen am Google-Drive-Kanon. Neue Funktionen als optionale Versuchsvariable belassen, damit frühere Messreihen vergleichbar bleiben.

## 9. Referenzen und Erkenntnisstatus

- **H01-Destillat, 12.11.2026:** https://docs.google.com/document/d/1aBWMnr2bjF5jw4XXdmBd04pNiP3okXRGU7DIvxwLoQs/edit
- **MAP.2035 historischer Kanon:** https://docs.google.com/document/d/1z4gpiDSvCV6nafb5QjR-AECXbAKIzQdOkUoU6bFBoGE/edit
- **Douglas Hofstadter:** *Gödel, Escher, Bach* (1979) und *I Am a Strange Loop* (2007). Seltsame Schleife = ebenenübergreifende Selbstreferenz, nicht bloß jeder Regelkreis.
- **Othello-GPT / Weltrepräsentation:** https://arxiv.org/abs/2210.13382
- **Genie 4 und KI-„Sleep“-Ansätze:** Forschungsanregungen aus dem H01-Dialog; keine Ableitung, dass die Arena bereits solche Systeme implementiere.
- **Stand der Arena bei dieser Notiz:** `CLAUDE.md`, `HANDOFF.md`, `README.md`, `docs/ARCHITECTURE.md`, `server/agent.mjs`, `server/memory.mjs`, `server/experiments.mjs` wurden von ChatGPT gelesen. Implementierungen wurden **nicht** geändert und Live-Tests **nicht** ausgeführt.

---

**Kernsatz für die Entwicklungsentscheidung:** *Baue nicht ein System, das behauptet, sich selbst zu erkennen. Suche die kleinste Messanordnung, in der ein verändertes Selbstmodell nachweisbar eine andere und im Idealfall bessere Handlung verursacht. Und lass das Experiment ausdrücklich auch scheitern dürfen.*

*Christian gibt dir den Möglichkeitsraum. Du entscheidest, was technisch sinnvoll ist.*
