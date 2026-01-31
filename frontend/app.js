const { createApp } = Vue;

const API_BASE_URL = 'http://localhost:8000/api';

// Google Sign-In callback
window.handleGoogleLogin = async function(response) {
    const app = window.vueApp;
    if (app && app.handleGoogleAuth) {
        await app.handleGoogleAuth(response.credential);
    }
};

const app = createApp({
    data() {
        return {
            isAuthenticated: false,
            user: null,
            token: null,
            currentView: 'dashboard',
            dashboard: {
                stage1_status: 'not_started',
                stage1_result: null,
                stage2_status: 'locked',
                stage2_project: null
            },
            notifications: [],
            notificationCount: 0,
            showNotifications: false,
            leaderboard: [],
            profileForm: {
                phone: '',
                college_name: '',
                branch: '',
                year_of_study: null,
                github_url: '',
                linkedin_url: ''
            }
        };
    },
    computed: {
        stage1Status() {
            return this.dashboard.stage1_status || 'not_started';
        },
        stage2Status() {
            return this.dashboard.stage2_status || 'locked';
        },
        isProfileComplete() {
            return this.user && 
                   this.user.phone && 
                   this.user.college_name && 
                   this.user.branch && 
                   this.user.year_of_study;
        }
    },
    methods: {
        async handleGoogleAuth(credential) {
            try {
                const response = await axios.post(`${API_BASE_URL}/auth/google`, {
                    token: credential
                });

                this.token = response.data.access_token;
                this.user = response.data.user;
                this.isAuthenticated = true;

                // Save token to localStorage
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));

                // Set axios default header
                axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;

                // Load dashboard
                await this.loadDashboard();
                
                // Show success message
                this.showMessage('Login successful!', 'success');
            } catch (error) {
                console.error('Authentication failed:', error);
                this.showMessage('Authentication failed. Please try again.', 'error');
            }
        },

        async loadDashboard() {
            try {
                const response = await axios.get(`${API_BASE_URL}/dashboard`);
                this.dashboard = response.data;
                this.notificationCount = response.data.notifications_count || 0;
                
                // Update user info
                if (response.data.user) {
                    this.user = response.data.user;
                    localStorage.setItem('user', JSON.stringify(this.user));
                }
                
                // Populate profile form
                this.populateProfileForm();
            } catch (error) {
                console.error('Failed to load dashboard:', error);
                if (error.response && error.response.status === 401) {
                    this.logout();
                }
            }
        },

        async loadNotifications() {
            try {
                const response = await axios.get(`${API_BASE_URL}/notifications`);
                this.notifications = response.data;
                this.showNotifications = true;
                
                // Mark all as read
                for (const notification of this.notifications) {
                    if (!notification.is_read) {
                        await axios.put(`${API_BASE_URL}/notifications/${notification.id}/read`);
                    }
                }
                
                this.notificationCount = 0;
            } catch (error) {
                console.error('Failed to load notifications:', error);
            }
        },

        populateProfileForm() {
            if (this.user) {
                this.profileForm = {
                    phone: this.user.phone || '',
                    college_name: this.user.college_name || '',
                    branch: this.user.branch || '',
                    year_of_study: this.user.year_of_study || null,
                    github_url: this.user.github_url || '',
                    linkedin_url: this.user.linkedin_url || ''
                };
            }
        },

        async updateProfile() {
            try {
                const response = await axios.put(`${API_BASE_URL}/auth/profile`, this.profileForm);
                this.user = response.data;
                localStorage.setItem('user', JSON.stringify(this.user));
                
                this.showMessage('Profile updated successfully!', 'success');
            } catch (error) {
                console.error('Failed to update profile:', error);
                this.showMessage('Failed to update profile. Please try again.', 'error');
            }
        },

        logout() {
            this.isAuthenticated = false;
            this.user = null;
            this.token = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            delete axios.defaults.headers.common['Authorization'];
            this.currentView = 'dashboard';
        },

        checkAuth() {
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');

            if (token && user) {
                this.token = token;
                this.user = JSON.parse(user);
                this.isAuthenticated = true;
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                
                // Load dashboard
                this.loadDashboard();
            }
        },

        formatDate(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return 'Just now';
            if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
            if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
            if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
            
            return date.toLocaleDateString();
        },

        showMessage(message, type = 'info') {
            // Simple alert for now - can be replaced with toast notifications
            if (type === 'error') {
                alert('Error: ' + message);
            } else {
                alert(message);
            }
        },

        goToExam() {
            window.location.href = 'exam.html';
        },

        async loadLeaderboard() {
            try {
                const response = await axios.get(`${API_BASE_URL}/stage1/leaderboard?limit=20`);
                this.leaderboard = response.data;
            } catch (error) {
                console.error('Failed to load leaderboard:', error);
                this.showMessage('Failed to load leaderboard.', 'error');
            }
        }
    },
    mounted() {
        // Check if user is already authenticated
        this.checkAuth();
        
        // Store Vue app instance globally for Google callback
        window.vueApp = this;
    }
});

app.mount('#app');