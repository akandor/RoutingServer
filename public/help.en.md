Welcome to the Routing Server Admin Panel!

### Routes Administration

### SBC Configuration

#### Configure the Remote Web Service
The Remote Web Service defines the destination for the HTTP requests, it is used by the IP-to-IP routing rules.

![Remote Web Service](/assets/Remote-Web-Service.png)

- **Path:** clear the default value.
- **Type:** select RoutingServer.
- **Login Needed:** set to Disabled unless you secured your endpoint with authentication. 

Click **HTTP Remote Hosts** at the bottom of the screen and add the routing server host.

![HTTP Remote Host](/assets/HTTP-Remote-Host.png)

Make sure to choose the correct interface and destination port. You should see the status **connected**.

Common issues:

- **NAT** - If the SBC and the routing server communicate over the private IPv4 network and the selected interface has NAT translation rules in place, make sure the chosen port (e.g. 3000) is not within the target port range.
- **Firewall** – make sure that the IPv4 address associated with the selected interface is allowed inbound on the chosen port (e.g. 3000) on the ACL assigned to the server hosting the routing server
- **TLS** – If you are using HTTPS transport, make sure to import trusted root chain for certificated hosted in the routing server into the default SBC tls context.

#### Create IP-to-IP Routing Rules

Create the main routing rule for handling incoming SIP Invites. My setup also includes rules for handling SIP Options, Registrations and rerouting of REFER messages. 

Make sure to select Routing Server as Destination Type (this is what triggers HTTP POST requests).

![IP-to-IP Route](/assets/IP-to-IP-Route.png)

### Routes

Notations:
x	Wildcard (metacharacter) that represents any single digit from 0 through 9.
z	Wildcard (metacharacter) that represents any single digit from 1 through 9.
n	Wildcard (metacharacter) that represents  any single digit from 2 through 9.
*	(Asterisk symbol) If it is the only character in the rule, it functions as a wildcard (metacharacter) that represents any amount of digits or letters (i.e., matches everything).

### User Management (Admins only)



### Token Management (Admins only)