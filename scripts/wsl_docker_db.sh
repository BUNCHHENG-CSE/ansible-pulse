#!/usr/bin/env bash
# ==============================================================================
# TCT AnsiblePulse - WSL Docker PostgreSQL 16 Controller
# Starts, stops, and verifies the production-optimized PostgreSQL database.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env if present
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs -d '\n')
fi

POSTGRES_PORT="${POSTGRES_PORT:-5436}"
POSTGRES_DB="${POSTGRES_DB:-ansible_pulse}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
CONTAINER_NAME="ansiblepulse_postgres"

ensure_docker_running() {
    if ! docker info >/dev/null 2>&1; then
        echo "[*] Starting Docker daemon inside WSL..."
        sudo service docker start || true
        sleep 2
    fi
}

cmd_start() {
    ensure_docker_running
    echo "[*] Launching TCT AnsiblePulse PostgreSQL 16 on port ${POSTGRES_PORT}..."
    cd "$PROJECT_ROOT"
    
    # Check if docker compose is available
    if docker compose version >/dev/null 2>&1; then
        docker compose up -d postgres
    else
        docker-compose up -d postgres
    fi

    echo "[*] Waiting for PostgreSQL database to become healthy..."
    for i in {1..30}; do
        HEALTH=$(docker inspect --format='{{json .State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "not_running")
        if [ "$HEALTH" == "\"healthy\"" ]; then
            echo "[✓] PostgreSQL is HEALTHY and accepting connections on port ${POSTGRES_PORT}!"
            echo "    Database URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
            return 0
        fi
        sleep 1
    done

    echo "[!] Warning: Database container started but did not report healthy in 30s. Checking logs..."
    docker logs "$CONTAINER_NAME" --tail 20
}

cmd_stop() {
    ensure_docker_running
    echo "[*] Stopping TCT AnsiblePulse PostgreSQL container..."
    cd "$PROJECT_ROOT"
    docker compose stop postgres 2>/dev/null || docker stop "$CONTAINER_NAME" || true
    echo "[✓] Database container stopped."
}

cmd_status() {
    ensure_docker_running
    echo "=== TCT AnsiblePulse PostgreSQL Container Status ==="
    docker ps -a --filter "name=$CONTAINER_NAME"
}

cmd_logs() {
    ensure_docker_running
    docker logs "$CONTAINER_NAME" -f --tail 50
}

cmd_psql() {
    ensure_docker_running
    echo "[*] Connecting to PostgreSQL CLI in container..."
    docker exec -it "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
}

case "${1:-start}" in
    start|up)
        cmd_start
        ;;
    stop|down)
        cmd_stop
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs
        ;;
    psql)
        cmd_psql
        ;;
    *)
        echo "Usage: $0 {start|stop|status|logs|psql}"
        exit 1
        ;;
esac
