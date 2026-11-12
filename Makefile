SHELL := /bin/bash
AGENT_VENV := ai-agent/.venv

.PHONY: ui ui-platform backend core agent agent-install install platform-install nats gateway notifications search recsys openapi seed help

## Start the React dev server (port 5173)
ui:
	cd ui && npm run dev

## Start the Node.js/Express backend in watch mode (port 8000)
backend:
	cd backend && npm run dev

# ---- Platform mode (gateway + NATS + extracted services) --------------------------------
# Ports: gateway 8100 (public) / 8101 (internal), core 8000, notifications 8111, search 8112, recsys 8004, NATS 4222.
export NATS_URL ?= nats://127.0.0.1:4222

## Install + build workspace packages (@centoire/*) and service deps
platform-install:
	npm install

## NATS with JetStream (event bus + service registry); stops cleanly when its pane is closed
nats:
	./scripts/nats.sh

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
recsys:
	cd services/recsys && npm run dev

## React dev server proxied through the gateway instead of straight to the monolith
ui-platform:
	cd ui && API_PROXY_TARGET=http://localhost:8100 npm run dev

## Create venv and install Python deps if needed
agent-install:
	test -d $(AGENT_VENV) || python3 -m venv $(AGENT_VENV)
	$(AGENT_VENV)/bin/pip install -r ai-agent/requirements.txt

## Start the FastAPI AI agent with hot-reload (port 8001)
agent: agent-install
	$(AGENT_VENV)/bin/uvicorn app.main:app --port 8001 --reload --app-dir ai-agent

## Run all linters and tests (Node packages + services)
test:
	npm test
	npm run typecheck

## Regenerate OpenAPI spec and typed API client
openapi:
	cd backend && npm run openapi
	cd ui && npm run api:refresh

## Seed local database (monolith mode)
seed:
	cd backend && npm run seed

## Help
help:
	@echo "Centoire Community make targets:"
	@echo "  make platform-install  Install & build monorepo packages"
	@echo "  make nats              Start NATS server on port 4222"
	@echo "  make gateway           Start API gateway on port 8100"
	@echo "  make core              Start core backend on port 8000"
	@echo "  make notifications     Start notifications service on port 8111"
	@echo "  make search            Start search service on port 8112"
	@echo "  make recsys            Start recommendation service on port 8004"
	@echo "  make ui-platform       Start UI dev server proxied via gateway"
	@echo "  make agent             Start FastAPI AI agent on port 8001"
