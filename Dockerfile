FROM node:22-alpine

RUN apk add --no-cache \
    chromium nss freetype harfbuzz ca-certificates \
    ttf-freefont font-noto-cjk curl patch

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

COPY . .

ENV VITE_ANALYTICS_ENDPOINT=
ENV VITE_ANALYTICS_WEBSITE_ID=

RUN pnpm build

CMD ["sh", "-c", "pnpm db:push && pnpm start"]

EXPOSE 3000
