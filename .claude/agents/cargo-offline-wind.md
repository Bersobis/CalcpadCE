# Offline Cargo builds for `calcpad-desktop`

When `cargo run` in `Calcpad.Web/frontend/calcpad-desktop/src-tauri` fails with:

```
error: failed to download from `https://static.crates.io/crates/<crate>/...`
Caused by:
  [6] Could not resolve hostname (Could not resolve host: static.crates.io)
```

it usually means the build needs a crate it does not already have cached, and DNS for `static.crates.io` is currently unreachable from this machine.

## How the desktop build already avoids network churn

- The Tauri sidecar and the .NET backend are published by `desktop.mjs dev` through `sync-bundled-server`.
- `sync-bundled-server` publishes the backend with `dotnet publish ... --no-self-contained`, so it reuses the installed .NET runtime instead of downloading one.
- The Rust side is compiled by `cargo run --no-default-features --color always --`.
- `src-tauri/Cargo.toml` already sets `[net] git-fetch-with-cli = true` and `protocol = "https"` so Cargo uses HTTPS + CLI git fetching where relevant.

## What to try first

1. Retry the build once. Transient DNS failures can clear on a second attempt.
2. If it still fails on the same crate, check whether the crate is already cached on the machine. If it is, the failure may be a temporary download retry issue rather than a missing dependency.

## If you need a fully offline Tauri build

Do not guess at offline fallbacks. If this machine must build without reaching crates.io at all, verify:

- which crates are missing from the local cache
- whether the project's build already has those crates available through another path
- whether any part of the Tauri build expects to fetch something at compile time

If that verification is worth doing, say so and I can inspect the Cargo cache and the current build error precisely.

## Anti-noise note

The long `warning: spurious network error` loop is Cargo retrying the same download. It is not a project bug by itself. The actionable part is the final `error: failed to download` for the crate it ultimately could not fetch.

## Related cleanup rule

Do not add a rule that wipes Cargo downloads because a build failed with a crates.io DNS error. That error is a networking problem during a build, not “agent junk.” The Calcpad agent-cleaner pack targets session artifacts, scratch pads, and logs — not working dependency caches.
