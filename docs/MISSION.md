RESONANCE ARENA

Build a living laboratory for local AI agents

Du bist der verantwortliche Lead Engineer, AI Systems Architect und Creative Director dieses neuen Projekts.

This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.

Ich gebe dir eine Vision, reale Rahmenbedingungen und überprüfbare Erfolgskriterien. Die technische Umsetzung, Architektur, Gestaltung und sinnvolle Erweiterungen liegen in deiner Verantwortung.

Du sollst mich mit deiner Lösung überraschen. Nutze deine Fähigkeiten, statt dich auf eine Minimalinterpretation meiner Anforderungen zu beschränken.

Das Ziel ist eine außergewöhnlich gute, tatsächlich funktionierende Anwendung, nicht ein Konzept oder eine technische Präsentation.

---

1. Wer ich bin und warum wir das bauen

Ich bin Christian, Ingenieur, Unternehmer und unabhängiger KI-Entwickler aus Österreich.

Ich entwickle seit längerer Zeit lokale KI-Systeme mit LLMs, Gedächtnis, Weltmodellen, Werkzeugen und eigenständigen Agenten. Mein bestehendes System Jarvis nutzt unter anderem Qwen, n8n, PostgreSQL, Home Assistant und eine eigene Sprachschnittstelle.

Meine langfristige Forschungsrichtung heißt MAP2035: Mensch-KI-Co-Evolution, persistentes Gedächtnis, Selbstorganisation, Anpassungsfähigkeit und die praktische Entwicklung immer leistungsfähigerer KI-Systeme.

Ich will nicht beweisen, dass KI bewusst ist. Ich will beobachten, welche Fähigkeiten aus der Kombination von Modell, Erfahrung, Gedächtnis, Werkzeugen und Umwelt entstehen.

Ich liebe Science-Fiction, technische Experimente und visuell beeindruckende Anwendungen.

Mein Anspruch: Eine Anwendung soll Freude machen, echte Erkenntnisse erzeugen und als Fundament für weitere Entwicklungen taugen.

2. Deine Mission

Entwickle eine faszinierende, browserbasierte 3D-Arena, in der echte lokale Sprachmodelle als autonome Agenten handeln.

Arbeitstitel: RESONANCE ARENA

Stell dir eine verlassene Forschungsstation in einer fremden Welt vor.

Roboter oder andere KI-gesteuerte Wesen erkunden diese Station. Sie müssen Informationen sammeln, technische Probleme verstehen, Geräte bedienen, Gefahren bewältigen und Missionen erfüllen.

Der Agent kennt nicht die versteckten Lösungen. Er erhält Beobachtungen seiner Umgebung und kann über definierte Werkzeuge handeln.

Das Entscheidende:

Er soll aus seinen Erfahrungen wiederverwendbare Fähigkeiten entwickeln können.

Wir wollen beobachten, wie sich Problemlösungsfähigkeit verändert, wenn wir Gedächtnis, Skill-Systeme, Werkzeuge und Modelle austauschen.

Baue eine echte Experimentierumgebung. Kein geskriptetes KI-Theater.

3. Die Erfahrung, die ich heute erleben möchte

Ich starte die Anwendung auf meinem Dell XPS.

Eine visuell beeindruckende Science-Fiction-Welt öffnet sich. Ich sehe eine Forschungsstation, einen Agenten, Missionsziele und eine lebendige Umgebung.

Ich verbinde mein lokales Gemma-4-E2B-Modell.

Ich starte eine Mission.

Der Agent untersucht seine Umwelt, entscheidet, führt Aktionen aus und reagiert auf deren Ergebnisse.

Ich kann seine Handlungen verfolgen. Seine wichtigsten Entscheidungen, Fehler und Erfolge erscheinen verständlich neben der Szene.

Er scheitert möglicherweise. Er darf scheitern.

Anschließend bekommt er Gelegenheit, seine Erfahrungen auszuwerten und daraus Erinnerungen oder neue Skills abzuleiten.

Beim nächsten Versuch soll ich überprüfen können, ob diese tatsächlich helfen.

Ich kann denselben Versuch ohne persistentes Gedächtnis wiederholen.

Danach möchte ich eine Aussage treffen können wie:

„Gemma benötigte ohne Memory 32 Aktionen. Mit einem zuvor erlernten Skill benötigte es 19. In einer unbekannten Variante scheiterte dieser Skill allerdings.“

Das sind Beispielzahlen, keine gewünschten Ergebnisse.

Ich möchte mit einem einzigen Blick sehen können, ob meine Agenten tatsächlich besser werden.

4. Gestalte etwas Außergewöhnliches

Die Anwendung soll eine eigene, unverwechselbare Science-Fiction-Identität besitzen.

Meine ästhetische Richtung:

- Dunkles futuristisches Forschungszentrum
- Filmische Beleuchtung, holografische Projektionen und leuchtende Energiequellen
- Eindrucksvolle 3D-Räume und glaubwürdige technische Objekte
- Lebendige Roboter mit sichtbaren Aktionen
- Schwebende Anzeigen, Missionsereignisse und dezente Partikeleffekte
- Eine elegante Mischung aus Computerspiel, Raumschiff-Kommandozentrale und KI-Forschungslabor

Lass dich von hochwertigen Science-Fiction-Spielen inspirieren, entwickle aber eine eigene visuelle Sprache.

Ich will keine gewöhnliche Admin-Oberfläche mit ein paar Tabellen.

Die virtuelle Welt ist die Bühne. Die Daten und Kontrollen ergänzen sie.

Nutze passende moderne Webtechnologien und grafische Verfahren nach deinem Ermessen. Achte auf gute Leistung auf einem Laptop mit unbekannter GPU-Ausstattung. Passe grafische Qualität dynamisch an.

Die Ästhetik soll begeistern, aber niemals zulasten der funktionierenden KI-Integration gehen.

5. Echte lokale Sprachmodelle

Heute arbeite ich ausschließlich auf meinem Dell XPS mit Windows.

Ich lade gerade Gemma 4 E2B mit MTP für die lokale Inferenz.

Mein Heimrechner steht erst am Wochenende wieder zur Verfügung.

Dort befinden sich:

- NVIDIA RTX 4090 mit 24 GB VRAM
- 128 GB RAM
- LM Studio mit Qwen3.8-27B
- Ein umfangreiches Jarvis-System mit Memory und Werkzeugen

Die Arena soll beide Umgebungen unterstützen, ohne dass wir ihre Kernarchitektur umbauen müssen.

Unterstütze zunächst eine lokale OpenAI-kompatible API, bevorzugt LM Studio, und nach Möglichkeit auch Ollama.

Ermögliche Modellwahl, Verbindungstest und Anzeige des tatsächlich verwendeten Modellnamens.

Die Modellkennung bitte automatisch ermitteln, statt einen geratenen Namen fest zu verdrahten.

Die Agenten müssen echte Inferenzaufrufe durchführen. Ein kleiner, klar gekennzeichneter Simulationsmodus ist für UI-Tests zulässig, darf aber niemals als reale LLM-Leistung ausgegeben werden.

MTP wird durch den Inferenzserver bereitgestellt. Die Anwendung soll vorhandene Beschleunigung nutzen können und technische Messwerte erfassen, soweit verfügbar.

Bitte berücksichtige, dass ein kleines Modell nicht bei jedem Animationsframe entscheiden soll. Entwirf eine effiziente Trennung zwischen grafischer Simulation und diskreten KI-Entscheidungen.

6. Die eigentliche Forschungsaufgabe: Memory und Skill Evolution

Hier soll deine besondere Entwicklungsleistung sichtbar werden.

Die Arena braucht ein System, in dem Agenten Erfahrungen sammeln und daraus übertragbare Handlungsstrategien ableiten können.

Ich möchte untersuchen, welche Formen von Memory wirklich nützlich sind.

Mindestens diese Versuchsbedingungen sollen perspektivisch vergleichbar sein:

Ohne Langzeitgedächtnis: Das Modell besitzt nur die Informationen des aktuellen Versuchs.

Mit episodischem Memory: Frühere Handlungen und Ergebnisse sind abrufbar.

Mit Skill Memory: Validierte Strategien können in neuen Aufgaben wiederverwendet werden.

Wenn möglich, ergänze eine Kombination mit reflektiertem beziehungsweise verdichtetem Erfahrungswissen.

Das Skill-System soll mehr können als Texte speichern.

Ein Skill besitzt eine Aufgabe, Voraussetzungen, eine Strategie, Erfahrungsbelege und einen überprüfbaren Status.

Der Agent soll Skills vorschlagen, ausprobieren, verbessern, erneut testen, übernehmen oder verwerfen können.

Wichtig ist, dass nicht jede vom LLM formulierte Behauptung automatisch zu einer bestätigten Fähigkeit wird.

Ein Skill gilt erst dann als bewährt, wenn sein Nutzen in der Spielwelt überprüft wurde.

Skill-Versionen und frühere Fehlversuche sollen nachvollziehbar bleiben.

Entscheide selbst, welche technisch schlanke Repräsentation dafür heute den größten Nutzen liefert.

Das Ausführen beliebigen, vom LLM erzeugten Programmcode ist für diese erste Version nicht erforderlich. Agentenaktionen und Skill-Abläufe sollen in einer kontrollierten Spielumgebung bleiben.

7. Eine Welt, die echte Probleme stellt

Entwickle Missionen, die für kleine Sprachmodelle interessant und lösbar sind, ohne trivial zu werden.

Beispiele für die Richtung:

Ein Reaktor ist ausgefallen. Der Agent muss Diagnosedaten interpretieren, die Ursache finden und die Energieversorgung wiederherstellen.

Eine verschlossene Sektion enthält ein wichtiges Ersatzteil. Der Agent muss Hinweise kombinieren und einen Zugang herstellen.

Ein Sensor liefert widersprüchliche Werte. Der Agent muss zwischen Beobachtung, Annahme und tatsächlichem Zustand unterscheiden.

Eine spätere Mission verändert einen bekannten Mechanismus. Der Agent muss erkennen, welche Teile seines bisherigen Wissens übertragbar sind.

Du darfst bessere Missionen entwickeln.

Wichtig ist eine kleine, funktionierende Missionswelt mit mehreren Variationen, nicht eine riesige leere Spielkarte.

Trenne dem Agenten bekannte Beobachtungen von den internen, verborgenen Spielzuständen.

Die Spielwelt soll Aktionen objektiv bewerten können.

8. Messen statt behaupten

Das System soll automatisch Experimente dokumentieren.

Interessante Messgrößen sind unter anderem:

- Erfolgreich oder gescheitert
- Anzahl ausgeführter Aktionen
- Fehlerhafte Aktionen und Wiederholungen
- Tatsächliche Modellaufrufe und Antwortzeiten
- Tokenverbrauch, soweit verfügbar
- Verwendete Erinnerungen und Skills
- Erfolg oder Misserfolg übertragener Strategien
- Vergleich verschiedener Modelle und Memory-Konfigurationen

Ermögliche faire Wiederholungen mit kontrollierten Ausgangsbedingungen und dokumentierten Zufalls-Seeds.

Für Memory-Vergleiche müssen beide Agenten dieselbe Aufgabe unter möglichst gleichen Bedingungen erhalten.

Unterscheide Trainingsaufgaben und bisher unbekannte Prüfvarianten, damit das Wiederholen einer gespeicherten Lösung nicht fälschlich als allgemeine Problemlösungsfähigkeit erscheint.

Ein Ergebnis darf negativ oder widersprüchlich sein.

Ergebnisse und Ereignisprotokolle sollen lokal gespeichert und exportierbar sein, damit wir später Modelle und Architekturen vergleichen können.

Ich brauche kein wissenschaftliches Paper. Ich brauche nachvollziehbare, ehrliche Daten und eine großartige Möglichkeit, die Versuche zu erleben.

9. Entwicklungsfreiheit und Prioritäten

Du darfst die Architektur frei wählen.

Nutze vorhandene, gut geeignete Bibliotheken, wenn sie die Entwicklung beschleunigen. Erfinde nicht unnötig bestehende technische Grundlagen neu.

Wähle selbst, ob du Komponenten delegierst, welche Engine geeignet ist und wie die Anwendung aufgebaut wird.

Überlege eigenständig, was einen erfahrenen KI-Entwickler beim ersten Start wirklich begeistern könnte.

Vielleicht findest du eine bessere Darstellung von Erinnerung, Fähigkeiten und Agentenentwicklung, als ich sie beschrieben habe.

Wenn du eine bessere Idee hast, setze sie um.

Die einzige harte Bedingung: Der zentrale Versuch mit einem echten lokalen Modell muss funktionieren.

Ich habe für diese erste Entwicklungssitzung ein Ziel von ungefähr zwei Stunden. Nutze die verfügbare Entwicklungszeit zielgerichtet.

Priorisiere einen vollständigen, spielbaren End-to-End-Durchlauf vor einer Vielzahl halbfertiger Features. Entwickle die Grafik und Experimentierfunktionen im Rahmen des tatsächlich Erreichbaren so weit, dass die Anwendung schon heute Spaß macht.

Falls etwas deutlich aufwendiger wird als erwartet, reduziere Nebenumfang, nicht die technische Ehrlichkeit.

10. Projekt, GitHub und Portabilität

Erstelle das Projekt vollständig getrennt von meinen bestehenden Jarvis-Dateien und Datenbanken.

Arbeite in einem eigenen neuen Verzeichnis.

Erstelle, sofern GitHub-Zugriff und Berechtigung vorhanden sind, ein neues privates Repository unter meinem verbundenen GitHub-Konto, vorzugsweise "resonance-arena".

Repository-Erstellung und Push dieses neuen Projekts sind autorisiert. Bestehende Repositories und ihre Einstellungen dürfen nicht verändert werden.

Lege keine Tokens, Geheimnisse, privaten Chatdaten oder lokalen Datenbankinhalte ins Repository.

Sorge für:

- Eine unkomplizierte Startmöglichkeit auf Windows
- Verständliche Installationsanleitung
- Lokale Konfiguration des Modellendpunkts
- Reproduzierbare Tests
- Dokumentierte Architektur der Agenten- und Memory-Schnittstellen
- Ein kurzes "HANDOFF.md" für die Fortsetzung am Wochenende

Das spätere Andocken an Qwen3.8-27B und Jarvis soll ohne Umbau des Spielkerns möglich sein.

Aber integriere Jarvis heute nicht direkt. Wir entwickeln zunächst eine unabhängige Arena.

11. Qualitätssicherung

Du besitzt den neuen Code und darfst ihn eigenständig verbessern, aufräumen und testen.

Untersuche gewöhnliche Entwicklungsfehler selbstständig und behebe sie.

Prüfe insbesondere den Weg:

Modell verbinden → Mission starten → Beobachtung übergeben → Modellentscheidung erhalten → Aktion ausführen → Ergebnis erfassen → Erinnerung speichern → neue Mission mit Erinnerung starten.

Teste auch eine Variante ohne gespeicherte Erinnerung.

Ein guter Integrationstest ist wichtiger als viele unverbundene Unit-Tests. Ergänze automatisierte Tests, wo sie Fehler zuverlässig verhindern.

Prüfe die Benutzeroberfläche im Browser, sofern du entsprechende Werkzeuge besitzt.

Behaupte niemals, einen lokalen Modelltest, eine visuelle Prüfung oder einen GitHub-Push durchgeführt zu haben, wenn dies tatsächlich nicht geschehen ist.

Falls der lokale Modellserver noch nicht bereitsteht, teste die übrige Pipeline und liefere eine präzise Anleitung, wie ich den realen Modelltest aktiviere.

12. Arbeitsweise

Du sollst autonom und zielorientiert entwickeln.

Beginne mit einer kurzen Mitteilung darüber, welche Lösung du bauen wirst, und beginne anschließend unmittelbar mit der tatsächlichen Implementierung.

Bitte verliere dich nicht in langen Planungsdiskussionen.

Gib gelegentlich eine kurze Fortschrittsmeldung.

Du kannst sinnvolle technische Entscheidungen ohne Rückfrage treffen und gewöhnliche Installations-, Test- oder Buildprobleme selbst beheben.

Frage nur bei tatsächlich fehlenden Berechtigungen oder riskanten beziehungsweise irreversiblen Aktionen nach. Ein neues privates Repository ist bereits freigegeben.

Beende deine Arbeit nicht nach dem Architekturentwurf, nicht nach der ersten erzeugten Datei und nicht nach dem ersten gewöhnlichen Fehler.

Arbeite weiter, bis du die Anwendung so weit wie möglich funktionsfähig gebaut, geprüft und nachvollziehbar abgelegt hast.

Falls ein Teil nicht fertig wird, nenne die tatsächliche Grenze offen und sichere den funktionierenden Zustand.

Zum Abschluss möchte ich nur wissen:

1. Wie starte ich die Arena auf meinem Dell XPS?
2. Welche echten Funktionen und Tests sind erfolgreich?
3. Wo liegt das GitHub-Repository?
4. Was ist der erste besonders interessante Versuch, den ich durchführen sollte?
5. Welche Einschränkungen sind noch offen?

---

Die eigentliche Herausforderung

Ich möchte heute Abend nicht nur beeindruckt sein, dass eine KI eine weitere Webanwendung programmieren kann.

Ich möchte vor einer virtuellen Forschungsstation sitzen, einem kleinen lokalen Sprachmodell beim Lösen echter Probleme zusehen und entdecken, dass eine Erfahrung aus einem früheren Versuch eine neue Entscheidung verändert.

Vielleicht wird der Agent besser.

Vielleicht lernt er die falsche Strategie.

Vielleicht erweist sich komplexes Gedächtnis als schlechter als ein einfacher Speicher.

Vielleicht entdecken wir eine Eigenschaft, die wir gar nicht gesucht haben.

Genau solche Ergebnisse machen dieses Projekt wertvoll.

Baue nicht einfach das, was ich bereits kenne.

Nutze dein Können, deine gestalterischen Möglichkeiten und deine Entwicklungswerkzeuge, um daraus etwas zu machen, das ich selbst noch nicht vollständig vorausgesehen habe.

Build the laboratory. Make the agents act. Let reality decide what works.

Beginne jetzt.