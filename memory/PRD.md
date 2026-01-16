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

### Telecaller's Desk
- Lead assignment and call tracking
- Status management (No Response, Interested, Not Interested, Callbacks)
- Call statistics by date range

### Telecaller Statistics (NEW)
- Dedicated analytics page at /dashboard/telecaller-statistics
- Visual charts: Calls Per Day (Area chart), Telecaller Performance (Bar chart), Status Distribution (Pie chart)
- Summary cards: Total Calls, Total Leads, Highly Interested, No Response, Not Interested, Callbacks
- Daily Summary table with filtering by telecaller
- Individual Telecaller Report cards
- Date range selection
- "Send Daily Report" button for manual Slack reports

### Slack Integration (NEW)
- Configurable in Settings page
- Webhook URL configuration for Slack channel
- Automated daily reports at 8 PM (scheduled task)
- Report format:
  ```
  Angelin's Report:
  Total leads = 82
  Calls done = 37
  No Response = 11
  Highly Interested = 1
  ```
- Enable/disable toggle
- Customizable report time

### Montra Vehicle Insights
- Vehicle tracking and analytics
- Monthly Ride Tracking feature (in progress - checkbox bug)

### Other Features
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
- Scheduler: APScheduler for automated tasks
- External APIs: Google Geocoding API, Slack Webhooks

## Recent Updates (Jan 2026)

### Payment Data Extractor Enhancements
- Added Jan 2026 folder for new month support
- Added manual entry fields for Driver Name and Vehicle Number in processing modal
- Fixed Create Folder dialog visibility in folder-selection view

### Telecaller Statistics Page
- New dedicated page with comprehensive analytics
- Charts showing calls per day, telecaller performance, status distribution
- Summary cards with key metrics
- Filterable daily summary table
- Individual telecaller report cards

### Slack Integration
- Settings page configuration for Slack webhook
- Automated 8 PM daily reports (via APScheduler)
- Manual report sending from Statistics page

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
