# Multi-Ecosystem Project

Configuration for a project with both Rust and TypeScript code, publishing to both crates.io and npm.

## Structure

```
.
├── Cargo.toml          # Rust library
├── src/                # Rust source
├── bindings/
│   └── node/           # Node.js bindings (napi-rs or similar)
│       └── package.json
```

## Features

- Releases Rust crate first, then npm package
- Useful for native Node.js modules
- Both packages share version
- Delay between publishes for registry indexing

## Setup

1. Copy both config files to your repo
2. Add both secrets:
   - `CARGO_REGISTRY_TOKEN`
   - `NPM_TOKEN`
3. Adjust paths to match your structure

## Release Order

1. Rust crate published to crates.io
2. Wait 30 seconds
3. Node bindings published to npm

This ensures the Rust crate is available when npm package is installed (if it depends on it).
