#!/usr/bin/env bash
#
# Inspect and trigger the nightly snapshot on the deployed Worker.
#
#   ./scripts/psx-admin.sh            show the last 20 sync attempts
#   ./scripts/psx-admin.sh dry        run the full decision, write nothing
#   ./scripts/psx-admin.sh sync       run for real and write the snapshot
#
# The password is read from $PSX_PASSWORD if set, otherwise prompted for with
# echo disabled — so it stays out of shell history either way. The session
# cookie goes to a private temp file that is removed on exit.

set -euo pipefail

BASE="${PSX_BASE:-https://psx-portfolio.saadofficial0999.workers.dev}"
ACTION="${1:-runs}"

JAR="$(mktemp)"
chmod 600 "$JAR"
trap 'rm -f "$JAR"' EXIT

if [ -z "${PSX_PASSWORD:-}" ]; then
  printf 'Password for %s: ' "$BASE" >&2
  read -rs PSX_PASSWORD
  printf '\n' >&2
fi

# jq -Rn keeps the password correctly escaped whatever characters it contains.
login_body="$(jq -Rn --arg p "$PSX_PASSWORD" '{password:$p}')"
code="$(curl -sS -o /dev/null -w '%{http_code}' -c "$JAR" \
  -X POST -H 'Content-Type: application/json' \
  -d "$login_body" "$BASE/api/auth/login")"

case "$code" in
  200) ;;
  401) echo "Login failed: wrong password." >&2; exit 1 ;;
  429) echo "Login rate-limited. Wait a few minutes and retry." >&2; exit 1 ;;
  503) echo "Server auth is not configured (SESSION_SECRET / APP_PASSWORD_HASH)." >&2; exit 1 ;;
  *)   echo "Login failed with HTTP $code." >&2; exit 1 ;;
esac

show_runs() {
  curl -sS -b "$JAR" "$BASE/api/admin/runs" | jq -r '
    if length == 0 then
      "No runs recorded yet."
    else
      (["WHEN(UTC)","PKDATE","RAN","REASON","RULE","Q","SRC","KSE","ms"] | @tsv),
      (.[] | [
        (.ran_at // "" | sub("\\.[0-9]+Z$"; "Z")),
        (.pk_date // "-"),
        (if .ran == 1 then "yes" else "no" end),
        (.reason // "-"),
        (.rule // "-"),
        (.quotes // 0 | tostring),
        (.sources // "-"),
        (.kse_source // "-"),
        (.duration_ms // 0 | tostring)
      ] | @tsv)
    end' | column -t -s "$(printf '\t')"

  # Errors are truncated out of the table above; surface them in full so a
  # crashed run is never reduced to a blank column.
  curl -sS -b "$JAR" "$BASE/api/admin/runs" \
    | jq -r '.[] | select(.error != null) | "\nERROR on run #\(.id) at \(.ran_at):\n\(.error)"'
}

case "$ACTION" in
  runs)
    show_runs
    ;;
  dry)
    echo "Dry run (no write):"
    curl -sS -b "$JAR" -X POST "$BASE/api/admin/sync?dry=1&force=1" | jq .
    ;;
  sync)
    echo "Running for real — this writes a snapshot for today's PKT date."
    printf 'Continue? [y/N] '
    read -r confirm
    case "$confirm" in
      [yY]*) curl -sS -b "$JAR" -X POST "$BASE/api/admin/sync?force=1" | jq . ;;
      *) echo "Aborted."; exit 0 ;;
    esac
    ;;
  *)
    echo "Usage: $0 [runs|dry|sync]" >&2
    exit 2
    ;;
esac
