# Scène Pulse — PRD

## Problem Statement (original)
> Crée moi une application de planification de concerts, spectacles et résidences d'artistes

## User Choices
- Usage personnel, pas d'authentification
- Toutes les fonctionnalités dans une seule page (Dashboard avec onglets) + Calendrier séparé
- Upload d'images et de PDFs
- Langue : française

## Architecture
- **Backend** : FastAPI + MongoDB (collections : `artists`, `venues`, `events`, `files`)
- **Frontend** : React + Tailwind + shadcn/ui + Sonner
- **Stockage** : Emergent Object Storage (via EMERGENT_LLM_KEY) pour affiches, photos, riders, contrats
- **Design** : Dark brutalist/editorial (Cabinet Grotesk + IBM Plex Sans + JetBrains Mono), accent orange `#FF5A00`

## User Persona
Un·e programmateur·rice culturel·le gérant personnellement une saison : concerts, spectacles, résidences artistiques, fiches artistes, lieux, documents de production.

## Core Requirements (static)
1. Gérer les artistes (fiche + photo)
2. Gérer les lieux/salles (capacité, scène)
3. Planifier des événements typés (concert, spectacle, résidence) avec statut, cachet, lieu et artistes
4. Stocker affiches (images) + fiches techniques & contrats (PDF)
5. Calendrier mensuel coloré par type d'événement
6. UI française, dark brutalist

## What's Been Implemented (v1 — Feb 2026)
- [x] Backend REST complet `/api/artists`, `/api/venues`, `/api/events` (+ filtre `?type=`)
- [x] Upload + download de fichiers via Emergent Object Storage (`/api/upload`, `/api/files/{id}`, `/api/files/{id}/info`)
- [x] Endpoint `/api/stats` (événements, à venir, résidences, artistes, lieux, cachets confirmés)
- [x] Dashboard avec 4 onglets (Événements, Résidences, Artistes, Lieux)
- [x] Page Calendrier séparée (vue mois, nav prev/next/today, code couleur)
- [x] Sélection multi-artistes, dialogs shadcn, toasts Sonner, design brutalist
- [x] Résidences multi-jours affichées sur toutes les dates du range
- [x] Tests complets : 100 % backend (pytest) + 100 % frontend (Playwright)

## Backlog
### P1 (valeur immédiate)
- Export PDF du planning (feuille de route semaine / mois)
- Vue semaine et vue jour dans le calendrier
- Duplication d'un événement (récurrence simple)
- Budgets consolidés (recettes vs cachets) par période
- Recherche globale (tous onglets)
- Drag & drop des événements dans le calendrier

### P2 (confort)
- Migrer FastAPI `@app.on_event` vers `lifespan`
- Passer les appels storage synchrones à `httpx.AsyncClient`
- Ajouter `DialogDescription` aux dialogs (a11y)
- Thème clair optionnel
- Export CSV des événements / artistes

### P0 restants
- Aucun

## Next Tasks
1. Collecter feedback utilisateur sur le flow actuel
2. Prioriser P1 selon les besoins concrets (export planning vs vue semaine)
