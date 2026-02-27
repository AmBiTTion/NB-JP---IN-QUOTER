# FOB Quotation System v2.6.5

A desktop quotation tool for export business, built with Electron + React + TypeScript.

## Features
- FOB quotation workflow (input -> calculation -> result)
- Product / packaging / factory data maintenance
- External quotation Excel export
- Local persistence with `LowDB` (`data.json`)

## Tech Stack
- Electron
- React + TypeScript + Vite
- LowDB

## Getting Started
```bash
npm install
npm run dev
```

## Project Structure
- `src/`: Renderer process (React UI)
- `src/components/`: UI modules (Admin, page-level components)
- `src/utils/`: Calculation helpers, labels, shared UI logic
- `src/types/`: TypeScript domain models and shared types
- `src/ui/`: Theme/provider layer (Mantine and UI theme wrappers)
- `electron/`: Electron main/preload process code
- `electron/exporters/`: Export implementations (Excel quotation export)
- `resources/`: Static resources (templates, icons, logo)
- `public/`: Frontend static assets
- `scripts/`: Utility scripts (backup and project maintenance scripts)
- `_backups/`: Generated backup snapshots
- `data.json`: Main local data source (products/settings/rules)
- `dist-electron/`: Built Electron output
- `run.bat`: Windows quick start script
- `run_hidden.vbs`: Hidden launch script (no visible PowerShell window)

## Version
- `v2.6.5` (current)

## Signatures
- Codex // GPT-5 Engineering Edition
- ONDLE - created in Phoebetai (2026)
