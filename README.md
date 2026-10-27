# Russisch-Tool

Ein Russisch-Trainer in einer einzigen Datei: **`index.html`** im Browser öffnen, fertig – keine Installation, kein Server; wahlweise als App installierbar.

**Online:** https://srlt191.github.io/Russisch-Tool/

**Als App installieren:** die Online-Seite in Vivaldi (oder Chrome/Edge) öffnen, dann im Menü *App installieren* bzw. auf dem Handy *Zum Startbildschirm hinzufügen*. Die App startet im eigenen Fenster, holt bei Internet immer die neueste Fassung und läuft auch ohne Internet (`manifest.webmanifest`, `sw.js`, Symbole in `icons/`). Der Lernstand ist derselbe wie in der Online-Seite im selben Browser; vor dem ersten Installieren trotzdem mit GitHub abgleichen oder eine Sicherung machen.

- **Startseite „Heute“:** Weiterlernen (mit Vorschau, was kommt), fällige Wiederholungen mit Vorschau der nächsten Tage, heute geübt, Woche mit Summe und Quote, Stand je Sprachstufe, „Oft falsch“ zum gezielten Üben (Fehlerzähler: +1 bei falsch, −1 bei richtig), Hinweis wenn nicht auf GitHub gespeichert
- **Vokabeln:** 3180 Karten (3197 Wörter) in 79 Kategorien, RU → DE und DE → RU, Freitext, Auswahl und Aufdecken; Umschrift wahlweise nach der Aussprache oder Buchstabe für Buchstabe; Vorlesen mit wählbarer russischer und deutscher Stimme
- **Grammatik:** 17 Werkzeuge (Verben, Substantive, Adjektive, Pronomen, Präpositionen, Sätze)
- **Hörverstehen:** Hörtrainer, Hörquiz, Satzdiktat
- **Sprachniveau:** jedes Wort und jeder Satz mit Stufe (A1–C1), Stufenplan, Einstufungstest, Stufe abschließen

## Lernstand

Der Lernstand liegt **nur im Browser** (localStorage) – nicht in diesem Repository. Neben dem Übungsstand (offen/erledigt) führt die App je Wort und Aufgabe eine **Wiederholungsstufe 0–5**, die nur mit wachsendem Abstand steigt (sofort, dann nach 1, 3, 7 und 14 Tagen), dazu „zuletzt geübt“. Unter *Einstellungen → Speichern → Sicherung* lässt er sich als Datei sichern und wieder einlesen; beim Einlesen wird zusammengeführt, nichts geht verloren. Sicherungsdateien gehören nicht ins Repository (siehe `.gitignore`). Wahlweise speichert *Einstellungen → Speichern → GitHub-Speicher* den Lernstand in einem **eigenen privaten Repo** (Datei `lernstand.json`, Zugang über einen fein eingeschränkten Token nur für dieses Repo); der Token bleibt im Browser des Geräts.

## Prüfungen

`pruefungen/` enthält Browser-Prüfungen (Playwright), die die App in einem echten Chromium durchklicken. Sie laufen bei jedem Push und Pull Request automatisch (GitHub Actions). Lokal:

```bash
cd pruefungen
npm install
npx playwright install chromium
npm test
```

## Arbeitsweise

Siehe `WARTUNGSPLAN.md`: Prüfbefehle, wann welcher Befehl, feste Regeln. Änderungen kommen über einen eigenen Zweig und einen Pull Request; eingebaut wird erst nach Bestätigung.

## Quellen

Sprachniveaus als Richtwert: A1 nach den FIPI-Anforderungen „Уровень 1“ (2023), A2 nach dem „Лексический минимум по русскому языку как иностранному. Базовый уровень“ (Н.П. Андрюшина, Т.В. Козлова, Златоуст 2019), sonst nach Worthäufigkeit (OpenSubtitles-Liste, hermitdave/FrequencyWords) mit Wortformen aus OpenRussian.org (CC BY-SA 4.0).

Schriften: Noto Sans und Literata (SIL Open Font License 1.1), Symbole: Tabler Icons (MIT), alle eingebettet in `index.html`.
