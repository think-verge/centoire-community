SHELL := /bin/bash
AGENT_VENV := ai-agent/.venv

.PHONY: ui backend agent agent-install install openapi seed help

## Start the React dev server (port 5173)
ui:
	cd ui && npm run dev

## Start the Node.js/Express backend in watch mode (port 8000)
backend:
	cd backend && npm run dev

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
	@echo "  make openapi  — Regenerate API client"
	@echo "  make seed     — Seed the database"
	@echo ""
