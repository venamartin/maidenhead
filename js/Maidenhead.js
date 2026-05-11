/**
 * Maidenhead Locator System math engine.
 */
export class Maidenhead {
    /**
     * Converts WGS84 coordinates to a Maidenhead locator string.
     * @param {number} lat - Latitude in degrees.
     * @param {number} lon - Longitude in degrees.
     * @param {number} precision - Length of the string (4, 6, 8, 10).
     * @returns {string} - The Maidenhead locator.
     */
    static fromLatLon(lat, lon, precision = 10) {
        let l = lon + 180;
        let b = lat + 90;

        // Handle edge cases
        if (l < 0) l = 0;
        if (l >= 360) l = 359.999999;
        if (b < 0) b = 0;
        if (b >= 180) b = 179.999999;

        let locator = "";

        // Fields (Base 18: 20° x 10°)
        locator += String.fromCharCode(65 + Math.floor(l / 20));
        locator += String.fromCharCode(65 + Math.floor(b / 10));
        l %= 20;
        b %= 10;

        // Squares (Base 10: 2° x 1°)
        if (precision >= 4) {
            locator += Math.floor(l / 2);
            locator += Math.floor(b / 1);
            l %= 2;
            b %= 1;
        }

        // Subsquares (Base 24: 5' x 2.5')
        if (precision >= 6) {
            l *= 12; // 24 / 2
            b *= 24; // 24 / 1
            locator += String.fromCharCode(97 + Math.floor(l));
            locator += String.fromCharCode(97 + Math.floor(b));
            l -= Math.floor(l);
            b -= Math.floor(b);
        }

        // Extended Squares (Base 10: 30" x 15")
        if (precision >= 8) {
            l *= 10;
            b *= 10;
            locator += Math.floor(l);
            locator += Math.floor(b);
            l -= Math.floor(l);
            b -= Math.floor(b);
        }

        // Sub-extended (Base 24: 1.25" x 0.625")
        if (precision >= 10) {
            l *= 24;
            b *= 24;
            locator += String.fromCharCode(97 + Math.floor(l));
            locator += String.fromCharCode(97 + Math.floor(b));
        }

        return locator;
    }

    /**
     * Converts a 4-character Maidenhead locator to its bounding box.
     * @param {string} locator - e.g. "CM96"
     * @returns {object} - {minLat, maxLat, minLon, maxLon}
     */
    static getBounds4(locator) {
        locator = locator.toUpperCase();
        let lon = (locator.charCodeAt(0) - 65) * 20 - 180;
        let lat = (locator.charCodeAt(1) - 65) * 10 - 90;
        lon += parseInt(locator[2]) * 2;
        lat += parseInt(locator[3]) * 1;
        
        return {
            minLat: lat,
            maxLat: lat + 1,
            minLon: lon,
            maxLon: lon + 2
        };
    }
    /**
     * Convert a Maidenhead locator to Latitude/Longitude (center of the square).
     * @param {string} locator 
     * @returns {Array|null} [lat, lng]
     */
    static toCoordinates(locator) {
        if (!locator || locator.length < 2) return null;
        
        locator = locator.toUpperCase().replace(/\s/g, '');
        
        let lng = -180;
        let lat = -90;

        // 1. Fields (Pairs 1-2: letters)
        lng += (locator.charCodeAt(0) - 65) * 20;
        lat += (locator.charCodeAt(1) - 65) * 10;

        if (locator.length >= 4) {
            // 2. Squares (Pairs 3-4: numbers)
            lng += parseInt(locator[2]) * 2;
            lat += parseInt(locator[3]) * 1;
        }

        if (locator.length >= 6) {
            // 3. Subsquares (Pairs 5-6: letters)
            lng += (locator.charCodeAt(4) - 65) * (2 / 24);
            lat += (locator.charCodeAt(5) - 65) * (1 / 24);
            
            // Move to center of the 6-char square
            if (locator.length === 6) {
                lng += (1 / 24);
                lat += (0.5 / 24);
            }
        }

        if (locator.length >= 8) {
            // 4. Extended (Pairs 7-8: numbers)
            lng += parseInt(locator[6]) * (2 / 240);
            lat += parseInt(locator[7]) * (1 / 240);

            if (locator.length === 8) {
                lng += (1 / 240);
                lat += (0.5 / 240);
            }
        }

        if (locator.length >= 10) {
            // 5. Sub-extended (Pairs 9-10: letters)
            lng += (locator.charCodeAt(8) - 65) * (2 / 5760);
            lat += (locator.charCodeAt(9) - 65) * (1 / 5760);
            
            lng += (1 / 5760);
            lat += (0.5 / 5760);
        }

        return [lat, lng];
    }
}
