# Mathan ERP frontend

React 19 and Vite frontend for Mathan ERP. Use `npm run dev` for local development or run the complete repository with Docker Compose.

The application calls `/api/v1`; Vite proxies this to the backend. With Docker Compose the backend is exposed on host port `8082`; a locally started Spring Boot backend uses port `8080`. The production Nginx container proxies the API over the Compose network.

For LAN development, Vite listens on port `3001`. Set `VITE_DEV_PROXY_TARGET` and `VITE_DIRECT_API_PORT` to the backend port in `.env`, then restart `npm run dev`.
