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
        this.init();
    }

    async init() {
        this.updateStatus("Registering Service Worker...");

        // Register the Service Worker for Offline PWA support
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered successfully:', registration.scope);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }

        this.updateStatus("Initializing Offline Engine...");

        try {
            // 1. Initialize SQLite WASM
            await this.dbEngine.init();

            // 2. Import the grid database to OPFS
            // Note: In production, this would be triggered by a "Download" button.
            // For this phase, we'll auto-import the local file into OPFS if not already there.
            await this.dbEngine.importToOpfs('./Maidenhead_Cm96_Openstreetmap.htrx', 'cm96.sqlite');
            await this.dbEngine.openOpfsDb('cm96.sqlite');

            // 3. Initialize Map with the SQLite Layer
            this.mapController.init('map');

            // 4. Start Geo Tracking
            this.startTracking();

            this.updateStatus("System Online.");
        } catch (err) {
            console.error("Initialization error:", err);
            this.updateStatus("Engine Error: " + err.message);
        }
        
        this.checkIosInstall();
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