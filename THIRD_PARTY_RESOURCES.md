# FleetYield AI — Third-Party Resources & Licensing Disclosures

**Document Version:** 1.0  
**Context:** SAMARTHA Hackathon — Travel Software Enhancement (TBS FleetOS)  
**Verification Date:** 2026-10-10  

This document provides a complete, honest inventory of all third-party libraries, runtime packages, fonts, icons, and components utilized in FleetYield AI. No closed-source models, proprietary templates, or external cloud API keys are used.

---

## 1. Inventory of Third-Party Resources

| Resource Name | Version | Type | Where Used | License | Source URL | Modifications Made | Required at Runtime |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Python** | 3.14.3 | Runtime | Backend execution environment | PSF License | https://www.python.org/ | None | Yes |
| **FastAPI** | 0.141.1 | Python Library | Backend REST routing, middleware, and request handling | MIT | https://fastapi.tiangolo.com/ | None | Yes |
| **Starlette** | 1.6.0 | Python Library | ASGI framework underneath FastAPI | BSD-3-Clause | https://www.starlette.io/ | None | Yes |
| **Uvicorn** | 0.52.4 | Python Library | ASGI web server hosting FastAPI | BSD-3-Clause | https://www.uvicorn.org/ | None | Yes |
| **Pydantic** | 2.13.5 | Python Library | Data validation and JSON schema definitions | MIT | https://docs.pydantic.dev/ | None | Yes |
| **SQLite3** | 3.50.4 | Database Engine | Embedded local relational storage (`fleetyield.db`) | Public Domain | https://www.sqlite.org/ | None (Standard Library) | Yes |
| **Pytest** | 9.1.1 | Python Library | Automated unit and integration test runner | MIT | https://pytest.org/ | None | No (Test only) |
| **Node.js** | 24.20.0 | Runtime | Frontend build and bundling environment | MIT | https://nodejs.org/ | None | No (Build only) |
| **React** | 19.0.0 | JS Library | Frontend user interface framework | MIT | https://react.dev/ | None | Yes |
| **React-DOM** | 19.0.0 | JS Library | DOM renderer for React | MIT | https://react.dev/ | None | Yes |
| **Vite** | 6.2.0 | Build Tool | Frontend bundling, development server, and TypeScript compilation | MIT | https://vite.dev/ | Configured proxy to backend `/api` | No (Build only) |
| **TypeScript** | 5.7.2 | Language | Static type checking for frontend code | Apache-2.0 | https://www.typescriptlang.org/ | Configured strict type checking | No (Build only) |
| **Lucide React** | 0.475.0 | Icon Library | UI iconography across navigation, status badges, and cards | ISC / MIT | https://lucide.dev/ | None | Yes |
| **Google Fonts (Inter)** | Web Font | Typography | Main user interface font | SIL Open Font License (OFL) 1.1 | https://fonts.google.com/specimen/Inter | Loaded via Google Fonts CDN in `index.html` | Yes |
| **Google Fonts (JetBrains Mono)** | Web Font | Typography | Code snippets, numeric fares, and IDs | Apache-2.0 | https://fonts.google.com/specimen/JetBrains+Mono | Loaded via Google Fonts CDN in `index.html` | Yes |
| **TailAdmin Free Dashboard** | UI Pattern | Design Reference | Sidebar layout, date range selector, and notification dropdown pattern | MIT | https://github.com/TailAdmin/free-react-tailwind-admin-dashboard | Re-implemented as original React + CSS components | No (Inspiration only) |
| **Horizon UI React** | UI Pattern | Design Reference | White card system, subtle borders, compact KPI card layout, and donut breakdown | MIT | https://github.com/horizon-ui/horizon-tailwind-react | Re-implemented as original React + CSS components | No (Inspiration only) |
| **Bus Booking System (realarpan)** | Domain Model | Domain Reference | Bus schedule, route conventions, seat inventory layouts | MIT | https://github.com/realarpan/bus-booking-system | Re-implemented with SQLite persistence & FleetOS schemas | No (Inspiration only) |

---

## 2. Resources NOT Used (Explicit Out-of-Scope Disclosures)

- **No Proprietary UI Templates:** All CSS styles, layouts, card components, tables, and modal dialogs are original Vanilla CSS implementations created for this project.
- **No External Cloud AI APIs:** All demand classifications and price recommendations are computed locally using deterministic Python rule modules (`demand_classifier.py` and `pricing_policy.py`). No OpenAI, Anthropic, or external inference APIs are invoked at runtime.
- **No Third-Party Ticketing Connectors:** No real-world ticketing, reservation, payment, or GPS APIs (such as TheBusStand live production endpoints) are connected. All prototype state changes are saved strictly within local SQLite storage.
- **No External Datasets:** All starter records were generated synthetically and are clearly marked as `Synthetic demo data`.
