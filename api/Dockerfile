# Build
FROM golang:1.22-alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/accounting-api .

# Run
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata \
  && adduser -D -H -u 10001 appuser

COPY --from=builder /out/accounting-api /app/accounting-api
COPY --from=builder /src/migrations /app/migrations

ENV APP_ENV=prod \
    APP_PORT=8080 \
    TZ=Asia/Tehran

RUN mkdir -p /app/assets/product && chown -R appuser:appuser /app/assets

EXPOSE 8080

USER appuser

CMD ["/app/accounting-api"]
