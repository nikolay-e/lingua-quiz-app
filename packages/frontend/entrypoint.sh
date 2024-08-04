#!/bin/sh
set -e

# Check if SSL cert and key are provided
if [ ! -f "/etc/nginx/ssl/cert.pem" ] || [ ! -f "/etc/nginx/ssl/key.pem" ]; then
    echo "Error: SSL certificate and/or key not found in /etc/nginx/ssl/"
    echo "Please provide both cert.pem and key.pem"
    exit 1
fi

# Replace the placeholder with the actual HTTPS_PORT
if [ -z "$HTTPS_PORT" ]; then
    echo "Error: HTTPS_PORT environment variable is not set"
    exit 1
fi

sed -i "s/HTTPS_PORT_PLACEHOLDER/${HTTPS_PORT}/g" /etc/nginx/nginx.conf.template
mv /etc/nginx/nginx.conf.template /etc/nginx/nginx.conf

# Execute the CMD
exec "$@"
