// Form switching functionality
const loginForm = document.getElementById('loginForm');
const signUpForm = document.getElementById('signUpForm');
const forgetPasswordForm = document.getElementById('forgetPasswordForm');

const signUpLink = document.getElementById('signUpLink');
const loginLink = document.getElementById('loginLink');
const forgetPasswordLink = document.getElementById('forgetPasswordLink');
const backToLoginLink = document.getElementById('backToLoginLink');

function showForm(formToShow) {
    loginForm.classList.remove('active');
    signUpForm.classList.remove('active');
    forgetPasswordForm.classList.remove('active');
    formToShow.classList.add('active');
}

signUpLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(signUpForm);
});

loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(loginForm);
});

forgetPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(forgetPasswordForm);
});

backToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForm(loginForm);
});

// User data storage (in production, this would be server-side)
function getUsers() {
    return JSON.parse(localStorage.getItem('users')) || [];
}

function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

// Login functionality
const btn = document.getElementById('vanishBtn');
const userInp = document.getElementById('username');
const passInp = document.getElementById('password');

// The "Evasive" Logic
btn.addEventListener('mouseover', () => {
    // Only vanish if fields are empty
    if (userInp.value.trim() === "" || passInp.value.trim() === "") {
        // Make it disappear instantly
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none'; // Prevent clicking while invisible

        // Make it dramatic by reappearing after 500ms
        setTimeout(() => {
            btn.classList.remove('pop-up'); // Reset animation
            void btn.offsetWidth;  // Trigger reflow to restart animation

            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';

            btn.classList.add('pop-up'); // Play pop animation
        }, 600);
    }
});

// Final check to prevent keyboard users from bypassing
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (userInp.value.trim() === "" || passInp.value.trim() === "") {
        alert("The button is trying to tell you something... Please fill the fields.");
        return;
    }

    const users = getUsers();
    const user = users.find(u => u.username === userInp.value.trim() && u.password === passInp.value.trim());

    if (user) {
        alert("Access Granted! Welcome back, " + user.username + "!");
        // In a real app, you'd redirect to dashboard or set session
    } else {
        alert("Invalid username or password!");
    }
});

// Sign up functionality
document.getElementById('signUpForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const email = document.getElementById('signUpEmail').value.trim();
    const username = document.getElementById('signUpUsername').value.trim();
    const password = document.getElementById('signUpPassword').value.trim();
    const confirmPassword = document.getElementById('signUpConfirmPassword').value.trim();
    const warning = document.getElementById('signUpWarning');

    warning.textContent = '';

    if (!email || !username || !password || !confirmPassword) {
        warning.textContent = 'Please fill all fields';
        return;
    }

    if (password !== confirmPassword) {
        warning.textContent = 'Passwords do not match';
        return;
    }

    if (password.length < 6) {
        warning.textContent = 'Password must be at least 6 characters';
        return;
    }

    const users = getUsers();

    // Check if username or email already exists
    if (users.some(u => u.username === username)) {
        warning.textContent = 'Username already exists';
        return;
    }

    if (users.some(u => u.email === email)) {
        warning.textContent = 'Email already registered';
        return;
    }

    // Add new user
    users.push({ email, username, password });
    saveUsers(users);

    alert('Account created successfully! Please login.');
    showForm(loginForm);

    // Clear form
    document.getElementById('signUpEmail').value = '';
    document.getElementById('signUpUsername').value = '';
    document.getElementById('signUpPassword').value = '';
    document.getElementById('signUpConfirmPassword').value = '';
});

// Forget password functionality
document.getElementById('forgetPasswordForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const email = document.getElementById('forgetEmail').value.trim();
    const warning = document.getElementById('forgetWarning');

    warning.textContent = '';

    if (!email) {
        warning.textContent = 'Please enter your email';
        return;
    }

    const users = getUsers();
    const user = users.find(u => u.email === email);

    if (user) {
        // In a real app, you'd send a reset email
        alert('Password reset link sent to ' + email + '. (This is a demo - check console for reset code)');
        console.log('Reset code for ' + user.username + ': 123456');
        showForm(loginForm);
    } else {
        warning.textContent = 'Email not found';
    }

    document.getElementById('forgetEmail').value = '';
});