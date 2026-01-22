#!/bin/bash

# Find all .tsx files in the apps/lk directory
FILES=$(find apps/lk -name "*.tsx")

for f in $FILES
do
  # Replace lib imports
  sed -i.bak "s|@housler/lib|@/lib|g" "$f"

  # Clean up backup files
  rm -f "${f}.bak"
done

echo "Lib import revert complete."
