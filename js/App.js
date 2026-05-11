import { DbEngine } from './DbEngine.js';
import { MapController } from './MapController.js';
import { Maidenhead } from './Maidenhead.js';
import { Phonetics } from './Phonetics.js';

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

        // 2. Start Geo Tracking (Background)
        this.startTracking();

        // 3. Initialize Offline Engine (Background)
        this.initOfflineEngine();
        
        this.checkIosInstall();
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
                const positions = JSON.parse(localStorage.getItem('sagPositions') || '{}');
                positions[id] = { lat, lng, grid };
                localStorage.setItem('sagPositions', JSON.stringify(positions));
                
                this.mapController.updateSagMarker(id, lat, lng, this.getSagColor(id));
                this.updateStatus(`${id} plotted at ${grid}`);
                gridInput.value = '';
            } else {
                alert("Invalid Grid Format. Use e.g. CM96dw");
            }
        });
    }

    restoreSagMarkers() {
        const positions = JSON.parse(localStorage.getItem('sagPositions') || '{}');
        Object.entries(positions).forEach(([id, data]) => {
            this.mapController.updateSagMarker(id, data.lat, data.lng, this.getSagColor(id));
        });
    }

    getSagColor(id) {
        const colors = [
            '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', 
            '#007AFF', '#5856D6', '#FF2D55', '#AF52DE', '#8E8E93',
            '#FF375F', '#FFD60A', '#30D158', '#64D2FF', '#0A84FF',
            '#BF5AF2', '#FF64D2', '#5E5CE6', '#98989D', '#636366'
        ];
        const num = parseInt(id.replace('SAG','')) - 1;
        return colors[num % colors.length];
    }

    async initOfflineEngine() {
        try {
            this.updateStatus("Initializing Engine...");
            await this.dbEngine.loadDb('./Maidenhead_Cm96_Openstreetmap.htrx', 'cm96.sqlite');
            
            this.updateStatus("Offline Tiles Active.");
            
            // Refresh map to load the newly available tiles
            if (this.mapController.map) {
                this.mapController.map.eachLayer(l => {
                    if (l instanceof L.SqliteTileLayer) l.redraw();
                });
            }
        } catch (err) {
            console.error("Offline engine error:", err);
            this.updateStatus("Offline Unavailable (Memory Limit?)");
        }
    }

    /**
     * Start watching the device's physical location.
     */
    startTracking() {
        if (!navigator.geolocation) {
            this.updateStatus("Geolocation not supported by this browser.");
            return;
        }

        navigator.geolocation.watchPosition(
            (pos) => this.handleNewPosition(pos),
            (err) => {
                console.error("GPS Error:", err);
                this.updateStatus("GPS Error: " + err.message);
            },
            { 
                enableHighAccuracy: true, 
                maximumAge: 1000,
                timeout: 10000
            }
        );
    }

    /**
     * Handle incoming GPS coordinates.
     */
    handleNewPosition(pos) {
        const { latitude, longitude } = pos.coords;
        
        // Update Map Center and User Marker
        this.mapController.updatePosition(latitude, longitude);

        // Calculate 10-character Maidenhead locator
        const locator = Maidenhead.fromLatLon(latitude, longitude, 10);
        
        // Format for UI: Prefix (4 chars) and Suffix (6 chars)
        const prefix = locator.substring(0, 4).toUpperCase();
        const suffix = locator.substring(4); // e.g. "dw00qi"
        
        // Update Display
        document.getElementById('grid-text').innerText = `${prefix} ${suffix}`;
        
        // Translate the suffix (the detailed part) to NATO phonetics
        const phoneticList = Phonetics.translate(suffix);
        document.getElementById('phonetic-text').innerText = phoneticList.join(' · ');
        
        this.updateStatus("Location Updated.");
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