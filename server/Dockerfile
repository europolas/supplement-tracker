FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm ci --omit=dev \
 && npx playwright install --with-deps --only-shell chromium \
 && apt-get install -y --no-install-recommends fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
COPY src ./src
COPY schema.sql ./schema.sql
COPY scripts ./scripts
COPY migrations ./migrations
USER node
EXPOSE 3000
CMD ["node", "src/server.mjs"]
