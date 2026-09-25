#!/bin/sh
set -e

# Substitute only $PORT and $VITE_API_BASE_URL so nginx's own $uri/$request_uri
# variables are untouched — same mechanism as rgmc-consignment-webapp.
envsubst '$PORT $VITE_API_BASE_URL' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Validate the generated config before attempting to start
nginx -t

# exec replaces the shell so nginx becomes PID 1 and receives Cloud Run's SIGTERM
exec nginx -g 'daemon off;'
