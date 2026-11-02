SHELL := /bin/bash
AGENT_VENV := ai-agent/.venv

.PHONY: ui ui-platform backend core agent agent-install install platform-install nats gateway notifications search openapi seed help

## Start the React dev server (port 5173)
ui:
	cd ui && npm run dev

## Start the Node.js/Express backend in watch mode (port 8000)
backend:
	cd backend && npm run dev

# ---- Platform mode (gateway + NATS + extracted services) --------------------------------
# Ports: gateway 8100 (public) / 8101 (internal), core 8000, notifications 8111, search 8112, NATS 4222.
export NATS_URL ?= nats://127.0.0.1:4222

## Install + build workspace packages (@centoire/*) and service deps
platform-install:
	npm install

## NATS with JetStream (event bus + service registry)
nats:
	mkdir -p .data/nats && nats-server -js -sd .data/nats

## Edge gateway: routes /api/v1/* to whichever service announced the prefix
gateway:
	cd services/gateway && npm run dev

## The monolith as a registered service; notifications are owned by the extracted service
core:
	cd backend && NOTIFICATIONS_EXTERNAL=true npm run dev

## Extracted services
notifications:
	cd services/notifications && npm run dev
search:
	cd services/search && npm run dev

## React dev server proxied through the gateway instead of straight to the monolith
ui-platform:
	cd ui && API_PROXY_TARGET=http://localhost:8100 npm run dev

## Create venv and install Python deps if needed
agent-install:
	test -d $(AGENT_VENV) || python3 -m venv $(AGENT_VENV)
	$(AGENT_VENV)/bin/pip install -r ai-agent/requirements.txt

## Start the FastAPI AI agent with hot-reload (port 8001)
agent: agent-install
	cd ai-agent && . .venv/bin/activate && uvicorn app.main:app --reload --port 8001

## Install all dependencies (Node + Python)
install: agent-install
	cd backend && npm install
	cd ui && npm install

## Regenerate OpenAPI spec + frontend client (run after backend schema changes)
openapi:
	cd backend && npm run openapi
	cd ui && npm run api:refresh

## Seed the database with initial data
seed:
	cd backend && npm run seed

help:
	@echo ""
	@echo "  make ui       — React dev server     (localhost:5173)"
	@echo "  make backend  — Express API server   (localhost:8000)"
	@echo "  make agent    — FastAPI AI agent     (localhost:8001)"
	@echo "  make install  — Install all deps"
	@echo "  -- platform mode: make nats gateway core notifications search ui-platform --"
	@echo "  make platform-install — Install workspace packages + services"
	@echo "  make openapi  — Regenerate API client"
	@echo "  make seed     — Seed the database"
	@echo ""
