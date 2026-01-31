#!/bin/bash
# Sharkbait Install Script
# Usage: curl -fsSL https://raw.githubusercontent.com/shyamsridhar123/sharkbait/main/install.sh | bash

set -e

REPO="shyamsridhar123/sharkbait"
INSTALL_DIR="${SHARKBAIT_INSTALL_DIR:-$HOME/.sharkbait/bin}"

# Detect OS and architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "$OS" in
        darwin) OS="darwin" ;;
        linux) OS="linux" ;;
        mingw*|msys*|cygwin*) OS="windows" ;;
        *) echo "Unsupported OS: $OS"; exit 1 ;;
    esac
    
    case "$ARCH" in
        x86_64|amd64) ARCH="x64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    
    echo "${OS}-${ARCH}"
}

# Get latest release version
get_latest_version() {
    curl -sL "https://api.github.com/repos/${REPO}/releases/latest" | \
        grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/'
}

main() {
    echo "🦈 Installing Sharkbait..."
    echo ""
    
    PLATFORM=$(detect_platform)
    echo "Detected platform: $PLATFORM"
    
    VERSION=$(get_latest_version)
    if [ -z "$VERSION" ]; then
        VERSION="v1.0.0"
    fi
    echo "Version: $VERSION"
    
    # Create install directory
    mkdir -p "$INSTALL_DIR"
    
    # Determine binary extension
    EXT=""
    if [[ "$PLATFORM" == windows* ]]; then
        EXT=".exe"
    fi
    
    BINARY_NAME="sharkbait-${PLATFORM}${EXT}"
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}"
    
    echo "Downloading from: $DOWNLOAD_URL"
    
    # Download binary
    curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/sharkbait${EXT}"
    chmod +x "${INSTALL_DIR}/sharkbait${EXT}"
    
    echo ""
    echo "✓ Installed to: ${INSTALL_DIR}/sharkbait${EXT}"
    echo ""
    
    # Add to PATH instructions
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo "Add the following to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo ""
        echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
        echo ""
    fi
    
    echo "🦈 Sharkbait installed successfully!"
    echo "Run 'sharkbait' to get started."
}

main "$@"
