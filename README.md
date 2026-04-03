# AudioCodes Routing Server

A web-based routing management server for AudioCodes SBCs. Provides a REST API and web UI for managing call routing rules, user authentication with optional 2FA (TOTP), role-based access control, and token-based API access.

## Quick Start with Docker Compose

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed

### 1. Clone the repository

```bash
git clone git@github.com:akandor/RoutingServer.git
cd RoutingServer
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Edit `.env` and set a strong password for `POSTGRES_PASSWORD`.

### 3. Start the services

```bash
docker compose up -d
```

This starts two containers:

| Service    | Description               | Port Mapping        |
|------------|---------------------------|---------------------|
| **app**    | Routing Server (Node.js)  | `3111` -> `3000`    |
| **postgres** | PostgreSQL 15 database  | `5432` -> `5432`    |

The app also exposes HTTPS on port **3443** (configurable via the web UI).

### 4. Access the web UI

Open [http://localhost:3111](http://localhost:3111) in your browser.

**Default credentials:**

| Username | Password   | Role  |
|----------|------------|-------|
| admin    | admin123   | Admin |
| user     | user123    | User  |

> **Important:** Change the default passwords after first login.

## Docker Compose Example

If you want to deploy without cloning the repo, create a `docker-compose.yaml` file:

```yaml
services:
  app:
    image: ghcr.io/akandor/routingserver:latest
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3111:3000"
      - "3443:3443"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    container_name: routing_server_postgres_db
    restart: always
    env_file:
      - .env
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  pgdata:
```

Then create a `.env` file alongside it (see [Environment Variables](#environment-variables) below) and run `docker compose up -d`.

## Environment Variables

| Variable            | Description                  | Default            |
|---------------------|------------------------------|--------------------|
| `POSTGRES_HOST`     | PostgreSQL hostname          | `postgres`         |
| `POSTGRES_PORT`     | PostgreSQL port              | `5432`             |
| `POSTGRES_USER`     | PostgreSQL username          | `pgroutinguser`    |
| `POSTGRES_PASSWORD` | PostgreSQL password          | *(required)*       |
| `POSTGRES_DB`       | PostgreSQL database name     | `routingserverdb`  |
| `PORT`              | HTTP listen port (internal)  | `3000`             |
| `HTTPS_PORT`        | HTTPS listen port (internal) | `3443`             |

## Data Persistence

The following volumes are mounted to preserve data across container restarts:

| Volume         | Container Path                  | Purpose                     |
|----------------|----------------------------------|-----------------------------|
| `./data`       | `/app/data`                     | Application data (SQLite fallback) |
| `./uploads`    | `/app/uploads`                  | User avatars and uploads    |
| `pgdata`       | `/var/lib/postgresql/data`      | PostgreSQL database files   |

## Updating

Pull the latest image and recreate the containers:

```bash
docker compose pull
docker compose up -d
```

## Building from Source

If you prefer to build the Docker image locally:

```bash
docker build -t routingserver .
```

Then update `docker-compose.yaml` to use your local image:

```yaml
services:
  app:
    image: routingserver
    # build: .    # alternative: uncomment to build on `docker compose up --build`
```

### Running without Docker

```bash
# Install dependencies
yarn install

# Start the server
yarn start
```

Requires Node.js 20+ and a running PostgreSQL instance. Configure connection details in `.env`.

## CI/CD

The repository includes a GitHub Actions workflow (`.github/workflows/docker-publish.yml`) that automatically builds and publishes the Docker image to GitHub Container Registry:

- **On push to `main`**: publishes `ghcr.io/akandor/routingserver:latest`
- **On version tags** (e.g. `v1.0.0`): publishes `ghcr.io/akandor/routingserver:1.0.0`

To pull the image manually:

```bash
docker pull ghcr.io/akandor/routingserver:latest
```

## License

ISC
