# reffy-ts

Local-first references server for Node projects with optional Linear sync.

## Install

Recommended usage in another Node project:

```bash
npm install github:RoskiDeluge/reffy-ts
```

The install runs this package's `prepare` step, which builds `dist/` automatically.

Then inside that project:

```bash
npx reffy init
```

This creates/updates `AGENTS.md` and inserts the managed Reffy block in the correct location.

Create your local environment file:

```bash
cp .env.example .env
```

You can run the server with:

```bash
node node_modules/reffy-ts/dist/server.js
```

On first startup, `.references/` structure is bootstrapped automatically.

## Develop

For local development of this repo itself:

```bash
npm install
```

```bash
npm run dev
```

## Build + Run

```bash
npm run build
npm start
```

The server defaults to `http://127.0.0.1:8787`.


## API Endpoints

- `GET /health`
- `GET /references`
- `POST /references`
- `GET /references/:artifact_id`
- `PATCH /references/:artifact_id`
- `DELETE /references/:artifact_id`
- `GET /references/:artifact_id/download`
- `POST /references/reindex`
- `POST /sync/push`
- `POST /sync/pull`

## CLI

```bash
npm run build
node dist/cli.js init --repo .
```

If installed in another project as a dependency:

```bash
npx reffy init
```

Or install globally and use `reffy init`.

`reffy init` behavior:
- Creates `AGENTS.md` if it does not exist.
- Inserts/updates the managed Reffy block.
- If `<!-- OPENSPEC:START -->` exists, the Reffy block is placed above it.

## Environment Variables

See `.env.example` for a complete example configuration.

- `LINEAR_API_KEY` (optional; required if `LINEAR_OAUTH_TOKEN` is not set)
- `LINEAR_OAUTH_TOKEN` (optional; required if `LINEAR_API_KEY` is not set)
- `LINEAR_TEAM_ID` (optional; auto-picks first team when omitted)
- `LINEAR_PROJECT_ID` (optional)
- `LINEAR_PULL_CREATE=1` (optional; enables importing unlinked labeled issues)
- `LINEAR_PULL_LABEL=reffy-ts` (required only when `LINEAR_PULL_CREATE=1`)
- `LINEAR_PUSH_LABEL=reffy-ts` (optional; defaults to `reffy-ts`, set empty to disable labeling)
- `LINEAR_PULL_ON_START=1` (optional)
- `LINEAR_WATCH=1` (optional)
- `LINEAR_WATCH_PUSH=1` (optional)
- `LINEAR_WATCH_REINDEX=1` (optional)
- `LINEAR_WATCH_DEBOUNCE=1.0` (optional)
- `LINEAR_PULL_CREATE_CONFLICTS=1` (optional; set `0` to disable conflict-copy creation on pull)
- `HOST=127.0.0.1` (optional)
- `PORT=8787` (optional)

Auth notes:
- Use either `LINEAR_API_KEY` or `LINEAR_OAUTH_TOKEN`.
- If both are set, `LINEAR_OAUTH_TOKEN` is used first.
- API key is simplest for single-user/local use; OAuth token is typically used for app-based/user-authorized flows.
