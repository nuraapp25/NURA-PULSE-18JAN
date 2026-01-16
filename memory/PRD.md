# Nura Pulse - Product Requirements Document

## Overview
Nura Pulse is a comprehensive data management and insights dashboard for logistics and fleet operations.

## Core Features

### Payment Data Extractor
- AI-powered payment screenshot analysis using GPT-4o-mini
- Folder-based organization by month/year
- Manual and dropdown entry for Driver Name and Vehicle Number
- Sync to Google Sheets
- Batch processing of up to 10 screenshots simultaneously

### Nura Express
- OCR and geocoding for delivery data
- Hotspot matching and distance calculation
- Ops Name selection in processing modal
- Google Maps direction links in exports

### Hex Hotspots
- Integrated analytics app for hexagonal grid analysis
- H3-based location clustering
- Raw data export with Hex IDs and distances
- Yard-to-Pickup/Drop distance calculations

### Driver Onboarding
- Lead management with multi-stage pipeline
- Status tracking (S1-S4 stages)
- "Churn" and "Quick Churn" status support
- RNR (Reached - No Response) count in S1 summary
- Import from CSV/XLSX with smart column mapping

### Montra Vehicle Insights
- Vehicle tracking and analytics
- Monthly Ride Tracking feature (in progress)

### Other Features
- Telecaller's Desk
- Supply Plan
- Expense Tracker
- Hotspot Planning
- QR Code Manager
- Ride Deck Data Analysis

## Tech Stack
- Frontend: React with Shadcn/UI components
- Backend: FastAPI (Python)
- Database: MongoDB
- AI Integration: OpenAI GPT-4o-mini via Emergent LLM Key
- External APIs: Google Geocoding API

## Recent Updates (Jan 2026)

### Payment Data Extractor Enhancements
- Added Jan 2026 folder for new month support
- Added manual entry fields for Driver Name and Vehicle Number in processing modal
- Fixed Create Folder dialog visibility in folder-selection view

## Known Issues

### Monthly Ride Tracking (P0)
- Vehicle selection checkboxes not working in MonthlyRideTracking.jsx
- Previous fix attempts using label wrapping and div onClick both failed
- Root cause: Radix UI Checkbox component event handling

## Backlog

### P1 Tasks
- Fix Monthly Ride Tracking vehicle selection bug
- Address ESLint warnings from Hex Hotspots TS-to-JS conversion

### P2 Tasks
- Add utilization statistics to Supply Plan page
- Refactor h3Helper.js (900+ lines)
- Refactor DriverOnboardingPage.jsx (monolithic component)
