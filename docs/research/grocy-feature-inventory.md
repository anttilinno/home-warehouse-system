# Grocy Feature Inventory

**Research date:** 2026-02-25
**Sources:** GitHub repository (grocy/grocy), grocy.info official website, demo instance (demo.grocy.info), OpenAPI specification, configuration reference, release notes
**Confidence:** High — all major claims cross-referenced across 3+ independent sources (GitHub README, official website, live demo interface, OpenAPI spec)

---

## What is Grocy

Grocy is a self-hosted, open-source, web-based household management application. Its tagline is "ERP beyond your fridge." It is a PHP application backed by SQLite, licensed under MIT, created and maintained by Bernd Bestel. It is not a SaaS product — users run it on their own infrastructure.

The defining characteristic: every feature available in the web UI is equally accessible via a REST API, making the application fully automatable and integration-friendly.

---

## Module Overview

Grocy is structured around discrete, independently toggleable modules. Each module can be disabled via a feature flag if not needed.

| Module | Feature Flag | Purpose |
|---|---|---|
| Stock | `FEATURE_FLAG_STOCK` | Inventory and grocery tracking |
| Shopping List | `FEATURE_FLAG_SHOPPINGLIST` | Purchase planning |
| Recipes | `FEATURE_FLAG_RECIPES` | Recipe management and fulfillment |
| Meal Plan | (sub-feature of recipes) | Calendar-based meal scheduling |
| Chores | `FEATURE_FLAG_CHORES` | Recurring household task tracking |
| Tasks | `FEATURE_FLAG_TASKS` | General to-do management |
| Batteries | `FEATURE_FLAG_BATTERIES` | Battery charge cycle tracking |
| Equipment | `FEATURE_FLAG_EQUIPMENT` | Household device/manual management |
| Calendar | `FEATURE_FLAG_CALENDAR` | Unified calendar view and iCal export |
| Label Printer | `FEATURE_FLAG_LABEL_PRINTER` | Physical label generation |

---

## 1. Stock Management

This is the core module and the most feature-rich.

### Stock Overview

The main stock table displays all products currently in inventory. Visible columns (user-configurable):

- Product name and product group
- Amount in stock
- Monetary value of current stock
- Next due date (earliest expiry across all entries)
- Location
- Status (In stock / Due soon / Overdue / Expired / Below min. stock)
- Calories
- Last purchased date
- Last price paid
- Minimum stock amount
- Product description

Filtering options: by location, by product group, by status.

### Stock Entry Model

Each time a product is purchased it creates a distinct **stock entry** with its own:

- Quantity and quantity unit
- Best-before / expiry date
- Purchase price
- Location
- Open/sealed status
- Note

This means a single product (e.g., "Milk") can have multiple entries with different expiry dates and prices simultaneously — grocy tracks them individually.

### Stock Operations

Each operation is atomic, undoable, and exposed in the API:

- **Purchase / Add**: Record arrival of product into stock. Supports setting price, location, best-before date, and quantity.
- **Consume**: Remove product from stock. Can consume the entry expiring soonest (FEFO — First Expired, First Out) automatically, or from a specific location.
- **Open**: Mark a sealed item as opened. Opened items can have a different "shelf life after opening" countdown separate from the best-before date.
- **Transfer**: Move stock between storage locations without consuming it.
- **Inventory**: Set the absolute quantity of a product to bring records in line with physical count.
- **Undo**: Every individual stock booking can be undone. Entire transactions (multi-booking operations) can also be undone atomically.

### Product Configuration

Each product has a rich set of optional attributes:

- **Quantity units**: A default purchase unit and a default stock unit, with conversion factors defined between them (e.g., "1 pack = 6 bottles"). Multi-level conversion chains are supported and derived conversion factors are calculated automatically.
- **Locations**: A default storage location. Products can be in multiple locations simultaneously.
- **Due date handling**: "Best before date" or "Expiration date" (user chooses the label). Products can be flagged as "never overdue."
- **Due soon threshold**: Per-product configurable "warn me N days before expiry."
- **Shelf life after opening**: Separate countdown starts when a product is marked as opened.
- **Minimum stock amount**: Threshold below which the product appears in "missing" views and can be auto-added to shopping lists.
- **Product image**: Attach a photo to each product.
- **Calories / energy**: Track per-unit energy value.
- **Freezing**: Products can be flagged as frozen, and grocy adjusts due date handling for frozen items.
- **Default consume location**: Optionally consume from a fixed location regardless of global settings.
- **Barcode(s)**: Multiple barcodes can be assigned to one product (handles multi-pack sizes, regional variants, etc.).
- **"Can't be opened" flag**: For products not subject to opened/shelf-life tracking.
- **Default purchase price type**: List price vs. actual paid.
- **Default store**: Associate a product with a preferred retailer.
- **Tare weight handling**: For products weighed by container (e.g., "jar of jam"), grocy can subtract the container tare weight.

### Product Groups and Locations

- Products are organized into **product groups** (user-defined categories).
- **Locations** represent physical storage spots (fridge, freezer, pantry shelf, etc.) and are user-defined.
- Locations can be flagged as freezer locations, which affects due date behavior.

### Price Tracking

- Every purchase optionally records a price.
- A **price history** is maintained per product with a trendline visualization.
- Spending analysis reports aggregate purchase history.

### Quantity Units and Conversions

- Fully custom quantity units (e.g., pieces, grams, liters, boxes, cans).
- Conversion factors defined between units (e.g., "1 kg = 1000 g").
- Multi-level chains resolved automatically (e.g., "pack" -> "bottle" -> "ml").

### Reports

- **Location Content Sheets**: Printable inventory lists per storage location.
- **Spending Analysis**: Historical cost reporting across products and time periods.

---

## 2. Shopping List

- Multiple named shopping lists (feature flag: `FEATURE_FLAG_MULTIPLE_SHOPPING_LISTS`).
- Items can be added manually, or auto-populated from stock status.
- **Auto-population rules**:
  - Add products below minimum stock amount.
  - Add products that are overdue or expired and need replacement.
- Items are organized by product group, which maps to store sections — optimizes physical shopping route.
- When items are purchased, the shopping list drives the "add to stock" workflow directly.
- Items can include notes.
- The list can be cleared in bulk via API.

---

## 3. Recipes

### Core Recipe Features

- Store full recipes with ingredient lists.
- Each ingredient specifies quantity, quantity unit, and which product it maps to.
- Recipes support a **note/instructions** field.
- A recipe can have a **desired servings** count; all quantities scale accordingly.

### Stock Fulfillment

- Grocy checks current stock against each recipe's ingredient list in real time.
- **Fulfillment states**: "Enough in stock" / "Not enough" / "Not enough but enough with shopping list".
- Missing ingredients can be added to the shopping list with one action.
- Recipes can be consumed (deducting all ingredients from stock) even when not all ingredients are currently available.

### Due Score (Unique Feature)

Each recipe gets a **"Due Score"** — a ranking based on how many of its ingredients are nearing their best-before date. Recipes with higher due scores should be cooked first to use up items before they expire. This directly connects recipe suggestions to waste reduction.

### Nested Recipes

Recipes can include other recipes as sub-components (e.g., a "lasagne" recipe includes a "bechamel sauce" recipe as an ingredient). Multi-level nesting is supported with correct quantity aggregation.

### Meal Plan

- Calendar-based weekly/daily view for scheduling which recipes will be cooked on which days.
- The meal plan integrates with the shopping list: missing ingredients for planned meals can be added to the shopping list automatically.
- Configurable start day of week.

---

## 4. Chores

Chores represent **recurring household tasks** (cleaning, maintenance, etc.).

### Chore Configuration

- Name and description.
- **Scheduling period and type**: Every N days, every N weeks (on specific weekdays), monthly (on a specific day), or manually (no schedule).
- **Tracking interval**: "Each execution" or a minimum interval between trackable executions.
- **Rollover**: Whether missed executions carry over.
- **Assignment**: Per-user assignment for multi-person households. Supports rotating assignments (round-robin) or specific user assignment.
- **Next estimated execution time**: Calculated and displayed automatically.
- **"Scheduled tracking time"**: Whether the chore was completed on schedule or late (tracked in history).

### Chore Operations

- Mark a chore as executed (with timestamp and optional user override).
- Undo a chore execution.
- Recalculate next user assignments.
- Print a chore label.
- Merge two chore records.

### Chore History

Full execution log: who completed the chore, when, and whether it was on time.

---

## 5. Tasks

Tasks are **one-off to-dos** that differ from chores (which are recurring).

- Name, description, due date, category.
- Mark as complete / undo completion.
- Categories are user-defined.
- Displayed in the calendar view.
- API: list all incomplete tasks, complete a task, undo completion.

---

## 6. Batteries

Batteries track **household battery charge cycles** — intended for rechargeable batteries.

- Name, description, charge interval (how often the battery needs charging).
- Track each charge cycle (timestamp, optional user).
- Undo a charge cycle.
- **Next estimated charge time** calculated from interval and last charge.
- Due-soon threshold configurable (warn N days before charge is needed).
- Custom userfields supported.
- Print battery labels.

This module mirrors the Chores module but specialized for physical rechargeable batteries (AA, AAA, power tool batteries, etc.).

---

## 7. Equipment

Equipment tracks **household devices and appliances**.

- Name, description, and a free-text "instruction manual URL" or attachment.
- Intended as a reference database rather than an operational tracker (no scheduling or state tracking).
- Links to the device manual or warranty information.

---

## 8. Calendar

- Unified calendar view aggregating events from all modules: meal plans, chore due dates, task due dates, battery charge due dates, product expiry dates.
- Per-category color coding (configurable hex colors for each type).
- **iCal export**: The calendar is available as a standards-compliant iCal feed (`/api/calendar/ical`) that can be subscribed to from any calendar application (Google Calendar, Apple Calendar, Outlook, etc.).
- A **public sharing link** for the iCal feed can be generated without exposing the API key.
- Configurable first day of week.
- Configurable week-of-year display.

---

## 9. Technical Capabilities

### REST API

- Every operation available in the UI is available via the API.
- Full OpenAPI / Swagger specification served at `/api/openapi/specification`.
- Interactive Swagger UI browser at `/api`.
- API key management: multiple API keys per user.
- All stock operations (add, consume, transfer, inventory, open) available by product ID or directly by barcode.
- Generic entity CRUD endpoints for all master data (products, locations, chores, etc.).

### Barcode Support

- Physical USB/Bluetooth barcode scanners work natively (they emulate a keyboard).
- **Camera scanning**: Built-in client-side camera stream processing using the **ZXing** library. Runs entirely offline in the browser — no server round-trip for decoding.
- Supports both **1D barcodes** (Code128, EAN, UPC, etc.) and **2D barcodes** (QR Code, DataMatrix).
- **Multiple barcodes per product**: One product can have many barcodes (handles multipacks, regional variants).
- **External barcode lookup**: When a barcode is scanned and the product does not exist in the database yet, grocy queries an external lookup service. Default integration: **Open Food Facts**. The product name and image are pulled in automatically.
- Plugin architecture for barcode lookup: custom plugins can be written to query other databases (e.g., regional food databases).
- Barcode scanner test interface in the UI.
- **GrocyCode**: Grocy can generate and print its own internal barcodes (Code128 or DataMatrix) for products that don't have commercial barcodes, enabling stock operations via scan on any item.

### Label Printing

- **Thermal printer support**: Direct printing to a thermal printer (network or local USB at `/dev/usb/lp0`). Configurable to print product name, quantity, notes.
- **Webhook-based label printing**: Any label print action triggers a configurable HTTP webhook, enabling integration with any external label printer system. The webhook payload includes full product details and stock entry data.
- API endpoints for printing product labels, stock entry labels, recipe labels, chore labels, battery labels.
- GrocyCode type configurable: 1D (Code128) or 2D (DataMatrix).

### Authentication and Multi-User

- Built-in username/password authentication.
- **LDAP authentication**: Full LDAP/Active Directory integration (`LdapAuth` class) with configurable bind credentials, base DN, user filter, and UID attribute.
- **Reverse proxy authentication**: Delegate authentication to a reverse proxy (e.g., Authelia, Authentik) by reading a header.
- **Disable authentication**: Single-user mode with no login screen.
- Per-user API keys.
- **Granular permission system**: Assignable permission roles per user.
- Per-user language and display preferences.

### Userfields (Custom Fields)

- User-defined custom fields can be added to **any entity** in grocy (products, chores, batteries, tasks, locations, etc.).
- Fields support different data types.
- Userfields appear in the UI and are accessible via the API.
- This effectively allows grocy to be extended as a general-purpose tracking database without modifying code.

### Custom Entities (Generic Objects)

- Beyond userfields on existing entities, grocy supports completely **custom entity types** via the Generic Entity API (`/objects/{entity}`).
- Users can define new entity types with their own fields, creating entirely new tracking lists within grocy (e.g., "Books," "Tools," "Wine cellar").

### Progressive Web App (PWA)

- The web frontend is installable as a PWA on mobile and desktop.
- Responsive design works on all screen sizes.
- Note: PWA does not provide offline capability — it requires a network connection to the server.

### Localization

- Multi-language with per-user language preference.
- Built-in: English (en), German (de).
- Community translations via Transifex; translations with 70%+ completeness are included in releases.
- ISO-8601 dates throughout. Date input fields support shorthand: `+1d` (tomorrow), `+1w` (next week), `+1m` (next month), `x` (never expires).

### Customization Without Code Changes

- `data/custom_css.html`: Inject custom CSS.
- `data/custom_js.html`: Inject custom JavaScript.
- Neither file is overwritten on application updates.

### Scan Mode (Rapid Stock Entry)

- Both the "Purchase" and "Consume" pages have a **scan mode** toggle.
- In scan mode, scanning a barcode immediately submits the operation with default values — no additional keyboard input required.
- Designed for rapid stock-taking with a physical scanner: one scan = one operation.

### Input Productivity Features

- All date fields accept keyboard shortcuts (`+1m`, `+7d`, `x`).
- Forms are optimized for "one hand, 3 seconds" operation on mobile.
- Number pad overlay for best-before date entry on touchscreens.

---

## 10. Deployment and Infrastructure

- **PHP 8.2 or 8.3** with SQLite (version 3.34.0+).
- Required PHP extensions: `fileinfo`, `pdo_sqlite`, `gd`, `ctype`, `intl`, `zlib`, `mbstring`.
- No external database server required — SQLite is the only database.
- **Docker**: Official image via LinuxServer (`linuxserver/grocy`).
- **Grocy Desktop**: Windows desktop wrapper that bundles PHP and a webserver; no separate installation required.
- Traditional PHP hosting also supported.
- No internet connection required after installation (except for optional barcode lookup).

---

## 11. Notable / Unique Features

These features stand out as particularly clever or distinguishing:

1. **Due Score on recipes**: Recipes are ranked by how urgently their ingredients need to be used before expiry. Solves the practical problem of "I have things expiring — what should I cook?" without manual checking.

2. **FEFO consumption**: First Expired, First Out — when consuming a product, grocy automatically deducts from the entry with the nearest expiry date. Minimizes food waste by default.

3. **Opened product tracking**: Marking an item as "opened" starts a separate shelf-life countdown (e.g., "opened milk lasts 4 days"). This is independent of the printed best-before date.

4. **Tare weight support**: For products stored in containers and weighed on scales (e.g., bulk dry goods in jars), grocy can subtract the container's tare weight from the total scale reading to get the net product amount.

5. **GrocyCode for untagged items**: Grocy prints its own internal barcodes for items that lack a manufacturer barcode, enabling full scan-based workflows on any household item.

6. **Full undo on all operations**: Every stock booking, chore execution, charge cycle, and task completion is individually undoable. Entire multi-item transactions are undoable atomically.

7. **iCal feed for everything**: The unified calendar exports a standards-compliant iCal feed that includes stock expiry, chore schedules, task due dates, battery charge dates, and meal plans — subscribable in any calendar app.

8. **Generic entity/custom object system**: Grocy can be repurposed as a tracker for anything — wine, tools, books, medications — without writing any code, using the custom entity and userfield system.

9. **Barcode lookup plugin architecture**: The external barcode lookup system is pluggable. Different regions can use their own food product databases rather than being locked into Open Food Facts.

10. **API parity with UI**: There is no feature accessible in the UI that is not also accessible via the API. This is an architectural commitment, not a best-effort claim.

---

## Knowledge Gaps

The following were not found or could not be confirmed from available sources:

- **Offline capability details**: The PWA is described as not supporting offline use, but it is unclear whether any read-only caching is implemented.
- **Webhook payload schema**: The label printer webhook payload structure is partially documented (includes `details` and `stock_entry`) but the complete schema was not found in the sources reviewed.
- **User permission granularity**: The system has "granular permission roles" but the specific list of individual permissions was not enumerated in the sources reviewed.
- **Import/export**: Whether grocy supports bulk CSV import of products or stock was not confirmed. The API enables this programmatically but no native UI import tool was found documented.
- **Notifications/alerts**: Whether grocy has built-in push notifications, email alerts, or webhook triggers for stock events (e.g., "product expired") beyond the UI indicators was not confirmed.

---

## Source Record

| Source | URL | Used For |
|---|---|---|
| GitHub README | https://github.com/grocy/grocy | Core feature descriptions, technical requirements |
| Official website | https://grocy.info | Feature marketing descriptions, capability overview |
| Demo stock overview | https://demo.grocy.info/stockoverview | Stock table columns, filter options, action buttons |
| Demo navigation | https://demo.grocy.info | Complete module list, navigation structure |
| OpenAPI specification | https://demo.grocy.info/api/openapi/specification | Complete API surface / feature inventory |
| Configuration reference | https://github.com/grocy/grocy/blob/master/config-dist.php | Feature flags, auth options, printer config |
| GitHub releases | https://github.com/grocy/grocy/releases | Feature history, capability depth |
| Controller listing | https://github.com/grocy/grocy/tree/master/controllers | Module confirmation via code structure |
