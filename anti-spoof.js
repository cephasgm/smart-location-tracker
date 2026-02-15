class AntiSpoof {
    constructor() {
        this.locationHistory = [];
        this.maxHistorySize = 10;
        this.maxSpeed = 100; // Maximum realistic speed in m/s (360 km/h)
        this.maxJump = 1000; // Maximum realistic jump between points in meters
    }

    validateLocation(location) {
        // Add to history
        this.locationHistory.push(location);
        if (this.locationHistory.length > this.maxHistorySize) {
            this.locationHistory.shift();
        }

        // Run all validation checks
        return this.checkSpeed(location) && 
               this.checkJump(location) && 
               this.checkAccuracy(location) &&
               this.checkTimestamp(location);
    }

    checkSpeed(location) {
        if (this.locationHistory.length < 2) return true;

        const previous = this.locationHistory[this.locationHistory.length - 2];
        const timeDiff = (location.timestamp - previous.timestamp) / 1000; // in seconds
        
        if (timeDiff === 0) return true;

        // Calculate distance using Haversine formula
        const distance = this.calculateDistance(
            previous.lat, previous.lng,
            location.lat, location.lng
        );

        const speed = distance / timeDiff; // m/s

        if (speed > this.maxSpeed) {
            console.warn(`Speed check failed: ${speed.toFixed(2)} m/s`);
            return false;
        }

        return true;
    }

    checkJump(location) {
        if (this.locationHistory.length < 2) return true;

        const previous = this.locationHistory[this.locationHistory.length - 2];
        const distance = this.calculateDistance(
            previous.lat, previous.lng,
            location.lat, location.lng
        );

        if (distance > this.maxJump) {
            console.warn(`Jump check failed: ${distance.toFixed(2)} meters`);
            return false;
        }

        return true;
    }

    checkAccuracy(location) {
        // GPS accuracy should be reasonable (not perfect, not terrible)
        if (location.accuracy < 1) {
            console.warn('Accuracy too good, possible mock location');
            return false;
        }

        if (location.accuracy > 500) {
            console.warn('Accuracy too poor');
            return false;
        }

        return true;
    }

    checkTimestamp(location) {
        const now = Date.now();
        const timeDiff = Math.abs(now - location.timestamp);

        // Timestamp should be within the last 5 minutes
        if (timeDiff > 300000) {
            console.warn('Timestamp too old');
            return false;
        }

        // Timestamp shouldn't be in the future
        if (location.timestamp > now + 10000) {
            console.warn('Timestamp in future');
            return false;
        }

        return true;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = this.toRadians(lat1);
        const φ2 = this.toRadians(lat2);
        const Δφ = this.toRadians(lat2 - lat1);
        const Δλ = this.toRadians(lon2 - lon1);

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }

    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    // Check if location is within a reasonable area (anti-spoofing for common mock locations)
    isReasonableLocation(lat, lng) {
        // Check for null island (0,0) - common mock location
        if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
            return false;
        }

        // Check for impossible coordinates
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            return false;
        }

        return true;
    }
}
