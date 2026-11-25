FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/static ./static
COPY --from=builder /app/CLAUDE.md ./CLAUDE.md
COPY --from=builder /app/secrets.csv.example ./secrets.csv.example
RUN mkdir -p /app/data /app/backups
EXPOSE 3000
CMD ["node", "build"]
