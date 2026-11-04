# Simon YouTube

YouTube als Desktop-App mit **vier Panels**:

| Panel | Was es macht |
|---|---|
| **Video** | Spielt das gewählte Video bildfüllend ab. Shorts laufen hier auch – einfach mit dem Mausrad / den Pfeiltasten weiterscrollen. |
| **Browser** | Normales YouTube zum Stöbern, Suchen, Abos usw. |
| **Kommentare / Vorschläge** | Zeigt die Kommentare bzw. die Video-Vorschläge zum aktuellen Video (umschaltbar). |
| **Später ansehen** | Deine Merkliste. |

## Bedienung

- **Linksklick** auf ein Video im Browser → wird im Video-Panel abgespielt, die Kommentare erscheinen im Kommentar-Panel.
- **Mittelklick** (Mausrad-Klick) auf ein Video → kommt in **Später ansehen**. (Strg+Klick geht auch.)
- **Klick** auf ein Video in *Später ansehen* → startet es und nimmt es aus der Liste.
- Klick auf einen Vorschlag im Kommentar-Panel spielt ihn ab, Klick auf einen Zeitstempel in einem Kommentar springt zu dieser Stelle.
- Shorts: im Video-Panel einfach scrollen – die Kommentare wandern automatisch mit.
- Die Trennlinien zwischen den Panels lassen sich ziehen (Doppelklick = zurücksetzen).
- **⊞ In 4 Fenster aufteilen** (oben): Jedes Panel bekommt sein eigenes Fenster (z. B. für mehrere Monitore).
  Beim ersten Mal wird der Bildschirm in vier Viertel geteilt, danach merkt sich die App die Fensterpositionen.
  **⊟ Zusammenfügen** oder das Schließen eines der Fenster holt alles wieder in ein Fenster.
- **⚙ Einstellungen**:
  - **Lautstärke-Ausgleich (Auto-Level)**: *Auto* (wie YouTube), *Aus* (keine Normalisierung, immer die eingestellte
    Reglerlautstärke) oder *Eigene Stärke* 0–100 %.
  - **Videoqualität**: *Auto* oder feste Auflösung (144p … 4K). Ist die gewählte nicht verfügbar, wird die nächstniedrigere genommen.
- Oben rechts: **Anmelden** / **Abmelden**. Beim allerersten Start erscheint ein Anmeldefenster, dort kann man auch **„Ohne Anmeldung fortfahren“** wählen.

## Downloads

Alles wird automatisch von GitHub Actions gebaut und unter
[Releases → latest](../../releases/tag/latest) veröffentlicht – ohne Versionsnummer im Dateinamen:

| Datei | System |
|---|---|
| `Simon-YouTube-Setup.exe` | Windows – Installer |
| `Simon-YouTube-Portable.exe` | Windows – Portable (Daten liegen im Ordner `Simon-YouTube-Daten` neben der .exe) |
| `Simon-YouTube.AppImage` | Linux – AppImage (`chmod +x` und starten) |
| `Simon-YouTube.deb` | Debian / Ubuntu / Mint (`sudo apt install ./Simon-YouTube.deb`) |
| `Simon-YouTube.flatpak` | Linux – Flatpak (`flatpak install --user Simon-YouTube.flatpak`) |

Jeder Push auf den Standard-Branch ersetzt das Release `latest`. Bei anderen Branches und Pull Requests
werden die Dateien nur als Actions-Artefakte gebaut.

## Selbst starten / bauen

```bash
npm install
npm start
```

```bash
npm run dist:win      # Windows: Installer + Portable
npm run dist:linux    # Linux: AppImage + deb
npm run dist:flatpak  # Linux: Flatpak (braucht flatpak + flatpak-builder)
```
