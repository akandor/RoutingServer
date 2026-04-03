Willkommen im Routing Server Admin Panel!

### Routen Administration

### SBC Konfiguration

#### Konfiguration des Remote Web Service
Der Remote Web Service definiert das Ziel für die HTTP-Anfragen und wird von den IP-zu-IP-Routing-Regeln verwendet.

![Remote Web Service](/assets/Remote-Web-Service.png)

- **Pfad:** Löschen Sie den Standardwert.
- **Typ:** Wählen Sie RoutingServer.
- **Login erforderlich:** Setzen Sie auf Deaktiviert, es sei denn, Sie haben Ihren Endpunkt mit Authentifizierung gesichert.

Klicken Sie auf **HTTP Remote Hosts** am unteren Bildschirmrand und fügen Sie den Routing-Server-Host hinzu.

![HTTP Remote Host](/assets/HTTP-Remote-Host.png)

Stellen Sie sicher, dass Sie die richtige Schnittstelle und den Zielport wählen. Sie sollten den Status **verbunden** sehen.

Häufige Probleme:

- **NAT** - Wenn die SBC und der Routing-Server über das private IPv4-Netzwerk kommunizieren und die ausgewählte Schnittstelle NAT-Übersetzungsregeln hat, stellen Sie sicher, dass der gewählte Port (z.B. 3000) nicht im Zielportbereich liegt.
- **Firewall** – Stellen Sie sicher, dass die IPv4-Adresse der ausgewählten Schnittstelle für eingehende Verbindungen auf dem gewählten Port (z.B. 3000) in der ACL des Servers erlaubt ist, der den Routing-Server hostet.
- **TLS** – Wenn Sie HTTPS-Transport verwenden, stellen Sie sicher, dass Sie die vertrauenswürdige Root-Kette für Zertifikate, die im Routing-Server gehostet werden, in den Standard-SBC-TLS-Kontext importieren.

#### IP-zu-IP-Routing-Regeln erstellen

Erstellen Sie die Hauptrouting-Regel für die Behandlung eingehender SIP-Invites. Mein Setup enthält auch Regeln für die Behandlung von SIP-Optionen, Registrierungen und Umleitung von REFER-Nachrichten.

Stellen Sie sicher, dass Sie RoutingServer als Zieltyp auswählen (dies löst HTTP-POST-Anfragen aus).

![IP-to-IP Route](/assets/IP-to-IP-Route.png)

### Routen

Notationen:
x	Platzhalter (Metazeichen), der eine einzelne Ziffer von 0 bis 9 darstellt.
z	Platzhalter (Metazeichen), der eine einzelne Ziffer von 1 bis 9 darstellt.
n	Platzhalter (Metazeichen), der eine einzelne Ziffer von 2 bis 9 darstellt.
*	(Sternchen-Symbol) Wenn es das einzige Zeichen in der Regel ist, fungiert es als Platzhalter (Metazeichen), der eine beliebige Anzahl von Ziffern oder Buchstaben darstellt (d.h. passt zu allem).

### Benutzerverwaltung (nur Administratoren)



### Token-Verwaltung (nur Administratoren)
