/**
 * Leaflet Map Controller
 */
export class MapController {
    constructor(dbEngine) {
        this.dbEngine = dbEngine;
        this.map = null;
        this.userMarker = null;
        this.sqliteLayer = null;
        this.onlineLayer = null;
    }

    /**
     * Initialize the map.
     */
    init(containerId) {
        console.log('Initializing Leaflet map on container:', containerId);
        
        // Initialize Leaflet Map
        this.map = L.map(containerId, {
            zoomControl: false,
            attributionControl: false,
            center: [36.5, -121.0], // Center on CM96 area
            zoom: 12
        });

        // 1. Online Layer (Off by default)
        this.onlineLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

        // 2. Add custom SQLite Layer (Main Offline Layer)
        console.log('Adding SQLite tile layer using HTRX bit-packing formula...');
        
        const self = this;
        L.SqliteTileLayer = L.TileLayer.extend({
            createTile: function (coords, done) {
                const tile = document.createElement('img');
                const { z, x, y } = coords;

                // THE HTRX FORMULA: index = (((z << z) + x) << z) + y
                // Note: JS bitwise operators are 32-bit, but for Z > 10 we might exceed that.
                // We'll use BigInt to ensure we don't lose precision for high zoom levels.
                const bZ = BigInt(z);
                const bX = BigInt(x);
                const bY = BigInt(y);
                const key = (((bZ << bZ) + bX) << bZ) + bY;

                if (!self.dbEngine.db) {
                    done(null, tile);
                    return tile;
                }

                self.dbEngine.selectArrays('SELECT tile FROM tiles WHERE key = ?', [key.toString()])
                    .then(rows => {
                        if (rows && rows.length > 0) {
                            const blob = rows[0][0];
                            const url = URL.createObjectURL(new Blob([blob], { type: 'image/png' }));
                            tile.src = url;
                            tile.onload = () => URL.revokeObjectURL(url);
                        }
                        done(null, tile);
                    })
                    .catch(err => {
                        console.error("Tile fetch error:", err);
                        done(null, tile);
                    });

                return tile;
            }
        });

        this.sqliteLayer = new L.SqliteTileLayer();
        this.sqliteLayer.addTo(this.map);

        // Add User Marker
        const icon = L.divIcon({
            className: 'user-marker',
            html: '<div style="background: #0A84FF; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px #0A84FF;"></div>',
            iconSize: [12, 12]
        });
        this.userMarker = L.marker([36.5, -121.0], { icon }).addTo(this.map);
    }

    /**
     * Toggle the online OpenStreetMap layer.
     */
    toggleOnline(enabled) {
        if (enabled) {
            this.onlineLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.onlineLayer);
        }
    }

    /**
     * Update user position and center map.
     */
    updatePosition(lat, lng) {
        if (!this.map) return;
        const pos = [lat, lng];
        this.userMarker.setLatLng(pos);
        this.map.setView(pos);
    }
}
