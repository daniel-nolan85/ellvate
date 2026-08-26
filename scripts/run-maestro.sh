#!/usr/bin/env bash
set -euo pipefail

mode="${1:-disabled}"
flow="${2:-maestro/flows/smoke/cold-launch.yaml}"
device="${MAESTRO_DEVICE:-}"
port="${EXPO_PORT:-8081}"
log_file="${MAESTRO_METRO_LOG:-/tmp/llv-maestro-metro.log}"

if [[ "$mode" != "disabled" && "$mode" != "clerk" ]]; then
  echo "usage: scripts/run-maestro.sh <disabled|clerk> <flow-or-directory>" >&2
  exit 2
fi

if command -v lsof >/dev/null 2>&1; then
  while read -r pid; do
    [[ -z "$pid" ]] || kill "$pid" 2>/dev/null || true
  done < <(lsof -tiTCP:"$port" -sTCP:LISTEN || true)
fi

metro_env=(EXPO_PUBLIC_MAESTRO_AUTH_MODE=clerk BACKEND_AUTH_MODE=clerk)
if [[ "$mode" == "disabled" ]]; then
  metro_env=(EXPO_NO_DOTENV=1 EXPO_PUBLIC_MAESTRO_AUTH_MODE=disabled BACKEND_AUTH_MODE=demo)
fi
if [[ "${MAESTRO_PROFILE_SYNC_FAIL_ONCE:-}" == "true" ]]; then
  metro_env+=(EXPO_PUBLIC_MAESTRO_PROFILE_SYNC_FAIL_ONCE=true)
fi

(env -u MAESTRO_PROFILE_SYNC_FAIL_ONCE "${metro_env[@]}" bun run start -- --clear --localhost --port "$port" >"$log_file" 2>&1) &
metro_pid=$!
cleanup() {
  kill "$metro_pid" 2>/dev/null || true
}
trap cleanup EXIT

for attempt in {1..60}; do
  if curl --silent --fail "http://127.0.0.1:${port}" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$metro_pid" 2>/dev/null; then
    cat "$log_file" >&2
    exit 1
  fi
  sleep 1
done

if [[ -n "$device" ]] && command -v xcrun >/dev/null 2>&1; then
  xcrun simctl terminate "$device" com.ellvate.app >/dev/null 2>&1 || true
  xcrun simctl openurl "$device" "http://127.0.0.1:${port}" >/dev/null
fi

run_flow() {
  local target="$1"
  local maestro_args=(test "$target")
  if [[ -n "$device" ]]; then
    maestro_args+=(--device "$device")
  fi
  maestro "${maestro_args[@]}"
}

if [[ -d "$flow" ]]; then
  while IFS= read -r target; do
    run_flow "$target"
  done < <(find "$flow" -maxdepth 1 -type f -name '*.yaml' -print | sort)
else
  run_flow "$flow"
fi
