# MrxDown Installation Guide für macOS

## 🍎 Für Apple Silicon (M1/M2/M3) Macs

### Wenn du die Gatekeeper-Warnung bekommst:

> "MrxDown.app" ist beschädigt und kann nicht geöffnet werden. Sie sollten es in den Papierkorb verschieben.

**Schnelle Lösung:**
```bash
# Quarantäne von der heruntergeladenen App entfernen
xattr -cr /path/to/MrxDown.app

# Oder mit sudo falls nötig:
sudo xattr -dr com.apple.quarantine /path/to/MrxDown.app
```

### Schritt-für-Schritt Anleitung:

1. **App herunterladen** von [GitHub Releases](https://github.com/pepperonas/mrxdown/releases)

2. **Terminal öffnen** (⌘ + Leertaste → "Terminal")

3. **Zur App navigieren** (zum Beispiel im Downloads-Ordner):
   ```bash
   cd ~/Downloads
   ```

4. **Quarantäne entfernen**:
   ```bash
   xattr -cr MrxDown.app
   ```

5. **App in den Programme-Ordner verschieben**:
   ```bash
   mv MrxDown.app /Applications/
   ```

6. **App starten** - jetzt sollte sie ohne Warnung öffnen!

## 🔧 Für Entwickler

### Lokale Builds erstellen:

```bash
# Universal Binary (Intel + Apple Silicon)
npm run build-mac-local

# Nur für Apple Silicon
npm run build-mac-arm64
```

### Warum passiert das?

- macOS Gatekeeper blockiert Apps die nicht von Apple notarisiert sind
- Unsere GitHub Actions Builds sind korrekt signiert aber nicht notarisiert
- Die Quarantäne-Entfernung ist ein sicherer Workaround

## 📞 Support

Falls du weiterhin Probleme hast:
- [GitHub Issues](https://github.com/pepperonas/mrxdown/issues)
- [Diskussionen](https://github.com/pepperonas/mrxdown/discussions)