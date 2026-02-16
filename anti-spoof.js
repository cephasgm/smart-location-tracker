// anti-spoof.js - Anti-spoofing class to detect fake/mocked locations - v2.1.0
// FIXED: Adjusted thresholds to be less sensitive for real GPS data

class AntiSpoof {
    constructor() {
        this.locationHistory = [];
        this.maxHistorySize = 20;
        
        // INCREASED THRESHOLDS for real GPS (less sensitive)
        this.maxSpeed = 150; // Increased from 100 to 150 m/s (540 km/h) - allows for fast vehicles
        this.maxAcceleration = 25; // Increased from 20 to 25 m/s²
        this.maxJump = 2000; // Increased from 1000 to 2000 meters - allows for GPS jumps
        this.minAccuracy = 0.5; // Decreased from 1 to 0.5 - some devices get <1m accuracy
        this.maxAccuracy = 1000; // Increased from 500 to 1000 meters - allows for poor GPS
        this.maxTimeDrift = 600000; // Increased from 300000 to 600000 ms (10 minutes)
        
        this.suspiciousPatterns = [];
        this.warningCount = 0;
        this.maxWarnings = 5; // Limit warnings to prevent console spam
        
        console.log('🛡️ AntiSpoof v2.1.0 initialized (adjusted for real GPS)');
    }

    validateLocation(location) {
        // Validate input
        if (!location || typeof location !== 'object') {
            this.logWarning('Invalid location object');
            return false;
        }

        // Ensure required fields exist
        if (location.lat === undefined || location.lng === undefined || 
            location.timestamp === undefined) {
            this.logWarning('Missing required location fields');
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

        // Log failures only if under warning limit
        const failedChecks = Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([check]) => check);

        if (failedChecks.length > 0 && this.warningCount < this.maxWarnings) {
            this.warningCount++;
            console.warn(`⚠️ Location validation warnings:`, failedChecks);
            
            // Show toast for first few warnings only
            if (this.warningCount === 1 && window.app) {
                window.app.showToast('⚠️ Unusual location pattern detected', 'warning');
            }
        }

        // All checks must pass - but be more lenient
        // Allow up to 2 failed checks for real GPS (which can be noisy)
        const passedCount = Object.values(checks).filter(v => v === true).length;
        const requiredPasses = Object.keys(checks).length - 2; // Allow 2 failures
        
        return passedCount >= requiredPasses;
    }

    logWarning(message) {
        if (this.warningCount < this.maxWarnings) {
            this.warningCount++;
            console.warn(`⚠️ ${message}`);
        }
    }

    isReasonableLocation(lat, lng) {
        // Check for null island (0,0) - common mock location
        if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
            this.logWarning('Null island detected');
            return false;
        }

        // Check for impossible coordinates
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            this.logWarning('Impossible coordinates');
            return false;
        }

        return true;
    }

    checkAccuracy(location) {
        if (location.accuracy === undefined || location.accuracy === null) {
            return true; // No accuracy data, can't validate
        }

        // GPS accuracy should be reasonable
        if (location.accuracy < this.minAccuracy) {
            this.logWarning(`Accuracy too good: ${location.accuracy.toFixed(2)}m`);
            return false;
        }

        if (location.accuracy > this.maxAccuracy) {
            this.logWarning(`Accuracy too poor: ${location.accuracy.toFixed(2)}m`);
            // Don't fail, just warn - poor accuracy is still valid GPS
            return true;
        }

        return true;
    }

    checkTimestamp(location) {
        const now = Date.now();
        const timeDiff = Math.abs(now - location.timestamp);

        // Timestamp should be within acceptable range
        if (timeDiff > this.maxTimeDrift) {
            this.logWarning(`Timestamp drift: ${(timeDiff/1000).toFixed(0)}s`);
            return false;
        }

        // Timestamp shouldn't be in the future (allow small clock skew)
        if (location.timestamp > now + 30000) { // Increased to 30 seconds
            this.logWarning('Timestamp in future');
            return false;
        }

        return true;
    }

    checkSpeed(location) {
        if (this.locationHistory.length < 2) return true;

        const previous = this.locationHistory[this.locationHistory.length - 2];
        const timeDiff = (location.timestamp - previous.timestamp) / 1000;
        
        if (timeDiff <= 0) return true;

        const distance = this.calculateDistance(
            previous.lat, previous.lng,
            location.lat, location.lng
        );

        const speed = distance / timeDiff; // m/s

        // Check against max speed
        if (speed > this.maxSpeed) {
            this.logWarning(`High speed detected: ${(speed * 3.6).toFixed(1)} km/h`);
            // Don't fail for high speed - could be in a fast vehicle
            return true;
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
            this.logWarning(`Large position jump: ${distance.toFixed(2)} meters`);
            // Don't fail for jumps - GPS can sometimes jump
            return true;
        }

        // Check for teleportation (impossible distance in short time)
        const timeDiff = (location.timestamp - previous.timestamp) / 1000;
        if (timeDiff < 2 && distance > 500) { // More lenient: 500m in 2 seconds
            this.logWarning('Possible teleportation detected');
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
            this.logWarning(`High acceleration: ${acceleration.toFixed(2)} m/s²`);
            // Don't fail for high acceleration - could be realistic
            return true;
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
            if (variance < 0.00000001) { // Even more lenient
                this.logWarning('Suspiciously stable location');
                return false;
            }
        }

        return true;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

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
            warningCount: this.warningCount
        };
    }

    reset() {
        this.locationHistory = [];
        this.suspiciousPatterns = [];
        this.warningCount = 0;
        console.log('🔄 AntiSpoof reset');
    }
}

// Make it globally available
window.AntiSpoof = AntiSpoof;

// Create default instance if not exists
if (!window.antiSpoof) {
    window.antiSpoof = new AntiSpoof();
}

console.log('✅ AntiSpoof loaded and available globally');
