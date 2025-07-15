#!/bin/bash

# MrxDown Setup Script
# This script helps set up the development environment for MrxDown

set -e

echo "🚀 Setting up MrxDown development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm version: $NPM_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create assets directory if it doesn't exist
if [ ! -d "assets" ]; then
    echo "📁 Creating assets directory..."
    mkdir -p assets
fi

# Check if we're on macOS and create placeholder icon files
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [ ! -f "assets/icon.icns" ]; then
        echo "🖼️  Creating placeholder icon.icns..."
        # Create a simple placeholder icon
        # In a real setup, you'd want to replace this with actual icon files
        touch assets/icon.icns
    fi
fi

# Create placeholder icon files for other platforms
if [ ! -f "assets/icon.png" ]; then
    echo "🖼️  Creating placeholder icon.png..."
    touch assets/icon.png
fi

if [ ! -f "assets/icon.ico" ]; then
    echo "🖼️  Creating placeholder icon.ico..."
    touch assets/icon.ico
fi

# Make scripts executable
if [ -f "scripts/version.js" ]; then
    chmod +x scripts/version.js
    echo "✅ Made version script executable"
fi

# Setup complete
echo ""
echo "🎉 Setup complete! You can now:"
echo "   📱 Start the app: npm start"
echo "   🔨 Build for your platform: npm run build"
echo "   🚀 Build for all platforms: npm run build-all"
echo "   📝 Update version: npm run version <version>"
echo ""
echo "📚 For more information, see README.md"
echo "🐛 Report issues at: https://github.com/pepperonas/mrxdown/issues"
echo ""
echo "Happy coding! 🚀"