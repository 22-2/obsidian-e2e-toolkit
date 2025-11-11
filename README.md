# Obsidian E2E Test Toolkit (Simplified API)

Reusable E2E testing utilities for Obsidian plugins using Playwright.

Primary usage (recommended)
```typescript
import { ObsidianPageObject, test, expect } from "obsidian-e2e-toolkit";

test("basic smoke", async ({ vault }) => {
  const pageObj = new ObsidianPageObject(vault);
  // use pageObj, test and expect for most tests
});
```

Notes
- The library still contains internal helpers (config, launcher, utilities) but they are not exported from the top-level by default to keep the public API small and focused.
- If you need lower-level APIs, import from internal paths during development or extend the toolkit as needed.

Installation
```bash
pnpm add -D obsidian-e2e-toolkit
```

Quick start
1. Add a setup script in package.json:
```json
{
  "scripts": {
    "setup:e2e": "sh node_modules/obsidian-e2e-toolkit/setup.sh"
  }
}
```
2. Run setup:
```bash
pnpm setup:e2e
```
3. Write tests using the simplified import shown above.

License: MIT
