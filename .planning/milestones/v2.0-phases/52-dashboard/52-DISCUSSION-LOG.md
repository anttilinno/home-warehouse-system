# Phase 52: Dashboard — Discussion Log

**Session:** 2026-04-11
**Mode:** Interactive discuss-phase

---

## Area 1: Workspace context

**Q: How should frontend2 get and store the workspace ID?**
Options: Add to AuthContext on login / localStorage + hook / Fetch at dashboard level
→ **Selected: Add to AuthContext on login**

**Q: What should happen if the user has no workspace yet?**
Options: Redirect to setup page / Show empty states / Claude decides
→ **Selected: Redirect to a setup page (deferred — implement redirect now, setup page is future phase)**

---

## Area 2: Stats panel content

**Q: Which stats should appear as HUD panels?**
Options: 3 panels (Items, Categories, Locations) / 5 panels / All 9
→ **Selected: 3 panels — Items, Categories, Locations (exactly per DASH-01)**

**Q: How should stat panels be visually structured?**
Options: Large number + label below / Icon + number + label / Claude decides
→ **Selected: Large number + label below (monospace number, uppercase label)**

---

## Area 3: Activity feed format

**Q: How should each activity entry be formatted?**
Options: Monospace log line `[HH:MM] ACTION entity_type: entity_name` / Icon badge + sentence / Claude decides
→ **Selected: Monospace log line format**

**Q: How many entries, and refresh mechanism?**
Options: 10 static / 20 static / 10 + auto-refresh 30s
→ **Selected (Other): Last 10 entries, refresh via SSE**

**Q: How should the SSE connection work?**
Options: Connect on dashboard mount, disconnect on unmount / Global SSE in App / Claude decides
→ **Selected: Connect on dashboard mount, disconnect on unmount — re-fetch activity on any SSE event**

---

## Area 4: Quick-action card behavior

**Q: What should cards do when clicked (routes don't exist yet)?**
Options: Navigate to stub routes / Disabled "coming soon" / Link to frontend1
→ **Selected: Navigate to stub routes (/items, /loans, /scan)**

**Q: Should stub routes also appear in the sidebar?**
Options: Yes — add Items and Loans to sidebar / No — sidebar stays as Phase 51 left it
→ **Selected: Yes — add Items and Loans to sidebar (Dashboard, Items, Loans, Settings order)**
