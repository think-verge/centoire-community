#!/usr/bin/env bash
# Runs the dev NATS server (JetStream) so that it stops when its terminal / tmux pane goes away.
#
# Why a wrapper: nats-server treats SIGHUP as "reload config". `tmux kill-session` (./centmux kill) sends
# SIGHUP to the pane, so a bare nats-server logs a reload error and keeps running in the background,
# and the next start fails with "bind: address already in use". This script traps the signal and stops it.
#
# Env: NATS_PORT (default 4222), NATS_STORE (default .data/nats, relative to the repo root).
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
PORT="${NATS_PORT:-4222}"
STORE="${NATS_STORE:-.data/nats}"

if (echo >"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
  echo "nats: port $PORT is already in use." >&2
  echo "      If it is a leftover Centoire NATS, run ./centmux kill (it stops leftovers too)," >&2
  echo "      or: pkill -f 'nats-server -js -sd $STORE'" >&2
  exit 1
fi

mkdir -p "$STORE"
nats-server -js -sd "$STORE" -p "$PORT" &
pid=$!
trap 'kill -TERM "$pid" 2>/dev/null' HUP INT TERM
wait "$pid"
code=$?
wait "$pid" 2>/dev/null   # a trapped signal interrupts the first wait: reap the child before exiting
exit "$code"
