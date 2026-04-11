# Internal Developer Platform

A complete, self-hosted Internal Developer Platform (IDP) built on [Backstage](https://backstage.io) and open-source tooling.

Enables **self-service** (software templates, scaffolding), **innersource** (GitHub catalog integration, TechDocs), a **standard RBAC model** (four roles enforced via Backstage's permission framework), and an **MCP server** so AI agents can interact with the platform programmatically.

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        Developer Tools                               │
│   Claude Desktop  ·  Cursor  ·  VS Code  ·  Browser                 │
└────────┬───────────────────┬──────────────────────────────────────────┘
         │ MCP (stdio/SSE)   │ HTTPS
         ▼                   ▼
┌─────────────────┐  ┌────────────────────────────────────────────────┐
│   MCP Server    │  │              Backstage                         │
│  (mcp-server/)  │  │  ┌──────────────┐   ┌──────────────────────┐  │
│                 │  │  │  Frontend    │   │  Backend             │  │
│  search_catalog │  │  │  React SPA   │   │  Node.js             │  │
│  list_templates │  │  │  port 3000   │   │  port 7007           │  │
│  scaffold_service│ │  └──────────────┘   └────────┬─────────────┘  │
│  get_entity     │  │                              │                │
│  register_component    ┌─────────────────────────┤                │
│  check_permission│ │  │  Plugins                 │                │
│  + 6 more tools │  │  │  catalog · scaffolder    │                │
└─────────────────┘  │  │  techdocs · auth         │                │
                     │  │  permissions · search     │                │
                     │  └──────────────────────────┘                │
                     └──────────────────┬─────────────────────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │         PostgreSQL          │
                          │      (catalog data)         │
                          └────────────────────────────┘
                                        │
                          ┌─────────────▼──────────────┐
                          │           GitHub            │
                          │  catalog · auth · templates │
                          └────────────────────────────┘
```

### Components

| Component | Path | Purpose |
| --- | --- | --- |
| Backstage app | `backstage/` | Yarn-workspace monorepo (frontend + backend) |
| MCP server | `mcp-server/` | Exposes IDP as AI-agent tools |
| Templates | `templates/` | Self-service scaffolding templates |
| Catalog | `catalog/` | Platform catalog entities (domain, system, groups) |
| RBAC | `rbac/` | Role definitions and permission matrix |
| Infrastructure | `infrastructure/` | Docker Compose for local dev |
| CI | `.github/workflows/` | GitHub Actions pipelines |

---

## RBAC Model

Four roles are enforced via Backstage's native `PermissionPolicy`. Roles are derived from catalog Group membership.

| Permission | platform-admin | team-lead | developer | guest |
| --- | :---: | :---: | :---: | :---: |
| Catalog read | ✓ | ✓ | ✓ | ✓ |
| Catalog create / refresh | ✓ | ✓ | ✗ | ✗ |
| Catalog delete | ✓ | ✗ | ✗ | ✗ |
| Scaffolder execute | ✓ | ✓ | ✓ | ✗ |
| Scaffolder cancel | ✓ | ✓ | ✓ | ✗ |
| TechDocs read | ✓ | ✓ | ✓ | ✓ |
| TechDocs create | ✓ | ✓ | ✗ | ✗ |
| Search | ✓ | ✓ | ✓ | ✓ |
| All other actions | ✓ | ✗ | ✗ | ✗ |

Groups live in `catalog/catalog-info.yaml`. Add users by adding `members` entries to the Group entities.

Full role definitions: [`rbac/roles.yaml`](rbac/roles.yaml)

---

## Self-Service Templates

Three templates are included out of the box:

| Template | Path | What it creates |
| --- | --- | --- |
| Microservice | `templates/microservice/` | GitHub repo, Dockerfile, CI workflow, catalog entry |
| Shared Library | `templates/library/` | GitHub repo, package scaffold, catalog entry |
| Documentation Site | `templates/docs-site/` | GitHub repo, MkDocs site, TechDocs catalog entry |

Templates are registered automatically via `app-config.yaml`. To add your own, drop a `template.yaml` into `templates/` and add its URL to the `catalog.locations` list.

---

## MCP Server

The `mcp-server/` directory contains a standalone MCP server that exposes the IDP as tools for AI agents (Claude Desktop, Cursor, VS Code with Continue, etc.).

### Tools

| Tool | Description |
| --- | --- |
| `search_catalog` | Full-text search across all catalog entities |
| `get_entity` | Fetch a single entity by kind/namespace/name |
| `list_entities` | List entities with kind and label filters |
| `get_system` | Get a system and all its components |
| `list_apis` | List APIs with optional type filter |
| `list_teams` | List all Group entities |
| `register_component` | Register a repo via its catalog-info.yaml URL |
| `list_templates` | List available scaffolding templates |
| `scaffold_service` | Trigger a template to create a new service |
| `get_scaffolder_task` | Poll a scaffolder task for status/logs |
| `get_techdocs` | Get TechDocs metadata for an entity |
| `check_permission` | Check whether the token has a given permission |

### Claude Desktop configuration

```json
{
  "mcpServers": {
    "idp": {
      "command": "node",
      "args": ["/absolute/path/to/developer-platform/mcp-server/index.js"],
      "env": {
        "BACKSTAGE_BASE_URL": "http://localhost:7007",
        "BACKSTAGE_TOKEN": "dev-token"
      }
    }
  }
}
```

---

## Installation

### Prerequisites

- Docker and Docker Compose v2+
- A GitHub account and organisation
- Node.js ≥ 20 (for local MCP server use only)

### 1. Clone the repo

```bash
git clone https://github.com/<your-org>/developer-platform.git
cd developer-platform
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in every value:

| Variable | Description |
| --- | --- |
| `ORGANIZATION_NAME` | Display name shown in Backstage |
| `GITHUB_ORG` | GitHub org slug (e.g. `acme-corp`) |
| `POSTGRES_USER` | Postgres user (default: `backstage`) |
| `POSTGRES_PASSWORD` | Postgres password — change in production |
| `GITHUB_TOKEN` | PAT with `repo`, `read:org`, `read:user` scopes |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `BACKSTAGE_TOKEN` | Static token used by the MCP server |

#### Create a GitHub OAuth App

Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**:

- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:7007/api/auth/github/handler/frame`

Copy the Client ID and generate a Client Secret into your `.env`.

### 3. Start the stack

```bash
docker compose -f infrastructure/docker-compose.yml up -d
docker compose -f infrastructure/docker-compose.yml logs -f backstage
```

Backstage will be available at:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:7007`

### 4. Bootstrap the MCP server

```bash
cd mcp-server
npm install
```

Then add the [Claude Desktop config](#claude-desktop-configuration) shown above.

---

## How-To Guides

### Add a team

1. Edit [`catalog/catalog-info.yaml`](catalog/catalog-info.yaml).
2. Add a new `Group` entity with `spec.type: team` and list `spec.members`.
3. Assign a role by placing the group in the appropriate parent group (`platform-admins`, `team-leads`, or `developers`).
4. Commit and push — Backstage will ingest the change on the next catalog refresh.

### Register an existing service

Option A — via UI: navigate to **Create → Register Existing Component** and paste the raw URL to the repo's `catalog-info.yaml`.

Option B — via MCP tool:

```text
register_component(
  catalog_url: "https://github.com/acme-corp/my-service/blob/main/catalog-info.yaml"
)
```

Option C — add a `catalog.locations` entry to `backstage/app-config.yaml`:

```yaml
catalog:
  locations:
    - type: url
      target: https://github.com/acme-corp/my-service/blob/main/catalog-info.yaml
```

### Create a new microservice via template

1. In Backstage, click **Create** and choose the **Microservice** template.
2. Fill in the parameters (name, owner, language, etc.).
3. Backstage will create the GitHub repo, push a skeleton, and register the component.

Or via MCP:

```text
list_templates()                          # discover available templates
scaffold_service(
  template_name: "microservice",
  values: {
    name: "payment-gateway",
    owner: "group:default/payments-team",
    description: "Handles payment processing",
    repoName: "payment-gateway",
    language: "typescript"
  }
)
get_scaffolder_task(task_id: "<id>")      # poll until complete
```

### Add a software template

1. Create a directory under `templates/` with `template.yaml` and a `skeleton/` directory.
2. Follow the [Backstage template schema](https://backstage.io/docs/features/software-templates/).
3. Register it in `backstage/app-config.yaml` under `catalog.locations`.
4. Commit, push, and refresh the catalog.

### Promote a developer to team-lead

Edit `catalog/catalog-info.yaml`:

```yaml
# Find the team-leads group and add the user's entity ref
spec:
  members:
    - user:default/alice
    - user:default/bob       # <-- add here
```

Backstage permission decisions update on the next catalog sync (default: every 3 minutes).

### Production deployment

1. Set `IDP_HOST` in `.env` and uncomment the production block.
2. Copy `backstage/app-config.production.yaml` — it sets `https` backend URLs and an S3 TechDocs publisher.
3. Set `TECHDOCS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCOUNT_ID`.
4. Build the Docker image:

   ```bash
   docker build -t idp-backstage:latest backstage/
   ```

5. Push to your container registry and deploy via your orchestration platform (ECS, EKS, Cloud Run, etc.).

---

## Development

### Run Backstage locally (without Docker)

```bash
cd backstage
cp ../env.example ../.env   # if not already done
yarn install
yarn dev                    # starts frontend (3000) + backend (7007) concurrently
```

### Project structure

```text
developer-platform/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions: build, lint, docker, yaml-validate
├── backstage/
│   ├── app-config.yaml        # Base Backstage config
│   ├── app-config.production.yaml
│   ├── Dockerfile             # Multi-stage production image
│   ├── package.json           # Yarn workspaces root
│   └── packages/
│       ├── app/               # React frontend
│       │   └── src/
│       │       ├── App.tsx
│       │       └── index.tsx
│       └── backend/           # Node.js backend
│           └── src/
│               ├── index.ts
│               └── plugins/
│                   └── permission.ts   # IDPPermissionPolicy
├── catalog/
│   └── catalog-info.yaml      # Platform domain, system, and groups
├── infrastructure/
│   └── docker-compose.yml     # Postgres + Backstage
├── mcp-server/
│   ├── index.js               # 12-tool MCP server
│   └── package.json
├── rbac/
│   └── roles.yaml             # Human-readable role definitions
├── templates/
│   ├── microservice/          # Microservice template + skeleton
│   ├── library/               # Shared library template + skeleton
│   └── docs-site/             # Documentation site template + skeleton
├── .env.example
└── README.md
```

---

## CI/CD

GitHub Actions runs on every push and pull request to `main`:

| Job | Trigger | What it does |
| --- | --- | --- |
| `backstage-backend` | push + PR | `yarn tsc` + `yarn build` |
| `backstage-frontend` | push + PR | `backstage-cli package lint` |
| `mcp-server` | push + PR | `npm install` + `node --check` |
| `docker` | push to main only | Docker Buildx build (no push) |
| `validate-yaml` | push + PR | `yamllint` over all catalog/template YAML |

---

## Contributing

1. Fork the repo and create a feature branch.
2. Make your changes — templates, catalog entries, RBAC rules, or MCP tools.
3. Ensure CI passes (`yarn tsc`, `yarn build`, `yamllint`).
4. Open a pull request with a description of what changed and why.

---

## License

MIT
