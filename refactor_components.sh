#!/bin/bash

# Find all .tsx files in the apps/lk directory
FILES=$(find apps/lk -name "*.tsx")

for f in $FILES
do
  # Replace component imports
  sed -i.bak "s|@/components/deals|@housler/ui|g" "$f"
  sed -i.bak "s|@/components/layout|@housler/ui|g" "$f"
  sed -i.bak "s|@/components/shared|@housler/ui|g" "$f"
  sed -i.bak "s|@/components/ui|@housler/ui|g" "$f"

  # Clean up backup files
  rm -f "${f}.bak"
done

echo "Component import refactoring complete."
