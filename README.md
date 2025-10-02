# chvm — Chromium Version Manager

A lightweight CLI tool for managing multiple Chromium versions on macOS (ARM/Apple Silicon).

## ⚠️ Development Status

**chvm is currently unstable.** We recommend using it via npx to automatically get bug fixes:

```bash
alias chvm="npx -y chvm"
```

Add this alias to your `~/.zshrc` or `~/.bashrc` to make it permanent.

## Requirements

- macOS with ARM (Apple Silicon)
- Node.js >= 18.0.0
- unzip command // brew install unzip

## Quick Start

```bash
# Update available versions list
chvm update # will take a few minutes

# List versions
chvm ls

# Install and open a version
chvm open latest

# Install specific version
chvm install 92.0.4515.159

# Open with CORS disabled (for development)
chvm open 92 --disable-cors

# Uninstall a version
chvm uninstall 92.0.4515.159
```

## Features

- ✅ Install and manage multiple Chromium versions
- ✅ Separate profiles per version
- ✅ Everything stored in `~/.chvm` (no system pollution)
- ✅ CORS disable support for development

## Commands

| Command | Description |
|---------|-------------|
| `chvm update [--force]` | Update list of available versions |
| `chvm ls [--json]` | List available and installed versions |
| `chvm install <version>` | Install a version (version number, revision, or latest/oldest) |
| `chvm open <version> [--disable-cors]` | Open a version (auto-installs if needed) |
| `chvm uninstall <version> [--force]` | Uninstall a version |

## License

MIT

---

Made with ❤️ for developers
