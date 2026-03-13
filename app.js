// Initialize Firebase
// User Isolation: All data is stored under /users/{firebase_uid}/data/{key}
// This ensures each Google account has its own isolated data space.
let SHOP_ID = "default_shop"; // Fallback before login
const getPath = (key) => {
    if (currentUser && currentUser.id) {
        // Secure path: /users/{firebase_uid}/data/{key}
        return `users/${currentUser.id}/data/${key}`;
    }
    return `${SHOP_ID}/${key}`;
};

// Data Models (Loaded from Firebase)
let orders = [];
let transactions = [];
let shopSettings = JSON.parse(localStorage.getItem('alAbbasiShopSettings')) || {
    name: 'Jabli ERP', tagline: 'Your Smart Business Partner', logo: null, address: '', phone: '', social: '',
    billHeaderColor: '#1e40af', billHeaderTextColor: '#ffffff', billFooterColor: '#1e40af',
    billFont: "'Outfit', sans-serif", billFontSize: 18,
    billHeaderType: 'solid', billHeaderGrad1: '#1e40af', billHeaderGrad2: '#1d4ed8', billHeaderGradDir: 'to right',
    billHeaderBgImage: null, billHeaderText: '', billFooterText: '',
    billLogoPosition: 'right', billStripBg: '#f8f9fa', billStripTextColor: '#333333',
    billFooterBg: '#1e40af', billFooterTextColor: '#ffffff',
    billNameFont: "'Noto Nastaliq Urdu', serif",
    qrBaseUrl: '',
    users: [
        { username: 'admin', pin: 'admin123', role: 'admin' },
        { username: 'staff1', pin: '1234', role: 'staff' },
        { username: 'staff2', pin: '4321', role: 'staff' }
    ]
};

// Safety check for older settings
if (!shopSettings.users || !Array.isArray(shopSettings.users)) {
    shopSettings.users = [
        { username: 'admin', pin: 'admin123', role: 'admin' },
        { username: 'staff1', pin: '1234', role: 'staff' }
    ];
}
let products = [];
let deletedOrders = [];
let orderCategories = [
    { id: 'stationery', label: 'اسٹیشنری' },
    { id: 'printing', label: 'پرنٹنگ' },
    { id: 'online', label: 'آنلائن سروسز' }
];
let orderStatuses = JSON.parse(localStorage.getItem('alAbbasiOrderStatuses')) || [
    { id: 'progress', label: 'زیر تکمیل', color: 'status-progress', isFinal: false },
    { id: 'designing', label: 'ڈیزائننگ', color: 'status-designing', isFinal: false },
    { id: 'printing', label: 'پرنٹنگ', color: 'status-printing', isFinal: false },
    { id: 'pasting', label: 'پیسٹنگ', color: 'status-pasting', isFinal: false },
    { id: 'completed', label: 'مکمل', color: 'status-completed', isFinal: true }
];

function cleanupOldDeletedOrders() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const initialCount = deletedOrders.length;
    deletedOrders = deletedOrders.filter(order => {
        const deletedAt = new Date(order.deletedAt);
        return deletedAt > thirtyDaysAgo;
    });

    if (deletedOrders.length !== initialCount) {
        window.saveDeletedOrders();
        console.log(`Cleaned up ${initialCount - deletedOrders.length} old deleted orders.`);
    }
}
cleanupOldDeletedOrders();

const defaultUsers = {
    owner1: { id: 'owner1', name: 'محمد معوذ جبلی', role: 'superadmin', avatar: 'م', color: '#f3e8ff', textColor: '#9333ea', pass: '1234' },
    owner2: { id: 'owner2', name: 'عمر فاروق لدھیانوی', role: 'admin', avatar: 'ع', color: 'var(--primary)', textColor: 'white', pass: '1234' },
    staff1: { id: 'staff1', name: 'حاشر', role: 'staff', avatar: 'ح', color: 'var(--warning-light)', textColor: 'var(--warning)', pass: '0000' },
    staff2: { id: 'staff2', name: 'حسن', role: 'staff', avatar: 'ح', color: 'var(--info-light)', textColor: 'var(--info)', pass: '0000' }
};

// Custom Toast Notification System
window.showToast = function (message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'information-circle-outline';
    if (type === 'success') icon = 'checkmark-circle-outline';
    if (type === 'error') icon = 'alert-circle-outline';

    // Auto-detect type based on keywords if type is info
    if (type === 'info') {
        if (message.includes('کامیابی') || message.includes('شامل') || message.includes('تیار') || message.includes('محفوظ') || message.includes('مکمل')) {
            type = 'success';
            toast.className = `toast success`;
            icon = 'checkmark-circle-outline';
        } else if (message.includes('غلط') || message.includes('مسئلہ') || message.includes('براہ کرم') || message.includes('صرف') || message.includes('نہیں')) {
            type = 'error';
            toast.className = `toast error`;
            icon = 'close-circle-outline';
        }
    }

    toast.innerHTML = `
        <ion-icon name="${icon}"></ion-icon>
        <span style="flex: 1; font-family: inherit;">${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:20px; display:flex; align-items:center;">
            <ion-icon name="close-outline"></ion-icon>
        </button>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 300);
        }
    }, 5000);
}

// Override default alert
window.alert = function (message) {
    showToast(message);
}

let USERS = {};

// If localStorage is completely empty, invalid, or an array, reset to defaults
if (!USERS || typeof USERS !== 'object' || Array.isArray(USERS) || Object.keys(USERS).length === 0) {
    USERS = JSON.parse(JSON.stringify(defaultUsers));
}

// Ensure 'admin' from shopSettings is migrated if missing
if (shopSettings.users && Array.isArray(shopSettings.users)) {
    shopSettings.users.forEach(u => {
        const existing = Object.values(USERS).find(user => user.name === u.username);
        if (!existing) {
            const id = 'user_' + Date.now() + Math.floor(Math.random() * 1000);
            USERS[id] = {
                id,
                name: u.username,
                role: u.role || 'staff',
                pass: u.pin,
                avatar: u.username.charAt(0).toUpperCase(),
                color: 'var(--primary)',
                textColor: 'white'
            };
        }
    });
    // Optional: cleanup legacy array to prevent confusion
    // delete shopSettings.users; 
}

localStorage.setItem('alAbbasiUsers', JSON.stringify(USERS));

// Force owner1 to always be super admin
if (USERS.owner1) {
    USERS.owner1.role = 'superadmin';
}

let currentUser = null; // Default to none, needs login
let currentRole = null;

// Save functions refactored for Firebase Modular SDK
window.saveUsers = function () {
    fbSet(fbRef(db, getPath('users')), USERS);
}

window.saveTransactions = function () {
    fbSet(fbRef(db, getPath('transactions')), transactions);
    if (currentUser) syncToDriveDebounced();
}

window.saveProducts = function () {
    fbSet(fbRef(db, getPath('products')), products);
    if (currentUser) syncToDriveDebounced();
}

window.saveOrders = function () {
    fbSet(fbRef(db, getPath('orders')), orders);
    if (typeof updateTabCounts === 'function') updateTabCounts();
    if (currentUser) syncToDriveDebounced();
}

window.saveShopSettings = function () {
    fbSet(fbRef(db, getPath('shopSettings')), shopSettings);
}

window.saveDeletedOrders = function () {
    fbSet(fbRef(db, getPath('deletedOrders')), deletedOrders);
}

window.saveOrderStatuses = function () {
    fbSet(fbRef(db, getPath('orderStatuses')), orderStatuses);
}

window.saveOrderCategories = function () {
    fbSet(fbRef(db, getPath('orderCategories')), orderCategories);
}

// ---- Debounced Google Drive Sync ----
// This is called automatically after every save (orders, transactions, products).
// It waits 5 seconds after the last call to avoid uploading too frequently.
let _driveSyncTimer = null;
function syncToDriveDebounced() {
    if (_driveSyncTimer) clearTimeout(_driveSyncTimer);
    _driveSyncTimer = setTimeout(() => {
        // Only sync if user has linked their Google Drive
        const uid = currentUser ? currentUser.id : null;
        const token = uid ? localStorage.getItem(`gdrive_token_${uid}`) : localStorage.getItem('gdrive_token');
        if (token) {
            console.log('[Drive] Auto-syncing after data change...');
            manualGDriveSync();
        }
    }, 5000); // 5 second debounce
}

// Add a new transaction
// type: 'income', 'expense', 'handover'
function addTransaction(type, amount, userId, description, relatedId = null, handOverToId = null) {
    const trx = {
        id: 'TRX-' + Date.now(),
        type,
        amount,
        userId,
        description,
        relatedId,
        handOverToId,
        date: new Date().toISOString()
    };
    transactions.push(trx);
    saveTransactions();
}

// Initial Dummy Data if empty
if (orders.length === 0) {
    orders = [
        {
            id: 'ORD-1001',
            customerName: 'علی رضا',
            category: 'printing',
            details: 'سکول یونیفارم پینافلیکس',
            status: 'designing',
            totalAmount: 2500,
            advance: 1250,
            date: new Date().toISOString()
        },
        {
            id: 'ORD-1002',
            customerName: 'اسامہ کالج',
            category: 'stationery',
            details: '100 نوٹس کاپیاں',
            status: 'completed',
            totalAmount: 10000,
            advance: 8000,
            date: new Date(Date.now() - 86400000).toISOString()
        }
    ];
    saveOrders();
}

// Save to Firebase
function saveOrders() {
    window.saveOrders();
    localStorage.setItem('alAbbasiOrders', JSON.stringify(orders));
}

// Generate New Order ID
function generateOrderId() {
    if (orders.length === 0) return 'ORD-1001';
    const lastId = orders[orders.length - 1].id;
    const num = parseInt(lastId.split('-')[1]);
    return `ORD-${num + 1}`;
}

// Format Currency
function formatCurrency(amount) {
    return 'Rs. ' + amount.toLocaleString('en-PK');
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (typeof applyShopSettings === 'function') applyShopSettings();

    // Safely call setup functions if they exist
    if (typeof setupLogin === 'function') setupLogin();
    if (typeof setupNavigation === 'function') setupNavigation();
    if (typeof setupModal === 'function') setupModal();
    if (typeof setupUserToggle === 'function') setupUserToggle();
    if (typeof setupFinanceModals === 'function') setupFinanceModals();
    if (typeof setupSettingsModal === 'function') setupSettingsModal();
    if (typeof setupManageUsersModal === 'function') setupManageUsersModal();
    if (typeof setupShopSettingsModal === 'function') setupShopSettingsModal();
    if (typeof setupProductsPage === 'function') setupProductsPage();
    if (typeof populateOrderProducts === 'function') populateOrderProducts();

    // The main entry point for login and dynamic setup
    if (typeof initDynamicUI === 'function') initDynamicUI();
});

// --- Auto-Logout / Inactivity Timer Logic ---
let lastActivityTime = Date.now();
const INACTIVITY_LIMIT = 20 * 60 * 1000; // 20 minutes

function resetInactivityTimer() {
    lastActivityTime = Date.now();
}

function startInactivityCheck() {
    // Check every minute
    setInterval(() => {
        if (currentUser && (Date.now() - lastActivityTime > INACTIVITY_LIMIT)) {
            console.log("Inactivity limit reached. Logging out...");
            logoutUser();
        }
    }, 60000);

    // Activity listeners
    ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer, true);
    });
}
startInactivityCheck();

function applyShopSettings() {
    // Top-left sidebar
    const sidebarText = document.getElementById('sidebarShopNameText');
    if (sidebarText) sidebarText.innerText = shopSettings.name;
    const sLogo = document.getElementById('sidebarShopLogoImg');
    if (sLogo) {
        if (shopSettings.logo) {
            sLogo.outerHTML = `<img src="${shopSettings.logo}" id="sidebarShopLogoImg" alt="Logo">`;
        } else {
            sLogo.outerHTML = `<ion-icon name="print" id="sidebarShopLogoImg"></ion-icon>`;
        }
    }
    // Note: login screen elements (loginShopNameText, loginLogoImg) have been removed in the new glassmorphism design
}

// Page Switching Logic
window.switchPage = function (pageId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.style.display = 'block';

    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navItem = document.getElementById('nav' + pageId.charAt(0).toUpperCase() + pageId.slice(1).replace('Page', ''));
    if (navItem) navItem.classList.add('active');

    // Special logic for pages
    if (pageId === 'ordersPage') {
        renderOrdersList();
    } else if (pageId === 'settingsPage') {
        renderManageUsersList();
        // Pre-fill shop settings
        document.getElementById('settingShopName').value = shopSettings.name;
        document.getElementById('settingShopAddress').value = shopSettings.address || '';
        document.getElementById('settingShopPhone').value = shopSettings.phone || '';
        document.getElementById('settingShopSocial').value = shopSettings.social || '';
        document.getElementById('settingQrBaseUrl').value = shopSettings.qrBaseUrl || '';

        // Pre-fill invoice design settings
        document.getElementById('invoiceHeaderColor').value = shopSettings.billHeaderColor || '#1e40af';
        document.getElementById('invoiceHeaderTextColor').value = shopSettings.billHeaderTextColor || '#ffffff';
        document.getElementById('invoiceFont').value = shopSettings.billFont || "'Outfit', sans-serif";
        document.getElementById('invoiceFontSize').value = shopSettings.billFontSize || 18;
        document.getElementById('invoiceFooterColor').value = shopSettings.billFooterColor || '#1e40af';

        // Advanced Settings
        const headerBgType = shopSettings.billHeaderType || 'solid';
        document.getElementById('invoiceHeaderBgType').value = headerBgType;
        toggleHeaderBgOptions(headerBgType);

        document.getElementById('invoiceHeaderGrad1').value = shopSettings.billHeaderGrad1 || '#1e40af';
        document.getElementById('invoiceHeaderGrad2').value = shopSettings.billHeaderGrad2 || '#1d4ed8';
        document.getElementById('invoiceHeaderGradDir').value = shopSettings.billHeaderGradDir || 'to right';
        document.getElementById('invoiceHeaderText').value = shopSettings.billHeaderText || '';
        document.getElementById('invoiceFooterText').value = shopSettings.billFooterText || '';

        // Further Granular Settings
        document.getElementById('invoiceLogoPosition').value = shopSettings.billLogoPosition || 'right';
        document.getElementById('invoiceStripBg').value = shopSettings.billStripBg || '#f8f9fa';
        document.getElementById('invoiceStripTextColor').value = shopSettings.billStripTextColor || '#333333';
        document.getElementById('invoiceFooterBg').value = shopSettings.billFooterBg || '#1e40af';
        document.getElementById('invoiceFooterTextColor').value = shopSettings.billFooterTextColor || '#ffffff';
        document.getElementById('invoiceNameFont').value = shopSettings.billNameFont || "'Noto Nastaliq Urdu', serif";

        if (shopSettings.billHeaderBgImage) {
            document.getElementById('headerBgPreview').src = shopSettings.billHeaderBgImage;
            document.getElementById('headerBgPreviewContainer').style.display = 'block';
        }
    } else if (pageId === 'productsPage') {
        renderProducts();
    } else if (pageId === 'customersPage') {
        renderCustomers();
    } else if (pageId === 'financePage') {
        renderFinancePage();
    }
}

window.toggleHeaderBgOptions = function (type) {
    document.getElementById('headerSolidOptions').style.display = type === 'solid' ? 'flex' : 'none';
    document.getElementById('headerGradientOptions').style.display = type === 'gradient' ? 'flex' : 'none';
    document.getElementById('headerImageOptions').style.display = type === 'image' ? 'block' : 'none';
}

function setupNavigation() {
    document.getElementById('navDashboard').addEventListener('click', (e) => {
        e.preventDefault();
        switchPage('dashboardPage');
    });

    document.getElementById('navSettings').addEventListener('click', (e) => {
        e.preventDefault();
        if (currentRole === 'superadmin' || currentRole === 'admin') {
            switchPage('settingsPage');
        } else {
            alert('صرف ایڈمنسٹریٹر ہی سیٹنگز تک رسائی حاصل کر سکتے ہیں۔');
        }
    });

    document.getElementById('navOrders').addEventListener('click', (e) => {
        e.preventDefault();
        switchPage('ordersPage');
    });

    document.getElementById('navFinance').addEventListener('click', (e) => {
        e.preventDefault();
        switchPage('financePage'); // Assuming financePage might exist or be added later
    });

    document.getElementById('navCustomers').addEventListener('click', (e) => {
        e.preventDefault();
        switchPage('customersPage'); // Placeholder
    });

    document.getElementById('navProducts').addEventListener('click', (e) => {
        e.preventDefault();
        switchPage('productsPage');
    });
}
window.toggleSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const appContainer = document.querySelector('.app-container');
    if (sidebar) sidebar.classList.toggle('active');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.getElementById('mobileMenuToggle');
    if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

function initUserGrids() {
    const switcherList = document.getElementById('dynamicUserSwitcherList');
    if (switcherList) switcherList.innerHTML = '';

    const handoverSelect = document.getElementById('handoverTo');
    const handoverToUser = document.getElementById('handoverToUser');
    const financeUserFilter = document.getElementById('financeUserFilter');

    if (handoverSelect) handoverSelect.innerHTML = '';
    if (handoverToUser) handoverToUser.innerHTML = '';
    if (financeUserFilter) financeUserFilter.innerHTML = '<option value="all">تمام یوزرز (All Users)</option>';

    const financeGrid = document.getElementById('financeCashInHandGrid');

    if (financeGrid) financeGrid.innerHTML = '';

    Object.values(USERS).forEach(user => {
        let roleText = user.role === 'superadmin' ? 'ایڈمنسٹریٹر' : (user.role === 'admin' ? 'مالک' : 'ملازم');

        if (user.role === 'admin' || user.role === 'superadmin') {
            if (handoverSelect) handoverSelect.innerHTML += `<option value="${user.id}">${user.name}</option>`;
            if (handoverToUser) handoverToUser.innerHTML += `<option value="${user.id}">${user.name}</option>`;
        }

        if (financeUserFilter) {
            financeUserFilter.innerHTML += `<option value="${user.id}">${user.name}</option>`;
        }


        // Add specific IDs for finance page cash grid elements
        const financeCardHtml = `
            <div class="stat-card" style="padding: 16px;">
                <div class="stat-icon" style="background-color: ${user.color}; color: ${user.textColor}; width: 40px; height: 40px; font-size: 20px;">${user.avatar}</div>
                <div class="stat-details">
                    <h3 style="font-size: 13px;">${user.name}</h3>
                    <h2 class="amount" id="finance_cash_${user.id}" style="font-size: 18px;">Rs. 0</h2>
                </div>
            </div>
        `;
        if (financeGrid) financeGrid.innerHTML += financeCardHtml;
    });
}

function initDynamicUI() {
    initUserGrids();
    if (typeof initSettingsUI === 'function') {
        initSettingsUI();
    }
}

// PIN Pad Logic
let enteredPin = "";
window.appendPin = function (num) {
    if (enteredPin.length < 4) {
        enteredPin += num;
        updatePinDisplay();
    }
    if (enteredPin.length === 4) {
        document.getElementById('verifyPinBtn').disabled = false;
    }
}

window.clearPin = function () {
    enteredPin = "";
    updatePinDisplay();
    document.getElementById('verifyPinBtn').disabled = true;
}

window.backspacePin = function () {
    enteredPin = enteredPin.slice(0, -1);
    updatePinDisplay();
    document.getElementById('verifyPinBtn').disabled = true;
}

function updatePinDisplay() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
        if (index < enteredPin.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

window.logoutFromGoogle = function () {
    const a = window.auth;
    if (a) a.signOut().then(() => {
        enteredPin = "";
        updatePinDisplay();
        document.getElementById('pinPadContainer').style.display = 'none';
        document.getElementById('googleSignInContainer').style.display = 'block';
    });
}

// Glassmorphism login page — "Continue" button (just triggers Google sign-in)
// --- Authentication UI & Logic (Upgraded) ---
let authMode = 'login'; // 'login' or 'signup'
let confirmationResult = null;
let pendingRegData = null;

window.toggleAuthMode = function () {
    authMode = authMode === 'login' ? 'signup' : 'login';
    const loginView = document.getElementById('loginView');
    const signupView = document.getElementById('signupView');
    const otpView = document.getElementById('otpView');
    const emailVerifyView = document.getElementById('emailVerifyView');
    const authTitle = document.getElementById('authTitle');

    const toggleBtn = document.getElementById('authModeToggle');

    if (authMode === 'login') {
        loginView.style.display = 'flex';
        signupView.style.display = 'none';
        otpView.style.display = 'none';
        if (emailVerifyView) emailVerifyView.style.display = 'none';
        authTitle.innerText = 'LOGIN';
        toggleBtn.innerText = 'Create Account';
    } else {
        loginView.style.display = 'none';
        signupView.style.display = 'flex';
        otpView.style.display = 'none';
        if (emailVerifyView) emailVerifyView.style.display = 'none';
        authTitle.innerText = 'CREATE ACCOUNT';
        toggleBtn.innerText = 'Login Instead';
    }
}


// Helper to normalize phone number to E.164 format (e.g., +923001234567)
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, ''); // keep only digits
    if (clean.startsWith('0')) clean = '92' + clean.slice(1);
    // If it's 10 digits and starts with 3, assume it's a PK number without 92 or 0
    if (clean.length === 10 && clean.startsWith('3')) clean = '92' + clean;
    return '+' + clean;
}

async function setupRecaptcha() {
    // Ensure "Simulation" mode is off so real test numbers (from console) work
    if (auth && auth.settings) {
        auth.settings.appVerificationDisabledForTesting = false;
    }

    if (window.recaptchaVerifier) {
        try {
            window.recaptchaVerifier.clear();
        } catch (e) { }
    }

    window.recaptchaVerifier = new fbRecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {
            console.log('reCAPTCHA solved');
        },
        'expired-callback': () => {
            console.log('reCAPTCHA expired');
            if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
        }
    });

    try {
        await window.recaptchaVerifier.render();
        console.log('reCAPTCHA rendered successfully');
    } catch (err) {
        console.error('reCAPTCHA render error:', err);
        throw err;
    }
}


window.handleSignup = function () {
    const name = (document.getElementById('regName') || {}).value || '';
    const email = (document.getElementById('regEmail') || {}).value || '';
    const phoneRaw = (document.getElementById('regPhone') || {}).value || '';
    const pass = (document.getElementById('regPassword') || {}).value || '';

    // Normalize phone number to include country code
    const phone = phoneRaw ? normalizePhoneNumber(phoneRaw) : '';

    // Requirement: Flexibility (Email and Phone optional, but at least one required)
    if (!name || !pass || (!email && !phone)) {
        showToast('Please provide Name, Password and at least one contact method (Email or Phone)', 'error');
        return;
    }

    if (pass.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    // Save registration data temporarily
    pendingRegData = { name, email, phone, pass };

    showToast('Starting registration...', 'info');
    document.getElementById('signupBtn').disabled = true;

    if (email) {
        // Sign up with Email/Password first
        fbCreateUserWithEmailAndPassword(auth, email, pass)
            .then((userCredential) => {
                const user = userCredential.user;
                fbUpdateProfile(user, { displayName: name });

                // Requirement: Trigger Email Verification
                fbSendEmailVerification(user).then(() => {
                    showToast('Verification email sent to ' + email, 'success');
                });

                if (phone) {
                    // If phone also provided, proceed to OTP
                    return triggerPhoneOTP(phone);
                } else {
                    // Only Email: Wait for verification
                    document.getElementById('signupView').style.display = 'none';
                    if (document.getElementById('emailVerifyView')) {
                        document.getElementById('emailVerifyView').style.display = 'flex';
                    }
                    document.getElementById('authTitle').innerText = 'VERIFY EMAIL';
                    showToast('Please check your email to verify your account.', 'info');
                }

            })
            .catch((error) => {
                console.error(error);
                showToast('Registration Error: ' + error.message, 'error');
                document.getElementById('signupBtn').disabled = false;
            });
    } else if (phone) {
        // Phone Only Flow
        triggerPhoneOTP(phone);
    }
}


async function triggerPhoneOTP(phone) {
    showToast('Preparing verification...', 'info');
    try {
        await setupRecaptcha();
        const result = await fbSignInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
        confirmationResult = result;
        showToast('6-digit OTP sent to ' + phone, 'success');

        // Requirement: Show OTP View
        document.getElementById('signupView').style.display = 'none';
        document.getElementById('otpView').style.display = 'flex';
        document.getElementById('authTitle').innerText = 'VERIFY PHONE';
    } catch (error) {
        console.error('Phone Auth Error:', error);
        showToast('Phone Error: ' + error.message, 'error');
        document.getElementById('signupBtn').disabled = false;
        // If it's a test number error, we point it out
        if (error.code === 'auth/invalid-phone-number') {
            showToast('Invalid phone number format. Please include country code.', 'error');
        }
    }
}



window.verifyOTP = function () {
    const code = (document.getElementById('otpInput') || {}).value || '';
    if (code.length !== 6) {
        showToast('Please enter a 6-digit code', 'error');
        return;
    }

    document.getElementById('verifyOtpBtn').disabled = true;

    confirmationResult.confirm(code)
        .then((result) => {
            showToast('Phone verified successfully!', 'success');

            // Finalize registration: Save profile to database
            const user = auth.currentUser;
            const profileData = {
                name: pendingRegData ? pendingRegData.name : (user.displayName || 'User'),
                email: pendingRegData ? pendingRegData.email : (user.email || ''),
                phone: pendingRegData ? pendingRegData.phone : (user.phoneNumber || ''),
                uid: user.uid,
                createdAt: new Date().toISOString()
            };

            return fbSet(fbRef(db, `users/${user.uid}/profile`), profileData);
        })
        .then(() => {
            // Success: Clean up and enter app
            enterApp();
        })
        .catch((error) => {
            console.error(error);
            showToast('Verification failed: ' + error.message, 'error');
            document.getElementById('verifyOtpBtn').disabled = false;
        });
}


window.cancelOTP = function () {
    document.getElementById('otpView').style.display = 'none';
    if (document.getElementById('emailVerifyView')) {
        document.getElementById('emailVerifyView').style.display = 'none';
    }
    document.getElementById('signupView').style.display = 'flex';
    document.getElementById('authTitle').innerText = 'CREATE ACCOUNT';
    document.getElementById('signupBtn').disabled = false;
    confirmationResult = null;
}


window.handleLogin = function (event) {
    if (event) event.preventDefault();

    const email = (document.getElementById('loginEmail') || {}).value || '';
    const pass = (document.getElementById('loginPassword') || {}).value || '';

    if (!email || !pass) {
        showToast('Please enter your email and password', 'error');
        return;
    }

    showToast('Logging in...', 'info');
    fbSignInWithEmailAndPassword(auth, email, pass)
        .then((userCredential) => {
            showToast('Welcome back!', 'success');

            // Requirement 1 & 3: Ensure reload/UI toggle after delay for session initialization
            // Using reload() as it's the most reliable way to reset the app state for the new user
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        })
        .catch((error) => {
            console.error(error);
            showToast('Login Failed: ' + error.message, 'error');
        });
}

function enterApp() {
    const user = auth.currentUser;
    if (!user) return;

    // Fetch profile data from DB
    fbGet(fbRef(db, `users/${user.uid}/profile`)).then((snapshot) => {
        const profile = snapshot.val() || {};

        currentUser = {
            id: user.uid,
            name: profile.name || user.displayName || 'User',
            email: user.email,
            phone: profile.phone || '',
            photoURL: user.photoURL,
            role: 'admin',
            avatar: (profile.name || user.displayName || 'U').charAt(0)
        };

        currentRole = 'admin';
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('dashboard-view').style.display = 'flex';

        // Set UI
        document.getElementById('currentUserName').innerText = currentUser.name;
        document.getElementById('currentUserRole').innerText = 'Admin';
        const avatarEl = document.getElementById('currentUserAvatar');
        if (currentUser.photoURL) {
            avatarEl.innerHTML = `<img src="${currentUser.photoURL}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            avatarEl.innerText = currentUser.avatar;
        }

        startRealtimeSync();
        if (typeof loadGDriveSessionForUser === 'function') loadGDriveSessionForUser();
        updateDashboardStats();
        renderRecentOrders();
        switchPage('dashboardPage');
    });
}

function setupLogin() {
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            fbSignInWithPopup(auth, provider).catch(error => {
                showToast("Google Login Error: " + error.message, "error");
            });
        });
    }

    // Auth State Observer
    fbOnAuthStateChanged(auth, (user) => {
        // Robust Splash Removal: disappear regardless of following logic
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('fade-out');

        if (user) {
            // Requirement 2: Clear any active 'Login Modal' or 'Overlay' from the DOM when user is detected
            document.querySelectorAll('.modal, .modal-backdrop, .overlay').forEach(el => el.remove());

            // Requirement: Prevent auto-login before verification
            const isOTPView = document.getElementById('otpView').style.display === 'flex';
            const isEmailFlow = pendingRegData && pendingRegData.email;
            const isVerified = (user.email ? user.emailVerified : true) && !isOTPView;

            if (isVerified) {
                enterApp();
            } else if (user.email && !user.emailVerified && !isOTPView) {
                // If logged in via email but not verified, stay on signup/info view
                document.getElementById('login-view').style.display = 'flex';
                document.getElementById('signupView').style.display = 'none';
                if (document.getElementById('emailVerifyView')) {
                    document.getElementById('emailVerifyView').style.display = 'flex';
                }
                document.getElementById('authTitle').innerText = 'VERIFY EMAIL';
                showToast('Please verify your email address before logging in.', 'info');
            }

        } else {
            // User is null: Ensure fully cleared session and redirect
            localStorage.clear();
            sessionStorage.clear();

            // Reset UI state variables
            currentUser = null;
            currentRole = null;

            // Redirect to login page to prevent back-button access to dashboard
            if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
                window.location.replace('index.html');
            }

            document.getElementById('login-view').style.display = 'flex';
            document.getElementById('dashboard-view').style.display = 'none';

            // Reset views back to login
            document.getElementById('loginView').style.display = 'flex';
            document.getElementById('signupView').style.display = 'none';
            document.getElementById('otpView').style.display = 'none';

            // Clear dashboard-related UI variables and values
            const amountElements = document.querySelectorAll('.amount');
            amountElements.forEach(el => el.innerText = 'Rs. 0');

            const pcCount = document.getElementById('pendingCustomersCount');
            if (pcCount) pcCount.innerText = '0';
            const aoCount = document.getElementById('activeOrdersCount');
            if (aoCount) aoCount.innerText = '0';
            const coCount = document.getElementById('completedOrdersCount');
            if (coCount) coCount.innerText = '0';

            const recentOrdersBody = document.getElementById('recentOrdersBody');
            if (recentOrdersBody) recentOrdersBody.innerHTML = '';
        }
    });

}


// Realtime Sync Logic (Modular SDK)
function startRealtimeSync() {
    const refs = {
        'orders': (val) => { if (val) { orders = val; renderOrdersList(); updateDashboardStats(); } },
        'transactions': (val) => { if (val) { transactions = val; updateDashboardStats(); if (typeof renderTransactionsTable === 'function') renderTransactionsTable(); } },
        'products': (val) => { if (val) { products = val; if (typeof renderProducts === 'function') renderProducts(); } },
        'shopSettings': (val) => { if (val) { shopSettings = val; if (typeof applyShopSettings === 'function') applyShopSettings(); } },
        'users': (val) => { if (val) { USERS = val; initUserGrids(); } },
        'deletedOrders': (val) => { if (val) { deletedOrders = val; } },
        'orderStatuses': (val) => { if (val) { orderStatuses = val; } },
        'orderCategories': (val) => { if (val) { orderCategories = val; } }
    };

    // Setup listeners
    Object.keys(refs).forEach(key => {
        fbOnValue(fbRef(db, getPath(key)), (snapshot) => {
            const val = snapshot.val();
            if (val) refs[key](val);
        });
    });
}

function migrateLocalToCloud() {
    const dataToMigrate = {
        orders: orders,
        transactions: transactions,
        shopSettings: shopSettings,
        products: products,
        users: USERS,
        deletedOrders: deletedOrders,
        orderStatuses: orderStatuses,
        orderCategories: orderCategories
    };

    fbUpdate(fbRef(db, getPath('')), dataToMigrate).then(() => {
        showToast("ڈیٹا کلاؤڈ پر منتقل کر دیا گیا ہے۔", "success");
    }).catch(err => {
        console.error("Migration error:", err);
    });
}

// Calculate and Update Dashboard Stats
function updateDashboardStats() {
    let pendingBalance = 0;
    let pendingCustomers = 0;
    let activeOrders = 0;
    let completedOrders = 0;

    const catTotals = {};
    orderCategories.forEach(c => catTotals[c.id] = 0);

    const todayStr = new Date().toISOString().split('T')[0];
    const dailyCatTotals = {};
    orderCategories.forEach(c => dailyCatTotals[c.id] = 0);

    orders.forEach(order => {
        // Stats by category
        if (catTotals[order.category] !== undefined) {
            catTotals[order.category] += order.totalAmount;
        }

        const orderDateStr = new Date(order.date).toISOString().split('T')[0];
        if (orderDateStr === todayStr && dailyCatTotals[order.category] !== undefined) {
            dailyCatTotals[order.category] += order.totalAmount;
        }

        // Overall stats
        if (order.status === 'completed') {
            completedOrders++;
        } else {
            activeOrders++;
        }

        let paid = order.advance || 0;
        let pending = order.totalAmount - paid;
        if (pending > 0) {
            pendingBalance += pending;
            pendingCustomers++;
        }
    });

    let totalIncome = 0;
    let userBalances = {};
    Object.keys(USERS).forEach(k => userBalances[k] = 0);

    transactions.forEach(trx => {
        if (trx.type === 'income') {
            totalIncome += trx.amount;
            if (userBalances[trx.userId] !== undefined) userBalances[trx.userId] += trx.amount;
        } else if (trx.type === 'expense') {
            if (userBalances[trx.userId] !== undefined) userBalances[trx.userId] -= trx.amount;
        } else if (trx.type === 'handover') {
            if (userBalances[trx.userId] !== undefined) userBalances[trx.userId] -= trx.amount;
            if (trx.handOverToId && userBalances[trx.handOverToId] !== undefined) {
                userBalances[trx.handOverToId] += trx.amount;
            }
        }
    });

    const incEl = document.querySelector('.stat-icon.income + .stat-details .amount');
    if (incEl) incEl.innerText = formatCurrency(totalIncome);

    const penEl = document.querySelector('.stat-icon.pending + .stat-details .amount');
    if (penEl) penEl.innerText = formatCurrency(pendingBalance);

    const pcCount = document.getElementById('pendingCustomersCount');
    if (pcCount) pcCount.innerText = pendingCustomers;

    const aoCount = document.getElementById('activeOrdersCount');
    if (aoCount) aoCount.innerText = activeOrders;

    const coCount = document.getElementById('completedOrdersCount');
    if (coCount) coCount.innerText = completedOrders;


    // Also update finance page specific elements if they exist
    Object.keys(USERS).forEach(id => {
        const financeEl = document.getElementById(`finance_cash_${id}`);
        if (financeEl) financeEl.innerText = formatCurrency(userBalances[id]);
    });

    // Daily Summary updating (simplified)
    const summaries = document.querySelectorAll('.summary-info p');
    // Update category summaries dynamically (first 3 available categories)
    const summaryLabels = document.querySelectorAll('.summary-info h4');
    if (summaries.length >= 3 && summaryLabels.length >= 3) {
        orderCategories.slice(0, 3).forEach((cat, index) => {
            summaryLabels[index].innerText = cat.label;
            summaries[index].innerText = formatCurrency(dailyCatTotals[cat.id] || 0);
        });
    }

    updateTabCounts();
}

function updateTabCounts() {
    const counts = {
        all: orders.length,
        'zair-e-takmeel': orders.filter(o => o.status !== 'completed' && o.status !== 'designing' && o.status !== 'printing' && o.status !== 'pasting').length,
        'designing': orders.filter(o => o.status === 'designing').length,
        'printing': orders.filter(o => o.status === 'printing').length,
        'pasting': orders.filter(o => o.status === 'pasting').length,
        'completed': orders.filter(o => o.status === 'completed').length
    };

    for (const [id, count] of Object.entries(counts)) {
        const el = document.getElementById(`count-${id}`);
        if (el) el.innerText = count;
    }
}

// Export Finance to Excel Logic
window.openFinanceDownloadModal = function () {
    const modal = document.getElementById('financeDownloadModal');
    if (!modal) return;

    // Populate users dropdown
    const userSelect = document.getElementById('financeDownloadUser');
    if (userSelect) {
        userSelect.innerHTML = '<option value="all">تمام یوزرز (All Users)</option>';
        Object.entries(USERS).forEach(([id, user]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = user.name || user.username;
            userSelect.appendChild(option);
        });
    }

    // Reset date range
    const rangeSelect = document.getElementById('financeDownloadRange');
    if (rangeSelect) {
        rangeSelect.value = 'all';
        toggleFinanceCustomDate('all');
    }

    modal.classList.add('show');
};

window.closeFinanceDownloadModal = function () {
    const modal = document.getElementById('financeDownloadModal');
    if (modal) modal.classList.remove('show');
};

window.toggleFinanceCustomDate = function (value) {
    const customDateRow = document.getElementById('financeCustomDateRange');
    if (customDateRow) {
        customDateRow.style.display = value === 'custom' ? 'flex' : 'none';
    }
};

window.executeFinanceDownload = function () {
    if (!transactions || transactions.length === 0) {
        alert("ڈاؤنلوڈ کرنے کے لئے کوئی ڈیٹا موجود نہیں ہے۔");
        return;
    }

    const range = document.getElementById('financeDownloadRange').value;
    const selectedUserId = document.getElementById('financeDownloadUser').value;
    let filteredTransactions = [...transactions];

    // Filter by User
    if (selectedUserId !== 'all') {
        filteredTransactions = filteredTransactions.filter(trx =>
            trx.userId === selectedUserId || trx.handOverToId === selectedUserId
        );
    }

    // Filter by Date
    if (range !== 'all') {
        const now = new Date();
        now.setHours(0, 0, 0, 0); // start of today
        let startDate = null;
        let endDate = null;

        if (range === 'today') {
            startDate = new Date(now);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
        } else if (range === 'week') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            endDate = new Date();
        } else if (range === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else if (range === 'custom') {
            const sdStr = document.getElementById('financeCustomStartDate').value;
            const edStr = document.getElementById('financeCustomEndDate').value;

            if (!sdStr || !edStr) {
                alert("براہ کرم مخصوص تاریخ کا انتخاب کریں۔");
                return;
            }
            startDate = new Date(sdStr);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(edStr);
            endDate.setHours(23, 59, 59, 999);

            if (startDate > endDate) {
                alert("شروع کی تاریخ، ختم کی تاریخ سے پہلے ہونی چاہیے۔");
                return;
            }
        }

        if (startDate && endDate) {
            filteredTransactions = filteredTransactions.filter(trx => {
                const txDate = new Date(trx.date);
                return txDate >= startDate && txDate <= endDate;
            });
        }
    }

    if (filteredTransactions.length === 0) {
        alert("منتخب کردہ فلٹرز کے مطابق کوئی ڈیٹا نہیں ملا۔");
        return;
    }

    const wb = XLSX.utils.book_new();

    // Helper to format data and add a sheet
    const addSheet = (trxArray, sheetName) => {
        const data = [
            ["تاریخ", "قسم", "رقم", "یوزر", "حوالہ/تفصیل"]
        ];

        trxArray.forEach(trx => {
            let typeStr = "";
            if (trx.type === 'income') typeStr = 'آمدنی';
            else if (trx.type === 'expense') typeStr = 'خرچہ';
            else if (trx.type === 'handover') typeStr = 'رقم منتقلی';

            let dateStr = new Date(trx.date).toLocaleString('ur-PK', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let userName = USERS[trx.userId] ? USERS[trx.userId].name : 'Unknown';

            let details = trx.description || '';
            if (trx.type === 'handover' && trx.handOverToId) {
                let toUser = USERS[trx.handOverToId] ? USERS[trx.handOverToId].name : 'Unknown';
                details = `جمع کروائی گئی: ${toUser} ` + details;
            }

            data.push([
                dateStr, typeStr, trx.amount, userName, details
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        if (!ws['!dir']) ws['!dir'] = 'rtl';
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    // 1. Always add the main sheet containing all filtered data
    const mainSheetName = selectedUserId === 'all' ? "سب ٹرانزیکشنز" : "ٹرانزیکشنز";
    addSheet(filteredTransactions, mainSheetName);

    // 2. If 'All Users' was selected, append an individual sheet for each user
    if (selectedUserId === 'all') {
        Object.keys(USERS).forEach(userId => {
            const userTrxs = filteredTransactions.filter(trx =>
                trx.userId === userId || trx.handOverToId === userId
            );

            if (userTrxs.length > 0) {
                // Sanitize user name for Excel sheet (Max 31 chars, no special characters like : / \ ? * [ ])
                let sName = USERS[userId].name || USERS[userId].username || 'User';
                sName = sName.replace(/[\\/*?:\[\]]/g, '').substring(0, 31);
                addSheet(userTrxs, sName);
            }
        });
    }

    const d = new Date();
    const dateComponent = d.toISOString().split('T')[0];
    const filename = `Finance_Report_${dateComponent}.xlsx`;
    XLSX.writeFile(wb, filename);

    closeFinanceDownloadModal();
};

// Download Data Logic
window.openDownloadModal = function () {
    document.getElementById('downloadModal').classList.add('show');
};

window.closeDownloadModal = function () {
    document.getElementById('downloadModal').classList.remove('show');
};

window.toggleCustomDateInputs = function (value) {
    document.getElementById('customDateRange').style.display = value === 'custom' ? 'flex' : 'none';
};

window.handleDataDownload = function () {
    const range = document.getElementById('downloadRange').value;
    const format = document.querySelector('input[name="downloadFormat"]:checked').value;
    const downloadStatus = document.getElementById('downloadStatus').value;
    const downloadCurrentView = document.getElementById('downloadCurrentView').checked;

    let filteredOrders = [];
    let rangeLabel = "";
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (downloadCurrentView) {
        // Download exactly what's on the screen
        const searchTerm = (document.getElementById('orderSearchInput')?.value || '').toLowerCase();
        const categoryFilter = document.getElementById('orderCategoryFilter')?.value || 'all';

        filteredOrders = orders.filter(order => {
            // Status Tab Filter
            let matchStatus = true;
            if (currentStatusFilter !== 'all') {
                if (currentStatusFilter === 'zair-e-takmeel') {
                    matchStatus = order.status !== 'completed' && order.status !== 'designing' && order.status !== 'printing' && order.status !== 'pasting';
                } else {
                    matchStatus = order.status === currentStatusFilter;
                }
            }

            // Search Filter
            const matchSearch = order.customerName.toLowerCase().includes(searchTerm) ||
                (order.details && order.details.toLowerCase().includes(searchTerm)) ||
                order.id.toLowerCase().includes(searchTerm);

            // Category Filter
            const matchCategory = categoryFilter === 'all' || order.category === categoryFilter;

            return matchStatus && matchSearch && matchCategory;
        });

        rangeLabel = "موجودہ فلٹر شدہ ڈیٹا (Current View)";
    } else {
        // Use Modal Date Range + Modal Status Filter

        // 1. Date Range Filter
        if (range === 'today') {
            rangeLabel = "آج کا ڈیٹا (" + todayStr + ")";
            filteredOrders = orders.filter(o => o.date.startsWith(todayStr));
        } else if (range === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            rangeLabel = "اس ہفتے کا ڈیٹا";
            filteredOrders = orders.filter(o => new Date(o.date) >= weekAgo);
        } else if (range === 'month') {
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            rangeLabel = "اس ماہ کا ڈیٹا";
            filteredOrders = orders.filter(o => new Date(o.date) >= monthAgo);
        } else if (range === 'all') {
            rangeLabel = "تمام ریکارڈز (All Data)";
            filteredOrders = [...orders];
        } else if (range === 'custom') {
            const fromDate = document.getElementById('downloadFromDate').value;
            const toDate = document.getElementById('downloadToDate').value;
            if (!fromDate || !toDate) {
                alert('براہ کرم دونوں تاریخیں منتخب کریں۔');
                return;
            }
            rangeLabel = `تاریخ ${fromDate} سے ${toDate} تک`;
            filteredOrders = orders.filter(o => {
                const d = o.date.split('T')[0];
                return d >= fromDate && d <= toDate;
            });
        }

        // 2. Status Filter from Modal
        if (downloadStatus !== 'all') {
            filteredOrders = filteredOrders.filter(o => {
                if (downloadStatus === 'pending') {
                    const nonFinalStatuses = orderStatuses.filter(s => !s.isFinal).map(s => s.id);
                    return nonFinalStatuses.includes(o.status);
                }
                return o.status === downloadStatus;
            });
            rangeLabel += ` - اسٹیٹس: ${getStatusUrdu(downloadStatus)}`;
        }
    }

    if (filteredOrders.length === 0) {
        alert('منتخب کردہ رینج اور فلٹرز میں کوئی ڈیٹا نہیں ملا۔');
        return;
    }

    // Sort by date descending
    filteredOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (format === 'pdf') {
        exportToPDF(filteredOrders, rangeLabel);
    } else {
        exportToExcel(filteredOrders, rangeLabel);
    }

    closeDownloadModal();
};

async function exportToPDF(data, rangeLabel) {
    const wrapEl = document.getElementById('reportTemplateWrap');
    const reportContent = document.getElementById('reportContent');
    const tbody = document.getElementById('reportTableBody');

    // Clear and populate
    tbody.innerHTML = '';
    document.getElementById('reportShopName').innerText = shopSettings.name;
    document.getElementById('reportRangeLabel').innerText = rangeLabel;
    document.getElementById('reportGenDate').innerText = new Date().toLocaleString('en-GB');

    let totalAmountSum = 0;
    let totalReceivedSum = 0;
    let totalBalanceSum = 0;

    data.forEach(o => {
        const d = new Date(o.date);
        const dayMonth = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        const year = d.getFullYear();
        const dateHtml = `${dayMonth}<br/>${year}`;

        const idParts = o.id.split('-');
        const idHtml = idParts.length > 1 ? `${idParts[0]}<br/>${idParts[1]}` : o.id;

        const balance = o.totalAmount - (o.advance || 0);
        const detailsHtml = (o.details || '').replace(/\n/g, '<br/>');

        totalAmountSum += (o.totalAmount || 0);
        totalReceivedSum += (o.advance || 0);
        totalBalanceSum += balance;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 10px; font-family: 'Outfit', sans-serif;">${idHtml}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 10px; font-family: 'Outfit', sans-serif;">${dateHtml}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-family: 'Noto Nastaliq Urdu', sans-serif; font-size: 14px; line-height: 2;"><strong>${o.customerName}</strong><br/><small style="color: #444;">${detailsHtml}</small></td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-size: 13px; font-family: 'Noto Nastaliq Urdu', sans-serif; line-height: 2;">${getStatusUrdu(o.status)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-family: 'Outfit', sans-serif;">${o.totalAmount}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-family: 'Outfit', sans-serif;">${o.advance || 0}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; font-family: 'Outfit', sans-serif; color: ${balance > 0 ? '#dc2626' : '#16a34a'};">${balance}</td>
        `;
        tbody.appendChild(tr);
    });

    // Add Total Row
    const totalTr = document.createElement('tr');
    totalTr.style.backgroundColor = '#f1f5f9';
    totalTr.style.fontWeight = 'bold';
    totalTr.innerHTML = `
        <td colspan="4" style="padding: 10px; border: 1px solid #ddd; text-align: center; font-family: 'Noto Nastaliq Urdu', sans-serif;">کل میزان (TOTAL)</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-family: 'Outfit', sans-serif;">${totalAmountSum}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-family: 'Outfit', sans-serif;">${totalReceivedSum}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-family: 'Outfit', sans-serif; color: ${totalBalanceSum > 0 ? '#dc2626' : '#16a34a'};">${totalBalanceSum}</td>
    `;
    tbody.appendChild(totalTr);

    showToast('رپورٹ تیار کی جا رہی ہے، براہ کرم انتظار کریں...', 'info');

    const opt = {
        margin: [10, 5, 10, 5], // top, left, bottom, right in mm
        filename: `al-abbasi-report-${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            logging: true,
            onclone: (clonedDoc) => {
                const clonedWrap = clonedDoc.getElementById('reportTemplateWrap');
                if (clonedWrap) {
                    clonedWrap.style.position = 'absolute';
                    clonedWrap.style.left = '0px';
                    clonedWrap.style.top = '0px';
                    clonedWrap.style.visibility = 'visible';
                    clonedWrap.style.display = 'block';
                    clonedWrap.style.zIndex = '1';
                }
            }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
        await html2pdf().set(opt).from(reportContent).save();
        showToast('PDF فائل ڈاؤنلوڈ کر دی گئی ہے', 'success');
    } catch (err) {
        console.error("PDF Export Error:", err);
        alert("پی ڈی ایف بنانے میں مسئلہ پیش آیا۔");
    }
}

function exportToExcel(data, rangeLabel) {
    const wb = XLSX.utils.book_new();

    // Helper to generate sheet data
    const generateSheetData = (items, title) => {
        const header = [
            ["Al-Abbasi Computer - Orders Report"],
            [title],
            [],
            ["Order ID", "Date", "Customer Name", "Category", "Status", "Total Amount", "Advance", "Balance", "Details"]
        ];

        let totalAmt = 0;
        let totalAdv = 0;
        let totalBal = 0;

        const rows = items.map(o => {
            const bal = o.totalAmount - (o.advance || 0);
            totalAmt += (o.totalAmount || 0);
            totalAdv += (o.advance || 0);
            totalBal += bal;

            return [
                o.id,
                new Date(o.date).toLocaleDateString('en-GB'),
                o.customerName,
                o.category,
                getStatusUrdu(o.status),
                o.totalAmount,
                o.advance || 0,
                bal,
                o.details || ""
            ];
        });

        // Add Total Row
        const totalRow = ["", "", "كل میزان (TOTAL)", "", "", totalAmt, totalAdv, totalBal, ""];

        return [...header, ...rows, [], totalRow];
    };

    // 1. Add Main Sheet
    const mainWsData = generateSheetData(data, rangeLabel);
    const mainWs = XLSX.utils.aoa_to_sheet(mainWsData);
    XLSX.utils.book_append_sheet(wb, mainWs, "All Data");

    // 2. Add Status Specific Sheets
    // a. All Pending (Not Final)
    const nonFinalStatIds = orderStatuses.filter(s => !s.isFinal).map(s => s.id);
    const pendingOrders = data.filter(o => nonFinalStatIds.includes(o.status));
    if (pendingOrders.length > 0) {
        const wsData = generateSheetData(pendingOrders, "Pending/In-Progress Orders");
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Pending Data");
    }

    // b. Individual Statuses
    orderStatuses.forEach(s => {
        const statusOrders = data.filter(o => o.status === s.id);
        if (statusOrders.length > 0) {
            // Excel sheet names must be <= 31 chars and unique
            let sheetName = s.label.substring(0, 25);
            // Append a suffix if name taken (simple prevent)
            if (wb.SheetNames.includes(sheetName)) sheetName += "_";

            const wsData = generateSheetData(statusOrders, `${s.label} (${s.id})`);
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
    });

    XLSX.writeFile(wb, `al-abbasi-report-${Date.now()}.xlsx`);
    showToast('Excel فائل ڈاؤنلوڈ کر دی گئی ہے', 'success');
}

// Render the Orders Table
// Render the Orders Table (Dashboard - Limited to 5)
function renderRecentOrders() {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Show latest 5 first
    const recentOrders = [...orders].reverse().slice(0, 5);

    recentOrders.forEach(order => {
        let statusClass = getStatusColorClass(order.status);

        let catText = 'اسٹیشنری';
        if (order.category === 'printing') catText = 'پرنٹنگ (و دیگر)';
        if (order.category === 'online') catText = 'آنلائن سروسز';

        let pending = order.totalAmount - (order.advance || 0);
        let paymentBadge = pending <= 0 ?
            `<span class="text-success" style="font-weight: 600;"><ion-icon name="checkmark-circle"></ion-icon> مکمل ادا</span>` :
            `<span class="text-danger" style="font-weight: 600;">Rs. ${pending} بقایا</span>`;

        let orderProfitHtml = '<span style="color:var(--text-muted); font-size: 11px;">مخفی</span>';
        if (currentRole === 'admin' || currentRole === 'superadmin') {
            let orderCogs = 0;
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    let pp = item.purchasePrice;
                    if (pp === undefined) {
                        const currentProd = products.find(p => p.id === item.id);
                        pp = currentProd ? (currentProd.purchasePrice || 0) : 0;
                    }
                    orderCogs += (pp * (item.qty || 1));
                });
            }

            // Subtract any specific expenses related to this order
            const orderSpecificExpenses = transactions
                .filter(t => t.type === 'expense' && t.relatedId === order.id)
                .reduce((sum, t) => sum + t.amount, 0);

            // Shared Monthly Expenses logic for Recent Orders
            const orderDate = new Date(order.date);
            const oMonth = orderDate.getMonth();
            const oYear = orderDate.getFullYear();

            const monthGeneralExpenses = transactions.filter(t => {
                const tDate = new Date(t.date);
                return t.type === 'expense' && t.relatedId === 'EXP' && tDate.getMonth() === oMonth && tDate.getFullYear() === oYear;
            }).reduce((sum, t) => sum + t.amount, 0);

            const mOrdersCount = orders.filter(o => {
                const oDate = new Date(o.date);
                return oDate.getMonth() === oMonth && oDate.getFullYear() === oYear;
            }).length;
            const generalShare = mOrdersCount > 0 ? (monthGeneralExpenses / mOrdersCount) : 0;

            const monthCatExpenses = transactions.filter(t => {
                const tDate = new Date(t.date);
                return t.type === 'expense' && t.relatedId === ('CAT-' + order.category) && tDate.getMonth() === oMonth && tDate.getFullYear() === oYear;
            }).reduce((sum, t) => sum + t.amount, 0);

            const mCatOrdersCount = orders.filter(o => {
                const oDate = new Date(o.date);
                return o.category === order.category && oDate.getMonth() === oMonth && oDate.getFullYear() === oYear;
            }).length;
            const categoryShare = mCatOrdersCount > 0 ? (monthCatExpenses / mCatOrdersCount) : 0;

            const totalExpenses = orderSpecificExpenses + generalShare + categoryShare;
            const profit = (order.totalAmount || 0) - orderCogs - totalExpenses;

            let expenseHtml = '';
            if (totalExpenses > 0) {
                expenseHtml = `<br/><small style="color: var(--danger); font-size: 10px;">خرچہ: ${formatCurrency(totalExpenses)}</small>`;
            }

            const profitColor = profit > 0 ? 'var(--success)' : (profit < 0 ? 'var(--danger)' : 'var(--text-main)');
            orderProfitHtml = `<span style="color: ${profitColor}; font-weight: 500; font-size: 13px;">${formatCurrency(profit)}</span>${expenseHtml}`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${order.id}</strong></td>
            <td><strong style="font-size: 15px;">${order.customerName}</strong><br/><small style="color:var(--text-muted);">${order.details ? (order.details.substring(0, 40) + '...') : '-'}</small></td>
            <td><span style="background-color: var(--bg-main); padding: 4px 8px; border-radius: 4px; font-size: 12px; border: 1px solid var(--border);">${catText}</span></td>
            <td><span class="badge-status ${statusClass}">${getStatusUrdu(order.status)}</span></td>
            <td>${paymentBadge}</td>
            <td style="text-align: right;">${orderProfitHtml}</td>
            <td style="display: flex; gap: 8px;">
                <button onclick="generateAndDownloadBill('${order.id}')" class="btn btn-icon" style="color: var(--primary); background: #f3f4f6;" title="بل/رسید ڈاؤنلوڈ کریں"><ion-icon name="document-text-outline"></ion-icon></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Full Orders List Logic (Pagination & Filtering)
let currentStatusFilter = 'all';

window.filterOrdersByStatus = function (status, btn) {
    currentStatusFilter = status;
    const tabs = btn.parentElement.querySelectorAll('button');
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderOrdersList();
};

window.renderOrdersList = function () {
    const tbody = document.getElementById('ordersListBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = (document.getElementById('orderSearchInput')?.value || '').toLowerCase();
    const categoryFilter = document.getElementById('orderCategoryFilter')?.value || 'all';

    let filteredOrders = orders.filter(order => {
        // Status Filter
        let matchStatus = true;
        if (currentStatusFilter !== 'all') {
            if (currentStatusFilter === 'zair-e-takmeel') {
                const nonFinalStatuses = orderStatuses.filter(s => !s.isFinal).map(s => s.id);
                matchStatus = nonFinalStatuses.includes(order.status);
            } else {
                matchStatus = order.status === currentStatusFilter;
            }
        }

        // Search Filter
        const matchSearch = order.customerName.toLowerCase().includes(searchTerm) ||
            (order.details && order.details.toLowerCase().includes(searchTerm)) ||
            order.id.toLowerCase().includes(searchTerm);

        // Category Filter
        const matchCategory = categoryFilter === 'all' || order.category === categoryFilter;

        return matchStatus && matchSearch && matchCategory;
    });

    // Sort by date descending
    filteredOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredOrders.forEach(order => {
        const d = new Date(order.date);
        const dateStr = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        let statusClass = 'status-progress';
        if (order.status === 'completed') statusClass = 'status-completed';
        else if (order.status === 'designing') statusClass = 'status-designing';
        else if (order.status === 'printing') statusClass = 'status-printing';
        else if (order.status === 'pasting') statusClass = 'status-pasting';

        let pending = order.totalAmount - (order.advance || 0);
        let paymentInfo = `Rs. ${order.totalAmount} <br/> <small>وصول: ${order.advance || 0}</small>`;
        if (pending > 0) paymentInfo += `<br/><small class="text-danger">بقایا: ${pending}</small>`;
        else paymentInfo += `<br/><small class="text-success">مکمل ادا شدہ</small>`;

        const category = orderCategories.find(c => c.id === order.category);
        let catText = category ? category.label : 'نامعلوم';

        let orderProfitHtml = '<span style="color:var(--text-muted); font-size: 12px;">مخفی</span>';
        if (currentRole === 'admin' || currentRole === 'superadmin') {
            let orderCogs = 0;
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    let pp = item.purchasePrice;
                    if (pp === undefined) {
                        const currentProd = products.find(p => p.id === item.id);
                        pp = currentProd ? (currentProd.purchasePrice || 0) : 0;
                    }
                    orderCogs += (pp * (item.qty || 1));
                });
            }

            // Subtract any specific expenses related to this order
            const orderSpecificExpenses = transactions
                .filter(t => t.type === 'expense' && t.relatedId === order.id)
                .reduce((sum, t) => sum + t.amount, 0);

            // Calculate Shared Monthly Expenses
            const orderDate = new Date(order.date);
            const orderMonth = orderDate.getMonth();
            const orderYear = orderDate.getFullYear();

            // 1. Month's General Expenses
            const monthGeneralExpenses = transactions.filter(t => {
                const tDate = new Date(t.date);
                return t.type === 'expense' && t.relatedId === 'EXP' &&
                    tDate.getMonth() === orderMonth && tDate.getFullYear() === orderYear;
            }).reduce((sum, t) => sum + t.amount, 0);

            const monthOrders = orders.filter(o => {
                const oDate = new Date(o.date);
                return oDate.getMonth() === orderMonth && oDate.getFullYear() === orderYear;
            });
            const generalShare = monthOrders.length > 0 ? (monthGeneralExpenses / monthOrders.length) : 0;

            // 2. Month's Category-Specific Shared Expenses
            const monthCatExpenses = transactions.filter(t => {
                const tDate = new Date(t.date);
                return t.type === 'expense' && t.relatedId === ('CAT-' + order.category) &&
                    tDate.getMonth() === orderMonth && tDate.getFullYear() === orderYear;
            }).reduce((sum, t) => sum + t.amount, 0);

            const monthCatOrders = monthOrders.filter(o => o.category === order.category);
            const categoryShare = monthCatOrders.length > 0 ? (monthCatExpenses / monthCatOrders.length) : 0;

            const totalOrderExpenses = orderSpecificExpenses + generalShare + categoryShare;
            const profit = (order.totalAmount || 0) - orderCogs - totalOrderExpenses;

            let expenseHtml = '';
            if (totalOrderExpenses > 0) {
                let breakdown = [];
                if (orderSpecificExpenses > 0) breakdown.push(`خاص: ${orderSpecificExpenses}`);
                if (generalShare > 0) breakdown.push(`جنرل: ${generalShare.toFixed(1)}`);
                if (categoryShare > 0) breakdown.push(`کیٹیگری: ${categoryShare.toFixed(1)}`);

                expenseHtml = `<br/><small style="color: var(--danger); font-size: 10px;" title="${breakdown.join(', ')}">خرچہ: ${formatCurrency(totalOrderExpenses)}</small>`;
            }

            const profitColor = profit > 0 ? 'var(--success)' : (profit < 0 ? 'var(--danger)' : 'var(--text-main)');
            orderProfitHtml = `<span style="color: ${profitColor}; font-weight: 500;">${formatCurrency(profit)}</span>${expenseHtml}`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="order-checkbox" data-id="${order.id}" onclick="updateMassDeleteButtonsVisibility()">
            </td>
            <td style="font-size: 13px;">${dateStr}<br/><strong>${order.id}</strong></td>
            <td><strong style="font-size: 15px;">${order.customerName}</strong><br/><small style="color:var(--text-muted);">${order.details || '-'}</small></td>
            <td><span class="badge-status status-neutral" style="background:#f1f5f9; color:#475569;">${catText}</span></td>
            <td>
                <select class="badge-status ${statusClass}" onchange="changeOrderStatus('${order.id}', this.value)" style="border:none; cursor:pointer; font-family: inherit;">
                    ${orderStatuses.map(s => `<option value="${s.id}" ${order.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
                </select>
            </td>
            <td>${paymentInfo}</td>
            <td style="text-align: right;">${orderProfitHtml}</td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 5px; justify-content: center;">
                    <button onclick="generateAndDownloadBill('${order.id}')" class="btn btn-icon" style="color: var(--primary); background: #f3f4f6;" title="بل دیکھیں"><ion-icon name="document-text-outline"></ion-icon></button>
                    <button onclick="updatePayment('${order.id}')" class="btn btn-icon" style="color: var(--info); background: #e0f2fe;" title="رقم وصولی"><ion-icon name="wallet-outline"></ion-icon></button>
                    ${(currentRole === 'admin' || currentRole === 'superadmin') ? `<button onclick="deleteOrder('${order.id}')" class="btn btn-icon" style="color: var(--danger); background: #fee2e2;" title="ڈیلیٹ"><ion-icon name="trash-outline"></ion-icon></button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (filteredOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">کوئی آرڈر نہیں ملا۔</td></tr>`;
    }
};

function getStatusUrdu(statusId) {
    const status = orderStatuses.find(s => s.id === statusId);
    return status ? status.label : 'نامعلوم';
}

function getStatusColorClass(statusId) {
    const status = orderStatuses.find(s => s.id === statusId);
    return status ? status.color : 'status-progress';
}

// Global functions for inline HTML calls
window.changeOrderStatus = function (orderId, newStatus) {
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex > -1) {
        orders[orderIndex].status = newStatus;
        saveOrders();
        updateDashboardStats();
        renderRecentOrders();
        renderOrdersList();
    }
}

window.updatePayment = function (orderId) {
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex > -1) {
        let order = orders[orderIndex];
        let pending = order.totalAmount - order.advance;
        if (pending <= 0) {
            alert('اس آرڈر کی مکمل رقم پہلے ہی وصول ہو چکی ہے۔');
            return;
        }
        let inputAmount = prompt(`آرڈر کی بقیہ رقم: Rs. ${pending}\nمزید کتنی رقم وصول ہوئی ہے؟`, pending);
        if (inputAmount !== null && inputAmount.trim() !== '') {
            let amount = parseFloat(inputAmount);
            if (!isNaN(amount) && amount > 0) {
                // Ensure we don't receive more than pending
                if (amount > pending) amount = pending;

                order.advance += amount;
                addTransaction('income', amount, currentUser, `آرڈر ${order.id} کا بقیہ کیش وصول`, order.id);

                saveOrders();
                updateDashboardStats();
                renderRecentOrders();
                renderOrdersList();
            } else {
                alert('براہ کرم درست رقم درج کریں۔');
            }
        }
    }
}

window.editOrder = function (orderId) {
    alert('آرڈر ایڈٹ کرنے کی سہولت جلد شامل کر دی جائے گی۔ فی الحال آپ اسٹیٹس براہ راست تبدیل کر سکتے ہیں۔');
};

// Filtered Orders Modal Support
window.openFilteredOrdersModal = function (filterType) {
    const modal = document.getElementById('filteredOrdersModal');
    const title = document.getElementById('filteredOrdersTitle');
    const tbody = document.getElementById('filteredOrdersBody');
    tbody.innerHTML = '';

    let displayedOrders = [];

    if (filterType === 'pending') {
        title.innerText = 'بقایا جات والے کسٹمرز (Pending Payments)';
        displayedOrders = orders.filter(o => (o.totalAmount - (o.advance || 0)) > 0);
    } else if (filterType === 'active') {
        title.innerText = 'زیر تکمیل آرڈرز (Active Orders)';
        displayedOrders = orders.filter(o => o.status !== 'completed');
    }

    displayedOrders.forEach(order => {
        let statusClass = 'status-progress';
        if (order.status === 'completed') statusClass = 'status-completed';
        else if (order.status === 'designing') statusClass = 'status-designing';
        else if (order.status === 'printing') statusClass = 'status-printing';
        else if (order.status === 'pasting') statusClass = 'status-pasting';

        let statusText = 'زیر تکمیل';
        if (order.status === 'completed') statusText = 'مکمل';
        else if (order.status === 'designing') statusText = 'ڈیزائننگ';
        else if (order.status === 'printing') statusText = 'پرنٹنگ';
        else if (order.status === 'pasting') statusText = 'پیسٹنگ';

        let pending = order.totalAmount - (order.advance || 0);
        let paymentBadge = '';
        if (pending <= 0) {
            paymentBadge = `<span class="text-success"><ion-icon name="checkmark-circle"></ion-icon> مکمل</span>`;
        } else if ((order.advance || 0) > 0) {
            paymentBadge = `<span class="text-warning">وصول: ${formatCurrency(order.advance)}</span> <br/> <small class="text-danger">بقایا: ${formatCurrency(pending)}</small>`;
        } else {
            paymentBadge = `<span class="text-danger"><ion-icon name="alert-circle"></ion-icon> بقایا: ${formatCurrency(order.totalAmount)}</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${order.id}</strong></td>
            <td><strong>${order.customerName}</strong><br/><small style="color:var(--text-muted);">${order.details}</small></td>
            <td><span class="badge-status ${statusClass}">${statusText}</span></td>
            <td>${paymentBadge}</td>
            <td>
                <button onclick="generateAndDownloadBill('${order.id}')" class="btn btn-icon" style="color: var(--primary); background: #f3f4f6;" title="بل/رسید ڈاؤنلوڈ کریں"><ion-icon name="document-text-outline"></ion-icon></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (displayedOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">کوئی ریکارڈ نہیں ملا۔</td></tr>`;
    }

    modal.classList.add('show');
}

window.closeFilteredOrdersModal = function () {
    document.getElementById('filteredOrdersModal').classList.remove('show');
}

window.deleteOrder = function (orderId) {
    if (currentRole !== 'admin' && currentRole !== 'superadmin') {
        alert('صرف مالکان یا ایڈمنسٹریٹر آرڈر ڈیلیٹ کر سکتے ہیں۔');
        return;
    }
    if (confirm('کیا آپ واقعی یہ آرڈر ڈیلیٹ کرنا چاہتے ہیں؟ اسے ایک ماہ کے اندر ریفرش بن سے ریکور کیا جا سکتا ہے۔')) {
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex > -1) {
            const order = orders[orderIndex];
            order.deletedAt = new Date().toISOString();
            deletedOrders.push(order);
            saveDeletedOrders();

            orders.splice(orderIndex, 1);
            saveOrders();
            updateDashboardStats();
            renderRecentOrders();
            renderOrdersList();
            showToast('آرڈر ریفرش بن میں منتقل کر دیا گیا ہے', 'info');
        }
    }
}

// Bill Generation System
window.generateAndDownloadBill = async function (orderId, viewOnly = false) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    try {
        // Apply Dynamic Styles to Template
        const billContent = document.getElementById('billContent');
        const billHeader = document.getElementById('billHeaderContainer');
        const billInfoStrip = document.getElementById('billInfoStrip');
        const billFooterStrip = document.getElementById('billFooterStrip');
        const billSocialLinks = document.getElementById('billSocialLinks');
        const billHeaderCustom = document.getElementById('billHeaderCustomText');
        const billFooterCustom = document.getElementById('billFooterCustomText');
        const billQrCode = document.getElementById('billQrCode');

        // Clear previous QR
        if (billQrCode) billQrCode.innerHTML = '';

        billContent.style.fontFamily = shopSettings.billFont || "'Outfit', sans-serif";
        billContent.style.fontSize = (shopSettings.billFontSize || 18) + 'px';

        if (billHeader) {
            billHeader.style.color = shopSettings.billHeaderTextColor || '#ffffff';
            billHeader.style.flexDirection = shopSettings.billLogoPosition === 'left' ? 'row-reverse' : 'row';

            const type = shopSettings.billHeaderType || 'solid';
            if (type === 'solid') {
                billHeader.style.background = shopSettings.billHeaderColor || '#1e40af';
            } else if (type === 'gradient') {
                const g1 = shopSettings.billHeaderGrad1 || '#1e40af';
                const g2 = shopSettings.billHeaderGrad2 || '#1d4ed8';
                const dir = shopSettings.billHeaderGradDir || 'to right';
                billHeader.style.background = dir === 'circle' ? `radial-gradient(circle, ${g1}, ${g2})` : `linear-gradient(${dir}, ${g1}, ${g2})`;
            } else if (type === 'image' && shopSettings.billHeaderBgImage) {
                billHeader.style.background = `url(${shopSettings.billHeaderBgImage}) center/cover no-repeat`;
            }

            const h1 = billHeader.querySelector('h1');
            if (h1) {
                h1.style.color = shopSettings.billHeaderTextColor || '#ffffff';
                h1.style.fontFamily = shopSettings.billNameFont || "'Noto Nastaliq Urdu', serif";
            }
        }

        if (billInfoStrip) {
            billInfoStrip.style.background = shopSettings.billStripBg || '#f8f9fa';
            billInfoStrip.style.color = shopSettings.billStripTextColor || '#333333';
            document.getElementById('billShopAddressDisplay').innerText = shopSettings.address || '';
            document.getElementById('billShopPhoneDisplay').innerText = shopSettings.phone || '';

            const addressLen = (shopSettings.address || '').length;
            document.getElementById('billShopAddressDisplay').style.fontSize = addressLen > 50 ? '14px' : '16px';
        }

        if (billFooterStrip) {
            billFooterStrip.style.background = shopSettings.billFooterBg || '#1e40af';
            billFooterStrip.style.color = shopSettings.billFooterTextColor || '#ffffff';
        }

        if (billSocialLinks) {
            billSocialLinks.style.color = shopSettings.billFooterTextColor || '#ffffff';
            const socialStr = shopSettings.social || '';
            const socialLinks = socialStr.split(/[,\s]+/).filter(link => link.trim() !== '');
            billSocialLinks.innerText = socialLinks.join(' :|: ');
        }

        // Generate QR Code
        if (billQrCode) {
            const baseUrl = shopSettings.qrBaseUrl || window.location.href.split('?')[0];
            const qrUrl = `${baseUrl}?billId=${order.id}`;
            new QRCode(billQrCode, {
                text: qrUrl,
                width: 100,
                height: 100,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }

        if (billHeaderCustom) billHeaderCustom.innerText = shopSettings.billHeaderText || '';
        if (billFooterCustom) billFooterCustom.innerText = shopSettings.billFooterText || '';

        // Populate Bill Data
        document.getElementById('billShopName').innerHTML = `${shopSettings.name}<br/><small style="font-size: 14px; font-weight: 400; font-family: sans-serif; opacity: 0.9;">${shopSettings.tagline || 'Your Smart Business Partner'}</small>`;
        const logoImg = document.getElementById('billShopLogo');
        const defaultLogo = document.getElementById('billDefaultLogo');
        if (shopSettings.logo) {
            logoImg.src = shopSettings.logo;
            logoImg.style.display = 'block';
            defaultLogo.style.display = 'none';
        } else {
            logoImg.style.display = 'none';
            defaultLogo.style.display = 'block';
        }

        document.getElementById('billCustomerName').innerText = order.customerName;
        document.getElementById('billOrderDetails').innerText = order.details || '-';

        let catText = 'اسٹیشنری';
        if (order.category === 'printing') catText = 'پرنٹنگ (و دیگر)';
        if (order.category === 'online') catText = 'آنلائن سروسز';
        document.getElementById('billCategory').innerText = catText;
        document.getElementById('billOrderId').innerText = order.id;

        const dDate = new Date(order.date);
        document.getElementById('billDate').innerText = dDate.toLocaleDateString('en-GB') + ' ' + dDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const statusEl = document.getElementById('billStatus');
        let statusUrdu = 'باقی (Pending)';
        let statusColor = '#ca8a04';
        let statusBg = '#fef9c3';

        if (order.status === 'completed') {
            statusUrdu = 'مکمل (Completed)';
            statusColor = '#16a34a';
            statusBg = '#dcfce7';
        } else if (order.status === 'designing') {
            statusUrdu = 'ڈیزائننگ';
        } else if (order.status === 'printing') {
            statusUrdu = 'پرنٹنگ';
        } else if (order.status === 'pasting') {
            statusUrdu = 'پیسٹنگ';
        }

        if (statusEl) {
            statusEl.innerText = statusUrdu;
            statusEl.style.color = statusColor;
            statusEl.style.background = statusBg;
        }

        // Populate Table with Structured Items
        const itemsBody = document.getElementById('billItemsBody');
        if (itemsBody) {
            itemsBody.innerHTML = '';
            const items = order.items || [];

            if (items.length > 0) {
                items.forEach((item, index) => {
                    const row = `
                        <tr>
                            <td style="padding: 15px; border: 1px solid #ddd; text-align: right;">${index + 1}</td>
                            <td style="padding: 15px; border: 1px solid #ddd; text-align: right;">${item.name}</td>
                            <td style="padding: 15px; border: 1px solid #ddd; text-align: right;">${formatCurrency(item.price)}</td>
                            <td style="padding: 15px; border: 1px solid #ddd; text-align: right;">${item.qty}</td>
                            <td style="padding: 15px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(item.price * item.qty)}</td>
                        </tr>
                    `;
                    itemsBody.innerHTML += row;
                });
            } else {
                // Fallback for legacy orders
                itemsBody.innerHTML = `
                    <tr>
                        <td style="padding: 15px; border: 1px solid #ddd; text-align: right;">1</td>
                        <td style="padding: 15px; border: 1px solid #ddd; text-align: right;">${order.details || 'تفصیل'}</td>
                        <td style="padding: 15px; border: 1px solid #ddd; text-align: right;">-</td>
                        <td style="padding: 15px; border: 1px solid #ddd; text-align: right;">1</td>
                        <td style="padding: 15px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(order.totalAmount + (order.discount || 0))}</td>
                    </tr>
                `;
            }
        }

        document.getElementById('billSummaryTotal').innerText = formatCurrency(order.totalAmount + (order.discount || 0));

        const discountRow = document.getElementById('billSummaryDiscountRow');
        if (order.discount > 0) {
            document.getElementById('billSummaryDiscount').innerText = '- ' + formatCurrency(order.discount);
            if (discountRow) discountRow.style.display = 'table-row';
        } else {
            if (discountRow) discountRow.style.display = 'none';
        }

        document.getElementById('billSummaryAdvance').innerText = formatCurrency(order.advance || 0);
        const balance = order.totalAmount - (order.advance || 0);
        document.getElementById('billSummaryBalance').innerText = formatCurrency(balance);

        const watermark = document.getElementById('billWatermark');
        if (balance <= 0) {
            watermark.innerText = 'ادا شدہ (PAID)';
            watermark.style.color = 'rgba(22, 163, 74, 0.04)';
        } else {
            watermark.innerText = 'باقی (PENDING)';
            watermark.style.color = 'rgba(220, 38, 38, 0.03)';
        }

        if (viewOnly) return;

        // Generate Image
        const billEl = document.getElementById('billContent');

        showToast('بل تیار کیا جا رہا ہے، براہ کرم انتظار کریں...', 'info');

        const canvas = await html2canvas(billEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: true,
            onclone: (clonedDoc) => {
                const clonedWrap = clonedDoc.getElementById('billTemplateWrap');
                if (clonedWrap) {
                    // Reset positioning in the cloned document so html2canvas sees it clearly
                    clonedWrap.style.position = 'absolute';
                    clonedWrap.style.left = '0px';
                    clonedWrap.style.top = '0px';
                    clonedWrap.style.visibility = 'visible';
                    clonedWrap.style.display = 'block';
                    clonedWrap.style.zIndex = '1';
                }
            }
        });

        // Robust Blob approach to prevent 0 Byte downloads
        try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

            if (dataUrl.length < 50) {
                throw new Error("Canvas render failed (blank image)");
            }

            // Manual Base64 to Blob conversion to bypass fetch DataURI limits
            const arr = dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });

            if (blob.size === 0) {
                throw new Error("Blob is 0 bytes");
            }

            const objectUrl = URL.createObjectURL(blob);

            let cleanName = order.customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/gi, '').replace(/\s+/g, '_');
            if (!cleanName) cleanName = 'Customer';
            const fileName = `Bill_${order.id}_${cleanName}.jpg`;

            const link = document.createElement('a');
            link.download = fileName;
            link.href = objectUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up to free memory
            setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);

            showToast('بل تیار ہو گیا ہے۔', 'success');
        } catch (e) {
            console.error("Canvas export failed:", e);
            alert("تصویر بنانے میں مسئلہ پیش آیا: " + e.message);
        }

    } catch (error) {
        console.error('Error generating bill image:', error);
        alert('بل بنانے میں کوئی تکنیکی مسئلہ پیش آیا۔ براہ کرم پیج ریفریش کر کے دوبارہ کوشش کریں۔');
        document.getElementById('billTemplateWrap').style.left = '-9999px';
    }
};

// Modal Logic
function setupModal() {
    const modal = document.getElementById('orderModal');
    const openBtn = document.getElementById('newOrderBtn');
    const closeBtn = document.getElementById('closeOrderModal');
    const form = document.getElementById('newOrderForm');

    openBtn.addEventListener('click', () => {
        modal.classList.add('show');
    });

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        form.dataset.products = '[]';
        form.dataset.subtotal = '0';
        document.getElementById('orderDiscountAmount').value = '0';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            form.dataset.products = '[]';
            form.dataset.subtotal = '0';
            document.getElementById('orderDiscountAmount').value = '0';
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let customerName = form.querySelector('input[type="text"]').value.trim();
        if (!customerName) customerName = 'نامعلوم کسٹمر';
        const category = form.querySelector('select').value;
        const details = form.querySelector('textarea').value;
        const totalAmount = parseFloat(document.getElementById('orderTotalAmountInput').value) || 0;
        const advance = parseFloat(document.getElementById('orderReceivedAmountInput').value) || 0;
        const discountAmount = parseFloat(document.getElementById('orderDiscountAmount').value) || 0;

        const orderStatus = document.getElementById('orderStatus').value || (category === 'printing' ? 'designing' : 'progress');

        const newOrder = {
            id: generateOrderId(),
            customerName: customerName,
            category: category,
            details: details,
            status: orderStatus,
            totalAmount: totalAmount,
            discount: discountAmount,
            advance: advance,
            items: JSON.parse(form.dataset.products || '[]'),
            date: new Date().toISOString(),
            payments: advance > 0 ? [{
                date: new Date().toISOString(),
                amount: advance,
                user: currentUser,
                note: 'ایڈوانس رقم'
            }] : []
        };

        orders.push(newOrder);
        if (advance > 0) {
            addTransaction('income', advance, currentUser, `آرڈر ${newOrder.id} کی ایڈوانس رقم`, newOrder.id);
        }

        let orderProducts = JSON.parse(form.dataset.products || '[]');
        orderProducts = orderProducts.map(op => {
            let p = products.find(prod => prod.id === op.id);
            if (p) {
                p.qty -= op.qty;
                if (p.qty < 0) p.qty = 0;
                op.purchasePrice = p.purchasePrice || 0; // Capture purchase price for profit calculation
            } else {
                op.purchasePrice = 0;
            }
            return op;
        });

        // Update the items in newOrder before saving
        newOrder.items = orderProducts;

        saveProducts();
        populateOrderProducts();

        saveOrders();
        updateDashboardStats();
        renderRecentOrders();

        modal.classList.remove('show');
        form.reset();
        form.dataset.products = '[]';
        form.dataset.subtotal = '0';
        document.getElementById('orderDiscountAmount').value = '0';
    });
}

// Ensure the income form works
document.addEventListener('DOMContentLoaded', () => {
    const newIncomeForm = document.getElementById('newIncomeForm');
    if (newIncomeForm) {
        newIncomeForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const orderId = document.getElementById('incomeSelectedOrderId').value;
            const amount = parseFloat(document.getElementById('incomeAmount').value) || 0;
            const note = document.getElementById('incomeNote').value.trim();
            const currentUser = localStorage.getItem('alAbbasiCurrentUser') || 'owner1';

            if (!orderId) {
                alert('براہ کرم فہرست سے آرڈر منتخب کریں۔');
                return;
            }

            if (amount <= 0) {
                alert('براہ کرم درست رقم درج کریں۔');
                return;
            }

            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex === -1) {
                alert('آرڈر نہیں ملا۔');
                return;
            }

            // Update order record
            orders[orderIndex].advance += amount;

            // Record payment history
            if (!orders[orderIndex].payments) {
                orders[orderIndex].payments = [];
            }
            orders[orderIndex].payments.push({
                date: new Date().toISOString(),
                amount: amount,
                user: currentUser,
                note: note || 'آمدن کیش وصولی'
            });

            saveOrders();

            // Log Transaction globally
            addTransaction('income', amount, currentUser, `آرڈر ${orderId} کیش وصولی ${note ? '- ' + note : ''}`, orderId);

            updateDashboardStats();
            renderRecentOrders();
            if (document.getElementById('ordersPage')?.style.display !== 'none') {
                renderOrdersList();
            }

            closeIncomeModal();
            showToast(`Rs. ${amount} کامیابی سے جمع کر لیے گئے`, 'success');
        });
    }
});

function populateOrderProducts() {
    const select = document.getElementById('orderProductSelect');
    if (!select) return;
    select.innerHTML = '<option value="">کوئی پروڈکٹ منتخب کریں...</option>';
    products.forEach(p => {
        if (p.qty > 0) {
            const price = p.salePrice || p.price || 0;
            select.innerHTML += `<option value="${p.id}">${p.name} - (اسٹاک: ${p.qty}) - Rs. ${price}</option>`;
        }
    });
}

window.addProductToOrder = function () {
    const prodId = document.getElementById('orderProductSelect').value;
    const qty = parseInt(document.getElementById('orderProductQty').value) || 1;

    if (!prodId) {
        alert('براہ کرم کوئی پروڈکٹ منتخب کریں۔');
        return;
    }

    const prod = products.find(p => p.id === prodId);
    if (prod) {
        if (qty > prod.qty) {
            alert(`اسٹاک میں صرف ${prod.qty} عدد دستیاب ہیں۔`);
            return;
        }

        const detailsArea = document.querySelector('#newOrderForm textarea');
        const priceToUse = prod.salePrice || prod.price || 0;
        let lineItemTotal = priceToUse * qty;

        const form = document.getElementById('newOrderForm');
        let currentSubtotal = parseFloat(form.dataset.subtotal) || 0;
        currentSubtotal += lineItemTotal;
        form.dataset.subtotal = currentSubtotal;

        let lineItemText = `${prod.name} x ${qty} = Rs. ${lineItemTotal}`;
        if (detailsArea.value) {
            detailsArea.value += `\n${lineItemText}`;
        } else {
            detailsArea.value = lineItemText;
        }

        let orderProducts = JSON.parse(form.dataset.products || '[]');
        orderProducts.push({ id: prod.id, name: prod.name, price: priceToUse, qty: qty });
        form.dataset.products = JSON.stringify(orderProducts);

        document.getElementById('orderProductSelect').value = '';
        document.getElementById('orderProductQty').value = 1;

        calculateTotalAfterDiscount();

        alert(`پروڈکٹ بل میں شامل کر لی گئی۔`);
    }
}

window.addCustomProductToOrder = function () {
    const name = document.getElementById('customProductName').value.trim();
    const price = parseFloat(document.getElementById('customProductPrice').value) || 0;
    const qty = parseInt(document.getElementById('customProductQty').value) || 1;

    if (!name || price <= 0) {
        alert('براہ کرم آئٹم کا نام اور درست قیمت درج کریں۔');
        return;
    }

    const detailsArea = document.querySelector('#newOrderForm textarea');
    let lineItemTotal = price * qty;

    const form = document.getElementById('newOrderForm');
    let currentSubtotal = parseFloat(form.dataset.subtotal) || 0;
    currentSubtotal += lineItemTotal;
    form.dataset.subtotal = currentSubtotal;

    let lineItemText = `${name} (Custom) x ${qty} = Rs. ${lineItemTotal}`;
    if (detailsArea.value) {
        detailsArea.value += `\n${lineItemText}`;
    } else {
        detailsArea.value = lineItemText;
    }

    calculateTotalAfterDiscount();

    document.getElementById('customProductName').value = '';
    document.getElementById('customProductPrice').value = '';
    document.getElementById('customProductQty').value = 1;

    alert('کسٹم آئٹم بل میں شامل کر لیا گیا۔');
}

window.calculateTotalAfterDiscount = function () {
    const form = document.getElementById('newOrderForm');
    let subtotal = parseFloat(form.dataset.subtotal) || 0;
    let discount = parseFloat(document.getElementById('orderDiscountAmount').value) || 0;
    let finalTotal = subtotal - discount;
    if (finalTotal < 0) finalTotal = 0;
    document.getElementById('orderTotalAmountInput').value = finalTotal;
}

window.updateManualSubtotal = function () {
    const form = document.getElementById('newOrderForm');
    let discount = parseFloat(document.getElementById('orderDiscountAmount').value) || 0;
    let manualTotal = parseFloat(document.getElementById('orderTotalAmountInput').value) || 0;
    form.dataset.subtotal = manualTotal + discount;
}

function setupProductsPage() {
    const form = document.getElementById('newProductForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('newProductName').value.trim();
        const category = document.getElementById('newProductCategory').value;
        const purchasePrice = parseFloat(document.getElementById('newProductPurchasePrice').value) || 0;
        const salePrice = parseFloat(document.getElementById('newProductSalePrice').value) || 0;
        const qty = parseInt(document.getElementById('newProductQty').value) || 0;

        if (name) {
            const existingIndex = products.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
            if (existingIndex > -1) {
                products[existingIndex].purchasePrice = purchasePrice;
                products[existingIndex].salePrice = salePrice;
                products[existingIndex].category = category;
                products[existingIndex].qty += qty;
            } else {
                products.push({
                    id: 'PROD-' + Date.now(),
                    name: name,
                    category: category,
                    purchasePrice: purchasePrice,
                    salePrice: salePrice,
                    qty: qty
                });
            }
            saveProducts();
            renderProducts();
            populateOrderProducts();
            form.reset();
            showToast('پروڈکٹ کامیابی سے محفوظ کر لی گئی ہے', 'success');
        }
    });
}

window.handlePresetChange = function () {
    const preset = document.getElementById('productQtyPreset').value;
    const rangeFields = document.getElementById('productQtyRangeFields');
    if (preset === 'range') {
        rangeFields.style.display = 'flex';
    } else {
        rangeFields.style.display = 'none';
        // Reset range inputs when not in range mode
        const minInput = document.getElementById('productQtyMin');
        const maxInput = document.getElementById('productQtyMax');
        if (minInput) minInput.value = '';
        if (maxInput) maxInput.value = '';
    }
    renderProducts();
};

window.renderProducts = function () {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = (document.getElementById('productSearchInput')?.value || '').toLowerCase();
    const preset = document.getElementById('productQtyPreset')?.value || 'all';

    // Range values
    const minVal = document.getElementById('productQtyMin')?.value;
    const maxVal = document.getElementById('productQtyMax')?.value;
    const min = (minVal !== undefined && minVal !== '') ? parseInt(minVal) : null;
    const max = (maxVal !== undefined && maxVal !== '') ? parseInt(maxVal) : null;

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        const qty = p.qty || 0;

        let matchesQty = true;
        if (preset === 'out') {
            matchesQty = qty === 0;
        } else if (preset === 'near') {
            matchesQty = qty <= 10;
        } else if (preset === 'low') {
            matchesQty = qty <= 25;
        } else if (preset === 'range') {
            const matchesMin = min === null || qty >= min;
            const matchesMax = max === null || qty <= max;
            matchesQty = matchesMin && matchesMax;
        }

        return matchesSearch && matchesQty;
    });

    filteredProducts.forEach(prod => {
        const tr = document.createElement('tr');
        const category = orderCategories.find(c => c.id === prod.category);
        const catLabel = category ? category.label : '-';

        const salePrice = prod.salePrice || prod.price || 0;
        const purchasePrice = prod.purchasePrice || 0;
        const margin = salePrice - purchasePrice;
        let marginHtml = '<span style="color:var(--text-muted); font-size: 11px;">مخفی</span>';
        if (currentRole === 'admin' || currentRole === 'superadmin') {
            const marginColor = margin > 0 ? 'var(--success)' : (margin < 0 ? 'var(--danger)' : 'var(--text-main)');
            marginHtml = `<span style="color: ${marginColor}; font-weight: 500;">${formatCurrency(margin)}</span>`;
        }

        let totalSold = 0;
        orders.forEach(o => {
            if (o.items && o.items.length > 0) {
                o.items.forEach(item => {
                    if (item.id === prod.id) {
                        totalSold += (item.qty || 1);
                    }
                });
            }
        });
        const remaining = prod.qty || 0;
        const totalArrived = remaining + totalSold;

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="product-checkbox" data-id="${prod.id}" onclick="updateProductBulkActionsVisibility()">
            </td>
            <td style="text-align: right;"><strong>${prod.name}</strong></td>
            <td style="text-align: right;"><span class="badge-status status-neutral" style="background:#f1f5f9; color:#475569;">${catLabel}</span></td>
            <td style="text-align: right;">${formatCurrency(purchasePrice)}</td>
            <td style="text-align: right; font-weight: bold; color: var(--primary);">${formatCurrency(salePrice)}</td>
            <td style="text-align: right;">${marginHtml}</td>
            <td style="text-align: right;"><span class="badge-status" style="background:var(--bg-card); border: 1px solid var(--border); color: var(--text-main);">${totalArrived} عدد</span></td>
            <td style="text-align: right;"><span class="badge-status" style="background:var(--danger-light); color: var(--danger);">${totalSold} عدد</span></td>
            <td style="text-align: right;"><span class="badge-status ${remaining > 0 ? 'status-completed' : 'status-pending'}">${remaining} عدد</span></td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button onclick="editProduct('${prod.id}')" class="btn btn-icon" style="color: var(--info); background: var(--info-light);" title="ایڈٹ"><ion-icon name="create-outline"></ion-icon></button>
                    <button onclick="deleteProduct('${prod.id}')" class="btn btn-icon" style="color: var(--danger); background: var(--danger-light);" title="ڈیلیٹ"><ion-icon name="trash-outline"></ion-icon></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateProductBulkActionsVisibility(); // Sync bar on search/render
    updateStockSummary(); // Update top stats
}

// Update Stock Summary Stats
window.updateStockSummary = function () {
    const summaryGrid = document.getElementById('productSummaryGrid');
    if (!summaryGrid) return;

    // We calculate based on ALL products, not just filtered ones
    const totalProducts = products.length;
    const catStats = {};

    // Initialize with existing categories
    orderCategories.forEach(c => catStats[c.id] = { label: c.label, count: 0 });

    products.forEach(p => {
        if (catStats[p.category]) {
            catStats[p.category].count++;
        }
    });

    let html = `
        <div class="stat-card" style="flex: 1; min-width: 150px; padding: 15px;">
            <div class="stat-icon" style="background: var(--info-light); color: var(--info); width: 32px; height: 32px; font-size: 16px;">
                <ion-icon name="cube-outline"></ion-icon>
            </div>
            <div class="stat-details">
                <h3 style="font-size: 11px; color: var(--text-muted);">کل پروڈکٹس</h3>
                <h2 style="font-size: 18px;">${totalProducts}</h2>
            </div>
        </div>
    `;

    Object.values(catStats).forEach(stat => {
        if (stat.count > 0) {
            html += `
                <div class="stat-card" style="flex: 1; min-width: 150px; padding: 15px;">
                    <div class="stat-icon" style="background: var(--success-light); color: var(--success); width: 32px; height: 32px; font-size: 16px;">
                        <ion-icon name="pricetag-outline"></ion-icon>
                    </div>
                    <div class="stat-details">
                        <h3 style="font-size: 11px; color: var(--text-muted);">${stat.label}</h3>
                        <h2 style="font-size: 18px;">${stat.count}</h2>
                    </div>
                </div>
            `;
        }
    });

    summaryGrid.innerHTML = html;
};

// Product Bulk Actions logic
window.toggleSelectAllProducts = function (checked) {
    const checkboxes = document.querySelectorAll('.product-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    updateProductBulkActionsVisibility();
};

window.updateProductBulkActionsVisibility = function () {
    const checkboxes = document.querySelectorAll('.product-checkbox');
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const bulkBar = document.getElementById('productBulkActionsBar');
    const countText = document.getElementById('productSelectedCountText');
    const selectAllCheckbox = document.getElementById('selectAllProducts');

    if (selectedCount > 0) {
        bulkBar.style.display = 'block';
        countText.innerText = `${selectedCount} پروڈکٹس منتخب کیے گئے`;
    } else {
        bulkBar.style.display = 'none';
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
    }

    if (selectAllCheckbox && checkboxes.length > 0) {
        selectAllCheckbox.checked = selectedCount === checkboxes.length;
    }
};

window.clearProductSelection = function () {
    const checkboxes = document.querySelectorAll('.product-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    const selectAllCheckbox = document.getElementById('selectAllProducts');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateProductBulkActionsVisibility();
};

window.deleteSelectedProducts = function () {
    const checkboxes = document.querySelectorAll('.product-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

    if (selectedIds.length === 0) return;

    if (confirm(`کیا آپ واقعی منتخب کردہ ${selectedIds.length} پروڈکٹس ڈیلیٹ کرنا چاہتے ہیں؟ یہ عمل واپس نہیں ہو سکتا۔`)) {
        products = products.filter(p => !selectedIds.includes(p.id));
        saveProducts();
        renderProducts();
        populateOrderProducts();
        showToast(`${selectedIds.length} پروڈکٹس کامیابی سے ڈیلیٹ کر دی گئیں`, 'success');
        clearProductSelection();
    }
};

// Excel Export/Import Logic
window.exportProductsToExcel = function () {
    if (products.length === 0) {
        alert('ایکسپورٹ کرنے کے لیے کوئی پروڈکٹ نہیں ہے۔');
        return;
    }

    const exportData = products.map(p => {
        const cat = orderCategories.find(c => c.id === p.category);
        return {
            'پروڈکٹ کا نام': p.name,
            'کیٹیگری': cat ? cat.label : p.category,
            'قیمت خرید': p.purchasePrice || 0,
            'قیمت فروخت': p.salePrice || p.price || 0,
            'موجودہ اسٹاک': p.qty || 0
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock");

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `AlAbbasi_Stock_${date}.xlsx`);
    showToast('اسٹاک فائل ڈاؤنلوڈ ہو گئی ہے', 'success');
};

window.importProductsFromExcel = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert('فائل خالی ہے یا اس کا فارمیٹ درست نہیں ہے۔');
                return;
            }

            let updatedCount = 0;
            let addedCount = 0;

            jsonData.forEach(row => {
                const name = (row['پروڈکٹ کا نام'] || '').toString().trim();
                const catLabel = (row['کیٹیگری'] || '').toString().trim();
                const pPrice = parseFloat(row['قیمت خرید']) || 0;
                const sPrice = parseFloat(row['قیمت فروخت']) || 0;
                const qty = parseInt(row['موجودہ اسٹاک']) || 0;

                if (!name) return;

                // Find category ID by label
                let catId = 'general';
                const foundCat = orderCategories.find(c => c.label.toLowerCase() === catLabel.toLowerCase() || c.id === catLabel.toLowerCase());
                if (foundCat) catId = foundCat.id;

                const existingIndex = products.findIndex(p => p.name.toLowerCase() === name.toLowerCase());

                if (existingIndex > -1) {
                    // Update existing
                    products[existingIndex].purchasePrice = pPrice;
                    products[existingIndex].salePrice = sPrice;
                    products[existingIndex].category = catId;
                    products[existingIndex].qty = qty;
                    updatedCount++;
                } else {
                    // Add new
                    products.push({
                        id: 'PROD-' + Date.now() + Math.floor(Math.random() * 1000),
                        name: name,
                        category: catId,
                        purchasePrice: pPrice,
                        salePrice: sPrice,
                        qty: qty
                    });
                    addedCount++;
                }
            });

            saveProducts();
            renderProducts();
            populateOrderProducts();
            input.value = ''; // Reset file input

            alert(`${updatedCount} پروڈکٹس اپڈیٹ کی گئیں اور ${addedCount} نئی پروڈکٹس شامل کی گئیں۔`);
            showToast('اسٹاک اپ ڈیٹ ہو گیا ہے', 'success');

        } catch (error) {
            console.error('Import error:', error);
            alert('فائل اپلوڈ کرنے میں کوئی مسئلہ پیش آیا۔ براہ کرم فارمیٹ چیک کریں۔');
        }
    };
    reader.readAsArrayBuffer(file);
};

window.deleteProduct = function (id) {
    if (confirm('کیا آپ واقعی یہ پروڈکٹ ڈیلیٹ کرنا چاہتے ہیں؟')) {
        products = products.filter(p => p.id !== id);
        saveProducts();
        renderProducts();
        populateOrderProducts();
    }
}

window.editProduct = function (id) {
    const prod = products.find(p => p.id === id);
    if (prod) {
        let newPurchasePrice = prompt(`نیا قیمت خرید (Purchase Price) درج کریں:`, prod.purchasePrice || 0);
        if (newPurchasePrice !== null && newPurchasePrice !== "") {
            let newSalePrice = prompt(`نیا قیمت فروخت (Sale Price) درج کریں:`, prod.salePrice || prod.price || 0);
            if (newSalePrice !== null && newSalePrice !== "") {
                let newQty = prompt(`نیا اسٹاک (Quantity) درج کریں:`, prod.qty);
                if (newQty !== null && newQty !== "") {
                    prod.purchasePrice = parseFloat(newPurchasePrice) || 0;
                    prod.salePrice = parseFloat(newSalePrice) || 0;
                    prod.qty = parseInt(newQty) || 0;
                    saveProducts();
                    renderProducts();
                    populateOrderProducts();
                }
            }
        }
    }
}

// Setup User Toggle & Dropdown
function setupUserToggle() {
    const profileBtn = document.getElementById('userProfileBtn');
    const dropdown = document.getElementById('userDropdown');

    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    window.addEventListener('click', () => {
        dropdown.style.display = 'none';
    });
}

// Switch User globally
window.switchUser = function (userId) {
    if (USERS[userId]) {
        if (currentUser === userId) return; // Already on this user

        const enteredPass = prompt(`براہ کرم ${USERS[userId].name} کا پاسورڈ درج کریں: `);

        if (enteredPass === null) return; // User cancelled

        if (enteredPass !== USERS[userId].pass) {
            alert('آپ نے غلط پاسورڈ درج کیا ہے۔ براہ کرم دوبارہ کوشش کریں۔');
            return;
        }

        currentUser = userId;
        currentRole = USERS[userId].role;
        localStorage.setItem('alAbbasiSession', currentUser); // Update saved session
        setCurrentUserUI();
        renderRecentOrders(); // To hide/show delete buttons
    }
}

// Logout User
window.logoutUser = function () {
    // Clear all persistent and session data
    localStorage.clear();
    sessionStorage.clear();

    // Clear in-memory state
    currentUser = null;
    currentRole = null;

    // Use the Firebase auth sign-out that handles session clearing on server-side
    if (typeof fbSignOut === 'function' && window.auth) {
        fbSignOut(window.auth).then(() => {
            // Redirect using replace to remove dashboard from browser history
            window.location.replace('index.html');
        }).catch(err => {
            console.error("Logout error:", err);
            window.location.replace('index.html');
        });
    } else {
        window.location.replace('index.html');
    }
}

// --- Customer Management Logic ---
window.renderCustomers = function () {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = (document.getElementById('customerSearchInput')?.value || '').toLowerCase();
    const paymentFilter = document.getElementById('customerPaymentFilter')?.value || 'all';
    const workFilter = document.getElementById('customerWorkFilter')?.value || 'all';

    // Aggregate data per customer
    const customerStats = {};

    orders.forEach(order => {
        const name = order.customerName || 'نامعلوم کسٹمر';
        if (!customerStats[name]) {
            customerStats[name] = {
                name: name,
                totalOrders: 0,
                pendingOrders: 0,
                totalAmount: 0,
                advance: 0,
                balance: 0
            };
        }

        customerStats[name].totalOrders++;
        if (order.status !== 'completed') {
            customerStats[name].pendingOrders++;
        }
        customerStats[name].totalAmount += order.totalAmount;
        customerStats[name].advance += (order.advance || 0);
        customerStats[name].balance = customerStats[name].totalAmount - customerStats[name].advance;
    });

    let displayList = Object.values(customerStats);

    // Filter
    displayList = displayList.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm);

        let matchesPayment = true;
        if (paymentFilter === 'pending') matchesPayment = c.balance > 0;
        else if (paymentFilter === 'paid') matchesPayment = c.balance <= 0;

        let matchesWork = true;
        if (workFilter === 'pending') matchesWork = c.pendingOrders > 0;
        else if (workFilter === 'completed') matchesWork = c.pendingOrders === 0;

        return matchesSearch && matchesPayment && matchesWork;
    });

    // Sort by balance descending
    displayList.sort((a, b) => b.balance - a.balance);

    displayList.forEach(c => {
        const tr = document.createElement('tr');

        let workStatusHtml = c.pendingOrders > 0
            ? `<span class="badge-status status-pending">${c.pendingOrders} زیرِ تکمیل</span>`
            : `<span class="badge-status status-completed">تمام مکمل</span>`;

        let paymentStatusHtml = c.balance > 0
            ? `<span class="badge-status status-pending">بقایا: ${formatCurrency(c.balance)}</span>`
            : `<span class="badge-status status-completed">مکمل ادا شدہ</span>`;

        tr.innerHTML = `
            <td style="text-align: right;"><strong>${c.name}</strong></td>
            <td style="text-align: center;">${c.totalOrders}</td>
            <td style="text-align: center;">${workStatusHtml}</td>
            <td style="text-align: center;">${paymentStatusHtml}</td>
            <td style="text-align: right; font-weight: bold; color: ${c.balance > 0 ? 'var(--danger)' : 'var(--success)'};">
                ${formatCurrency(c.balance)}
            </td>
            <td style="text-align: center;">
                <button onclick="downloadCustomerOrdersPDF('${c.name.replace(/'/g, "\\'")}')" class="btn btn-icon" style="color: var(--danger); background: var(--danger-light);" title="پی ڈی ایف رپورٹ ڈاؤنلوڈ کریں">
                    <ion-icon name="document-outline"></ion-icon>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">کوئی کسٹمر نہیں ملا۔</td></tr>`;
    }

    // Update Summary Cards (Based on ALL data usually, or filtered? Usually global summary is better)
    updateCustomerSummary(Object.values(customerStats));
};

function updateCustomerSummary(allStats) {
    const totalCustomers = allStats.length;
    const totalBalance = allStats.reduce((sum, c) => sum + c.balance, 0);
    const pendingWork = allStats.filter(c => c.pendingOrders > 0).length;

    const elTotal = document.getElementById('totalCustomersCount');
    const elBalance = document.getElementById('totalOutstandingBalance');
    const elWork = document.getElementById('pendingWorkCount');

    if (elTotal) elTotal.innerText = totalCustomers;
    if (elBalance) elBalance.innerText = formatCurrency(totalBalance);
    if (elWork) elWork.innerText = pendingWork;
}

window.downloadCustomerOrdersPDF = async function (customerName) {
    const customerOrders = orders.filter(o => o.customerName === customerName);
    if (customerOrders.length === 0) {
        alert('اس کسٹمر کا کوئی آرڈر نہیں ملا۔');
        return;
    }

    const templateWrap = document.getElementById('statementTemplateWrap');
    if (!templateWrap) return;

    // Set Common Info
    const stGenDate = document.getElementById('stGenDate');
    const stName = document.getElementById('stCustomerName');

    if (stGenDate) stGenDate.innerText = new Date().toLocaleDateString('en-GB');
    if (stName) stName.innerText = customerName;

    // Calculations
    const totalAmount = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalAdvance = customerOrders.reduce((sum, o) => sum + (o.advance || 0), 0);
    const totalBalance = totalAmount - totalAdvance;

    document.getElementById('stTotalBalance').innerText = formatCurrency(totalBalance);
    document.getElementById('stSummaryTotal').innerText = formatCurrency(totalAmount);
    document.getElementById('stSummaryPaid').innerText = formatCurrency(totalAdvance);
    document.getElementById('stSummaryBalance').innerText = formatCurrency(totalBalance);

    // Populate Orders Table
    const ordersBody = document.getElementById('stOrdersBody');
    ordersBody.innerHTML = '';
    customerOrders.forEach(o => {
        const tr = document.createElement('tr');
        tr.style.pageBreakInside = 'avoid';
        tr.innerHTML = `
            <td style="padding: 6px; border: 1px solid #000;">${new Date(o.date).toLocaleDateString('en-GB')}<br/><strong>${o.id}</strong></td>
            <td style="padding: 6px; border: 1px solid #000;">${o.details || '-'}</td>
            <td style="padding: 6px; border: 1px solid #000; text-align: center;">${o.totalAmount}</td>
            <td style="padding: 6px; border: 1px solid #000; text-align: center;">${o.advance || 0}</td>
            <td style="padding: 6px; border: 1px solid #000; text-align: center;">${o.totalAmount - (o.advance || 0)}</td>
        `;
        ordersBody.appendChild(tr);
    });

    // Populate Payments Table
    const paymentsBody = document.getElementById('stPaymentsBody');
    paymentsBody.innerHTML = '';
    const paymentRows = [];
    customerOrders.forEach(o => {
        if (o.payments && o.payments.length > 0) {
            o.payments.forEach(p => {
                paymentRows.push({
                    date: p.date,
                    orderId: o.id,
                    amount: p.amount,
                    note: p.note || 'پیمنٹ'
                });
            });
        } else if (o.advance > 0) {
            paymentRows.push({
                date: o.date,
                orderId: o.id,
                amount: o.advance,
                note: 'ایڈوانس رقم (پہلے سے)'
            });
        }
    });

    // Sort payments by date descending
    paymentRows.sort((a, b) => new Date(b.date) - new Date(a.date));

    paymentRows.forEach(p => {
        const tr = document.createElement('tr');
        tr.style.pageBreakInside = 'avoid';
        tr.innerHTML = `
            <td style="padding: 6px; border: 1px solid #000;">${new Date(p.date).toLocaleDateString('en-GB')}</td>
            <td style="padding: 6px; border: 1px solid #000;">${p.orderId}</td>
            <td style="padding: 6px; border: 1px solid #000;">${p.note}</td>
            <td style="padding: 6px; border: 1px solid #000; text-align: center; font-weight: bold;">${p.amount}</td>
        `;
        paymentsBody.appendChild(tr);
    });

    if (paymentRows.length === 0) {
        paymentsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">کوئی ادائیگی ریکارڈ نہیں کی گئی۔</td></tr>`;
    }

    // Generate PDF
    const element = document.getElementById('statementContent');
    const wrap = document.getElementById('statementTemplateWrap');

    // Temporarily make it "visible" to the browser engine for capture
    wrap.style.visibility = 'visible';
    wrap.style.position = 'absolute';
    wrap.style.left = '0';
    wrap.style.top = '0';

    const opt = {
        margin: [10, 0, 15, 0], // Top, Left, Bottom, Right
        filename: `${customerName}_Statement.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            scrollY: 0,
            scrollX: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
        await html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf) => {
            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(10);
                pdf.setTextColor(150);
                // Page numbering in standard format to avoid Urdu shaping issues
                pdf.text(`Page ${i} / ${totalPages}`, pdf.internal.pageSize.getWidth() - 20, pdf.internal.pageSize.getHeight() - 10, { align: 'right' });
            }
        }).save();
        showToast(`${customerName} کی اسٹیٹمنٹ ڈاؤنلوڈ ہو گئی ہے`, 'success');
    } catch (err) {
        console.error("PDF generation failed:", err);
        alert("پی ڈی ایف بنانے میں غلطی ہوئی ہے۔");
    } finally {
        wrap.style.visibility = 'hidden';
    }
};

// Update UI to reflect current user
function setCurrentUserUI() {
    const user = USERS[currentUser];
    document.getElementById('currentUserName').textContent = user.name;
    let roleText = user.role === 'superadmin' ? 'ایڈمنسٹریٹر' : (user.role === 'admin' ? 'مالک' : 'ملازم');
    document.getElementById('currentUserRole').textContent = roleText;

    const avatar = document.getElementById('currentUserAvatar');
    avatar.textContent = user.avatar;
    avatar.style.backgroundColor = user.color;
    avatar.style.color = user.textColor;

    const handoverBtn = document.getElementById('handoverNavBtn');
    if (handoverBtn) {
        if (user.role === 'superadmin' || user.role === 'admin') {
            handoverBtn.style.display = 'none'; // Owners don't need to hand over to themselves usually
        } else {
            handoverBtn.style.display = 'flex';
        }
    }

    const manageBtn = document.getElementById('manageUsersBtn');
    if (manageBtn) {
        manageBtn.style.display = user.role === 'superadmin' ? 'block' : 'none';
    }

    const shopSettingsBtn = document.getElementById('shopSettingsBtn');
    if (shopSettingsBtn) {
        shopSettingsBtn.style.display = user.role === 'superadmin' ? 'block' : 'none';
    }

    // Role-based Nav Visibility
    const navSettings = document.getElementById('navSettings');
    if (navSettings) {
        navSettings.style.display = user.role === 'superadmin' ? 'flex' : 'none';
    }

    const navFinance = document.getElementById('navFinance');
    if (navFinance) {
        navFinance.style.display = (user.role === 'superadmin' || user.role === 'admin') ? 'flex' : 'none';
    }

    const dashboardTotalIncomeCard = document.getElementById('dashboardTotalIncomeCard');
    if (dashboardTotalIncomeCard) {
        dashboardTotalIncomeCard.style.display = (user.role === 'superadmin' || user.role === 'admin') ? 'block' : 'none';
        // Note: keeping block relative to normal rendering but hiding completely if staff
    }


    // Re-init switcher list to apply role-based visibility
    initUserGrids();
}

// Removed redundant old setupFinanceModals
// Settings Modal
function setupSettingsModal() {
    const cpModal = document.getElementById('changePasswordModal');
    const cpForm = document.getElementById('changePasswordForm');

    window.openChangePasswordModal = () => cpModal.classList.add('show');
    window.closeChangePasswordModal = () => {
        cpModal.classList.remove('show');
        cpForm.reset();
    };

    cpForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const currentPass = document.getElementById('currentPass').value;
        const newPass = document.getElementById('newPass').value;
        const confirmPass = document.getElementById('confirmPass').value;

        if (currentPass !== USERS[currentUser].pass) {
            alert('آپ کا موجودہ پاسورڈ غلط ہے۔ براہ کرم دوبارہ کوشش کریں۔');
            return;
        }

        if (newPass !== confirmPass) {
            alert('نئے درج کردہ دونوں پاسورڈز آپس میں میل نہیں کھاتے۔');
            return;
        }

        if (newPass.length < 4) {
            alert('نیا پاسورڈ کم از کم 4 ہندسوں یا حروف پر مشتمل ہونا چاہیے۔');
            return;
        }

        // Success - updating password
        USERS[currentUser].pass = newPass;
        saveUsers();

        alert('پاسورڈ کامیابی سے تبدیل ہو گیا ہے!');
        closeChangePasswordModal();
        document.getElementById('userDropdown').style.display = 'none';

        // Log user out so they have to test it (optional, but good practice)
        location.reload();
    });
}

// Settings Logic (Now Page-based)
function setupManageUsersModal() {
    const form = document.getElementById('newUserForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('newUserName').value.trim();
        const role = document.getElementById('newUserRole').value;
        const email = document.getElementById('newUserEmail').value.trim().toLowerCase();
        const pass = document.getElementById('newUserPass').value.trim();

        if (name && role && email && pass) {
            const emailKey = email.replace(/\./g, ',');
            const id = emailKey; // Use sanitized email as ID for easier lookup

            const colors = ['#f3e8ff', 'var(--primary)', 'var(--warning-light)', 'var(--info-light)', '#d1fae5', '#fee2e2'];
            const textColors = ['#9333ea', 'white', 'var(--warning)', 'var(--info)', 'var(--success)', 'var(--danger)'];
            const colorIdx = Object.keys(USERS).length % colors.length;

            USERS[id] = {
                id,
                name,
                role,
                email, // Store the original email
                pin: pass, // Rename pass to pin to match requirements
                pass: pass, // Keep pass for compatibility with existing code
                avatar: name.charAt(0).toUpperCase(),
                color: colors[colorIdx],
                textColor: textColors[colorIdx]
            };
            saveUsers();
            initDynamicUI();
            renderManageUsersList();
            form.reset();
            alert('نیا یوزر شامل کر لیا گیا ہے۔');
        }
    });

    // Make functions global
    window.updateUserRole = function (userId, newRole) {
        if (USERS[userId]) {
            USERS[userId].role = newRole;
            saveUsers();
            initDynamicUI();
            alert('یوزر کا رول تبدیل کر دیا گیا ہے۔');
        }
    }

    window.deleteUser = function (userId) {
        if (userId === currentUser) {
            alert('آپ اپنا خود کا اکاؤنٹ ڈیلیٹ نہیں کر سکتے۔');
            return;
        }
        if (confirm('کیا آپ واقعی اس یوزر کو ڈیلیٹ کرنا چاہتے ہیں؟')) {
            delete USERS[userId];
            saveUsers();
            initDynamicUI();
            renderManageUsersList();
        }
    }

    window.resetUserPassword = function (userId) {
        if (currentRole !== 'superadmin' && currentRole !== 'admin') {
            alert('صرف ایڈمنسٹریٹر ہی پاسورڈ ری سیٹ کر سکتے ہیں۔');
            return;
        }

        const user = USERS[userId];
        if (!user) return;

        const newPass = prompt(`یوزر "${user.name}" کے لیے نیا 4 ہندسوں کا پن درج کریں:`);

        if (newPass === null) return; // Cancelled

        if (newPass.length < 4) {
            alert('پن کم از کم 4 ہندسوں پر مشتمل ہونا چاہیے۔');
            return;
        }

        user.pass = newPass;
        user.pin = newPass; // Also update pin field
        saveUsers();
        showToast(`یوزر "${user.name}" کا پن کامیابی سے تبدیل کر دیا گیا ہے`, 'success');
    }
}

window.renderManageUsersList = function () {
    const list = document.getElementById('existingUsersList');
    if (!list) return;
    list.innerHTML = '';

    Object.values(USERS).forEach(user => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); background: var(--bg-card); border-radius: 8px; margin-bottom: 8px;';

        let roleText = user.role === 'superadmin' ? 'ایڈمنسٹریٹر' : (user.role === 'admin' ? 'مالک' : 'ملازم');
        let roleSelectHtml = `
            <select onchange="updateUserRole('${user.id}', this.value)" style="padding:6px; font-size:13px; font-family:inherit; border:1px solid var(--border); border-radius:6px; margin-right:8px; background: var(--bg-main); color: var(--text-main);">
                <option value="superadmin" ${user.role === 'superadmin' ? 'selected' : ''}>ایڈمنسٹریٹر</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مالک</option>
                <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>ملازم</option>
            </select>
        `;

        if (user.id === currentUser) {
            roleSelectHtml = `<span style="margin-right:8px; font-size:12px; font-weight: bold; color:var(--primary);">(${roleText} - آپ)</span>`;
        }

        div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${user.color}; color: ${user.textColor}; display: flex; align-items: center; justify-content: center; font-weight: bold;">${user.avatar}</div>
            <span style="font-weight:600; font-size:14px;">${user.name}</span>
        </div>
        <div style="display: flex; align-items: center;">
            ${roleSelectHtml}
            ${user.id !== currentUser ? `
                <button onclick="resetUserPassword('${user.id}')" class="btn btn-icon" style="color: var(--primary); width:32px; height:32px; padding:0; margin-right: 5px;" title="پاسورڈ ری سیٹ کریں">
                    <ion-icon name="key-outline"></ion-icon>
                </button>
                <button onclick="deleteUser('${user.id}')" class="btn btn-icon" style="color: var(--danger); width:32px; height:32px; padding:0;"><ion-icon name="trash-outline"></ion-icon></button>
            ` : ''}
        </div>
    `;
        list.appendChild(div);
    });
}

function setupShopSettingsModal() {
    const form = document.getElementById('shopSettingsForm');
    const logoInput = document.getElementById('settingShopLogo');
    const previewContainer = document.getElementById('logoPreviewContainer');
    const previewImg = document.getElementById('logoPreview');

    if (!form) return;

    // Image preview generator
    logoInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                previewImg.src = e.target.result;
                previewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const newName = document.getElementById('settingShopName').value.trim();
        shopSettings.name = newName || 'Al-Abbasi Computer';
        shopSettings.address = document.getElementById('settingShopAddress').value.trim();
        shopSettings.phone = document.getElementById('settingShopPhone').value.trim();
        shopSettings.social = document.getElementById('settingShopSocial').value.trim();
        shopSettings.qrBaseUrl = document.getElementById('settingQrBaseUrl').value.trim();

        if (logoInput.files && logoInput.files[0]) {
            shopSettings.logo = previewImg.src;
        }

        saveShopSettings();
        applyShopSettings();
        alert('دکان کی سیٹنگز کامیابی سے محفوظ کر لی گئی ہیں۔');
    });

    // Invoice Design Advanced Handlers
    const designForm = document.getElementById('invoiceDesignForm');
    const headerBgInput = document.getElementById('invoiceHeaderBgImage');
    const headerBgPreview = document.getElementById('headerBgPreview');
    const headerBgPreviewContainer = document.getElementById('headerBgPreviewContainer');

    if (headerBgInput) {
        headerBgInput.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    headerBgPreview.src = e.target.result;
                    headerBgPreviewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (designForm) {
        designForm.addEventListener('submit', (e) => {
            e.preventDefault();
            shopSettings.billHeaderType = document.getElementById('invoiceHeaderBgType').value;
            shopSettings.billHeaderColor = document.getElementById('invoiceHeaderColor').value;
            shopSettings.billHeaderTextColor = document.getElementById('invoiceHeaderTextColor').value;
            shopSettings.billHeaderGrad1 = document.getElementById('invoiceHeaderGrad1').value;
            shopSettings.billHeaderGrad2 = document.getElementById('invoiceHeaderGrad2').value;
            shopSettings.billHeaderGradDir = document.getElementById('invoiceHeaderGradDir').value;
            shopSettings.billFont = document.getElementById('invoiceFont').value;
            shopSettings.billFontSize = parseInt(document.getElementById('invoiceFontSize').value) || 18;
            // billFooterColor corresponds to invoiceFooterColor (keeping legacy fallback if needed)
            shopSettings.billFooterColor = document.getElementById('invoiceFooterColor') ? document.getElementById('invoiceFooterColor').value : document.getElementById('invoiceFooterBg').value;
            shopSettings.billHeaderText = document.getElementById('invoiceHeaderText').value.trim();
            shopSettings.billFooterText = document.getElementById('invoiceFooterText').value.trim();

            shopSettings.billLogoPosition = document.getElementById('invoiceLogoPosition').value;
            shopSettings.billStripBg = document.getElementById('invoiceStripBg').value;
            shopSettings.billStripTextColor = document.getElementById('invoiceStripTextColor').value;
            shopSettings.billFooterBg = document.getElementById('invoiceFooterBg').value;
            shopSettings.billFooterTextColor = document.getElementById('invoiceFooterTextColor').value;
            shopSettings.billNameFont = document.getElementById('invoiceNameFont').value;

            if (headerBgInput && headerBgInput.files && headerBgInput.files[0]) {
                shopSettings.billHeaderBgImage = headerBgPreview.src;
            }

            saveShopSettings();
            alert('رسید کا جدید ڈیزائن محفوظ کر لیا گیا ہے۔');
        });
    }
}

// ====== Finance Page Logic ======
let currentFinanceCategoryFilter = 'all';

window.filterTransactionsByCategory = function (cat, btn) {
    currentFinanceCategoryFilter = cat;
    document.querySelectorAll('#financeTypeTabs .btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTransactionsTable();
};

window.renderFinancePage = function () {
    let totalExpense = 0;

    transactions.forEach(trx => {
        if (!trx) return;
        if (trx.type === 'expense') totalExpense += trx.amount;
    });

    // Calculate Sales, COGS, and Profit from Orders
    let totalSales = 0;
    let totalCogs = 0;

    orders.forEach(order => {
        if (!order) return;

        totalSales += (order.totalAmount || 0);

        // Calculate COGS for this order
        let orderCogs = 0;
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                // If historical order doesn't have purchasePrice saved, try to find current
                let pp = item.purchasePrice;
                if (pp === undefined) {
                    const currentProd = products.find(p => p.id === item.id);
                    pp = currentProd ? (currentProd.purchasePrice || 0) : 0;
                }
                orderCogs += (pp * (item.qty || 1));
            });
        }
        totalCogs += orderCogs;
    });

    const netProfit = totalSales - totalCogs - totalExpense;

    document.getElementById('financeTotalSales').innerText = formatCurrency(totalSales);
    document.getElementById('financeTotalCogs').innerText = formatCurrency(totalCogs);
    document.getElementById('financeTotalExpense').innerText = formatCurrency(totalExpense);
    document.getElementById('financeNetProfit').innerText = formatCurrency(netProfit);

    // Update color based on positive or negative net profit
    const netEl = document.getElementById('financeNetProfit');
    if (netProfit > 0) {
        netEl.style.color = 'var(--primary)';
    } else if (netProfit < 0) {
        netEl.style.color = 'var(--danger)';
    } else {
        netEl.style.color = 'var(--text-main)';
    }

    // Failsafe: Ensure wallets are populated if empty
    const financeGrid = document.getElementById('financeCashInHandGrid');
    if (financeGrid && financeGrid.children.length === 0) {
        initUserGrids();
    }

    // Ensure accurate latest balances are drawn
    updateDashboardStats();

    renderTransactionsTable();
};

window.renderTransactionsTable = function () {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('financeSearchInput')?.value || '').toLowerCase();
    const userFilter = document.getElementById('financeUserFilter')?.value || 'all';

    let filtered = transactions.filter(trx => {
        if (!trx) return false;
        // Tag search (relatedId) or description search safely
        const descMatch = trx.description ? String(trx.description).toLowerCase() : '';
        const relMatch = trx.relatedId ? String(trx.relatedId).toLowerCase() : '';
        const matchSearch = descMatch.includes(searchTerm) || relMatch.includes(searchTerm);

        let matchCat = true;
        if (currentFinanceCategoryFilter !== 'all') {
            matchCat = trx.type === currentFinanceCategoryFilter;
        }

        let matchUser = true;
        if (userFilter !== 'all') {
            matchUser = trx.userId === userFilter || trx.handOverToId === userFilter;
        }

        return matchSearch && matchCat && matchUser;
    });

    // Sort descending by date
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">کوئی ٹرانزیکشن موجود نہیں</td></tr>';
        return;
    }

    filtered.forEach(trx => {
        const d = new Date(trx.date);
        const dateHtml = `${d.toLocaleDateString('ur')} <br> <small style="color:var(--text-muted)">${d.toLocaleTimeString()}</small>`;

        let typeBadge = '';
        let amountStyle = '';
        if (trx.type === 'income') {
            typeBadge = '<span style="background: var(--success-light); color: var(--success); padding: 4px 8px; border-radius: 4px; font-size: 11px;">آمدنی</span>';
            amountStyle = 'color: var(--success); font-weight: bold;';
        } else if (trx.type === 'expense') {
            typeBadge = '<span style="background: var(--danger-light); color: var(--danger); padding: 4px 8px; border-radius: 4px; font-size: 11px;">خرچہ</span>';
            amountStyle = 'color: var(--danger); font-weight: bold;';
        } else if (trx.type === 'handover') {
            typeBadge = '<span style="background: var(--primary-light); color: var(--primary); padding: 4px 8px; border-radius: 4px; font-size: 11px;">ہینڈ اوور</span>';
            amountStyle = 'color: var(--primary); font-weight: bold;';
        }

        const userObj = USERS[trx.userId] || { name: 'نامعلوم' };
        let userHtml = userObj.name;

        if (trx.type === 'handover' && trx.handOverToId) {
            const receiver = USERS[trx.handOverToId] || { name: 'نامعلوم' };
            userHtml = `${userObj.name} <ion-icon name="arrow-forward-outline" style="vertical-align: middle;"></ion-icon> ${receiver.name}`;
        }

        const tag = trx.relatedId ? `<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:12px; border:1px solid #e2e8f0;">${trx.relatedId}</span>` : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="finance-checkbox" data-id="${trx.id}" onclick="updateFinanceMassDeleteVisibility()">
            </td>
            <td>${dateHtml}</td>
            <td>${tag}</td>
            <td>${typeBadge}</td>
            <td>${userHtml}</td>
            <td>${trx.description || '-'}</td>
            <td style="text-align: right; ${amountStyle}">${formatCurrency(trx.amount)}</td>
        `;
        tbody.appendChild(tr);
    });
};

// --- Finance Mass Delete Logic ---

window.toggleSelectAllFinance = function (checked) {
    const checkboxes = document.querySelectorAll('.finance-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    updateFinanceMassDeleteVisibility();
};

window.updateFinanceMassDeleteVisibility = function () {
    const checkboxes = document.querySelectorAll('.finance-checkbox');
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const bulkActionsBar = document.getElementById('financeBulkActionsBar');
    const selectedCountText = document.getElementById('financeSelectedCountText');
    const selectAllCheckbox = document.getElementById('selectAllFinance');

    if (selectedCount > 0) {
        bulkActionsBar.style.display = 'block';
        selectedCountText.innerText = `${selectedCount} ٹرانزیکشن منتخب کی گئیں`;
    } else {
        bulkActionsBar.style.display = 'none';
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
    }

    if (selectAllCheckbox && checkboxes.length > 0) {
        selectAllCheckbox.checked = selectedCount === checkboxes.length;
    }
};

window.clearFinanceSelection = function () {
    const checkboxes = document.querySelectorAll('.finance-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    const selectAllCheckbox = document.getElementById('selectAllFinance');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateFinanceMassDeleteVisibility();
};

window.deleteSelectedTransactions = function () {
    const checkboxes = document.querySelectorAll('.finance-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

    if (selectedIds.length === 0) return;

    if (confirm(`کیا آپ واقعی منتخب کردہ ${selectedIds.length} ٹرانزیکشنز ڈیلیٹ کرنا چاہتے ہیں؟ یہ عمل واپس نہیں لایا جا سکتا۔`)) {
        selectedIds.forEach(id => {
            const index = transactions.findIndex(t => t.id === id);
            if (index > -1) {
                transactions.splice(index, 1);
            }
        });

        saveTransactions();
        renderFinancePage();
        updateFinanceMassDeleteVisibility();
        showToast(`${selectedIds.length} ٹرانزیکشنز ڈیلیٹ کر دی گئیں`, 'success');
    }
};

// --- Order Category Management Logic ---

function setupCategoryManagement() {
    const form = document.getElementById('newCategoryForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const label = document.getElementById('categoryLabel').value.trim();
        let id = document.getElementById('categoryId').value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        if (label && id) {
            if (orderCategories.find(c => c.id === id)) {
                alert('یہ شناختی نام (ID) پہلے سے موجود ہے۔');
                return;
            }

            orderCategories.push({ id, label });
            saveOrderCategories();
            syncCategoryUI();
            form.reset();
            showToast('نئی کیٹیگری کامیابی سے شامل کر لی گئی ہے', 'success');
        }
    });

    renderCategoriesManager();
}

function renderCategoriesManager() {
    const list = document.getElementById('categoryManagementList');
    if (!list) return;
    list.innerHTML = '';

    orderCategories.forEach(cat => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); background: var(--bg-card); border-radius: 8px; margin-bottom: 8px;';

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="badge-status status-neutral" style="background:#f1f5f9; color:#475569; font-weight:bold;">${cat.label}</span>
                <small style="color: var(--text-muted); font-family: monospace;">(${cat.id})</small>
            </div>
            <div>
                <button onclick="deleteCategory('${cat.id}')" class="btn btn-icon" style="color: var(--danger); background: #fee2e2;" title="ڈیلیٹ"><ion-icon name="trash-outline"></ion-icon></button>
            </div>
        `;
        list.appendChild(div);
    });
}

window.deleteCategory = function (catId) {
    if (confirm('کیا آپ واقعی یہ کیٹیگری ڈیلیٹ کرنا چاہتے ہیں؟ اس کیٹیگری کے موجودہ آرڈرز پر اس کا اثر نہیں پڑے گا۔')) {
        orderCategories = orderCategories.filter(c => c.id !== catId);
        saveOrderCategories();
        syncCategoryUI();
        showToast('کیٹیگری ڈیلیٹ کر دی گئی ہے', 'info');
    }
};

window.syncCategoryUI = function () {
    // 1. Update Order List Filter
    const orderFilter = document.getElementById('orderCategoryFilter');
    if (orderFilter) {
        orderFilter.innerHTML = '<option value="all">تمام کیٹیگری</option>' +
            orderCategories.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
    }

    // 2. Update New Order Category Select
    const newOrderCategorySelect = document.getElementById('orderCategory');
    if (newOrderCategorySelect) {
        newOrderCategorySelect.innerHTML = orderCategories.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
    }

    // 3. Update Download Modal Category Select
    const downloadCategorySelect = document.getElementById('downloadCategory');
    if (downloadCategorySelect) {
        downloadCategorySelect.innerHTML = '<option value="all">تمام کیٹیگری</option>' +
            orderCategories.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
    }

    // 4. Update New Product Category Select
    const newProductCategorySelect = document.getElementById('newProductCategory');
    if (newProductCategorySelect) {
        newProductCategorySelect.innerHTML = orderCategories.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
    }

    renderCategoriesManager();
};

// --- Order Status Management Logic ---

function setupStatusManagement() {
    const form = document.getElementById('newStatusForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const label = document.getElementById('statusLabel').value.trim();
        const id = document.getElementById('statusId').value.trim().toLowerCase().replace(/\s+/g, '-');
        const color = document.getElementById('statusColor').value;
        const isFinal = document.getElementById('statusIsFinal').checked;

        if (label && id) {
            if (orderStatuses.find(s => s.id === id)) {
                alert('یہ شناختی نام (ID) پہلے سے موجود ہے۔');
                return;
            }

            orderStatuses.push({ id, label, color, isFinal });
            saveOrderStatuses();
            renderStatusesManager();
            syncStatusUI();
            form.reset();
            showToast('نیا اسٹیٹس شامل کر لیا گیا ہے', 'success');
        }
    });

    window.deleteStatus = function (statusId) {
        // Essential statuses safety
        const protectedStatuses = ['completed'];
        if (protectedStatuses.includes(statusId)) {
            alert('بنیادی اسٹیٹس ڈیلیٹ نہیں کیے جا سکتے۔');
            return;
        }

        const usageCount = orders.filter(o => o.status === statusId).length;
        if (usageCount > 0) {
            alert(`یہ اسٹیٹس ڈیلیٹ نہیں کیا جا سکتا کیونکہ ${usageCount} آرڈر اس اسٹیٹس میں موجود ہیں۔ پہلے ان کا اسٹیٹس تبدیل کریں۔`);
            return;
        }

        if (confirm('کیا آپ واقعی اس اسٹیٹس کو ڈیلیٹ کرنا چاہتے ہیں؟')) {
            orderStatuses = orderStatuses.filter(s => s.id !== statusId);
            saveOrderStatuses();
            renderStatusesManager();
            syncStatusUI();
        }
    };
}

function renderStatusesManager() {
    const list = document.getElementById('statusManagementList');
    if (!list) return;
    list.innerHTML = '';

    orderStatuses.forEach(status => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--border); background: var(--bg-card); border-radius: 8px; margin-bottom: 8px;';

        const isProtected = ['completed'].includes(status.id);

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="badge-status ${status.color}">${status.label}</span>
                <small style="color: var(--text-muted); font-size: 11px;">(${status.id}) ${status.isFinal ? ' [Final]' : ''}</small>
            </div>
            ${isProtected ? '<small style="color: var(--text-muted);">بنیادی</small>' :
                `<button onclick="deleteStatus('${status.id}')" class="btn btn-icon" style="color: var(--danger);"><ion-icon name="trash-outline"></ion-icon></button>`}
        `;
        list.appendChild(div);
    });
}

function syncStatusUI() {
    // 1. Update Tabs in Orders Page
    const tabsContainer = document.getElementById('orderStatusTabs');
    if (tabsContainer) {
        let tabsHtml = `<button class="${currentStatusFilter === 'all' ? 'active' : ''}" onclick="filterOrdersByStatus('all', this)">سب (All) <span class="tab-count" id="count-all">0</span></button>`;
        tabsHtml += `<button class="${currentStatusFilter === 'zair-e-takmeel' ? 'active' : ''}" onclick="filterOrdersByStatus('zair-e-takmeel', this)">زیرِ تکمیل <span class="tab-count" id="count-pending">0</span></button>`;

        orderStatuses.forEach(s => {
            tabsHtml += `<button class="${currentStatusFilter === s.id ? 'active' : ''}" onclick="filterOrdersByStatus('${s.id}', this)">${s.label} <span class="tab-count" id="count-${s.id}">0</span></button>`;
        });
        tabsContainer.innerHTML = tabsHtml;
    }

    // 2. Update New Order Modal select
    const orderSelect = document.getElementById('orderStatus');
    if (orderSelect) {
        orderSelect.innerHTML = orderStatuses.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    }

    // 3. Update Download Modal select
    const downloadSelect = document.getElementById('downloadStatus');
    if (downloadSelect) {
        let options = `<option value="all">تمام اسٹیٹس (All Statuses)</option>`;
        options += `<option value="pending">زیرِ تکمیل (Pending)</option>`;
        orderStatuses.forEach(s => {
            options += `<option value="${s.id}">${s.label} (${s.id})</option>`;
        });
        downloadSelect.innerHTML = options;
    }

    // Refresh counts and lists
    updateTabCounts();
    if (document.getElementById('ordersPage')?.style.display !== 'none') {
        renderOrdersList();
    }
}

// Settings UI initialization
window.initSettingsUI = function () {
    try {
        console.log('Initializing Settings UI Components...');
        renderStatusesManager();
        syncStatusUI();
        syncCategoryUI();
        setupCategoryManagement();
        setupStatusManagement();
    } catch (err) {
        console.error('Settings UI Initialization failed (likely icon load error):', err);
        // We continue anyway so the dashboard remains visible
    }
};

// mass delete logic
window.toggleSelectAllOrders = function (checked) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    updateMassDeleteButtonsVisibility();
};

window.updateMassDeleteButtonsVisibility = function () {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    const selectedCountText = document.getElementById('selectedCountText');
    const selectAllCheckbox = document.getElementById('selectAllOrders');

    if (selectedCount > 0) {
        bulkActionsBar.style.display = 'block';
        selectedCountText.innerText = `${selectedCount} آرڈر منتخب کیے گئے`;
    } else {
        bulkActionsBar.style.display = 'none';
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
    }

    // Sync select all checkbox
    if (selectAllCheckbox && checkboxes.length > 0) {
        selectAllCheckbox.checked = selectedCount === checkboxes.length;
    }
};

window.clearOrderSelection = function () {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    const selectAllCheckbox = document.getElementById('selectAllOrders');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateMassDeleteButtonsVisibility();
};

window.deleteSelectedOrders = function () {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

    if (selectedIds.length === 0) return;

    if (confirm(`کیا آپ واقعی منتخب کردہ ${selectedIds.length} آرڈرز ڈیلیٹ کرنا چاہتے ہیں؟ انہیں ایک ماہ کے اندر ریفرش بن سے ریکور کیا جا سکتا ہے۔`)) {
        const now = new Date().toISOString();
        selectedIds.forEach(id => {
            const orderIndex = orders.findIndex(o => o.id === id);
            if (orderIndex > -1) {
                const order = orders[orderIndex];
                order.deletedAt = now;
                deletedOrders.push(order);
                orders.splice(orderIndex, 1);
            }
        });

        saveDeletedOrders();
        saveOrders();
        renderOrdersList();
        updateDashboardStats();
        updateMassDeleteButtonsVisibility();
        showToast(`${selectedIds.length} آرڈرز ریفرش بن میں منتقل کر دیے گئے`, 'info');
    }
};

// Recycle Bin UI & Logic
window.openRecycleBinModal = function () {
    renderRecycleBin();
    document.getElementById('recycleBinModal').classList.add('show');
};

window.closeRecycleBinModal = function () {
    document.getElementById('recycleBinModal').classList.remove('show');
};

window.renderRecycleBin = function () {
    const tbody = document.getElementById('recycleBinBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (deletedOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">ریفرش بن خالی ہے۔</td></tr>`;

        // Sort by deleted date descending
        const sortedDeleted = [...deletedOrders].sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

        sortedDeleted.forEach(order => {
            const deletedAt = new Date(order.deletedAt);
            const deletedStr = deletedAt.toLocaleDateString('en-GB') + ' ' + deletedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            const orderDate = new Date(order.date);
            const orderDateStr = orderDate.toLocaleDateString('en-GB');

            const tr = document.createElement('tr');
            tr.innerHTML = `
            <td><strong>${order.id}</strong><br/><small>${orderDateStr}</small></td>
            <td><strong>${order.customerName}</strong><br/><small>${order.details || '-'}</small></td>
            <td>${deletedStr}</td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button onclick="restoreOrder('${order.id}')" class="btn btn-sm btn-outline-primary" title="بحال کریں">
                        <ion-icon name="refresh-outline"></ion-icon> بحال کریں
                    </button>
                    <button onclick="permanentlyDeleteOrder('${order.id}')" class="btn btn-sm" style="color: var(--danger); background: #fee2e2;" title="مستقل ڈیلیٹ">
                        <ion-icon name="trash-outline"></ion-icon>
                    </button>
                </div>
            </td>
        `;
            tbody.appendChild(tr);
        });
    }

    window.restoreOrder = function (orderId) {
        const orderIndex = deletedOrders.findIndex(o => o.id === orderId);
        if (orderIndex > -1) {
            const order = deletedOrders[orderIndex];
            // Remove deletedAt
            delete order.deletedAt;

            orders.push(order);
            deletedOrders.splice(orderIndex, 1);

            saveOrders();
            saveDeletedOrders();

            renderRecycleBin();
            renderOrdersList();
            updateDashboardStats();

            showToast('آرڈر کامیابی سے بحال کر دیا گیا ہے', 'success');
        }
    };

    window.permanentlyDeleteOrder = function (orderId) {
        if (confirm('کیا آپ واقعی اس آرڈر کو مستقل طور پر ڈیلیٹ کرنا چاہتے ہیں؟ یہ عمل واپس نہیں ہو سکتا۔')) {
            deletedOrders = deletedOrders.filter(o => o.id !== orderId);
            saveDeletedOrders();
            renderRecycleBin();
            showToast('آرڈر مستقل طور پر ڈیلیٹ کر دیا گیا ہے', 'info');
        }
    };

    window.switchSettingsTab = function (tabId, btn) {
        // Hide all tab contents
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.style.display = 'none';
        });

        // Show the selected tab content
        const activeTab = document.getElementById(tabId);
        if (activeTab) {
            activeTab.style.display = 'block';
        }

        // Update active button state
        document.querySelectorAll('.settings-tabs .btn').forEach(button => {
            button.classList.remove('active', 'btn-primary');
            button.classList.add('btn-secondary');
        });

        if (btn) {
            btn.classList.add('active', 'btn-primary');
            btn.classList.remove('btn-secondary');
        } else {
            // Fallback for initial load
            const defaultBtn = document.getElementById('btn-tab-shop');
            if (defaultBtn) {
                defaultBtn.classList.add('active', 'btn-primary');
                defaultBtn.classList.remove('btn-secondary');
            }
        }
    }
};
window.restoreOrder = function (orderId) {
    const orderIndex = deletedOrders.findIndex(o => o.id === orderId);
    if (orderIndex > -1) {
        const order = deletedOrders[orderIndex];
        // Remove deletedAt
        delete order.deletedAt;

        orders.push(order);
        deletedOrders.splice(orderIndex, 1);

        saveOrders();
        saveDeletedOrders();

        // Check if renderRecycleBin exists before calling it
        if (typeof renderRecycleBin === 'function') renderRecycleBin();
        if (typeof renderOrdersList === 'function') renderOrdersList();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();

        showToast('آرڈر کامیابی سے بحال کر دیا گیا ہے', 'success');
    }
};

window.permanentlyDeleteOrder = function (orderId) {
    if (confirm('کیا آپ واقعی اس آرڈر کو مستقل طور پر ڈیلیٹ کرنا چاہتے ہیں؟ یہ عمل واپس نہیں ہو سکتا۔')) {
        deletedOrders = deletedOrders.filter(o => o.id !== orderId);
        saveDeletedOrders();
        if (typeof renderRecycleBin === 'function') renderRecycleBin();
        showToast('آرڈر مستقل طور پر ڈیلیٹ کر دیا گیا ہے', 'info');
    }
};

window.switchSettingsTab = function (tabId, btn) {
    // Hide all tab contents
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // Show the selected tab content
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.style.display = 'block';

        // Render backup history if needed
        if (tabId === 'sett-backup' && typeof renderAutoBackupHistory === 'function') {
            renderAutoBackupHistory();
        }
    }

    // Update active button state
    document.querySelectorAll('.settings-tabs .btn').forEach(button => {
        button.classList.remove('active', 'btn-primary');
        button.classList.add('btn-secondary');
    });

    if (btn) {
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-secondary');
    } else {
        // Fallback for initial load
        const defaultBtn = document.getElementById('btn-tab-shop');
        if (defaultBtn) {
            defaultBtn.classList.add('active', 'btn-primary');
            defaultBtn.classList.remove('btn-secondary');
        }
    }
};

window.initDynamicUI = function () {
    const savedUserId = localStorage.getItem('currentUser');
    if (savedUserId) {
        const lastActivity = localStorage.getItem('lastActivityTime');
        const now = Date.now();
        if (lastActivity && (now - parseInt(lastActivity) > 20 * 60 * 1000)) {
            localStorage.removeItem('currentUser');
            document.getElementById('login-view').style.display = 'flex';
            document.getElementById('dashboard-view').style.display = 'none';
        } else {
            currentUser = JSON.parse(savedUserId);
            // Check if user still exists in USERS
            if (USERS[currentUser]) {
                document.getElementById('login-view').style.display = 'none';
                document.getElementById('dashboard-view').style.display = 'flex';
                finishLogin();
            } else {
                localStorage.removeItem('currentUser');
                document.getElementById('login-view').style.display = 'flex';
                document.getElementById('dashboard-view').style.display = 'none';
            }
        }
    } else {
        document.getElementById('login-view').style.display = 'flex';
        document.getElementById('dashboard-view').style.display = 'none';
    }

    // Hide splash screen after view determination
    const splash = document.getElementById('splash-screen');
    if (splash) splash.classList.add('fade-out');

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        // Prevent duplicate listeners
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);

        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim().toLowerCase();
            const password = document.getElementById('loginPassword').value.trim();

            console.log("Attempting login...", username);

            const userEntry = Object.entries(USERS).find(([id, u]) =>
                u.name.toLowerCase() === username && u.pass === password
            );

            if (userEntry) {
                const [userId, user] = userEntry;
                currentUser = userId;
                currentRole = user.role;
                localStorage.setItem('currentUser', JSON.stringify(userId));
                localStorage.setItem('lastActivityTime', Date.now());
                document.getElementById('login-view').style.display = 'none';
                document.getElementById('dashboard-view').style.display = 'flex';
                newForm.reset();
                finishLogin();
            } else {
                alert('غلط یوزر نیم یا پاسورڈ');
            }
        });
    }

    if (typeof window.initSettingsUI === 'function') {
        window.initSettingsUI();
    }
};

function finishLogin() {
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof renderRecentOrders === 'function') renderRecentOrders();
    if (typeof switchPage === 'function') {
        switchPage('dashboardPage');
    }
    setupActivityTracking();

    // Update the Sidebar UI with the current user's info
    const user = USERS[currentUser];
    if (user) {
        currentRole = user.role || 'staff';
        const nameEl = document.getElementById('currentUserName');
        const roleEl = document.getElementById('currentUserRole');
        const avatarEl = document.getElementById('currentUserAvatar');

        if (nameEl) nameEl.innerText = user.name || user.username || 'User';
        if (roleEl) {
            roleEl.innerText = currentRole === 'admin' ? 'مالک' : (currentRole === 'superadmin' ? 'ایڈمنسٹریٹر' : 'ملازم');
        }
        if (avatarEl) {
            avatarEl.innerText = (user.name || 'U').charAt(0).toUpperCase();
        }
    }

    // Apply role-based widget and navigation visibility
    if (typeof setCurrentUserUI === 'function') {
        setCurrentUserUI();
    }
}

function setupActivityTracking() {
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'];
    const updateActivity = () => {
        if (currentUser) {
            localStorage.setItem('lastActivityTime', Date.now());
        }
    };

    activityEvents.forEach(event => {
        document.addEventListener(event, updateActivity);
    });

    // Check every minute
    setInterval(() => {
        if (!currentUser) return;
        const lastActivity = localStorage.getItem('lastActivityTime');
        const now = Date.now();
        if (lastActivity && (now - parseInt(lastActivity) > 20 * 60 * 1000)) {
            logoutUser();
        }
    }, 60000);
}

// window.logoutUser is defined above around line 2841

// ====== Finance Modals Implementation ======
window.openIncomeModal = function () {
    const modal = document.getElementById('incomeModal');
    if (modal) modal.classList.add('show');
    const form = document.getElementById('newIncomeForm');
    if (form) form.reset();
    const results = document.getElementById('incomeSearchResults');
    if (results) results.style.display = 'none';
    const details = document.getElementById('incomeSelectedOrderDetails');
    if (details) details.style.display = 'none';
    const orderIdInput = document.getElementById('incomeSelectedOrderId');
    if (orderIdInput) orderIdInput.value = '';
};

window.closeIncomeModal = function () {
    const modal = document.getElementById('incomeModal');
    if (modal) modal.classList.remove('show');
};

window.searchOrderForIncome = function (query) {
    const resultsContainer = document.getElementById('incomeSearchResults');
    if (!resultsContainer) return;
    if (!query || query.trim() === '') {
        resultsContainer.style.display = 'none';
        return;
    }

    const qty = query.toLowerCase();

    // Group pending balances by customer name
    const customerBalances = {};
    const customerTotalBills = {};

    orders.forEach(o => {
        const balance = (o.totalAmount || 0) - (o.advance || 0);
        if (balance > 0 && o.customerName.toLowerCase().includes(qty)) {
            const cName = o.customerName.trim();
            if (!customerBalances[cName]) {
                customerBalances[cName] = 0;
                customerTotalBills[cName] = 0;
            }
            customerBalances[cName] += balance;
            customerTotalBills[cName] += (o.totalAmount || 0);
        }
    });

    resultsContainer.innerHTML = '';
    const customers = Object.keys(customerBalances);

    if (customers.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 8px; color: var(--text-muted); text-align: center;">کوئی کسٹمر یا بقایا نہیں ملا</div>';
    } else {
        customers.forEach(cName => {
            const balance = customerBalances[cName];
            const div = document.createElement('div');
            div.style.padding = '8px 12px';
            div.style.borderBottom = '1px solid var(--border)';
            div.style.cursor = 'pointer';
            div.innerHTML = `<strong>${cName}</strong> <br> <small style="color: var(--danger)">کل بقایا: Rs. ${balance}</small>`;
            div.onclick = function () { window.selectCustomerForIncome(cName, balance, customerTotalBills[cName]); };
            resultsContainer.appendChild(div);
        });
    }
    resultsContainer.style.display = 'block';
};

window.selectCustomerForIncome = function (customerName, totalBalance, totalBill) {
    document.getElementById('incomeSearchInput').value = customerName;
    document.getElementById('incomeSearchResults').style.display = 'none';

    document.getElementById('incomeCustomerName').innerText = customerName;
    document.getElementById('incomeTotalBill').innerText = totalBill;
    document.getElementById('incomeRemainingBalance').innerText = totalBalance;
    document.getElementById('incomeSelectedOrderId').value = 'CUSTOMER:' + customerName;

    const amountInput = document.getElementById('incomeAmount');
    if (amountInput) {
        amountInput.max = totalBalance;
        amountInput.value = ''; // Let them enter their own amount
    }
    document.getElementById('incomeSelectedOrderDetails').style.display = 'block';
};

window.setupFinanceModals = function () {
    const incomeForm = document.getElementById('newIncomeForm');
    if (incomeForm) {
        // Replace listener
        const newForm = incomeForm.cloneNode(true);
        incomeForm.parentNode.replaceChild(newForm, incomeForm);

        newForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const identifier = document.getElementById('incomeSelectedOrderId').value;
            const amount = parseFloat(document.getElementById('incomeAmount').value);
            const noteInput = document.getElementById('incomeNote');
            const note = noteInput ? noteInput.value : '';

            if (!identifier) {
                showToast('براہ کرم فہرست میں سے کوئی کسٹمر منتخب کریں۔', 'error');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                showToast('رقم 0 سے زیادہ ہونی چاہیے۔', 'error');
                return;
            }

            if (identifier.startsWith('CUSTOMER:')) {
                const customerName = identifier.substring(9);
                let remainingToDeduct = amount;

                // Find all pending orders for this customer, sorted by date (oldest first)
                let customerOrders = orders.filter(o =>
                    o.customerName.trim() === customerName &&
                    ((o.totalAmount || 0) - (o.advance || 0)) > 0
                );

                customerOrders.sort((a, b) => new Date(a.date) - new Date(b.date));

                let totalCustomerBalance = customerOrders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.advance || 0)), 0);

                if (amount > totalCustomerBalance) {
                    showToast('آمدن کی رقم کل بقایا رقم سے زیادہ نہیں ہو سکتی۔', 'error');
                    return;
                }

                let orderIdsAffected = [];

                // Deduct from oldest to newest
                customerOrders.forEach(o => {
                    if (remainingToDeduct <= 0) return;
                    let balance = (o.totalAmount || 0) - (o.advance || 0);
                    if (balance > 0) {
                        let deductAmount = Math.min(balance, remainingToDeduct);
                        o.advance = (o.advance || 0) + deductAmount;
                        remainingToDeduct -= deductAmount;
                        orderIdsAffected.push(o.id);
                    }
                });

                saveOrders();

                let affectedOrdersStr = orderIdsAffected.join(", ");
                addTransaction('income', amount, currentUser, `کسٹمر ${customerName} کی ادائیگی (آرڈرز: ${affectedOrdersStr}): ${note}`, orderIdsAffected[0]);

                updateDashboardStats();
                if (typeof renderFinancePage === 'function' && document.getElementById('financePage').style.display === 'block') {
                    renderFinancePage();
                }
                const ordersPage = document.getElementById('ordersPage');
                if (ordersPage && ordersPage.style.display === 'block' && typeof renderOrdersList === 'function') {
                    renderOrdersList();
                }

                window.closeIncomeModal();
                showToast('آمدن کامیابی سے درج ہو گئی ہے', 'success');
            }
        });
        const expenseForm = document.getElementById('newExpenseForm');
        if (expenseForm) {
            const newExpenseForm = expenseForm.cloneNode(true);
            expenseForm.parentNode.replaceChild(newExpenseForm, expenseForm);

            newExpenseForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const title = document.getElementById('expenseTitle').value.trim();
                const amount = parseFloat(document.getElementById('expenseAmount').value);

                const type = document.querySelector('input[name="expenseType"]:checked').value;
                const isSpecific = type === 'specific';
                const isCategory = type === 'category';
                const orderId = document.getElementById('expenseSelectedOrderId').value;
                const category = document.getElementById('expenseCategorySelect').value;

                if (!title || isNaN(amount) || amount <= 0) {
                    showToast('براہ کرم تمام خانے درست طریقے سے پُر کریں۔', 'error');
                    return;
                }

                if (isSpecific && !orderId) {
                    showToast('براہ کرم کوئی آرڈر منتخب کریں۔', 'error');
                    return;
                }

                let relatedId = 'EXP';
                if (isSpecific) relatedId = orderId;
                else if (isCategory) relatedId = 'CAT-' + category;

                addTransaction('expense', amount, currentUser, title, relatedId);

                updateDashboardStats();
                if (typeof renderFinancePage === 'function' && document.getElementById('financePage').style.display === 'block') {
                    renderFinancePage();
                }

                window.closeExpenseModal();
                showToast('خرچہ کامیابی سے درج ہو گیا ہے۔', 'success');
            });
        }

        const handoverForm = document.getElementById('newHandoverForm');
        if (handoverForm) {
            const newHandoverForm = handoverForm.cloneNode(true);
            handoverForm.parentNode.replaceChild(newHandoverForm, handoverForm);

            newHandoverForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const toUserId = document.getElementById('handoverToUser').value;
                const amount = parseFloat(document.getElementById('handoverAmount').value);
                const noteInput = document.getElementById('handoverNote');
                const note = noteInput ? noteInput.value.trim() : '';

                if (!toUserId || isNaN(amount) || amount <= 0) {
                    showToast('براہ کرم تمام خانے درست طریقے سے پُر کریں۔', 'error');
                    return;
                }

                // Can't handover to self
                if (toUserId === currentUser) {
                    showToast('آپ اپنے آپ کو رقم منتقل نہیں کر سکتے۔', 'error');
                    return;
                }

                addTransaction('handover', amount, currentUser, `رقم منتقلی: ${note}`, 'HND', toUserId);

                updateDashboardStats();
                if (typeof renderFinancePage === 'function' && document.getElementById('financePage').style.display === 'block') {
                    renderFinancePage();
                }

                window.closeHandoverModal();
                showToast('رقم کامیابی سے منتقل ہو گئی ہے۔', 'success');
            });
        }
    }
};

window.openExpenseModal = function () {
    const form = document.getElementById('newExpenseForm');
    if (form) {
        form.reset();
        document.getElementById('expenseOrderSearchGroup').style.display = 'none';
        document.getElementById('expenseCategoryGroup').style.display = 'none';
        document.getElementById('expenseSelectedOrderDetails').style.display = 'none';
        document.getElementById('expenseSelectedOrderId').value = '';
    }
    const m = document.getElementById('expenseModal');
    if (m) m.classList.add('show');
};

window.toggleExpenseType = function () {
    const type = document.querySelector('input[name="expenseType"]:checked').value;
    const isSpecific = type === 'specific';
    const isCategory = type === 'category';

    document.getElementById('expenseOrderSearchGroup').style.display = isSpecific ? 'block' : 'none';
    document.getElementById('expenseCategoryGroup').style.display = isCategory ? 'block' : 'none';

    if (!isSpecific) {
        document.getElementById('expenseSelectedOrderId').value = '';
        document.getElementById('expenseSelectedOrderDetails').style.display = 'none';
        document.getElementById('expenseSearchInput').value = '';
        document.getElementById('expenseSearchResults').style.display = 'none';
    }
};

window.searchOrderForExpense = function (query) {
    const resultsContainer = document.getElementById('expenseSearchResults');
    if (!query || query.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }

    const lowerQuery = query.toLowerCase();
    const matchedOrders = orders.filter(o =>
        o.id.toLowerCase().includes(lowerQuery) ||
        o.customerName.toLowerCase().includes(lowerQuery)
    ).slice(0, 5); // Limit to 5 results

    if (matchedOrders.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 8px; font-size: 13px; color: var(--text-muted); text-align: center;">کوئی آرڈر نہیں ملا</div>';
        resultsContainer.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = matchedOrders.map(o => `
        <div style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer;" 
             onclick="selectOrderForExpense('${o.id}', '${o.customerName}')"
             onmouseover="this.style.backgroundColor='var(--bg-main)'"
             onmouseout="this.style.backgroundColor='transparent'">
            <div style="font-weight: bold; font-size: 14px;">${o.customerName}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${o.id}</div>
        </div>
    `).join('');

    resultsContainer.style.display = 'block';
};

window.selectOrderForExpense = function (orderId, customerName) {
    document.getElementById('expenseSelectedOrderId').value = orderId;
    document.getElementById('expenseCustomerName').innerText = customerName;
    document.getElementById('expenseOrderIdText').innerText = orderId;

    document.getElementById('expenseSelectedOrderDetails').style.display = 'block';
    document.getElementById('expenseSearchResults').style.display = 'none';
    document.getElementById('expenseSearchInput').value = '';
};
window.closeExpenseModal = function () {
    const m = document.getElementById('expenseModal');
    if (m) m.classList.remove('show');
};

window.openHandoverModal = function () {
    document.getElementById('newHandoverForm')?.reset();
    const m = document.getElementById('handoverModal');
    if (m) m.classList.add('show');
};
window.closeHandoverModal = function () {
    const m = document.getElementById('handoverModal');
    if (m) m.classList.remove('show');
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        window.initDynamicUI();
        window.setupFinanceModals();
    }, 100);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        window.initDynamicUI();
        window.setupFinanceModals();
    });
}

window.downloadDailyReport = function () {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => {
        const d = new Date(o.date).toISOString().split('T')[0];
        return d === todayStr;
    });

    const todayTransactions = transactions.filter(t => {
        const d = new Date(t.date).toISOString().split('T')[0];
        return d === todayStr;
    });

    if (todayOrders.length === 0 && todayTransactions.length === 0) {
        showToast('آج کا کوئی ریکارڈ موجود نہیں ہے۔', 'error');
        return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Orders Sheet
    if (todayOrders.length > 0) {
        const ordersHeader = [
            ["Al-Abbasi Computer - Today's Orders"],
            ["Date: " + new Date().toLocaleDateString('en-GB')],
            [],
            ["Order ID", "Customer Name", "Category", "Status", "Total Amount", "Advance", "Balance", "Details"]
        ];

        let totalAmt = 0;
        let totalAdv = 0;
        let totalBal = 0;

        const ordersRows = todayOrders.map(o => {
            const bal = o.totalAmount - (o.advance || 0);
            totalAmt += (o.totalAmount || 0);
            totalAdv += (o.advance || 0);
            totalBal += bal;

            return [
                o.id,
                o.customerName,
                o.category,
                getStatusUrdu(o.status),
                o.totalAmount,
                o.advance || 0,
                bal,
                o.details || ""
            ];
        });

        const ordersTotalRow = ["", "كل میزان (TOTAL)", "", "", totalAmt, totalAdv, totalBal, ""];
        const ordersData = [...ordersHeader, ...ordersRows, [], ordersTotalRow];
        const wsOrders = XLSX.utils.aoa_to_sheet(ordersData);
        XLSX.utils.book_append_sheet(wb, wsOrders, "Today's Orders");
    } else {
        const wsOrders = XLSX.utils.aoa_to_sheet([["No orders today"]]);
        XLSX.utils.book_append_sheet(wb, wsOrders, "Today's Orders");
    }

    // 2. Transactions Sheet
    if (todayTransactions.length > 0) {
        const trxHeader = [
            ["Al-Abbasi Computer - Today's Transactions"],
            ["Date: " + new Date().toLocaleDateString('en-GB')],
            [],
            ["ID", "Type", "Amount", "Assigned User", "Description"]
        ];

        let totalInc = 0;
        let totalExp = 0;

        const trxRows = todayTransactions.map(t => {
            if (t.type === 'income') totalInc += t.amount;
            if (t.type === 'expense') totalExp += t.amount;

            let userName = USERS[t.userId] ? USERS[t.userId].name : t.userId;

            return [
                t.id,
                t.type === 'income' ? 'آمدنی (Income)' : (t.type === 'expense' ? 'خرچہ (Expense)' : 'ہینڈ اوور (Handover)'),
                t.amount,
                userName,
                t.description || ""
            ];
        });

        const trxTotalRow = ["", "كل آمدنی (Total Income)", totalInc, "", ""];
        const trxTotalExpRow = ["", "كل خرچہ (Total Expense)", totalExp, "", ""];
        const trxNetRow = ["", "نیٹ (Net)", totalInc - totalExp, "", ""];

        const trxData = [...trxHeader, ...trxRows, [], trxTotalRow, trxTotalExpRow, trxNetRow];
        const wsTrx = XLSX.utils.aoa_to_sheet(trxData);
        XLSX.utils.book_append_sheet(wb, wsTrx, "Today's Transactions");
    } else {
        const wsTrx = XLSX.utils.aoa_to_sheet([["No transactions today"]]);
        XLSX.utils.book_append_sheet(wb, wsTrx, "Today's Transactions");
    }

    XLSX.writeFile(wb, `daily-report-${todayStr}.xlsx`);
    showToast('روزانہ کی رپورٹ ڈاؤنلوڈ کر دی گئی ہے', 'success');
};

// ================= BACKUP & RESTORE SYSTEM =================

// 1. Manual Backup Download
window.downloadManualBackup = function () {
    try {
        const backupData = {
            alAbbasiOrders: JSON.parse(localStorage.getItem('alAbbasiOrders')) || [],
            alAbbasiTransactions: JSON.parse(localStorage.getItem('alAbbasiTransactions')) || [],
            alAbbasiShopSettings: JSON.parse(localStorage.getItem('alAbbasiShopSettings')) || {},
            alAbbasiProducts: JSON.parse(localStorage.getItem('alAbbasiProducts')) || [],
            alAbbasiOrderStatuses: JSON.parse(localStorage.getItem('alAbbasiOrderStatuses')) || [],
            alAbbasiOrderCategories: JSON.parse(localStorage.getItem('alAbbasiOrderCategories')) || [],
            alAbbasiDeletedOrders: JSON.parse(localStorage.getItem('alAbbasiDeletedOrders')) || [],
            alAbbasiUsers: JSON.parse(localStorage.getItem('alAbbasiUsers')) || {},
            backupDate: new Date().toISOString(),
            version: '2.0'
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];

        a.href = url;
        a.download = `al-abbasi-pos-backup-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('بیک اپ فائل کامیابی سے ڈاؤنلوڈ کر دی گئی ہے', 'success');
    } catch (error) {
        console.error('Backup Error:', error);
        alert('بیک اپ بنانے میں دشواری پیش آئی: ' + error.message);
    }
};

// 2. Restore from File
window.restoreBackupFromFile = function (input) {
    const file = input.files[0];
    if (!file) return;

    if (!confirm('کیا آپ واقعی یہ بیک اپ بحال کرنا چاہتے ہیں؟ موجودہ تمام ڈیٹا مٹ جائے گا اور بیک اپ والا ڈیٹا بحال کر دیا جائے گا۔')) {
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            // Basic validation
            if (!data.alAbbasiOrders || !data.alAbbasiUsers) {
                throw new Error('یہ فائل درست العباسی بیک اپ فائل نہیں ہے۔');
            }

            // Save to LocalStorage
            localStorage.setItem('alAbbasiOrders', JSON.stringify(data.alAbbasiOrders));
            localStorage.setItem('alAbbasiTransactions', JSON.stringify(data.alAbbasiTransactions || []));
            localStorage.setItem('alAbbasiShopSettings', JSON.stringify(data.alAbbasiShopSettings || {}));
            localStorage.setItem('alAbbasiProducts', JSON.stringify(data.alAbbasiProducts || []));
            localStorage.setItem('alAbbasiOrderStatuses', JSON.stringify(data.alAbbasiOrderStatuses || []));
            localStorage.setItem('alAbbasiOrderCategories', JSON.stringify(data.alAbbasiOrderCategories || []));
            localStorage.setItem('alAbbasiDeletedOrders', JSON.stringify(data.alAbbasiDeletedOrders || []));
            localStorage.setItem('alAbbasiUsers', JSON.stringify(data.alAbbasiUsers || {}));

            showToast('ڈیٹا کامیابی سے بحال کر دیا گیا ہے۔ سسٹم ری اسٹارٹ ہو رہا ہے...', 'success');

            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            console.error('Restore Error:', error);
            alert('ڈیٹا بحال کرنے میں غلطی: ' + error.message);
            input.value = '';
        }
    };
    reader.readAsText(file);
};

// 3. Auto Backup System (using IndexedDB for storage)
const DB_NAME = 'AlAbbasiBackupDB';
const STORE_NAME = 'autoBackups';
const DB_VERSION = 1;

function initBackupDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function runAutoBackup() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const lastAutoBackup = localStorage.getItem('alAbbasiLastAutoBackup');

        if (lastAutoBackup === today) return;

        const db = await initBackupDB();
        const backupData = {
            id: today,
            timestamp: new Date().toISOString(),
            data: {
                alAbbasiOrders: JSON.parse(localStorage.getItem('alAbbasiOrders')) || [],
                alAbbasiTransactions: JSON.parse(localStorage.getItem('alAbbasiTransactions')) || [],
                alAbbasiShopSettings: JSON.parse(localStorage.getItem('alAbbasiShopSettings')) || {},
                alAbbasiProducts: JSON.parse(localStorage.getItem('alAbbasiProducts')) || [],
                alAbbasiUsers: JSON.parse(localStorage.getItem('alAbbasiUsers')) || {}
            }
        };

        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await store.put(backupData);

        localStorage.setItem('alAbbasiLastAutoBackup', today);
        console.log('Auto backup created for', today);

        // Cleanup old backups (keep 30 days)
        await cleanupOldAutoBackups(db);

        if (typeof renderAutoBackupHistory === 'function') renderAutoBackupHistory();
    } catch (error) {
        console.error('Auto Backup Failed:', error);
    }
}

async function cleanupOldAutoBackups(db) {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
        const keys = request.result;
        if (keys.length > 30) {
            keys.sort(); // Should be ISO dates
            const toDelete = keys.slice(0, keys.length - 30);
            toDelete.forEach(key => store.delete(key));
            console.log(`Deleted ${toDelete.length} old auto-backups`);
        }
    };
}

window.renderAutoBackupHistory = async function () {
    const tableBody = document.querySelector('#sett-backup table tbody');
    if (!tableBody) return;

    try {
        const db = await initBackupDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const backups = request.result;
            backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (backups.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">کوئی خودکار بیک اپ موجود نہیں ہے۔</td></tr>';
                return;
            }

            tableBody.innerHTML = backups.map(b => {
                const date = new Date(b.timestamp).toLocaleString('ur-PK');
                const size = (JSON.stringify(b.data).length / 1024).toFixed(2) + ' KB';
                return `
                    <tr>
                        <td style="text-align: right;">${date}</td>
                        <td style="text-align: right;">${size}</td>
                        <td style="text-align: center;">
                            <button class="btn btn-sm btn-outline-primary" onclick="restoreFromAutoBackup('${b.id}')">
                                <ion-icon name="refresh-outline"></ion-icon> بحال کریں
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        };
    } catch (error) {
        console.error('Render History Error:', error);
    }
};

window.restoreFromAutoBackup = async function (id) {
    if (!confirm('کیا آپ واقعی اس خودکار بیک اپ کو بحال کرنا چاہتے ہیں؟')) return;

    try {
        const db = await initBackupDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            const backup = request.result;
            if (!backup) return;

            const data = backup.data;
            Object.keys(data).forEach(key => {
                localStorage.setItem(key, JSON.stringify(data[key]));
            });

            showToast('خودکار بیک اپ کامیابی سے بحال کر دیا گیا۔', 'success');
            setTimeout(() => window.location.reload(), 1500);
        };
    } catch (error) {
        alert('بیک اپ بحال کرنے میں دشواری: ' + error.message);
        alert('بیک اپ بحال کرنے میں دشواری: ' + error.message);
    }
};

// ================= GOOGLE DRIVE CLOUD SYNC SYSTEM =================
// Uses Google Identity Services (GIS) for OAuth.
// Tokens are stored per user: gdrive_token_{firebase_uid}
// This ensures complete isolation between different Google accounts.

// Get Client ID from <meta name="google-signin-client_id"> or fall back to a manual entry
function getGDriveClientId() {
    const meta = document.querySelector('meta[name="google-signin-client_id"]');
    const metaId = meta ? meta.content : '';
    const inputId = document.getElementById('gdriveClientId') ? document.getElementById('gdriveClientId').value.trim() : '';
    return inputId || metaId || '';
}

// Per-user token storage helpers
function getGDriveStorageKey(suffix) {
    const uid = (currentUser && currentUser.id) ? currentUser.id : 'shared';
    return `gdrive_${suffix}_${uid}`;
}

let gdriveToken = null;
let gdriveUser = null;
let autoSyncInterval = null;

// Load token for the currently logged-in user (called after PIN verify)
function loadGDriveSessionForUser() {
    gdriveToken = localStorage.getItem(getGDriveStorageKey('token')) || null;
    gdriveUser = JSON.parse(localStorage.getItem(getGDriveStorageKey('user'))) || null;
    updateGDriveUI();
}

window.openGDriveHelpModal = function () {
    const modal = document.getElementById('gdriveHelpModal');
    if (modal) modal.classList.add('show');
};

window.closeGDriveHelpModal = function () {
    const modal = document.getElementById('gdriveHelpModal');
    if (modal) modal.classList.remove('show');
};

window.handleGDriveAuth = function () {
    const clientId = getGDriveClientId();

    if (!clientId || clientId.length < 20) {
        showToast('Google Client ID نہیں مل سکی۔ براہ کرم پہلے درج کریں۔', 'error');
        return;
    }

    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        showToast('Google Identity Services لوڈ نہیں ہوئی، براہ کرم انٹرنیٹ کنکشن چیک کریں۔', 'error');
        return;
    }

    const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        // drive.appdata = hidden App Data Folder; drive.file = files created by app
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: (response) => {
            if (response.error) {
                showToast('گوگل لاگ ان میں غلطی: ' + response.error, 'error');
                return;
            }
            gdriveToken = response.access_token;
            localStorage.setItem(getGDriveStorageKey('token'), gdriveToken);
            // Also keep the legacy key for compat with debounce check
            if (currentUser) localStorage.setItem(`gdrive_token_${currentUser.id}`, gdriveToken);
            fetchGDriveUserInfo();
        },
    });
    client.requestAccessToken();
};

async function fetchGDriveUserInfo() {
    try {
        const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${gdriveToken}` }
        });
        gdriveUser = await resp.json();
        localStorage.setItem(getGDriveStorageKey('user'), JSON.stringify(gdriveUser));
        updateGDriveUI();
        showToast('گوگل اکاؤنٹ کامیابی سے منسلک ہو گیا ہے۔ پہلا بیک اپ بن رہا ہے...', 'success');

        // Initial sync after link
        await manualGDriveSync();
    } catch (err) {
        console.error('Error fetching user info:', err);
        showToast('یوزر انفو حاصل کرنے میں دشواری: ' + err.message, 'error');
    }
}

window.disconnectGDrive = function () {
    if (confirm('کیا آپ واقعی گوگل اکاؤنٹ ڈسکنیکٹ کرنا چاہتے ہیں؟')) {
        // Clear per-user keys
        localStorage.removeItem(getGDriveStorageKey('token'));
        localStorage.removeItem(getGDriveStorageKey('user'));
        localStorage.removeItem(getGDriveStorageKey('auto_sync'));
        localStorage.removeItem(getGDriveStorageKey('last_sync'));
        // Also clear legacy keys for compatibility
        if (currentUser) localStorage.removeItem(`gdrive_token_${currentUser.id}`);
        gdriveToken = null;
        gdriveUser = null;
        if (autoSyncInterval) clearInterval(autoSyncInterval);
        autoSyncInterval = null;
        updateGDriveUI();
        showToast('گوگل اکاؤنٹ ڈسکنیکٹ کر دیا گیا ہے۔', 'info');
    }
};

function updateGDriveUI() {
    const setupSection = document.getElementById('gdriveSetupSection');
    const syncSection = document.getElementById('gdriveSyncSection');
    const statusLabel = document.getElementById('gdriveStatus');

    if (gdriveToken && gdriveUser) {
        if (setupSection) setupSection.style.display = 'none';
        if (syncSection) syncSection.style.display = 'block';
        if (statusLabel) {
            statusLabel.innerText = 'منسلک شدہ ✓';
            statusLabel.style.background = '#dcfce7';
            statusLabel.style.color = '#166534';
        }

        const nameEl = document.getElementById('gdriveUserName');
        const emailEl = document.getElementById('gdriveUserEmail');
        if (nameEl) nameEl.innerText = gdriveUser.name || '';
        if (emailEl) emailEl.innerText = gdriveUser.email || '';

        if (gdriveUser.picture) {
            const img = document.getElementById('gdriveUserImg');
            const ph = document.getElementById('gdriveUserPlaceholder');
            if (img) { img.src = gdriveUser.picture; img.style.display = 'block'; }
            if (ph) ph.style.display = 'none';
        }

        const lastSync = localStorage.getItem(getGDriveStorageKey('last_sync'));
        const lastSyncEl = document.getElementById('lastSyncTime');
        if (lastSync && lastSyncEl) {
            lastSyncEl.innerText = 'آخری سینک: ' + new Date(lastSync).toLocaleString('ur-PK');
        }

        const isAutoSync = localStorage.getItem(getGDriveStorageKey('auto_sync')) === 'true';
        const toggle = document.getElementById('autoSyncToggle');
        if (toggle) {
            toggle.checked = isAutoSync;
            if (isAutoSync && !autoSyncInterval) startAutoSyncTimer();
        }

        // Pre-fill client ID field for visibility
        const clientIdInput = document.getElementById('gdriveClientId');
        if (clientIdInput && !clientIdInput.value) {
            clientIdInput.value = getGDriveClientId();
        }
    } else {
        if (setupSection) setupSection.style.display = 'block';
        if (syncSection) syncSection.style.display = 'none';
        if (statusLabel) {
            statusLabel.innerText = 'نہیں جڑا ہوا';
            statusLabel.style.background = '#f1f5f9';
            statusLabel.style.color = '#64748b';
        }
        // Pre-fill Client ID from meta tag to make it easy for users
        const clientIdInput = document.getElementById('gdriveClientId');
        if (clientIdInput && !clientIdInput.value) {
            const autoId = getGDriveClientId();
            if (autoId) clientIdInput.value = autoId;
        }
    }
}

window.manualGDriveSync = async function () {
    if (!gdriveToken) {
        showToast('پہلے گوگل اکاؤنٹ لنک کریں۔', 'warning');
        return;
    }

    const btn = document.getElementById('btnSyncNow');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<ion-icon name="sync-outline" class="rotating"></ion-icon> سینک ہو رہا ہے...';
    }

    try {
        // Use LIVE in-memory data from Firebase (not stale localStorage)
        // This guarantees the backup reflects exactly what's in the database.
        const uid = currentUser ? currentUser.id : 'unknown';
        const backupData = {
            uid: uid,
            userName: currentUser ? currentUser.name : '',
            userEmail: currentUser ? currentUser.email : '',
            orders: orders || [],
            transactions: transactions || [],
            shopSettings: shopSettings || {},
            products: products || [],
            orderStatuses: orderStatuses || [],
            orderCategories: orderCategories || [],
            deletedOrders: deletedOrders || [],
            users: USERS || {},
            syncDate: new Date().toISOString(),
            version: '3.0',
            firebasePath: getPath('')
        };

        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `jabli-erp-backup-${uid.substring(0, 8)}-${dateStr}.json`;
        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });

        // Search in appDataFolder (hidden from user's Drive) + regular Drive
        // We search in 'appDataFolder' space first, then fall back to regular
        let fileId = null;
        try {
            const searchResp = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=name+%3d+%27${encodeURIComponent(fileName)}%27+and+trashed%3dfalse&spaces=appDataFolder,drive`,
                { headers: { Authorization: `Bearer ${gdriveToken}` } }
            );
            const searchResult = await searchResp.json();
            if (searchResult.files && searchResult.files.length > 0) {
                fileId = searchResult.files[0].id;
            }
        } catch (e) { /* search failed, will create new */ }

        const metadata = {
            name: fileName,
            mimeType: 'application/json',
            // Store in hidden appDataFolder so it doesn't clutter user's Drive
            parents: fileId ? undefined : ['appDataFolder']
        };
        if (fileId) delete metadata.parents;

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let uploadMethod = 'POST';

        if (fileId) {
            uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            uploadMethod = 'PATCH';
        }

        const uploadResp = await fetch(uploadUrl, {
            method: uploadMethod,
            headers: { Authorization: `Bearer ${gdriveToken}` },
            body: form
        });

        if (uploadResp.ok) {
            const now = new Date().toISOString();
            localStorage.setItem(getGDriveStorageKey('last_sync'), now);
            const lastSyncEl = document.getElementById('lastSyncTime');
            if (lastSyncEl) lastSyncEl.innerText = 'آخری سینک: ' + new Date(now).toLocaleString('ur-PK');
            const sizeMB = (blob.size / 1024).toFixed(1);
            showToast(`گوگل ڈرائیو پر بیک اپ مکمل ✓ (${sizeMB} KB)`, 'success');
        } else {
            const errData = await uploadResp.json();
            if (errData.error && (errData.error.code === 401 || errData.error.status === 'UNAUTHENTICATED')) {
                showToast('گوگل سیشن ختم ہو گیا ہے، دوبارہ لنک کریں۔', 'error');
                // Clear token but keep user info
                gdriveToken = null;
                localStorage.removeItem(getGDriveStorageKey('token'));
                if (currentUser) localStorage.removeItem(`gdrive_token_${currentUser.id}`);
                updateGDriveUI();
            } else {
                throw new Error(errData.error ? errData.error.message : 'Drive upload failed');
            }
        }
    } catch (err) {
        console.error('[Drive Sync Error]:', err);
        showToast('سینک کے دوران غلطی: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml || '<ion-icon name="cloud-upload-outline"></ion-icon> ابھی سینک کریں';
        }
    }
};

window.toggleAutoSync = function (enabled) {
    localStorage.setItem(getGDriveStorageKey('auto_sync'), String(enabled));
    if (enabled) {
        startAutoSyncTimer();
        showToast('آٹو سینک فعال کر دیا گیا ہے۔', 'info');
    } else {
        if (autoSyncInterval) clearInterval(autoSyncInterval);
        autoSyncInterval = null;
        showToast('آٹو سینک بند کر دیا گیا ہے۔', 'info');
    }
};

function startAutoSyncTimer() {
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    // Every 5 minutes
    autoSyncInterval = setInterval(() => {
        if (gdriveToken) {
            console.log('Running auto sync...');
            manualGDriveSync();
        }
    }, 5 * 60 * 1000);
}

// Initialize GDrive UI and timers on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        updateGDriveUI();
        // Global styles for rotating icon
        if (!document.getElementById('gdriveStyles')) {
            const style = document.createElement('style');
            style.id = 'gdriveStyles';
            style.innerHTML = `
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .rotating { animation: rotate 2s linear infinite; }
                .status-badge { display: inline-block; margin-right: 10px; font-weight: 600; }
            `;
            document.head.appendChild(style);
        }
    }, 2000);
});

// Run auto-backup logic on load
setTimeout(runAutoBackup, 3000); // Delay slightly after init
