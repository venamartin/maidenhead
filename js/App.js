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

        // Background Service Worker registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(e => console.error(e));
        }

        // 1. Initialize Map IMMEDIATELY (with a default view for PC testing)
        try {
            this.mapController.init('map');
            this.updateStatus("Map Ready. Locating...");
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

    async initOfflineEngine() {
        try {
            this.updateStatus("Checking Offline Engine...");
            await this.dbEngine.init();

            // Check if file already exists in OPFS
            const root = await navigator.storage.getDirectory();
            let exists = false;
            try {
                await root.getFileHandle('cm96.sqlite');
                exists = true;
            } catch (e) {}

            if (!exists) {
                this.updateStatus("Downloading Map Data (16MB)...");
                await this.dbEngine.importToOpfs('./Maidenhead_Cm96_Openstreetmap.htrx', 'cm96.sqlite');
            }
            
            await this.dbEngine.openOpfsDb('cm96.sqlite');
            this.updateStatus("Offline Tiles Active.");
            
            // Refresh map to load the newly available tiles
            if (this.mapController.map) {
                this.mapController.map.eachLayer(l => {
                    if (l instanceof L.SqliteTileLayer) l.redraw();
                });
            }
        } catch (err) {
            console.error("Offline engine error:", err);
            this.updateStatus("Offline Mode Unavailable.");
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
new App();