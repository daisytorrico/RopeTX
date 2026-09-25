FROM node:22-alpine

WORKDIR /app

# Variables de entorno inyectadas durante la compilación de Vite
ARG VITE_BACKEND_URL=http://localhost:8000
ARG VITE_WS_BACKEND_URL=ws://localhost:8000
ARG VITE_ADMIN_TOKEN=AdminSecret2026

ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_WS_BACKEND_URL=$VITE_WS_BACKEND_URL
ENV VITE_ADMIN_TOKEN=$VITE_ADMIN_TOKEN

COPY package*.json ./
RUN npm install --no-audit

COPY . .
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "start"]
