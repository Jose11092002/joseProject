// Base URL for the Catalyst Advanced I/O function
const API_BASE = '/server/jose-function';

// Current active form mode ('register' or 'login')
let currentMode = 'register';

// Elements
const authForm = document.getElementById('authForm');
const nameGroup = document.getElementById('nameGroup');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const statusBanner = document.getElementById('statusBanner');
const bannerTitle = document.getElementById('bannerTitle');
const bannerMessage = document.getElementById('bannerMessage');
const bannerHint = document.getElementById('bannerHint');
const refreshBtn = document.getElementById('refreshBtn');
const tableBody = document.getElementById('tableBody');
const tabRegister = document.getElementById('tabRegister');
const tabLogin = document.getElementById('tabLogin');
const formTitle = document.getElementById('formTitle');

/**
 * Switch form between Registration (inserts user record) and Login mode
 * @param {'register' | 'login'} mode 
 */
function switchMode(mode) {
    currentMode = mode;
    hideBanner();

    if (mode === 'register') {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        nameGroup.classList.remove('hidden');
        formTitle.textContent = 'Create New Account';
        btnText.textContent = 'Register & Insert into Data Store';
    } else {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        nameGroup.classList.add('hidden');
        formTitle.textContent = 'User Sign In';
        btnText.textContent = 'Log In & Record to Data Store';
    }
}

/**
 * Display status feedback banner
 * @param {'success' | 'error'} type 
 * @param {string} title 
 * @param {string} message 
 * @param {string|null} hint 
 */
function showBanner(type, title, message, hint = null) {
    statusBanner.className = `banner ${type}`;
    bannerTitle.textContent = title;
    bannerMessage.textContent = message;

    if (hint) {
        bannerHint.textContent = hint;
        bannerHint.classList.remove('hidden');
    } else {
        bannerHint.classList.add('hidden');
    }

    statusBanner.classList.remove('hidden');
}

/**
 * Hide feedback banner
 */
function hideBanner() {
    statusBanner.classList.add('hidden');
}

/**
 * Toggle button loading state
 * @param {boolean} isLoading 
 */
function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
        btnSpinner.classList.remove('hidden');
        btnText.textContent = 'Inserting into Catalyst...';
    } else {
        btnSpinner.classList.add('hidden');
        btnText.textContent = currentMode === 'register' 
            ? 'Register & Insert into Data Store' 
            : 'Log In & Record to Data Store';
    }
}

/**
 * Handle form submission and POST to Catalyst backend
 */
async function handleSubmit(event) {
    event.preventDefault();
    hideBanner();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const name = nameInput.value.trim();

    if (!email || !password) {
        showBanner('error', 'Missing Information', 'Please provide both email and password.');
        return;
    }

    setLoading(true);

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name || undefined,
                email: email,
                password: password,
                mode: currentMode
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showBanner(
                'success',
                'Success!',
                result.message || 'Data inserted successfully into Catalyst Data Store backend.'
            );
            passwordInput.value = '';
            // Refresh table to show the newly inserted row
            await fetchUsers();
        } else {
            showBanner(
                'error',
                'Backend Error',
                result.message || 'Failed to insert data.',
                result.hint || result.error || null
            );
        }
    } catch (err) {
        console.error('Fetch error:', err);
        showBanner(
            'error',
            'Connection Error',
            'Could not communicate with the Catalyst function.',
            'Make sure you are running "catalyst serve" and accessing the app via the local test URL.'
        );
    } finally {
        setLoading(false);
    }
}

/**
 * Fetch stored user records from the Catalyst backend
 */
async function fetchUsers() {
    tableBody.innerHTML = `
        <tr class="placeholder-row">
            <td colspan="4">Loading records from Catalyst Data Store...</td>
        </tr>
    `;

    try {
        const response = await fetch(`${API_BASE}/users`);
        const result = await response.json();

        if (response.ok && result.success && Array.isArray(result.data) && result.data.length > 0) {
            tableBody.innerHTML = '';
            result.data.forEach(user => {
                const tr = document.createElement('tr');
                const formattedTime = user.LoginTime 
                    ? new Date(user.LoginTime).toLocaleString() 
                    : (user.CREATEDTIME || '—');

                tr.innerHTML = `
                    <td><strong>${escapeHtml(user.ROWID || '—')}</strong></td>
                    <td>${escapeHtml(user.Name || '—')}</td>
                    <td>${escapeHtml(user.Email || '—')}</td>
                    <td><small>${escapeHtml(formattedTime)}</small></td>
                `;
                tableBody.appendChild(tr);
            });
        } else if (response.ok && result.success && Array.isArray(result.data) && result.data.length === 0) {
            tableBody.innerHTML = `
                <tr class="placeholder-row">
                    <td colspan="4">No users found in Data Store yet. Submit the form on the left to add one!</td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = `
                <tr class="placeholder-row">
                    <td colspan="4" style="color: var(--error);">
                        ${escapeHtml(result.message || 'Could not fetch Data Store records.')}
                        ${result.hint ? `<br><small style="color: var(--text-muted);">${escapeHtml(result.hint)}</small>` : ''}
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Fetch users error:', err);
        tableBody.innerHTML = `
            <tr class="placeholder-row">
                <td colspan="4">Backend server not reachable. Run <code>catalyst serve</code> to start.</td>
            </tr>
        `;
    }
}

/**
 * Simple HTML sanitizer to prevent XSS in table rendering
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Event Listeners
authForm.addEventListener('submit', handleSubmit);
refreshBtn.addEventListener('click', fetchUsers);

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    switchMode('register');
    fetchUsers();
});
