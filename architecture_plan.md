# Architecture & Development Plan: "Maidenhead" PWA

## 1. Project Overview
**Name:** Maidenhead
**Purpose:** A mobile-first, offline-capable Progressive Web App (PWA) designed for situational awareness during amateur radio SAG (Support and Gear) operations. 
**Core Constraint:** Must operate entirely offline without risking browser cache eviction. Network-based map tile fetching is replaced by downloading immutable `.sqlite` database files containing specific Maidenhead grid square map data.

## 2. Technology Stack
* **Frontend UI:** Vanilla JavaScript (Strict ES6 Modules, Object-Oriented).
* **App Shell/PWA:** HTML5, CSS, `manifest.json`, Service Worker (`sw.js`).
* **Hosting:** GitHub Pages (enforces HTTPS for Android/iOS PWA installation).
* **Map Rendering:** Leaflet.js.
* **Offline Data Storage:** Browser Origin Private File System (OPFS).
* **Database Engine:** `sqlite3-wasm` (WebAssembly SQLite).
* **Backend/Data Prep:** Python (CLI utility for slicing master map databases).

---

## 3. Frontend Architecture (Vanilla JS Modules)
The frontend utilizes a strict, object-oriented module pattern, bypassing heavy frameworks like React/Vue.

* `App.js`: The orchestrator. Handles Service Worker registration, DOM updates, and wiring modules together.
* `Maidenhead.js`: The math engine. Converts WGS84 Lat/Lon coordinates to Maidenhead grid strings (e.g., `CM96cw62sj`), and vice-versa.
* `Phonetics.js`: Dictionary class for translating raw Maidenhead strings into standard ITU phonetics.
* `GeoTracker.js`: Wrapper for the `navigator.geolocation` API. Handles watch intervals, accuracy filtering, and state management of the device's current location.
* `MapController.js`: Wraps Leaflet.js. Handles map initialization, custom UI removal, center-point updates, and the custom tile layer logic.

---

## 4. The Offline Mapping Engine (OPFS + WebAssembly)
To avoid the ~1GB mobile browser Cache API limits and aggressive iOS Safari eviction policies, the app uses a database-driven approach.

1.  **Data Structure:** Map tiles are grouped into databases strictly bounded by 4-character Maidenhead grid squares (e.g., `cm96.sqlite`).
2.  **Storage:** When a user downloads a grid, the `.sqlite` file is written directly into the browser's OPFS block-level storage.
3.  **Querying:** The app boots the `sqlite3-wasm` engine, connecting directly to the OPFS files without loading the entire 500MB+ database into RAM.
4.  **Custom Leaflet Layer:** A custom Leaflet layer intercepts standard XYZ tile requests (`Z:15, X:5341, Y:12654`).
5.  **The Maidenhead Tile Router:** 
    * The requested XYZ tile is converted to its center Lat/Lon.
    * Lat/Lon is converted to a 4-character Maidenhead string (e.g., "CM96").
    * The router checks if `cm96.sqlite` is open in OPFS. If yes, it executes a `SELECT tile_data FROM tiles WHERE z=? AND x=? AND y=?` query, returning the binary blob via `URL.createObjectURL()`.

---

## 5. Backend Data Preparation Pipeline (Python)
A lightweight Python CLI utility will be used to generate the distribution files.

* **Input:** The master `ham_trax.sqlite` database (or an XYZ slippy map scraper).
* **Argument:** A 4-character Maidenhead string (e.g., `CM96`).
* **Process:** 
    * Calculates the exact Lat/Lon boundaries of the provided Maidenhead grid.
    * Translates those boundaries into Min/Max X and Y tile coordinates for zoom levels Z10 through Z16.
    * Extracts the specific blobs into a new, strictly bounded database (`cm96.sqlite`).
* **Schema:** 
    * `metadata` table: `name`, `bounds`, `zoom_min`, `zoom_max`.
    * `tiles` table: `zoom_level`, `tile_column`, `tile_row`, `tile_data`.

---

## 6. Development Roadmap
* **Phase 1A: PWA Foundation (Completed)**
    * Setup `index.html`, `manifest.json`, `sw.js`.
    * Deploy to GitHub Pages and verify native installability on Android/iOS.
* **Phase 1B: Offline Engine & Map Layer (Next)**
    * Modify existing Python scraper to accept Maidenhead bounding boxes.
    * Implement OPFS file streaming and `sqlite3-wasm` initialization.
    * Build the Leaflet custom database tile layer.
* **Phase 1C: GPS Integration**
    * Implement `GeoTracker.js` and `Maidenhead.js` to show self-position.
* **Phase 2: SAG Coordination Features**
    * Add reverse-lookup capability to `Maidenhead.js` (`toLatLon(gridString)`).
    * Add UI for manual entry of heard tactical Maidenhead coordinates to drop custom pins on the offline map.

## User Review Required
> [!IMPORTANT]
> The plan provided has been successfully captured as the blueprint for our upcoming work! Please verify if this matches your expectations, and if you are ready to begin Phase 1B (the Offline Engine & Map Layer).

## Open Questions
> [!NOTE]
> Since we are entering Phase 1B, would you like to start by providing the Python scraper utility you mentioned modifying, or should we begin with the `sqlite3-wasm` and OPFS integration on the frontend?
