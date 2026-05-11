import { DbEngine } from './DbEngine.js';
import { MapController } from './MapController.js';
import { Maidenhead } from './Maidenhead.js';
import { Phonetics } from './Phonetics.js';
import GeoTracker from './GeoTracker.js';
import WakeLock from './WakeLock.js';

/**
 * Main Application Orchestrator.
 */
class App {
    constructor() {
        this.dbEngine = new DbEngine();
        this.mapController = new MapController(this.dbEngine);
        this.isOnline = false;
        this.init();
    }

    async init() {
        this.updateStatus("Booting Map...");

        // Setup HUD Toggle
        const hudToggle = document.getElementById('hud-toggle');
        const overlay = document.getElementById('overlay');
        if (hudToggle && overlay) {
            this.isHudVisible = true;
            hudToggle.addEventListener('click', () => {
                this.isHudVisible = !this.isHudVisible;
                overlay.style.display = this.isHudVisible ? 'block' : 'none';
                hudToggle.style.background = this.isHudVisible ? "rgba(10, 132, 255, 0.3)" : "rgba(255,255,255,0.1)";
            });
        }

        // Setup Online Toggle
        const toggle = document.getElementById('online-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                this.isOnline = !this.isOnline;
                this.mapController.toggleOnline(this.isOnline);
                toggle.innerText = this.isOnline ? "Go Offline" : "Go Online";
                toggle.style.background = this.isOnline ? "rgba(10, 132, 255, 0.3)" : "rgba(255,255,255,0.1)";
            });
        }

        const wakeBtn = document.getElementById('wake-lock-btn');
        if (wakeBtn) {
            this.screenLock = new WakeLock(wakeBtn);
            wakeBtn.addEventListener('click', () => {
                this.screenLock.toggle();
            });
        }

        // Setup SAG Tracker
        this.setupSagTracker();

        // Background Service Worker registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(e => console.error(e));
        }

        // 1. Initialize Map IMMEDIATELY (with a default view for PC testing)
        try {
            this.mapController.init('map');
            this.updateStatus("Map Ready. Locating...");

            // Restore any saved SAG markers
            this.restoreSagMarkers();
        } catch (err) {
            console.error("Map init error:", err);
            this.updateStatus("Map Error: " + err.message);
        }

        // 2. Setup GPS Trigger (Mobile Security Golden Rule)
        this.setupGpsTrigger();

        // 3. Initialize Offline Engine (Background)
        this.initOfflineEngine();

        this.checkIosInstall();
    }

    setupGpsTrigger() {
        const startBtn = document.getElementById('gps-start-btn');
        const dashboard = document.getElementById('coord-dashboard');

        this.geoTracker = new GeoTracker(
            (data) => this.handleNewPosition(data),
            (err) => this.updateStatus(err)
        );

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.geoTracker.start();
                startBtn.style.display = 'none';
                if (dashboard) dashboard.style.display = 'block';
                this.updateStatus("GPS Request Sent...");
            });
        }
    }

    setupSagTracker() {
        const select = document.getElementById('sag-select');
        const gridInput = document.getElementById('sag-grid');
        const updateBtn = document.getElementById('sag-update');

        if (!select || !gridInput || !updateBtn) return;

        // Populate Dropdown
        for (let i = 1; i <= 20; i++) {
            const opt = document.createElement('option');
            opt.value = `SAG${i}`;
            opt.innerText = `SAG ${i}`;
            select.appendChild(opt);
        }

        // Handle Plot Button
        updateBtn.addEventListener('click', () => {
            const id = select.value;
            const grid = gridInput.value.trim();
            if (!grid) return;

            const coords = Maidenhead.toCoordinates(grid);
            if (coords) {
                const [lat, lng] = coords;
                const timestamp = Date.now();
                const positions = JSON.parse(localStorage.getItem('sagPositions') || '{}');
                positions[id] = { lat, lng, grid, timestamp };
                localStorage.setItem('sagPositions', JSON.stringify(positions));

                this.mapController.updateSagMarker(id, lat, lng, this.getSagColor(id), grid, timestamp);
                this.updateStatus(`${id} plotted at ${grid}`);
                gridInput.value = '';
            } else {
                alert("Invalid Grid Format. Use e.g. CM96dw");
            }
        });

        // Add Enter Key Support
        gridInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                updateBtn.click();
            }
        });

        // Start Auto-Refresh for SAG Labels (every 60s)
        setInterval(() => {
            this.mapController.refreshSagLabels();
        }, 60000);
    }

    restoreSagMarkers() {
        const positions = JSON.parse(localStorage.getItem('sagPositions') || '{}');
        Object.entries(positions).forEach(([id, data]) => {
            this.mapController.updateSagMarker(id, data.lat, data.lng, this.getSagColor(id), data.grid, data.timestamp);
        });
    }

    getSagColor(id) {
        const colors = [
            '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA',
            '#007AFF', '#5856D6', '#FF2D55', '#AF52DE', '#8E8E93',
            '#FF375F', '#FFD60A', '#30D158', '#64D2FF', '#0A84FF',
            '#BF5AF2', '#FF64D2', '#5E5CE6', '#98989D', '#636366'
        ];
        const num = parseInt(id.replace('SAG', '')) - 1;
        return colors[num % colors.length];
    }

    async initOfflineEngine() {
        try {
            this.updateStatus("Initializing Engine...");

            const filename = this.dbEngine.dbName;
            let url;

            // SMART ROUTING: Use local file for dev, but FORCE Media link for live site
            // This bypasses the GitHub "LFS Pointer" trickery on the live site.
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                url = `./maps/${filename}`;
                console.log("Local Dev: Attempting to load map from /maps/...");
            } else {
                url = `https://media.githubusercontent.com/media/venamartin/maidenhead/main/maps/${filename}`;
                console.log("Live Site: Loading map from GitHub LFS Media...");
            }

            // Perform the load with progress tracking
            await this.dbEngine.loadDb(url, filename, (progress, received, total) => {
                const percent = Math.round(progress * 100);
                const receivedMB = (received / 1024 / 1024).toFixed(1);
                const totalMB = (total / 1024 / 1024).toFixed(1);
                this.updateStatus(`Downloading Map: ${percent}% (${receivedMB}MB / ${totalMB}MB)`);
            });

            this.updateStatus("Offline Tiles Active.");

            // Refresh map to load the newly available tiles
            if (this.mapController.map) {
                this.mapController.map.eachLayer(l => {
                    if (l instanceof L.SqliteTileLayer) l.redraw();
                });
            }
        } catch (err) {
            console.error("Offline engine error:", err);
            this.updateStatus("GPS Active (Map Offline)");
        }
    }



    /**
     * Handle incoming GPS coordinates from GeoTracker.
     */
    handleNewPosition(data, isStale = false) {
        // data contains {lat, lon, accuracy, heading, speed}
        const { lat, lon } = data;

        // Update Dashboard
        document.getElementById('dash-lat').innerText = lat.toFixed(5);
        document.getElementById('dash-lon').innerText = lon.toFixed(5);

        // Update Map Center and User Marker
        this.mapController.updatePosition(lat, lon);

        // Calculate 10-character Maidenhead locator
        const locator = Maidenhead.fromLatLon(lat, lon, 10);

        // Format for UI: Prefix (4 chars) and Suffix (6 chars)
        const prefix = locator.substring(0, 4).toUpperCase();
        const suffix = locator.substring(4);

        // Update Display
        document.getElementById('grid-text').innerText = `${prefix} ${suffix}`;

        // Translate the suffix to NATO phonetics
        const phoneticList = Phonetics.translate(suffix);
        document.getElementById('phonetic-text').innerText = phoneticList.join(' · ');

        if (isStale) {
            this.updateStatus("Locating (Last Position Shown)");
        } else {
            this.updateStatus("GPS Active");
        }
    }

    /**
     * Update the small status bar text.
     */
    updateStatus(msg) {
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.innerText = msg;
    }

    /**
     * Detect iOS and show install instructions if necessary.
     */
    checkIosInstall() {
        const isIos = () => {
            const userAgent = window.navigator.userAgent.toLowerCase();
            return /iphone|ipad|ipod/.test(userAgent);
        };
        const isInStandaloneMode = () => ('standalone' in window.navigator && window.navigator.standalone) ||
            window.matchMedia('(display-mode: standalone)').matches;

        if (isIos() && !isInStandaloneMode()) {
            setTimeout(() => {
                const popup = document.getElementById('ios-install-popup');
                if (popup) popup.classList.add('show');
            }, 2000);
        }
    }
}

// Boot the application
window.app = new App();