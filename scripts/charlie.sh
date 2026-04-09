#!/bin/bash
# Charlie the Cache Exorcist v1.0
# Summon when the build ghosts haunt you
echo "🧟 Charlie summoned. Exorcising cache ghosts..."
npm cache clean --force
rm -rf node_modules package-lock.json
rm -rf ~/Library/Caches/eas-cli
rm -rf ~/.eas
npm install
echo "✨ Cache exorcised. Ready to build."
echo "Next: npx eas-cli build --platform ios --profile production --clear-cache"