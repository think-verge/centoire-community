.PHONY: ui backend agent install openapi seed help

## Start the React dev server (port 5173)
ui:
	cd ui && npm run dev

## Start the Node.js/Express backend in watch mode (port 8000)
backend:
	cd backend && npm run dev

## Start the FastAPI AI agent with hot-reload (port 8001)
agent:
	cd ai-agent && uvicorn app.main:app --reload --port 8001

## Install all dependencies
install:
	cd backend && npm install
	cd ui && npm install
	cd ai-agent && pip install -r requirements.txt

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
