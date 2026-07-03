#!/bin/sh
# Launch wrapper. Prepends a user-local Node install (~/node/bin) to PATH so
# harnesses/CI that spawn with a minimal PATH can still resolve node/vite. On
# machines without ~/node this prefix is a harmless no-op and npm resolves normally.
export PATH="$HOME/node/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
exec npm run dev
