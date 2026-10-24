# Russisch-Tool

Ein Russisch-Trainer in einer einzigen Datei: **`index.html`** im Browser öffnen, fertig – keine Installation, kein Server.

**Online:** https://srlt191.github.io/Russisch-Tool/

- **Vokabeln:** 2989 Karten (3006 Wörter) in 79 Kategorien, RU → DE und DE → RU, Freitext, Auswahl und Aufdecken
- **Grammatik:** 17 Werkzeuge (Verben, Substantive, Adjektive, Pronomen, Präpositionen, Sätze)
- **Hörverstehen:** Hörtrainer, Hörquiz, Satzdiktat
- **Sprachniveau:** jedes Wort und jeder Satz mit Stufe (A1–C1), Stufenplan, Einstufungstest, Stufe abschließen

## Lernstand

Der Lernstand liegt **nur im Browser** (localStorage) – nicht in diesem Repository. Unter *Einstellungen → Sicherung* lässt er sich als Datei sichern und wieder einlesen; beim Einlesen wird zusammengeführt, nichts geht verloren. Sicherungsdateien gehören nicht ins Repository (siehe `.gitignore`).

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

Sprachniveaus als Richtwert: A1 nach den FIPI-Anforderungen „Уровень 1“ (2023), sonst nach Worthäufigkeit (OpenSubtitles-Liste, hermitdave/FrequencyWords) mit Wortformen aus OpenRussian.org (CC BY-SA 4.0).
