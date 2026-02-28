#!/bin/bash

# Initialize Git repository
echo "Initializing Git repository..."
git init

# Add all files
echo "Adding files to Git..."
git add .

# Initial commit
echo "Creating initial commit..."
git commit -m "feat: initial commit - Egonetics Life Core Interface

- Hash chain chronicle implementation
- Tamper-evident record system
- Bornfly Theory integration
- Task management interface
- Modern React + TypeScript + Tailwind UI
- Zustand state management
- Web Crypto API for hashing"

echo ""
echo "✅ Git repository initialized!"
echo ""
echo "Next steps:"
echo "1. Create repository on GitHub: https://github.com/bornfly-detachment/egonetics"
echo "2. Add remote: git remote add origin https://github.com/bornfly-detachment/egonetics.git"
echo "3. Push: git push -u origin main"
echo ""
echo "To start development:"
echo "  npm run dev"