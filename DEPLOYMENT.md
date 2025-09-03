# MrxDown - Deployment Guide

## Overview

This document provides comprehensive guidance for deploying MrxDown across all supported platforms using automated GitHub Actions workflows.

## Supported Platforms & Artifacts

### macOS (Universal Binary)
- **Architecture**: Intel (x64) + Apple Silicon (arm64) 
- **Formats**: 
  - `MrxDown-{version}.zip` - Recommended for quick installation
  - `MrxDown-{version}.dmg` - Disk image with drag-to-Applications setup
- **Requirements**: macOS 10.11 (El Capitan) or later
- **Installation**: 
  1. Download ZIP or DMG
  2. For ZIP: Extract and move to Applications folder
  3. For DMG: Mount and drag to Applications
  4. **Security Note**: Right-click → "Open" for unsigned builds

### Windows
- **Architecture**: x64 and ia32 (32-bit)
- **Formats**:
  - `MrxDown Setup {version}.exe` - NSIS installer with desktop shortcuts
  - `MrxDown {version}.exe` - Portable executable (no installation required)
- **Requirements**: Windows 7 SP1 or later
- **Features**:
  - Desktop shortcuts creation
  - Start menu integration
  - Per-user installation (no admin rights required)
  - Clean uninstallation with data removal option

### Linux
- **Architecture**: x64 and arm64
- **Formats**:
  - `MrxDown-{version}.AppImage` - Universal Linux binary (recommended)
  - `MrxDown_{version}_amd64.deb` - Debian/Ubuntu packages
  - `MrxDown_{version}_amd64.snap` - Snap packages
- **Requirements**: glibc 2.17+ (Ubuntu 14.04+, CentOS 7+)
- **Desktop Integration**: Automatic .desktop file registration

## GitHub Actions Workflows

### Build Workflow (.github/workflows/build.yml)
- **Trigger**: Push to main/develop, Pull Requests
- **Purpose**: Continuous integration testing
- **Artifacts**: Build artifacts with 7-day retention
- **Features**:
  - Multi-platform matrix builds (macOS, Windows, Ubuntu)
  - Node.js 20 LTS with NPM caching
  - Enhanced Linux dependencies for Electron
  - Build verification and error handling
  - Virtual display (Xvfb) support for Linux

### Release Workflow (.github/workflows/release.yml)
- **Trigger**: Git tags (v*) or manual dispatch
- **Purpose**: Production releases
- **Features**:
  - Automated multi-platform builds
  - GitHub Release creation with changelog
  - Artifact upload with 30-day retention
  - Comprehensive error handling and logging

## Deployment Process

### Automated Release (Recommended)

1. **Update Version**:
   ```bash
   npm version patch|minor|major
   ```

2. **Create Release Tag**:
   ```bash
   git push origin main --tags
   ```

3. **Monitor Workflow**:
   - Check GitHub Actions tab for build status
   - Each platform builds in parallel (~10-15 minutes total)
   - Artifacts are automatically attached to GitHub Release

### Manual Build (Development)

```bash
# Install dependencies
npm install

# Build for current platform
npm run build

# Build for all platforms (requires platform-specific tools)
npm run build-all

# Platform-specific builds
npm run build-mac      # macOS
npm run build-win      # Windows  
npm run build-linux    # Linux
```

## Code Signing & Security

### macOS
- **Current Status**: Builds are unsigned (development)
- **For Production**: 
  - Set up Apple Developer account
  - Configure GitHub Secrets: `CSC_LINK`, `CSC_KEY_PASSWORD`
  - Enable notarization: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
  - Update `package.json`: `"notarize": true`

### Windows
- **Current Status**: Builds are unsigned
- **For Production**:
  - Obtain code signing certificate
  - Configure GitHub Secrets: `CSC_LINK`, `CSC_KEY_PASSWORD`
  - Update workflow with signing configuration

### Linux
- **Status**: No signing required
- **AppImage**: Includes built-in integrity verification

## Build Configuration

### Key Files
- `package.json` - Electron Builder configuration
- `assets/entitlements.mac.plist` - macOS security entitlements
- `.github/workflows/` - CI/CD pipeline definitions

### Environment Variables
```bash
# Build optimization
ELECTRON_CACHE=~/.cache/electron
ELECTRON_BUILDER_CACHE=~/.cache/electron-builder
DEBUG=electron-builder

# Security (disable for unsigned builds)
CSC_IDENTITY_AUTO_DISCOVERY=false
```

## Troubleshooting

### Common Issues

1. **macOS "App is damaged" error**:
   - Use `xattr -cr MrxDown.app` to clear quarantine
   - Or right-click → "Open" to bypass Gatekeeper

2. **Windows SmartScreen warning**:
   - Click "More info" → "Run anyway"
   - Consider code signing for production

3. **Linux AppImage not executable**:
   ```bash
   chmod +x MrxDown-*.AppImage
   ```

4. **Build failures**:
   - Check GitHub Actions logs for detailed error messages
   - Verify Node.js version compatibility (use 20 LTS)
   - Ensure all dependencies are installed

### Performance Optimization

- **Caching**: NPM and Electron Builder caches are enabled
- **Parallel Builds**: Matrix strategy builds all platforms simultaneously
- **Artifact Compression**: Automatic compression for faster downloads
- **Incremental Builds**: Only rebuild when necessary

## Release Checklist

- [ ] Update version number in `package.json`
- [ ] Update changelog in `README.md`
- [ ] Test locally on target platforms
- [ ] Create and push version tag
- [ ] Monitor GitHub Actions workflow
- [ ] Verify artifacts in GitHub Release
- [ ] Test installation on clean systems
- [ ] Update download links if necessary

## Monitoring & Metrics

- **Build Status**: GitHub Actions dashboard
- **Download Stats**: GitHub Release insights
- **Error Tracking**: GitHub Issues for user reports
- **Platform Coverage**: Automated testing across OS matrix

---

**Last Updated**: 2025-09-03  
**MrxDown Version**: 0.2.0  
**Maintainer**: Martin Pfeffer (@pepperonas)