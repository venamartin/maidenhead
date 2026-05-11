/**
 * Leaflet Map Controller with Custom SQLite Tile Layer.
 */
export class MapController {
    constructor(dbEngine) {
        this.dbEngine = dbEngine;
        this.map = null;
        this.userMarker = null;
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
        console.log('Adding SQLite tile layer...');
        this.sqliteLayer = new L.SqliteTileLayer(this.dbEngine, {
            minZoom: 1,
            maxZoom: 15,
            zIndex: 10
        });
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
     * Update the map center and user marker.
     */
    updatePosition(lat, lon) {
        if (!this.map) return;
        
        const pos = [lat, lon];
        this.userMarker.setLatLng(pos);
        this.map.panTo(pos, { animate: true });
    }
}

/**
 * Custom Leaflet Layer for fetching tiles from SQLite.
 */
L.SqliteTileLayer = L.TileLayer.extend({
    initialize: function (dbEngine, options) {
        this.dbEngine = dbEngine;
        L.TileLayer.prototype.initialize.call(this, "", options);
    },

    createTile: function (coords, done) {
        const tile = document.createElement('img');
        
        // Linear Quadtree Key calculation
        const z = coords.z;
        const x = coords.x;
        const y = coords.y;

        // Offset for this zoom level in the linear pyramid
        const offset = (Math.pow(4, z) - 1) / 3;
        
        // Morton encoding (Interleave bits of X and Y)
        const i = this._encodeMorton(x, y);
        const key = offset + i;

        if (!this.dbEngine.db) {
            done(null, tile);
            return tile;
        }

        this.dbEngine.db.selectArrays('SELECT tile FROM tiles WHERE key = ?', [key])
            .then(rows => {
                if (rows && rows.length > 0) {
                    const blob = rows[0][0];
                    const url = URL.createObjectURL(new Blob([blob], { type: 'image/png' }));
                    tile.src = url;
                    
                    // Clean up URL when image loads
                    tile.onload = () => URL.revokeObjectURL(url);
                    done(null, tile);
                } else {
                    // No tile found in DB
                    done(null, tile);
                }
            })
            .catch(err => {
                console.error(`Error fetching tile ${z}/${x}/${y}:`, err);
                done(err, tile);
            });
            
        return tile;
    },

    /**
     * Interleaves bits of x and y to create a Morton code.
     */
    _encodeMorton: function(x, y) {
        let res = 0;
        for (let i = 0; i < 16; i++) {
            res |= (x & (1 << i)) << i | (y & (1 << i)) << (i + 1);
        }
        return res;
    }
});
