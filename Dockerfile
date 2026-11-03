# Build once, serve the static site with nginx. docker build -t mission-control . && docker run -p 8080:80 mission-control
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
