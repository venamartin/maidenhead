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
            zoom: 12,
            maxZoom: 22 // Allow very deep zooming
        });

        // 1. Online Layer (Off by default)
        this.onlineLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 22
        });

        // 2. Add custom SQLite Layer (Main Offline Layer)
        console.log('Adding SQLite tile layer with Overzooming support...');
        
        const self = this;
        L.SqliteTileLayer = L.TileLayer.extend({
            options: {
                maxNativeZoom: 15, // The limit of the HTRX data
                maxZoom: 22        // How far we can stretch it
            },
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
     * Update a SAG vehicle marker.
     */
    updateSagMarker(id, lat, lng, color, grid, timestamp) {
        if (!this.map) return;
        if (!this.sagMarkers) this.sagMarkers = {};

        const ageText = this._formatAge(timestamp);
        const labelText = `${id} (${ageText})`;
        const popupText = `<strong>${id}</strong><br>${grid || 'Unknown'}<br><small>Updated: ${ageText} ago</small>`;

        if (this.sagMarkers[id]) {
            this.sagMarkers[id].setLatLng([lat, lng]);
            this.sagMarkers[id].setPopupContent(popupText);
            this.sagMarkers[id].setTooltipContent(labelText);
            this.sagMarkers[id].timestamp = timestamp;
            this.sagMarkers[id].grid = grid;
        } else {
            const icon = L.divIcon({
                className: 'sag-marker',
                html: `<div style="background: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; color: white; box-shadow: 0 0 10px ${color};">${id.replace('SAG','')}</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            this.sagMarkers[id] = L.marker([lat, lng], { icon }).addTo(this.map);
            this.sagMarkers[id].timestamp = timestamp;
            this.sagMarkers[id].grid = grid;
            this.sagMarkers[id].color = color;
            
            this.sagMarkers[id].bindTooltip(labelText, { 
                permanent: true, 
                direction: 'top',
                className: 'sag-tooltip',
                offset: [0, -10]
            });
            
            this.sagMarkers[id].bindPopup(popupText);
        }
    }

    /**
     * Refresh all SAG vehicle labels to update their "age".
     */
    refreshSagLabels() {
        if (!this.sagMarkers) return;
        Object.entries(this.sagMarkers).forEach(([id, marker]) => {
            const ageText = this._formatAge(marker.timestamp);
            marker.setTooltipContent(`${id} (${ageText})`);
            marker.setPopupContent(`<strong>${id}</strong><br>${marker.grid || 'Unknown'}<br><small>Updated: ${ageText} ago</small>`);
        });
    }

    _formatAge(timestamp) {
        if (!timestamp) return '?';
        const diffMs = Date.now() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return '<1m';
        if (diffMins < 60) return `${diffMins}m`;
        
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}h ${mins}m`;
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
