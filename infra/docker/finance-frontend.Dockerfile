FROM node:22-alpine AS build

WORKDIR /app
COPY frontend-v2/package.json frontend-v2/package-lock.json ./
RUN npm ci

COPY frontend-v2/ ./
ARG NEXT_BASE_PATH=/finance
ENV NEXT_BASE_PATH=${NEXT_BASE_PATH}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next

EXPOSE 3000
CMD ["npm", "run", "start"]
