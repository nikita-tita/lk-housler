#!/bin/bash

# Find all .tsx files in the apps/lk directory
FILES=$(find apps/lk -name "*.tsx")

for f in $FILES
do
  # Replace lib imports
  sed -i.bak "s|@/lib/hooks/useAuth|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/admin|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/analytics|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/bank-split|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/contracts|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/deals|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/invitations|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/organizations|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/profile|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/signing|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/users|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/api/auth|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/store/authStore|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/utils/format|@housler/lib|g" "$f"
  sed -i.bak "s|@/lib/utils/redirect|@housler/lib|g" "$f"
  
  # Replace component imports
  sed -i.bak "s|@/components/auth|@housler/ui|g" "$f"

  # Clean up backup files
  rm -f "${f}.bak"
done

echo "Refactoring complete."
