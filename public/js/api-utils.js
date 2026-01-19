// Utility for handling API calls with automatic token expiration handling
class ApiClient {
    constructor() {
        this.baseURL = '';
    }

    async request(url, options = {}) {
        const token = localStorage.getItem('auth_token');
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // Handle token expiration
            if (response.status === 401 || response.status === 403) {
                const data = await response.json().catch(() => ({}));
                if (data.error && (data.error.includes('токен') || data.error.includes('token') || 
                    data.error.includes('Недействительный') || data.error.includes('invalid'))) {
                    // Clear invalid token
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_info');
                    
                    // Redirect to login with current page as redirect
                    const currentUrl = encodeURIComponent(window.location.href);
                    window.location.href = `/login?redirect=${currentUrl}`;
                    return null;
                }
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            // Network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Ошибка сети. Проверьте подключение к интернету.');
            }
            throw error;
        }
    }

    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async delete(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'DELETE',
            body: JSON.stringify(data)
        });
    }

    async postFormData(url, formData, options = {}) {
        const token = localStorage.getItem('auth_token');
        const headers = { ...options.headers };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                method: 'POST',
                headers,
                body: formData
            });

            if (response.status === 401 || response.status === 403) {
                const data = await response.json().catch(() => ({}));
                if (data.error && (data.error.includes('токен') || data.error.includes('token') || 
                    data.error.includes('Недействительный') || data.error.includes('invalid'))) {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user_info');
                    const currentUrl = encodeURIComponent(window.location.href);
                    window.location.href = `/login?redirect=${currentUrl}`;
                    return null;
                }
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Ошибка сети. Проверьте подключение к интернету.');
            }
            throw error;
        }
    }
}

// Global API client instance
window.apiClient = new ApiClient();
