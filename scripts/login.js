// Login functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    const loginButton = loginForm.querySelector('.login-button');

    // Toggle password visibility
    togglePasswordBtn.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Change icon based on visibility
        const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
        if (type === 'text') {
            eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
            eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
    });

    // Handle form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Hide any existing error messages
        errorMessage.style.display = 'none';
        
        // Get form values
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        // Basic validation
        if (!username || !password) {
            showError('Please enter both username and password.');
            return;
        }
        
        // Show loading state
        loginButton.classList.add('loading');
        loginButton.querySelector('.button-text').textContent = 'Signing in...';
        
        // Simulate authentication (replace with actual authentication logic)
        setTimeout(() => {
            // For now, we'll accept any non-empty credentials
            // In a real application, this would check against a backend/database
            if (authenticateUser(username, password)) {
                // Store user session
                const userData = {
                    username: username,
                    loginTime: new Date().toISOString(),
                    company: getCompanyForUser(username) // This would come from backend
                };
                
                // Store in sessionStorage (or localStorage if "remember me" is checked)
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem('userSession', JSON.stringify(userData));
                
                // Redirect to marketplace page
                window.location.href = 'marketplace.html';
            } else {
                showError('Invalid username or password. Please try again.');
                loginButton.classList.remove('loading');
                loginButton.querySelector('.button-text').textContent = 'Sign In';
            }
        }, 1000);
    });
    
    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    
    // Temporary authentication function (replace with real authentication)
    function authenticateUser(username, password) {
        // For demonstration purposes, accept any credentials with length > 3
        // In production, this would validate against a backend API
        return username.length >= 3 && password.length >= 3;
    }
    
    // Get company for user (placeholder - would come from backend)
    function getCompanyForUser(username) {
        // This is mock data - in production, this would be retrieved from backend
        const mockCompanies = {
            'admin': 'Rosneft',
            'company1': 'Subsidiary A',
            'company2': 'Subsidiary B',
            'company3': 'Subsidiary C'
        };
        
        return mockCompanies[username.toLowerCase()] || 'Company ' + username;
    }
    
    // Check if user is already logged in
    const existingSession = sessionStorage.getItem('userSession') || localStorage.getItem('userSession');
    if (existingSession) {
        // Optionally redirect to marketplace if already logged in
        // window.location.href = 'marketplace.html';
    }
});

