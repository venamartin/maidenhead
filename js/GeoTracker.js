export default class GeoTracker {
    constructor(onLocationUpdate, onError) {
        this.watchId = null;
        this.onLocationUpdate = onLocationUpdate; // Callback for success
        this.onError = onError;                   // Callback for failure
    }

    start() {
        if (!('geolocation' in navigator)) {
            this.onError("Geolocation is not supported by this browser.");
            return;
        }

        // These options are CRITICAL for precise tracking
        const options = {
            enableHighAccuracy: true, // Forces the GPS hardware to turn on
            maximumAge: 0,            // Refuses cached, old locations
            timeout: 10000            // Waits 10 seconds before throwing a timeout error
        };

        // On Android/iOS, calling getCurrentPosition first is often more reliable for triggering the prompt
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.handleSuccess(position);
                // After the first success, start the continuous watch
                this.watchId = navigator.geolocation.watchPosition(
                    (pos) => this.handleSuccess(pos),
                    (err) => this.handleError(err),
                    options
                );
            },
            (error) => this.handleError(error),
            options
        );
    }

    stop() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    handleSuccess(position) {
        // Extract the precise data
        const data = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy, // Accuracy in meters
            heading: position.coords.heading,
            speed: position.coords.speed
        };
        this.onLocationUpdate(data);
    }

    handleError(error) {
        let errorMsg = "An unknown error occurred.";
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMsg = "Location permission denied. Please enable it in your phone settings.";
                break;
            case error.POSITION_UNAVAILABLE:
                errorMsg = "Location information is unavailable. (No GPS signal).";
                break;
            case error.TIMEOUT:
                errorMsg = "The request to get user location timed out.";
                break;
        }
        this.onError(errorMsg);
    }
}