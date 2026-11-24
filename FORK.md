# Miguel's OpenBot fork

This repository tracks [nightly-labs/openbot](https://github.com/nightly-labs/openbot) and adds a small set of fork-only features. Upstream stays the reference for security fixes and releases.

## What differs from upstream

| Area | Upstream | This fork |
| --- | --- | --- |
| Auto model | Pick a fixed model per agent | **Claude Auto** and **Codex Auto** (`model` id `auto`) pick model tier and reasoning effort per turn on subscription providers |
| `install-server.sh` | Downloads from `nightly-labs/openbot` releases | Honors `OPENBOT_RELEASES_URL` so a server can install fork builds |
| Release branch | `main` only | `miguel-release` fast-forwards when [Fork upstream sync](.github/workflows/fork-upstream-sync.yml) succeeds |
| Container image | `ghcr.io/nightly-labs/openbot` | `ghcr.io/miguelfrasco/openbot` on successful sync |
| GitHub Releases | Upstream publishes all desktop targets | This fork publishes **linux arm64** AppImage, `latest-linux-arm64.yml`, and checksums for Pi and arm64 servers |

License files and PolyForm Noncommercial notices are unchanged.

## Auto model behavior

- **Providers:** Claude Code and Codex (ChatGPT subscription) only. API-key, OpenRouter, and other providers are unchanged.
- **Picker:** Each connected subscription provider lists **Claude Auto** or **Codex Auto** like any other model. CLI: `openbot-cli agent set-model <agent> auto`.
- **Routing:** Before each turn, heuristics (prompt size, code/diff markers, attachments, planning language, tool-heavy cues) pick a tier. Usage-limit and failed-model state from the existing `UsageLimitGate` steps tiers down. Opus and other paid tiers stay allowed; **Fable** is never auto-selected.
- **Stickiness:** Tiers escalate after a failed turn in the same thread. They de-escalate on a new task, not every reply.
- **Failover:** Provider backup models and usage-limit return paths are unchanged. Auto does not switch between Claude and Codex mid-thread.
- **Quota step-down:** Uses the cached provider-account usage snapshot from the last successful usage read (`ProviderRuntime.cachedUsageSnapshot`). Snapshots older than 30 minutes, past their window duration, or after a window reset are ignored. At or above 80% used, Auto steps down one tier; at or above 95%, it picks the cheapest tier.
- **Configuration:** `OPENBOT_AUTO_CLASSIFY=0` disables the borderline tie-break (default is on). **There is no Haiku (or other) classification API call in this fork** — routing is heuristics-only until a later change adds an optional classifier.
- **UI:** No per-message model label. Debug logs use the `auto-model` logger.

## Upstream sync automation

Workflow: `.github/workflows/fork-upstream-sync.yml`

1. Nightly (and manual **workflow_dispatch**), read the newest `v*` tag from upstream.
2. Skip when `miguel-release` already contains that tag and a GitHub Release with assets exists. Use **force** on manual runs to rebuild anyway.
3. Create `auto/<tag>` from the upstream tag and cherry-pick commits on `main` that are not in that tag.
4. Run `bun install --frozen-lockfile`, the 12 Auto model tests, and `bun run typecheck:node`.
5. On success, fast-forward `miguel-release`, push matching tag `v*`, and run the **release** job on **`ubuntu-24.04-arm`** (native arm64).
6. The release job installs Codex, Claude, and Grok provider runtimes (same as upstream Linux arm64), builds `dist:linux:arm64`, checks the package and updater metadata, and publishes a [GitHub Release](https://github.com/miguelfrasco/openbot/releases) with the AppImage, `latest-linux-arm64.yml`, and `SHA256SUMS-linux-arm64.txt` (`install-server.sh` and the in-app updater read these).
7. Push `ghcr.io/miguelfrasco/openbot:<tag>`, `:<version>`, and `:latest`.
8. On conflict or test failure, open a GitHub issue labeled `upstream-sync` and leave `miguel-release` unchanged.

## Install from fork builds

### systemd server (Raspberry Pi and other Linux arm64/x86_64)

**Fork build:**

```bash
export OPENBOT_RELEASES_URL=https://github.com/miguelfrasco/openbot/releases
curl -fsSL "https://raw.githubusercontent.com/miguelfrasco/openbot/miguel-release/scripts/install-server.sh" | sudo bash
```

The install script reads `latest/download/latest-linux-arm64.yml` from that releases URL and downloads `OpenBot-<version>-arm64.AppImage`.

**Back to official upstream:**

```bash
unset OPENBOT_RELEASES_URL
curl -fsSL https://raw.githubusercontent.com/nightly-labs/openbot/main/scripts/install-server.sh | sudo bash
sudo openbot update
```

### Docker

**Fork image:**

```bash
docker pull ghcr.io/miguelfrasco/openbot:latest
docker run --detach --name openbot -v openbot-data:/data ghcr.io/miguelfrasco/openbot:latest
```

**Official upstream:**

```bash
docker pull ghcr.io/nightly-labs/openbot:latest
```

Stop the fork container, point your compose file or run command at `ghcr.io/nightly-labs/openbot:latest`, and keep the same `/data` volume only when versions are compatible (match major upstream tags).

## Develop on the fork

```bash
git remote add upstream https://github.com/nightly-labs/openbot.git
git fetch upstream --tags
git checkout main
git rebase upstream/v0.77.0
git cherry-pick <your-fork-commits>
```

Keep feature code in `src/backend/agent/auto-model/` and small integration hooks to ease rebases.