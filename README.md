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
- **Adressleiste** oben: YouTube-Link einfügen (z. B. aus Discord kopiert) → startet sofort im Video-Panel.
  **Shift+Enter** oder **+** legt ihn in *Später ansehen*. Normaler Text sucht auf YouTube. **Strg+L** springt in die Leiste.
  Versteht `youtu.be/…`, `watch?v=…`, Shorts, Live, Embed, Links mit Zeitstempel und Links in `<…>`.
- **Link kopieren** im Video-Panel kopiert den Link zum aktuellen Video inklusive Zeitstempel.
- **Panels verschieben**: Am Griff **⠿** in der Kopfzeile ein Panel auf ein anderes ziehen → die beiden tauschen die Plätze.
  Die Anordnung wird gespeichert (zurücksetzen unter ⚙ Einstellungen).
- Die Trennlinien zwischen den Panels lassen sich ziehen (Doppelklick = zurücksetzen).
- **Panels ein-/ausblenden**: Mit den Knöpfen **Browser · Kommentare · Später** oben lassen sich diese Panels
  aus- und wieder einblenden. Der **Media-Player** (Video) bleibt immer sichtbar; die übrigen Panels füllen den Platz.
- **⊞ In 4 Fenster aufteilen** (oben): Das Hauptfenster wird zum **Media-Player**, Browser, Kommentare und
  Später ansehen bekommen eigene Fenster (z. B. für mehrere Monitore). Beim ersten Mal wird der Bildschirm in vier
  Viertel geteilt, danach merkt sich die App die Fensterpositionen. Das **X** an einem dieser Fenster blendet es nur aus –
  über die Knöpfe oben im Player kommt es zurück. **⊟ Zusammenfügen** holt alles wieder in ein Fenster.
- **Sprache / Language**: Deutsch oder English – im Willkommensfenster oder unter ⚙ Einstellungen, wird sofort
  umgeschaltet. Beim ersten Start wird die Systemsprache genommen.
- **⚙ Einstellungen**:
  - **Lautstärke-Ausgleich (Auto-Level)**: *Auto* (wie YouTube), *Aus* (keine Normalisierung, immer die eingestellte
    Reglerlautstärke) oder *Eigene Stärke* 0–100 %.
  - **Profi Auto-Level (AGC)**: eigene Lautstärke-Regelung wie ein professioneller Auto-Leveler –
    Zielpegel (dBFS), max. Absenkung, max. Verstärkung, Attack, Release, Messfenster, Gate, Make-up-Gain und Limiter,
    mit Presets (Standard, Sprache, Musik, Nacht-Modus, Broadcast) und Live-Pegelanzeige.
  - **Videoqualität**: *Auto* oder feste Auflösung (144p … 4K). Ist die gewählte nicht verfügbar, wird die nächstniedrigere genommen.
- Oben rechts: **Anmelden** / **Abmelden**. Beim allerersten Start erscheint ein Anmeldefenster, dort kann man auch **„Ohne Anmeldung fortfahren“** wählen.

## Anmeldung klappt nicht? („Dieser Browser oder diese App ist unter Umständen nicht sicher“)

Google lässt die Anmeldung in eingebetteten App-Browsern oft nicht zu. Dann so:

1. In deinem normalen Browser (Chrome/Firefox/Edge) auf youtube.com anmelden.
2. Mit einer Erweiterung wie **„Get cookies.txt LOCALLY“** die Cookies von youtube.com als `cookies.txt` exportieren.
3. In Simon YouTube: **⚙ Einstellungen → cookies.txt importieren …** (oder beim ersten Start „Mit cookies.txt anmelden“,
   oder nach einem fehlgeschlagenen Login im Hinweisfenster).
4. Die `cookies.txt` danach löschen – sie enthält deine Anmeldung.

Es werden nur Cookies von youtube.com und google.* übernommen.

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
