# 📱 Bestellungen Handy-App (PWA)

Eine moderne, mobile App zur schnellen Erfassung und Verwaltung von Bestellungen mit Name, Datum, Status und Betrag.

## 🚀 Schnellstart

### Am PC starten:
Doppelklicke einfach auf:
👉 **`start_app.bat`**

Dadurch wird der lokale Server gestartet und die App öffnet sich automatisch in deinem Browser.

### Auf dem Handy öffnen:
1. Vergewissere dich, dass dein Smartphone im **selben WLAN** wie dein PC eingeloggt ist.
2. Klicke im Browser am PC oben rechts auf das **📱 Smartphone‑Symbol**.
3. **Scanne den angezeigten QR‑Code mit der Handy‑Kamera** (oder tippe die angezeigte IP‑Adresse in Safari / Chrome ein).
4. Fertig! Die App öffnet sich sofort auf deinem Smartphone.

---

## 📲 Als echte App auf dem Smartphone installieren (Home‑Screen)

### iPhone (iOS Safari):
1. Öffne die Seite in **Safari**.
2. Tippe unten in der Leiste auf den **„Teilen“-Button** (Viereck mit Pfeil nach oben).
3. Scrolle etwas nach unten und wähle **„Zum Home‑Bildschirm“** (Add to Home Screen).
4. Tippe oben rechts auf **„Hinzufügen“**.
5. Die App erscheint nun mit eigenem Icon auf deinem Startbildschirm und öffnet sich im echten Vollbildmodus (ohne Adressleiste)!

### Android (Google Chrome / Samsung Internet):
1. Öffne die Seite in **Chrome**.
2. Tippe oben rechts auf die **drei Punkte (Menü)**.
3. Wähle **„App installieren“** oder **„Zum Startbildschirm hinzufügen“**.
4. Bestätige mit **„Installieren“**.

---

## ✨ Funktionen
- **Bestellungen erfassen**: Titel, Name, Datum, Betrag (€), Notizen und Status.
- **Datum & Dringlichkeit**: Heutige Fälligkeiten und überfällige Bestellungen werden automatisch farblich hervorgehoben.
- **Filter & Suche**: Schnellfilter für *Alle*, *Offen*, *Heute fällig*, *Diese Woche*, *Geliefert* sowie Echtzeit‑Suche.
- **Status‑Wechsel mit 1 Tap**: Durch Antippen des Status‑Badges wechselt der Status direkt (*Offen* → *In Bearbeitung* → *Geliefert* → *Storniert*).
- **Offline & Sicher**: Funktioniert auch ohne Internetverbindung im Offline‑Modus (Service Worker Caching). Alle Daten bleiben lokal auf deinem Handy gespeichert.
- **Excel & CSV Export**: Mit 1 Klick als `.csv` für Excel oder als `.json` Backup exportieren.
- **Dark Mode**: Automatischer oder manueller Wechsel zwischen Hell‑ und Dunkelmodus.

---

## ☁️ Immer‑online Backend (Deployment)

### 1. Lokale Vorbereitung
```powershell
# Installiere Node.js (enthält npm) falls noch nicht vorhanden:
#   https://nodejs.org/en/download/
# Danach in das Projektverzeichnis wechseln und Abhängigkeiten installieren:
cd bestellungen-app
npm install
```

### 2. Deploy zu Render (Kostenlose Stufe)
1. **Repository zu GitHub pushen** (falls noch nicht geschehen).
2. Auf <https://render.com> ein Konto anlegen und ein neues **Web Service** erstellen.
3. **Verbinde das Git‑Repository** mit Render.
4. **Build Command**: `npm install`
5. **Start Command**: `npm start`
6. **Enable Persistent Disk** (z. B. 1 GB) – dient zur Speicherung von `orders.json`.
7. Render erzeugt eine öffentliche URL (z. B. `https://bestellungen-app.onrender.com`).
8. Aktualisiere die Variable `$permanentUrl` in `start_online.ps1` mit dieser URL.

### 3. Verifikation
- Öffne die Render‑URL im Browser – die PWA sollte laden.
- Lege eine Bestellung an; sie wird per API (`/api/orders`) gespeichert.
- Öffne dieselbe URL auf einem zweiten Gerät – die neue Bestellung sollte nach wenigen Sekunden erscheinen (Sync‑Badge grün).
- Schalte den PC aus – die App bleibt über die Render‑URL erreichbar.

---

*Hinweis*: Die kostenlose Stufe von Render kann nach längerer Inaktivität den Container pausieren (Cold‑Start). Das ist normal und hat nur eine kurze Verzögerung beim ersten Zugriff.

---

Eine moderne, mobile App zur schnellen Erfassung und Verwaltung von Bestellungen mit Name, Datum, Status und Betrag.

## 🚀 Schnellstart

### Am PC starten:
Doppelklicke einfach auf:
👉 **`start_app.bat`**

Dadurch wird der lokale Server gestartet und die App öffnet sich automatisch in deinem Browser.

### Auf dem Handy öffnen:
1. Vergewissere dich, dass dein Smartphone im **selben WLAN** wie dein PC eingeloggt ist.
2. Klicke im Browser am PC oben rechts auf das **📱 Smartphone-Symbol**.
3. **Scanne den angezeigten QR-Code mit der Handy-Kamera** (oder tippe die angezeigte IP-Adresse in Safari / Chrome ein).
4. Fertig! Die App öffnet sich sofort auf deinem Smartphone.

---

## 📲 Als echte App auf dem Smartphone installieren (Home-Screen)

### iPhone (iOS Safari):
1. Öffne die Seite in **Safari**.
2. Tippe unten in der Leiste auf den **„Teilen“-Button** (Viereck mit Pfeil nach oben).
3. Scrolle etwas nach unten und wähle **„Zum Home-Bildschirm“** (Add to Home Screen).
4. Tippe oben rechts auf **„Hinzufügen“**.
5. Die App erscheint nun mit eigenem Icon auf deinem Startbildschirm und öffnet sich im echten Vollbildmodus (ohne Adressleiste)!

### Android (Google Chrome / Samsung Internet):
1. Öffne die Seite in **Chrome**.
2. Tippe oben rechts auf die **drei Punkte (Menü)**.
3. Wähle **„App installieren“** oder **„Zum Startbildschirm hinzufügen“**.
4. Bestätige mit **„Installieren“**.

---

## ✨ Funktionen
- **Bestellungen erfassen**: Titel, Name, Datum, Betrag (€), Notizen und Status.
- **Datum & Dringlichkeit**: Heutige Fälligkeiten und überfällige Bestellungen werden automatisch farblich hervorgehoben.
- **Filter & Suche**: Schnellfilter für *Alle*, *Offen*, *Heute fällig*, *Diese Woche*, *Geliefert* sowie Echtzeit-Suche.
- **Status-Wechsel mit 1 Tap**: Durch Antippen des Status-Badges wechselt der Status direkt (*Offen* &rarr; *In Bearbeitung* &rarr; *Geliefert* &rarr; *Storniert*).
- **Offline & Sicher**: Funktioniert auch ohne Internetverbindung im Offline-Modus (Service Worker Caching). Alle Daten bleiben lokal auf deinem Handy gespeichert.
- **Excel & CSV Export**: Mit 1 Klick als `.csv` für Excel oder als `.json` Backup exportieren.
- **Dark Mode**: Automatischer oder manueller Wechsel zwischen Hell- und Dunkelmodus.
