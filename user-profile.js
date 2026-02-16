// user-profile.js - Professional user profiles with avatars - v3.2.0
// FEATURE: Built-in avatar generation - no external dependencies, works offline!

class UserProfile {
    constructor() {
        this.currentUser = null;
        this.profile = null;
        this.avatarFile = null;
        this.initialized = false;
        this.preferences = {
            units: 'metric',
            theme: 'auto',
            notifications: true,
            privacy: 'friends',
            language: 'en'
        };
        
        this.init();
        console.log('👤 UserProfile initialized');
    }

    async init() {
        try {
            await this.loadUserProfile();
            this.createProfileUI();
            this.initEventListeners();
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize UserProfile:', error);
        }
    }

    async loadUserProfile() {
        await this.waitForAuth();
        
        if (!window.authManager || !window.authManager.currentUser) {
            console.log('No user logged in');
            return;
        }

        this.currentUser = window.authManager.currentUser;

        try {
            const db = window.firebaseServices.db;
            const doc = await db.collection('users').doc(this.currentUser.uid).get();

            if (doc.exists) {
                this.profile = doc.data();
                this.preferences = { ...this.preferences, ...this.profile.preferences };
            } else {
                await this.createDefaultProfile();
            }
            
            if (window.analytics) {
                window.analytics.setUserProperties({
                    userId: this.currentUser.uid,
                    hasProfile: true
                });
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
            this.showToast('Failed to load profile', 'error');
        }
    }

    waitForAuth() {
        return new Promise((resolve) => {
            if (window.authManager && window.authManager.currentUser) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.authManager && window.authManager.currentUser) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve();
                }, 5000);
            }
        });
    }

    // ===== BEST FEATURE: Built-in Avatar Generation =====
    async generateAvatar() {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            
            // Generate unique color based on user ID
            // This ensures each user gets their own color
            const hue = this.currentUser?.uid ? 
                parseInt(this.currentUser.uid.substring(0, 8), 16) % 360 : 
                Math.floor(Math.random() * 360);
            
            // Create gradient background
            const gradient = ctx.createLinearGradient(0, 0, 200, 200);
            gradient.addColorStop(0, `hsl(${hue}, 80%, 65%)`);
            gradient.addColorStop(1, `hsl(${hue}, 80%, 45%)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 200, 200);
            
            // Get user initial
            let initial = '👤';
            if (this.currentUser?.email) {
                // Use first letter of email
                initial = this.currentUser.email[0].toUpperCase();
            } else if (this.currentUser?.displayName) {
                initial = this.currentUser.displayName[0].toUpperCase();
            } else if (this.currentUser?.uid) {
                // Use first character of uid if no email
                initial = this.currentUser.uid[0].toUpperCase();
            }
            
            // Draw initial
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.font = 'bold 80px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initial, 100, 110);
            
            // Reset shadow for patterns
            ctx.shadowColor = 'transparent';
            
            // Add decorative pattern
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(100, 100, 40 + i * 15, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            // Add small stars/dots
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            for (let i = 0; i < 5; i++) {
                const x = 50 + Math.random() * 100;
                const y = 50 + Math.random() * 100;
                ctx.beginPath();
                ctx.arc(x, y, 2 + Math.random() * 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Convert canvas to data URL
            resolve(canvas.toDataURL('image/png'));
        });
    }

    async createDefaultProfile() {
        try {
            // Generate avatar data URL (no external calls!)
            const avatarDataUrl = await this.generateAvatar();
            
            this.profile = {
                uid: this.currentUser.uid,
                displayName: this.currentUser.email ? this.currentUser.email.split('@')[0] : 'Anonymous User',
                email: this.currentUser.email || '',
                // Use generated avatar - no external dependencies!
                photoURL: avatarDataUrl,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                preferences: this.preferences,
                stats: {
                    totalTrips: 0,
                    totalDistance: 0,
                    totalDuration: 0,
                    achievements: []
                },
                friends: [],
                blockedUsers: []
            };

            const db = window.firebaseServices.db;
            await db.collection('users').doc(this.currentUser.uid).set(this.profile);
            console.log('✅ Default profile created with built-in avatar (no external dependencies)');
        } catch (error) {
            console.error('Failed to create default profile:', error);
        }
    }

    createProfileUI() {
        const existingPanel = document.getElementById('profilePanel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const profilePanel = document.createElement('div');
        profilePanel.className = 'profile-panel';
        profilePanel.id = 'profilePanel';
        profilePanel.innerHTML = `
            <div class="profile-header">
                <h4>👤 User Profile</h4>
                <button class="close-btn" id="closeProfileBtn">✕</button>
            </div>
            
            <div class="profile-avatar-section">
                <div class="avatar-container">
                    <img id="profileAvatar" src="${this.profile?.photoURL || ''}" alt="Avatar">
                    <div class="avatar-overlay" id="changeAvatarBtn">
                        <span>📷 Change</span>
                    </div>
                </div>
                <div class="avatar-controls">
                    <button class="btn-upload" id="uploadAvatarBtn">
                        Upload Photo
                    </button>
                    <button class="btn-generate" id="generateAvatarBtn">
                        🎨 Generate Avatar
                    </button>
                </div>
                <input type="file" id="avatarInput" accept="image/*" style="display: none;">
            </div>

            <div class="profile-info">
                <div class="info-group">
                    <label>Display Name</label>
                    <input type="text" id="displayName" value="${this.profile?.displayName || ''}" placeholder="Enter your name">
                </div>
                <div class="info-group">
                    <label>Email</label>
                    <input type="email" id="email" value="${this.profile?.email || ''}" readonly disabled>
                </div>
                <div class="info-group">
                    <label>Bio</label>
                    <textarea id="bio" rows="3" placeholder="Tell us about yourself...">${this.profile?.bio || ''}</textarea>
                </div>
                <div class="info-group">
                    <label>Location</label>
                    <input type="text" id="location" value="${this.profile?.location || ''}" placeholder="City, Country">
                </div>
            </div>

            <div class="profile-preferences">
                <h5>⚙️ Preferences</h5>
                <div class="pref-group">
                    <label>Units</label>
                    <select id="units">
                        <option value="metric" ${this.preferences.units === 'metric' ? 'selected' : ''}>Metric (km, m)</option>
                        <option value="imperial" ${this.preferences.units === 'imperial' ? 'selected' : ''}>Imperial (mi, ft)</option>
                    </select>
                </div>
                <div class="pref-group">
                    <label>Theme</label>
                    <select id="theme">
                        <option value="auto" ${this.preferences.theme === 'auto' ? 'selected' : ''}>Auto</option>
                        <option value="light" ${this.preferences.theme === 'light' ? 'selected' : ''}>Light</option>
                        <option value="dark" ${this.preferences.theme === 'dark' ? 'selected' : ''}>Dark</option>
                    </select>
                </div>
                <div class="pref-group">
                    <label>Privacy</label>
                    <select id="privacy">
                        <option value="public" ${this.preferences.privacy === 'public' ? 'selected' : ''}>Public</option>
                        <option value="friends" ${this.preferences.privacy === 'friends' ? 'selected' : ''}>Friends Only</option>
                        <option value="private" ${this.preferences.privacy === 'private' ? 'selected' : ''}>Private</option>
                    </select>
                </div>
                <div class="pref-group checkbox">
                    <label>
                        <input type="checkbox" id="notifications" ${this.preferences.notifications ? 'checked' : ''}>
                        Enable Notifications
                    </label>
                </div>
            </div>

            <div class="profile-stats">
                <h5>📊 Statistics</h5>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Total Trips</span>
                        <span class="stat-value" id="statTrips">${this.profile?.stats?.totalTrips || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Distance</span>
                        <span class="stat-value" id="statDistance">${this.formatDistance(this.profile?.stats?.totalDistance || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Total Time</span>
                        <span class="stat-value" id="statTime">${this.formatDuration(this.profile?.stats?.totalDuration || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Achievements</span>
                        <span class="stat-value" id="statAchievements">${this.profile?.stats?.achievements?.length || 0}</span>
                    </div>
                </div>
            </div>

            <div class="profile-actions">
                <button class="btn-save" id="saveProfileBtn">💾 Save Changes</button>
                <button class="btn-danger" id="deleteAccountBtn">⚠️ Delete Account</button>
            </div>
        `;

        document.body.appendChild(profilePanel);
    }

    initEventListeners() {
        document.getElementById('closeProfileBtn')?.addEventListener('click', () => {
            this.hidePanel();
        });

        document.getElementById('uploadAvatarBtn')?.addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });

        // UPDATED: Generate avatar button now uses built-in generation
        document.getElementById('generateAvatarBtn')?.addEventListener('click', async () => {
            try {
                this.showToast('🎨 Generating avatar...', 'info');
                const avatarDataUrl = await this.generateAvatar();
                
                // Update UI
                document.getElementById('profileAvatar').src = avatarDataUrl;
                
                // Save to profile
                this.profile.photoURL = avatarDataUrl;
                
                // Save to Firestore
                const db = window.firebaseServices.db;
                await db.collection('users').doc(this.currentUser.uid).update({
                    photoURL: avatarDataUrl
                });
                
                this.showToast('✅ Avatar generated and saved', 'success');
                
                if (window.analytics) {
                    window.analytics.trackEvent('avatar_generated');
                }
            } catch (error) {
                console.error('Avatar generation failed:', error);
                this.showToast('❌ Failed to generate avatar', 'error');
            }
        });

        document.getElementById('avatarInput')?.addEventListener('change', (e) => {
            this.handleAvatarUpload(e.target.files[0]);
        });

        document.getElementById('changeAvatarBtn')?.addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });

        document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
            this.saveProfile();
        });

        document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
            this.deleteAccount();
        });

        document.addEventListener('click', (e) => {
            const panel = document.getElementById('profilePanel');
            if (panel && panel.classList.contains('active') && 
                !panel.contains(e.target) && 
                !e.target.closest('.btn-primary')?.textContent.includes('Profile')) {
                this.hidePanel();
            }
        });
    }

    async handleAvatarUpload(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showToast('Image must be less than 5MB', 'error');
            return;
        }

        this.avatarFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('profileAvatar').src = e.target.result;
        };
        reader.readAsDataURL(file);

        await this.uploadAvatar(file);
    }

    async uploadAvatar(file) {
        try {
            this.showToast('📤 Uploading avatar...', 'info');

            const compressedFile = await this.compressImage(file);

            if (!firebase.storage) {
                throw new Error('Firebase Storage not available');
            }

            const storage = firebase.storage();
            const ref = storage.ref(`avatars/${this.currentUser.uid}`);
            await ref.put(compressedFile);

            const url = await ref.getDownloadURL();

            this.profile.photoURL = url;
            document.getElementById('profileAvatar').src = url;

            const db = window.firebaseServices.db;
            await db.collection('users').doc(this.currentUser.uid).update({
                photoURL: url
            });

            this.showToast('✅ Avatar uploaded successfully');
            
            if (window.analytics) {
                window.analytics.trackEvent('avatar_uploaded');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            this.showToast('❌ Failed to upload avatar: ' + error.message, 'error');
        }
    }

    async compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    let width = img.width;
                    let height = img.height;
                    const maxSize = 500;

                    if (width > height && width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', 0.8);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }

    async saveProfile() {
        try {
            const updates = {
                displayName: document.getElementById('displayName')?.value || '',
                bio: document.getElementById('bio')?.value || '',
                location: document.getElementById('location')?.value || '',
                preferences: {
                    units: document.getElementById('units')?.value || 'metric',
                    theme: document.getElementById('theme')?.value || 'auto',
                    privacy: document.getElementById('privacy')?.value || 'friends',
                    notifications: document.getElementById('notifications')?.checked || false,
                    language: this.preferences.language
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const db = window.firebaseServices.db;
            await db.collection('users').doc(this.currentUser.uid).update(updates);

            this.profile = { ...this.profile, ...updates };
            this.preferences = updates.preferences;
            
            this.showToast('✅ Profile saved successfully');
            this.applyTheme(updates.preferences.theme);

            if (window.analytics) {
                window.analytics.trackEvent('profile_updated');
            }

        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('❌ Failed to save profile: ' + error.message, 'error');
        }
    }

    applyTheme(theme) {
        if (theme === 'auto') {
            document.documentElement.style.removeProperty('color-scheme');
        } else {
            document.documentElement.style.colorScheme = theme;
        }
    }

    async deleteAccount() {
        if (!confirm('⚠️ Are you sure you want to delete your account?\n\nThis action cannot be undone! All your data will be permanently deleted.')) {
            return;
        }

        if (!confirm('This is your final warning! Deleting your account will remove all your trips, geofences, and profile data. Continue?')) {
            return;
        }

        try {
            this.showToast('🗑️ Deleting account...', 'info');

            const db = window.firebaseServices.db;
            await db.collection('users').doc(this.currentUser.uid).delete();

            const locations = await db.collection('locations').where('userId', '==', this.currentUser.uid).get();
            const batch = db.batch();
            locations.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            const geofences = await db.collection('geofences').where('userId', '==', this.currentUser.uid).get();
            const geofenceBatch = db.batch();
            geofences.docs.forEach(doc => {
                geofenceBatch.delete(doc.ref);
            });
            await geofenceBatch.commit();

            if (firebase.storage) {
                const storage = firebase.storage();
                const ref = storage.ref(`avatars/${this.currentUser.uid}`);
                await ref.delete().catch(() => {});
            }

            await this.currentUser.delete();

            this.showToast('✅ Account deleted');
            
            if (window.analytics) {
                window.analytics.trackEvent('account_deleted');
            }

            setTimeout(() => {
                window.location.href = '/smart-location-tracker/';
            }, 1500);

        } catch (error) {
            console.error('Delete failed:', error);
            this.showToast('❌ Failed to delete account: ' + error.message, 'error');
        }
    }

    async updateStats() {
        if (!this.currentUser || !window.locationHistory) return;

        try {
            const trips = window.locationHistory.trips || [];
            const stats = {
                totalTrips: trips.length,
                totalDistance: trips.reduce((sum, t) => sum + (t.distance || 0), 0),
                totalDuration: trips.reduce((sum, t) => sum + (t.duration || 0), 0)
            };

            const achievements = [];

            if (stats.totalTrips >= 1) achievements.push('first_trip');
            if (stats.totalTrips >= 10) achievements.push('explorer');
            if (stats.totalTrips >= 50) achievements.push('adventurer');
            if (stats.totalDistance >= 100000) achievements.push('marathoner');
            if (stats.totalDistance >= 1000000) achievements.push('globetrotter');
            if (stats.totalDuration >= 3600) achievements.push('time_traveler');
            if (stats.totalDuration >= 86400) achievements.push('day_tripper');

            stats.achievements = achievements;

            const db = window.firebaseServices.db;
            await db.collection('users').doc(this.currentUser.uid).update({ stats });
            
            this.updateStatsUI(stats);
            
            if (this.profile) {
                this.profile.stats = stats;
            }
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    updateStatsUI(stats) {
        const tripsEl = document.getElementById('statTrips');
        const distanceEl = document.getElementById('statDistance');
        const timeEl = document.getElementById('statTime');
        const achievementsEl = document.getElementById('statAchievements');

        if (tripsEl) tripsEl.textContent = stats.totalTrips;
        if (distanceEl) distanceEl.textContent = this.formatDistance(stats.totalDistance);
        if (timeEl) timeEl.textContent = this.formatDuration(stats.totalDuration);
        if (achievementsEl) achievementsEl.textContent = stats.achievements?.length || 0;
    }

    formatDistance(meters) {
        if (!meters && meters !== 0) return '0 m';
        
        if (this.preferences.units === 'metric') {
            return meters > 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
        } else {
            const miles = meters * 0.000621371;
            return miles > 0.1 ? `${miles.toFixed(1)} mi` : `${Math.round(miles * 5280)} ft`;
        }
    }

    formatDuration(seconds) {
        if (!seconds && seconds !== 0) return '0s';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        return `${secs}s`;
    }

    showPanel() {
        const panel = document.getElementById('profilePanel');
        if (panel) {
            panel.classList.add('active');
            this.updateStats();
        }
    }

    hidePanel() {
        const panel = document.getElementById('profilePanel');
        if (panel) {
            panel.classList.remove('active');
        }
    }

    showToast(message, type = 'success') {
        if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast(message, type);
        } else {
            console.log(`Toast (${type}): ${message}`);
        }
    }
}

// Initialize user profile when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!window.userProfile) {
            window.userProfile = new UserProfile();
        }
    }, 1000);
});

window.UserProfile = UserProfile;
