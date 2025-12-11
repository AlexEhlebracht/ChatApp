# --- Build Stage ---
FROM node:18 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# --- Serve Stage ---
FROM pierrezemb/gostatic
COPY --from=builder /app/dist /srv/http
CMD ["-port","8080","-https-promote","-enable-logging","-fallback","/index.html"]
