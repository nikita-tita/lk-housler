#!/bin/bash

# Find all .tsx files in the apps/lk directory
FILES=$(find apps/lk -name "*.tsx")

for f in $FILES
do
  # Replace component imports
  sed -i.bak "s|@housler/ui|@/components|g" "$f"

  # Clean up backup files
  rm -f "${f}.bak"
done

echo "Component import revert complete."
