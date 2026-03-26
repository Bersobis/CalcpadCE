#!/bin/bash

# Build script for CalcPad Desktop (Neutralino + .NET server)
# Detects OS/arch, builds the .NET server with correct SkiaSharp/Playwright
# assets, finds system browser, and packages via Neutralino CLI.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*"; }

# ─── Resolve paths ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$SCRIPT_DIR"
FRONTEND_DIR="$(dirname "$DESKTOP_DIR")"
BACKEND_DIR="$FRONTEND_DIR/../backend"
REPO_ROOT="$(cd "$FRONTEND_DIR/../.." && pwd)"
EXTENSIONS_DIR="$DESKTOP_DIR/extensions/server"

# ─── Detect OS and Architecture ─────────────────────────────────────────────
detect_platform() {
    local os arch

    case "$(uname -s)" in
        Linux*)  os="linux" ;;
        Darwin*) os="osx" ;;
        MINGW*|MSYS*|CYGWIN*) os="win" ;;
        *)
            err "Unsupported OS: $(uname -s)"
            exit 1
            ;;
    esac

    case "$(uname -m)" in
        x86_64|amd64)  arch="x64" ;;
        aarch64|arm64) arch="arm64" ;;
        *)
            err "Unsupported architecture: $(uname -m)"
            exit 1
            ;;
    esac

    DOTNET_RID="${os}-${arch}"
    PLATFORM_OS="$os"
    PLATFORM_ARCH="$arch"

    info "Detected platform: ${DOTNET_RID}"
}

# ─── Find system browser for Playwright ─────────────────────────────────────
find_browser() {
    local candidates=()

    case "$PLATFORM_OS" in
        linux)
            candidates=(
                chromium
                chromium-browser
                google-chrome-stable
                google-chrome
                microsoft-edge-stable
                microsoft-edge
            )
            ;;
        osx)
            candidates=(
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                "/Applications/Chromium.app/Contents/MacOS/Chromium"
                "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
            )
            # Also check brew-installed chromium
            if command -v chromium &>/dev/null; then
                BROWSER_PATH="$(command -v chromium)"
                return 0
            fi
            ;;
        win)
            # On Windows (MSYS/Git Bash), check common install paths
            candidates=(
                "/c/Program Files/Google/Chrome/Application/chrome.exe"
                "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
                "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
                "/c/Program Files/Microsoft/Edge/Application/msedge.exe"
            )
            ;;
    esac

    for candidate in "${candidates[@]}"; do
        if [[ "$candidate" == /* ]]; then
            # Absolute path
            if [ -x "$candidate" ]; then
                BROWSER_PATH="$candidate"
                return 0
            fi
        else
            # Command name — resolve via PATH
            local resolved
            resolved="$(command -v "$candidate" 2>/dev/null || true)"
            if [ -n "$resolved" ]; then
                BROWSER_PATH="$resolved"
                return 0
            fi
        fi
    done

    BROWSER_PATH=""
    return 1
}

# ─── Build .NET server ──────────────────────────────────────────────────────
build_server() {
    info "Building Calcpad.Server for ${DOTNET_RID}..."

    if ! command -v dotnet &>/dev/null; then
        err "dotnet CLI not found. Install .NET 10 SDK: https://dotnet.microsoft.com/download"
        exit 1
    fi

    local dotnet_version
    dotnet_version="$(dotnet --version 2>/dev/null || echo 'unknown')"
    info "Using dotnet ${dotnet_version}"

    # Skip Playwright browser download — we use the system browser
    export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

    local csproj="$BACKEND_DIR/Calcpad.Server.csproj"

    info "Restoring NuGet packages..."
    dotnet restore "$csproj" -r "$DOTNET_RID" --verbosity quiet

    info "Publishing self-contained build..."
    dotnet publish "$csproj" \
        -c Release \
        -r "$DOTNET_RID" \
        --self-contained true \
        -o "$EXTENSIONS_DIR" \
        --verbosity quiet

    # Strip platform runtimes we don't need (SkiaSharp ships natives for all platforms)
    if [ -d "$EXTENSIONS_DIR/runtimes" ]; then
        info "Stripping SkiaSharp native assets for other platforms..."
        local kept=0 removed=0
        for dir in "$EXTENSIONS_DIR/runtimes"/*/; do
            local rid_name
            rid_name="$(basename "$dir")"
            if [[ "$rid_name" == "$DOTNET_RID" || "$rid_name" == "${PLATFORM_OS}" ]]; then
                kept=$((kept + 1))
            else
                rm -rf "$dir"
                removed=$((removed + 1))
            fi
        done
        ok "Kept ${kept} runtime(s), removed ${removed} unused runtime(s)"
    fi

    # Strip Playwright drivers for other platforms
    if [ -d "$EXTENSIONS_DIR/.playwright/node" ]; then
        info "Stripping Playwright drivers for other platforms..."
        for dir in "$EXTENSIONS_DIR/.playwright/node"/*/; do
            local node_rid
            node_rid="$(basename "$dir")"
            if [[ "$node_rid" != "$DOTNET_RID" ]]; then
                rm -rf "$dir"
            fi
        done
    fi

    # Remove debug symbols
    find "$EXTENSIONS_DIR" -name "*.pdb" -delete 2>/dev/null || true

    # Verify the executable
    local exe_name="Calcpad.Server"
    if [ "$PLATFORM_OS" = "win" ]; then
        exe_name="Calcpad.Server.exe"
    fi

    if [ -f "$EXTENSIONS_DIR/$exe_name" ]; then
        local size
        size="$(du -sh "$EXTENSIONS_DIR" | cut -f1)"
        ok "Server built: ${EXTENSIONS_DIR}/${exe_name} (${size})"
    else
        err "Build failed — ${exe_name} not found in ${EXTENSIONS_DIR}"
        exit 1
    fi
}

# ─── Create server launcher wrapper ─────────────────────────────────────────
# The wrapper sets BROWSER_PATH and other env vars before starting the server.
# Neutralino extensions use the command* fields in neutralino.config.json.
create_launcher() {
    info "Creating server launcher..."

    local launcher="$EXTENSIONS_DIR/start-server.sh"

    cat > "$launcher" << 'LAUNCHER_EOF'
#!/bin/bash
# CalcPad Server launcher — sets environment and starts the .NET server
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Browser detection (if BROWSER_PATH not already set)
if [ -z "$BROWSER_PATH" ]; then
    for candidate in chromium chromium-browser google-chrome-stable google-chrome microsoft-edge-stable; do
        resolved="$(command -v "$candidate" 2>/dev/null || true)"
        if [ -n "$resolved" ]; then
            export BROWSER_PATH="$resolved"
            break
        fi
    done
fi

# Default server settings
export CALCPAD_PORT="${CALCPAD_PORT:-9420}"
export CALCPAD_HOST="${CALCPAD_HOST:-localhost}"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

exec "$SCRIPT_DIR/Calcpad.Server" "$@"
LAUNCHER_EOF

    chmod +x "$launcher"

    # Update neutralino.config.json to use the wrapper
    ok "Launcher created: ${launcher}"
}

# ─── Update Neutralino config for current platform ──────────────────────────
update_neutralino_config() {
    info "Updating Neutralino extension config for ${DOTNET_RID}..."

    local config="$DESKTOP_DIR/neutralino.config.json"

    # The config already has commandLinux/commandWindows/commandDarwin
    # For dev, we want to use the launcher wrapper
    case "$PLATFORM_OS" in
        linux)
            # Replace the extension command to use our launcher
            sed -i 's|"commandLinux":.*|"commandLinux": "${NL_PATH}/extensions/server/start-server.sh",|' "$config"
            ;;
        osx)
            sed -i '' 's|"commandDarwin":.*|"commandDarwin": "${NL_PATH}/extensions/server/start-server.sh",|' "$config"
            ;;
    esac

    ok "Neutralino config updated"
}

# ─── Print summary ──────────────────────────────────────────────────────────
print_summary() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  CalcPad Desktop build complete${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Platform:     ${BLUE}${DOTNET_RID}${NC}"
    echo -e "  Server:       ${BLUE}${EXTENSIONS_DIR}/Calcpad.Server${NC}"

    if [ -n "$BROWSER_PATH" ]; then
        echo -e "  Browser:      ${GREEN}${BROWSER_PATH}${NC}"
    else
        echo -e "  Browser:      ${YELLOW}Not found — PDF export will not work${NC}"
        echo -e "                ${YELLOW}Install chromium or set BROWSER_PATH${NC}"
    fi

    echo ""
    echo -e "  ${BLUE}Next steps:${NC}"
    echo -e "    Dev mode:   cd $(basename "$DESKTOP_DIR") && npm run dev"
    echo -e "    Build:      cd $(basename "$DESKTOP_DIR") && npx neu build"
    echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
    echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     CalcPad Desktop Build Script             ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
    echo ""

    detect_platform

    # Find browser
    if find_browser; then
        ok "Found browser: ${BROWSER_PATH}"
    else
        warn "No Chromium/Chrome/Edge found on PATH"
        warn "PDF generation will be unavailable until BROWSER_PATH is set"
    fi

    # Clean previous server build
    if [ -d "$EXTENSIONS_DIR" ]; then
        info "Cleaning previous server build..."
        # Keep .gitkeep
        find "$EXTENSIONS_DIR" -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} + 2>/dev/null || true
    fi
    mkdir -p "$EXTENSIONS_DIR"

    # Build
    build_server
    create_launcher
    update_neutralino_config

    print_summary
}

main "$@"
