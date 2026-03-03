## Maintenance Agent MVP

Web-first MVP for routing tenant maintenance requests directly to contractors with minimal property manager involvement.

Dev Identity Mode is enabled for early testing.

Habit B — Fast “what’s running” check
lsof -nP -iTCP:3000,3001 -sTCP:LISTEN

Terminal 1 — API

cd apps/api
npm run start:dev


Terminal 2 — Web

cd apps/web
npm run dev