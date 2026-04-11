{%- if values.language == 'nodejs' %}
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build --if-present

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE ${{ values.port }}
CMD ["node", "dist/index.js"]
{%- elif values.language == 'python' %}
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE ${{ values.port }}
CMD ["python", "-m", "app"]
{%- elif values.language == 'go' %}
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /service ./cmd/server

FROM gcr.io/distroless/static:nonroot
COPY --from=builder /service /service
EXPOSE ${{ values.port }}
ENTRYPOINT ["/service"]
{%- elif values.language == 'java' %}
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE ${{ values.port }}
ENTRYPOINT ["java", "-jar", "app.jar"]
{%- endif %}
