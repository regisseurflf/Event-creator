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
- [x] Upload + download de fichiers via Emergent Object Storage
- [x] Dashboard avec 4 onglets (Événements, Résidences, Artistes, Lieux)
- [x] Page Calendrier séparée (vue mois, nav prev/next/today)

## What's Been Implemented (v1.2 — Feb 2026)
- [x] Dashboard épuré : H1 « Planificateur d'événements », suppression du bandeau « Poste de régie », de la baseline, du stat bar et de la mention « Vue d'ensemble en direct »
- [x] **Vue Agenda** (4ᵉ vue du calendrier) : événements du mois groupés par jour, export PDF par événement
- [x] **Export ICS** (`GET /api/export/events.ics?type=&start=&end=`) — bouton `.ics` dans la barre du calendrier, période auto selon la vue (mois / semaine / jour)
- [x] **Drag & drop compatible tactile** : pointer events (mouse + touch/iPad), ghost visuel, mise en surbrillance de la cellule cible, `touch-action:none` sur les pastilles
- [x] **Validation stricte ISO YYYY-MM-DD** côté backend (POST/PUT /events, PATCH /events/{id}/dates) — réponse 422 en cas de date invalide
- [x] Tests : 100 % backend (20/20 pytest) + 100 % frontend

## What's Been Implemented (v1.1 — Feb 2026)
- [x] Rebranding **Scène Pulse → L'Ampli** (header, footer, PDF, API)
- [x] Suppression des champs `cachet`/`devise` et du stat « Cachets confirmés » (remplacé par « Confirmés »)
- [x] **Export PDF** de la feuille de route (`GET /api/events/{id}/roadmap.pdf` via reportlab) : titre, date, lieu + adresse + jauge, fiches artistes, notes de production, loges/backline — bouton présent dans Events, Résidences, Calendrier
- [x] **Vues Semaine / Jour** dans le calendrier (switcher Mois/Semaine/Jour, navigation contextuelle ±1 jour/semaine/mois)
- [x] **Drag & drop** des événements : `PATCH /api/events/{id}/dates` déplace automatiquement `start_date` et `end_date` (résidences multi-jours gardent leur durée)
- [x] Tests : 100 % backend (13/13 pytest) + 100 % frontend

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
