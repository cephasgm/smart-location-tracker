// user-profile.js - Professional user profiles with avatars

class UserProfile {
    constructor() {
        this.currentUser = null;
        this.profile = null;
        this.avatarFile = null;
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
        await this.loadUserProfile();
        this.createProfileUI();
        this.initEventListeners();
    }

    async loadUserProfile() {
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
            } else {
                // Create default profile
                this.profile = {
                    uid: this.currentUser.uid,
                    displayName: this.currentUser.email || 'Anonymous User',
                    email: this.currentUser.email,
                    photoURL: this.currentUser.photoURL || '/default-avatar.png',
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

                await db.collection('users').doc(this.currentUser.uid).set(this.profile);
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    createProfileUI() {
        const profilePanel = document.createElement('div');
        profilePanel.className = 'profile-panel';
        profilePanel.id = 'profilePanel';
        profilePanel.innerHTML = `
            <div class="profile-header">
                <h4>👤 User Profile</h4>
                <button class="close-btn" onclick="document.getElementById('profilePanel').classList.remove('active')">✕</button>
            </div>
            
            <div class="profile-avatar-section">
                <div class="avatar-container">
                    <img id="profileAvatar" src="${this.profile?.photoURL || '/default-avatar.png'}" alt="Avatar">
                    <div class="avatar-overlay" onclick="userProfile.changeAvatar()">
                        <span>📷 Change</span>
                    </div>
                </div>
                <div class="avatar-controls">
                    <button class="btn-upload" onclick="document.getElementById('avatarInput').click()">
                        Upload Photo
                    </button>
                    <button class="btn-generate" onclick="userProfile.generateAvatar()">
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
                <button class="btn-save" onclick="userProfile.saveProfile()">💾 Save Changes</button>
                <button class="btn-danger" onclick="userProfile.deleteAccount()">⚠️ Delete Account</button>
            </div>
        `;

        document.body.appendChild(profilePanel);
    }

    initEventListeners() {
        // Avatar upload
        document.getElementById('avatarInput')?.addEventListener('change', (e) => {
            this.handleAvatarUpload(e.target.files[0]);
        });
    }

    async handleAvatarUpload(file) {
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showToast('Image must be less than 5MB', 'error');
            return;
        }

        this.avatarFile = file;

        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('profileAvatar').src = e.target.result;
        };
        reader.readAsDataURL(file);

        // Upload
        await this.uploadAvatar(file);
    }

    async uploadAvatar(file) {
        try {
            this.showToast('📤 Uploading avatar...', 'info');

            // Compress image
            const compressedFile = await this.compressImage(file);

            // Upload to Firebase Storage
            const storage = firebase.storage();
            const ref = storage.ref(`avatars/${this.currentUser.uid}`);
            await ref.put(compressedFile);

            // Get download URL
            const url = await ref.getDownloadURL();

            // Update profile
            this.profile.photoURL = url;
            document.getElementById('profileAvatar').src = url;

            // Save to Firestore
            const db = window.firebaseServices.db;
            await db.collection('users').doc(this.currentUser.uid).update({
                photoURL: url
            });

            this.showToast('✅ Avatar uploaded successfully');
        } catch (error) {
            console.error('Upload failed:', error);
            this.showToast('❌ Failed to upload avatar', 'error');
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

                    // Calculate new dimensions (max 500px)
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

    async generateAvatar() {
        // Generate random avatar using DiceBear API
        const seed = this.currentUser?.uid || Math.random().toString(36);
        const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

        // Convert SVG to PNG
        try {
            const response = await fetch(avatarUrl);
            const svg = await response.text();

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = async () => {
                canvas.width = 200;
                canvas.height = 200;
                ctx.drawImage(img, 0, 0, 200, 200);

                canvas.toBlob(async (blob) => {
                    await this.uploadAvatar(blob);
                }, 'image/png');
            };

            img.src = 'data:image/svg+xml;base64,' + btoa(svg);
        } catch (error) {
            console.error('Avatar generation failed:', error);
        }
    }

    async saveProfile() {
        try {
            const updates = {
                displayName: document.getElementById('displayName')?.value,
                bio: document.getElementById('bio')?.value,
                location: document.getElementById('location')?.value,
                preferences: {
                    units: document.getElementById('units')?.value,
                    theme: document.getElementById('theme')?.value,
                    privacy: document.getElementById('privacy')?.value,
                    notifications: document.getElementById('notifications')?.checked,
                    language: this.preferences.language
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const db = window.firebaseServices.db;
            await db.collection('users').doc(this.currentUser.uid).update(updates);

            this.profile = { ...this.profile, ...updates };
            this.showToast('✅ Profile saved successfully');

            // Apply theme
            this.applyTheme(updates.preferences.theme);

        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('❌ Failed to save profile', 'error');
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
        if (!confirm('Are you sure you want to delete your account? This action cannot be undone!')) {
            return;
        }

        try {
            this.showToast('🗑️ Deleting account...', 'info');

            // Delete user data from Firestore
            const db = window.firebaseServices.db;
            await db.collection('users').doc(this.currentUser.uid).delete();

            // Delete avatar from Storage
            const storage = firebase.storage();
            const ref = storage.ref(`avatars/${this.currentUser.uid}`);
            await ref.delete().catch(() => {}); // Ignore if no avatar

            // Delete user from Firebase Auth
            await this.currentUser.delete();

            this.showToast('✅ Account deleted');
            window.location.reload();

        } catch (error) {
            console.error('Delete failed:', error);
            this.showToast('❌ Failed to delete account', 'error');
        }
    }

    async updateStats() {
        if (!this.currentUser || !window.locationHistory) return;

        const trips = window.locationHistory.trips;
        const stats = {
            totalTrips: trips.length,
            totalDistance: trips.reduce((sum, t) => sum + t.distance, 0),
            totalDuration: trips.reduce((sum, t) => sum + t.duration, 0)
        };

        // Check for achievements
        const achievements = [];

        if (stats.totalTrips >= 1) achievements.push('first_trip');
        if (stats.totalTrips >= 10) achievements.push('explorer');
        if (stats.totalTrips >= 50) achievements.push('adventurer');
        if (stats.totalDistance >= 100000) achievements.push('marathoner');
        if (stats.totalDistance >= 1000000) achievements.push('globetrotter');

        stats.achievements = achievements;

        try {
            const db = window.firebaseServices.db;
            await db.collection('users').doc(this.currentUser.uid).update({ stats });
            this.updateStatsUI(stats);
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    updateStatsUI(stats) {
        document.getElementById('statTrips').textContent = stats.totalTrips;
        document.getElementById('statDistance').textContent = this.formatDistance(stats.totalDistance);
        document.getElementById('statTime').textContent = this.formatDuration(stats.totalDuration);
        document.getElementById('statAchievements').textContent = stats.achievements?.length || 0;
    }

    formatDistance(meters) {
        if (this.preferences.units === 'metric') {
            return meters > 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
        } else {
            const miles = meters * 0.000621371;
            return miles > 0.1 ? `${miles.toFixed(1)} mi` : `${Math.round(miles * 5280)} ft`;
        }
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        }
        return `${Math.floor(seconds)}s`;
    }

    showPanel() {
        document.getElementById('profilePanel').classList.add('active');
        this.updateStats();
    }

    showToast(message, type = 'success') {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }
}

// Initialize user profile
const userProfile = new UserProfile();
window.userProfile = userProfile;
