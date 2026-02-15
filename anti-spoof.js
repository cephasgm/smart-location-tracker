// anti-spoof.js - Location validation and anti-spoofing measures
// This must load BEFORE location-engine.js

class AntiSpoof {
    constructor(options = {}) {
        this.locationHistory = [];
        this.maxHistorySize = options.maxHistorySize || 10;
        this.maxSpeed = options.maxSpeed || 100; // Maximum realistic speed in m/s (360 km/h)
        this.maxJump = options.maxJump || 1000; // Maximum realistic jump between points in meters
        this.minAccuracy = options.minAccuracy || 1; // Minimum accuracy in meters
        this.maxAccuracy = options.maxAccuracy || 500; // Maximum accuracy in meters
        this.maxTimestampAge = options.maxTimestampAge || 300000; // 5 minutes in ms
        this.enableDetailedLogging = options.enableDetailedLogging || false;
        
        // Suspicious patterns tracking
        this.suspiciousCount = 0;
        this.maxSuspiciousCount = 5;
        
        // Mock location patterns
        this.mockLocationPatterns = [
            { lat: 0, lng: 0 }, // Null Island
            { lat: 37.422, lng: -122.084 }, // Googleplex (common test location)
            { lat: 37.3318, lng: -122.0312 }, // Apple Campus
            { lat: 47.6205, lng: -122.3493 }, // Microsoft Campus
        ];
        
        this.log('AntiSpoof initialized');
    }

    validateLocation(location) {
        // Ensure location has required fields
        if (!this.isValidLocationObject(location)) {
            console.warn('Invalid location object');
            return false;
        }

        // Add to history
        this.locationHistory.push({...location, validationTimestamp: Date.now()});
        if (this.locationHistory.length > this.maxHistorySize) {
            this.locationHistory.shift();
        }

        // Run all validation checks
        const checks = {
            speed: this.checkSpeed(location),
            jump: this.checkJump(location),
            accuracy: this.checkAccuracy(location),
            timestamp: this.checkTimestamp(location),
            reasonable: this.isReasonableLocation(location.lat, location.lng),
            mockPattern: !this.isMockPattern(location.lat, location.lng)
        };

        // Log failed checks if detailed logging enabled
        if (this.enableDetailedLogging) {
            const failedChecks = Object.entries(checks)
                .filter(([_, passed]) => !passed)
                .map(([check]) => check);
            
            if (failedChecks.length > 0) {
                console.log('Location validation failed checks:', failedChecks);
            }
        }

        // All checks must pass
        const isValid = Object.values(checks).every(result => result === true);
        
        if (!isValid) {
            this.suspiciousCount++;
            if (this.suspiciousCount > this.maxSuspiciousCount) {
                console.warn('Multiple suspicious locations detected');
            }
        } else {
            // Reset suspicious count on valid location
            this.suspiciousCount = Math.max(0, this.suspiciousCount - 1);
        }

        return isValid;
    }

    isValidLocationObject(location) {
        return location && 
               typeof location.lat === 'number' && 
               typeof location.lng === 'number' && 
               typeof location.timestamp === 'number' &&
               typeof location.accuracy === 'number' &&
               !isNaN(location.lat) && 
               !isNaN(location.lng) &&
               isFinite(location.lat) && 
               isFinite(location.lng);
    }

    checkSpeed(location) {
        if (this.locationHistory.length < 2) return true;

        const previous = this.locationHistory[this.locationHistory.length - 2];
        const timeDiff = (location.timestamp - previous.timestamp) / 1000; // in seconds
        
        if (timeDiff <= 0) {
            this.log('Invalid time difference for speed check');
            return false;
        }

        // Calculate distance using Haversine formula
        const distance = this.calculateDistance(
            previous.lat, previous.lng,
            location.lat, location.lng
        );

        const speed = distance / timeDiff; // m/s

        if (speed > this.maxSpeed) {
            this.log(`Speed check failed: ${speed.toFixed(2)} m/s (max: ${this.maxSpeed})`);
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
            this.log(`Jump check failed: ${distance.toFixed(2)} meters (max: ${this.maxJump})`);
            return false;
        }

        return true;
    }

    checkAccuracy(location) {
        // Check if accuracy is within reasonable range
        if (location.accuracy < this.minAccuracy) {
            this.log(`Accuracy too good: ${location.accuracy}m (min: ${this.minAccuracy})`);
            return false;
        }

        if (location.accuracy > this.maxAccuracy) {
            this.log(`Accuracy too poor: ${location.accuracy}m (max: ${this.maxAccuracy})`);
            return false;
        }

        return true;
    }

    checkTimestamp(location) {
        const now = Date.now();
        const timeDiff = Math.abs(now - location.timestamp);

        // Timestamp should be within the allowed range
        if (timeDiff > this.maxTimestampAge) {
            this.log(`Timestamp too old: ${timeDiff}ms (max: ${this.maxTimestampAge})`);
            return false;
        }

        // Timestamp shouldn't be in the future (with 10s buffer)
        if (location.timestamp > now + 10000) {
            this.log('Timestamp in future');
            return false;
        }

        return true;
    }

    isReasonableLocation(lat, lng) {
        // Check for null island (0,0) - common mock location
        if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
            this.log('Null island detected');
            return false;
        }

        // Check for impossible coordinates
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            this.log('Impossible coordinates detected');
            return false;
        }

        // Check for locations with no decimal precision (often mocked)
        if (Number.isInteger(lat) && Number.isInteger(lng)) {
            this.log('Integer coordinates detected (possible mock)');
            return false;
        }

        return true;
    }

    isMockPattern(lat, lng) {
        // Check against known mock location patterns
        for (const pattern of this.mockLocationPatterns) {
            const distance = this.calculateDistance(
                lat, lng,
                pattern.lat, pattern.lng
            );
            
            // If within 100 meters of a known mock location
            if (distance < 100) {
                this.log(`Known mock location pattern detected: ${pattern.lat}, ${pattern.lng}`);
                return true;
            }
        }
        return false;
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

    log(message) {
        if (this.enableDetailedLogging) {
            console.log(`[AntiSpoof] ${message}`);
        }
    }

    // Get validation statistics
    getStats() {
        return {
            historySize: this.locationHistory.length,
            suspiciousCount: this.suspiciousCount,
            maxSuspiciousCount: this.maxSuspiciousCount
        };
    }

    // Clear location history
    clearHistory() {
        this.locationHistory = [];
        this.suspiciousCount = 0;
        this.log('Location history cleared');
    }
}

// Make it globally available (critical for location-engine.js)
window.AntiSpoof = AntiSpoof;

// Also create a default instance for immediate use if needed
window.antiSpoofInstance = new AntiSpoof();

// Log successful loading
console.log('✅ AntiSpoof loaded and available globally');
