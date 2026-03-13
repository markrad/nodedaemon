#!/bin/sh
set -e

# Rebuild trust store in case any have been added in compose or run
echo updating certificates
update-ca-certificates

# Continue to the container's CMD
exec "$@"
