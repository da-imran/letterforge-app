# Shared packages (lib/)

This directory is reserved for shared internal packages consumed by both `packages/server` and `packages/dashboard` (e.g. shared types, API contracts, validation schemas).

To add a new shared package:
```bash
mkdir lib/<package-name>
cd lib/<package-name>
npm init -y
# name it e.g. "@letterforge-app/<package-name>" and set "private": true
```

Then consume it from another package:
```json
// packages/<consumer>/package.json
"dependencies": {
  "@letterforge-app/<package-name>": "workspace:*"
}
```

The root `package.json` already declares `lib/*` as a workspace, so no further config is needed.

Currently empty — the dashboard keeps its own `src/types` and `src/lib/api.ts` to match the legacy structure. Extract shared code here when the duplication becomes painful.
