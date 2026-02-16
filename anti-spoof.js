// Anti-spoofing class to detect fake/mocked locations - v2.0.0

class AntiSpoof {
    constructor() {
        this.locationHistory = [];
        this.maxHistorySize = 20; // Increased for better pattern detection
        this.maxSpeed = 100; // Maximum realistic speed in m/s (360 km/h)
        this.maxAcceleration = 20; // Maximum acceleration in m/s²
        this.maxJump = 1000; // Maximum realistic jump between points in meters
        this.minAccuracy = 1; // Minimum accuracy in meters (anything less is suspicious)
        this.maxAccuracy = 500; // Maximum accuracy in meters
        this.maxTimeDrift = 300000; // 5 minutes in milliseconds
        this.suspiciousPatterns = [];
        
        console.log('🛡️ AntiSpoof v2.0.0 initialized');
    }

    validateLocation(location) {
        // Validate input
        if (!location || typeof location !== 'object') {
            console.warn('⚠️ Invalid location object');
            return false;
        }

        // Ensure required fields exist
        if (location.lat === undefined || location.lng === undefined || 
            location.timestamp === undefined) {
            console.warn('⚠️ Missing required location fields');
            return false;
        }

        // Add to history
        this.locationHistory.push({
            ...location,
            validatedAt: Date.now()
        });
        
        if (this.locationHistory.length > this.maxHistorySize) {
            this.locationHistory.shift();
        }

        // Run all validation checks
        const checks = {
            reasonable: this.isReasonableLocation(location.lat, location.lng),
            accuracy: this.checkAccuracy(location),
            timestamp: this.checkTimestamp(location),
            speed: this.checkSpeed(location),
            jump: this.checkJump(location),
            acceleration: this.checkAcceleration(location),
            pattern: this.checkSuspiciousPatterns(location)
        };

        // Log failures for debugging
        const failedChecks = Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([check]) => check);

        if (failedChecks.length > 0) {
            console.debug('⚠️ Location validation failed:', failedChecks);
        }

        // All checks must pass
        return Object.values(checks).every(result => result === true);
    }

    isReasonableLocation(lat, lng) {
        // Check for null island (0,0) - common mock location
        if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
            console.warn('⚠️ Null island detected');
            return false;
        }

        // Check for impossible coordinates
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            console.warn('⚠️ Impossible coordinates');
            return false;
        }

        // Check for common test coordinates
        const testLocations = [
            [37.4219999, -122.0840575], // Google HQ
            [37.386051, -122.083851],    // Mountain View
            [40.7128, -74.0060],         // NYC
            [51.5074, -0.1278],           // London
        ];

        const isTestLocation = testLocations.some(([testLat, testLng]) => 
            Math.abs(lat - testLat) < 0.0001 && Math.abs(lng - testLng) < 0.0001
        );

        if (isTestLocation) {
            console.warn('⚠️ Known test location detected');
            // Don't block, but log
        }

        return true;
    }

    checkAccuracy(location) {
        if (location.accuracy === undefined || location.accuracy === null) {
            return true; // No accuracy data, can't validate
        }

        // GPS accuracy should be reasonable
        if (location.accuracy < this.minAccuracy) {
            console.warn(`⚠️ Accuracy too good (${location.accuracy.toFixed(2)}m), possible mock location`);
            return false;
        }

        if (location.accuracy > this.maxAccuracy) {
            console.warn(`⚠️ Accuracy too poor (${location.accuracy.toFixed(2)}m)`);
            return false;
        }

        return true;
    }

    checkTimestamp(location) {
        const now = Date.now();
        const timeDiff = Math.abs(now - location.timestamp);

        // Timestamp should be within acceptable range
        if (timeDiff > this.maxTimeDrift) {
            console.warn(`⚠️ Timestamp drift too large: ${(timeDiff/1000).toFixed(0)}s`);
            return false;
        }

        // Timestamp shouldn't be in the future (allow small clock skew)
        if (location.timestamp > now + 10000) {
            console.warn('⚠️ Timestamp in future');
            return false;
        }

        // Check for monotonically increasing timestamps
        if (this.locationHistory.length >= 2) {
            const previous = this.locationHistory[this.locationHistory.length - 2];
            if (location.timestamp <= previous.timestamp) {
                console.warn('⚠️ Timestamp not increasing');
                return false;
            }
        }

        return true;
    }

    checkSpeed(location) {
        if (this.locationHistory.length < 2) return true;

        const previous = this.locationHistory[this.locationHistory.length - 2];
        const timeDiff = (location.timestamp - previous.timestamp) / 1000; // in seconds
        
        if (timeDiff <= 0) return true;

        const distance = this.calculateDistance(
            previous.lat, previous.lng,
            location.lat, location.lng
        );

        const speed = distance / timeDiff; // m/s

        // Check against max speed
        if (speed > this.maxSpeed) {
            console.warn(`⚠️ Speed check failed: ${(speed * 3.6).toFixed(1)} km/h`);
            return false;
        }

        // Check for unrealistic speeds for the context
        if (speed > 30 && (!location.speed || location.speed < 5)) {
            console.warn('⚠️ Speed mismatch with GPS reported speed');
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

        // Check for unrealistic jumps
        if (distance > this.maxJump) {
            console.warn(`⚠️ Jump check failed: ${distance.toFixed(2)} meters`);
            return false;
        }

        // Check for teleportation (impossible distance in short time)
        const timeDiff = (location.timestamp - previous.timestamp) / 1000;
        if (timeDiff < 1 && distance > 100) {
            console.warn('⚠️ Teleportation detected');
            return false;
        }

        return true;
    }

    checkAcceleration(location) {
        if (this.locationHistory.length < 3) return true;

        const prev2 = this.locationHistory[this.locationHistory.length - 3];
        const prev1 = this.locationHistory[this.locationHistory.length - 2];
        
        const timeDiff1 = (prev1.timestamp - prev2.timestamp) / 1000;
        const timeDiff2 = (location.timestamp - prev1.timestamp) / 1000;
        
        if (timeDiff1 <= 0 || timeDiff2 <= 0) return true;

        const distance1 = this.calculateDistance(
            prev2.lat, prev2.lng,
            prev1.lat, prev1.lng
        );
        const distance2 = this.calculateDistance(
            prev1.lat, prev1.lng,
            location.lat, location.lng
        );

        const speed1 = distance1 / timeDiff1;
        const speed2 = distance2 / timeDiff2;

        const acceleration = Math.abs(speed2 - speed1) / ((timeDiff1 + timeDiff2) / 2);

        if (acceleration > this.maxAcceleration) {
            console.warn(`⚠️ Acceleration too high: ${acceleration.toFixed(2)} m/s²`);
            return false;
        }

        return true;
    }

    checkSuspiciousPatterns(location) {
        // Check for location circling (possible mock location pattern)
        if (this.locationHistory.length >= 5) {
            const recent = this.locationHistory.slice(-5);
            
            // Calculate average position
            const avgLat = recent.reduce((sum, loc) => sum + loc.lat, 0) / 5;
            const avgLng = recent.reduce((sum, loc) => sum + loc.lng, 0) / 5;
            
            // Calculate variance
            const variance = recent.reduce((sum, loc) => 
                sum + Math.pow(loc.lat - avgLat, 2) + Math.pow(loc.lng - avgLng, 2), 0) / 5;

            // Very low variance might indicate mock location
            if (variance < 0.0000001) {
                console.warn('⚠️ Suspiciously stable location');
                return false;
            }
        }

        // Check for GPS signal strength indicators
        if (location.accuracy !== undefined) {
            // Sudden accuracy improvements might indicate mock location
            if (this.locationHistory.length >= 2) {
                const prev = this.locationHistory[this.locationHistory.length - 2];
                if (prev.accuracy && location.accuracy < prev.accuracy * 0.1) {
                    console.warn('⚠️ Unrealistic accuracy improvement');
                    return false;
                }
            }
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

        return R * c;
    }

    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    getValidationStats() {
        return {
            historySize: this.locationHistory.length,
            suspiciousPatterns: this.suspiciousPatterns.length,
            maxSpeed: this.maxSpeed,
            maxJump: this.maxJump
        };
    }

    reset() {
        this.locationHistory = [];
        this.suspiciousPatterns = [];
        console.log('🔄 AntiSpoof reset');
    }
}

// Make it globally available
window.AntiSpoof = AntiSpoof;

// Create default instance
if (!window.antiSpoof) {
    window.antiSpoof = new AntiSpoof();
}

console.log('✅ AntiSpoof loaded and available globally');
