SHELL := /bin/bash
AGENT_VENV := ai-agent/.venv

.PHONY: ui backend jobs-api jobs-web agent agent-install install openapi seed help

## Start the React dev server (port 5173)
ui:
	cd ui && npm run dev

## Start the Node.js/Express backend in watch mode (port 8000)
backend:
	cd backend && npm run dev

## Start the Jobs API in watch mode (port 8010). No-op until apps/jobs/api exists.
jobs-api:
	@if [ -d apps/jobs/api ]; then npm run dev -w @centoire/jobs-api; \
	else echo "jobs-api: apps/jobs/api not created yet (planned for P6), nothing to run"; fi

## Start the Jobs web app (port 5174). No-op until apps/jobs/web exists.
jobs-web:
	@if [ -d apps/jobs/web ]; then npm run dev -w @centoire/jobs-web; \
	else echo "jobs-web: apps/jobs/web not created yet (planned for P4/P7), nothing to run"; fi

## Create venv and install Python deps if needed
agent-install:
	test -d $(AGENT_VENV) || python3 -m venv $(AGENT_VENV)
	$(AGENT_VENV)/bin/pip install -r ai-agent/requirements.txt

## Start the FastAPI AI agent with hot-reload (port 8001)
agent: agent-install
	cd ai-agent && . .venv/bin/activate && uvicorn app.main:app --reload --port 8001

## Install all dependencies (Node + Python)
install: agent-install
	npm install

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
	@echo "  make jobs-api — Jobs API               (localhost:8010)"
	@echo "  make jobs-web — Jobs web app           (localhost:5174)"
	@echo "  make agent    — FastAPI AI agent     (localhost:8001)"
	@echo "  make install  — Install all deps"
	@echo "  make openapi  — Regenerate API client"
	@echo "  make seed     — Seed the database"
	@echo ""
