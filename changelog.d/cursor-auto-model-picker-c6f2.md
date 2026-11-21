### Added

- Claude Auto and Codex Auto (`auto` model id) pick subscription model tier and reasoning effort per turn. Quota step-down uses cached account usage snapshots (80% / 95% thresholds). Fable is excluded from auto selection. See `FORK.md`.
- `OPENBOT_RELEASES_URL` on `install-server.sh` and the fork upstream sync workflow for `miguel-release` and `ghcr.io/miguelfrasco/openbot` builds.