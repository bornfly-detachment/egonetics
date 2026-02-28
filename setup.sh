#!/bin/bash

echo "🚀 Setting up Egonetics project..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
    
    # Make scripts executable
    chmod +x init-git.sh
    
    echo ""
    echo "🎉 Setup complete!"
    echo ""
    echo "To start the development server:"
    echo "  npm run dev"
    echo ""
    echo "To initialize Git repository:"
    echo "  ./init-git.sh"
    echo ""
    echo "Open http://localhost:3000 after starting dev server"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi