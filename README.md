# Jora Vendor Portal

This portal uses the shared Jora MongoDB API. It has no database credentials in browser code.

## Local setup

1. Start the shared API in `jora-user-fix/server` with `MONGODB_URI` and JWT secrets configured.
2. Serve this directory from a web server or deploy it over HTTPS.
3. If the API is not on `http://127.0.0.1:4000/api`, set `jora_api_url` in localStorage to its deployed URL before signing in.

The retained vendor interface uses the API for session restore, shop setup, product management, orders, nearby partners and delivery assignment.
