const translations = {
    ur: {
        dir: "rtl",
        lang: "ur",
        dashboard: "ڈیش بورڈ",
        orders: "آرڈرز (Orders)",
        finance: "مالیات (Finance)",
        customers: "کسٹمرز",
        products: "اسٹاک / پروڈکٹس",
        settings: "سیٹنگز",
        welcome: "خوش آمدید، Jabli ERP!",
        today_summary: "آج کی تازہ ترین صورتحال - Your Smart Business Partner",
        total_income: "کل آمدنی",
        pending_balance: "بقایا جات (Pending)",
        active_orders: "زیر تکمیل آرڈرز",
        completed_orders: "مکمل شدہ آرڈرز",
        recent_orders: "حالیہ آرڈرز",
        view_all: "سب دیکھیں",
        today_overview: "آج کا خلاصہ",
        download_report: "روزانہ رپورٹ ڈاؤنلوڈ کریں",
        new_order: "نیا آرڈر بنائیں",
        search_placeholder: "آرڈر یا کسٹمر تلاش کریں...",
        income_btn: "آمدن درج کریں",
        expense_btn: "خرچہ کریں",
        handover_btn: "رقم جمع کروائیں",
        logout: "لاگ آؤٹ (Logout)",
        change_password: "اپنا پاسورڈ تبدیل کریں",
        admin_role: "Admin",
        language_btn: "English"
    },
    en: {
        dir: "ltr",
        lang: "en",
        dashboard: "Dashboard",
        orders: "Orders",
        finance: "Finance",
        customers: "Customers",
        products: "Stock / Products",
        settings: "Settings",
        welcome: "Welcome, Jabli ERP!",
        today_summary: "Today's latest status - Your Smart Business Partner",
        total_income: "Total Income",
        pending_balance: "Pending Balance",
        active_orders: "Active Orders",
        completed_orders: "Completed Orders",
        recent_orders: "Recent Orders",
        view_all: "View All",
        today_overview: "Today's Overview",
        download_report: "Download Daily Report",
        new_order: "Create New Order",
        search_placeholder: "Search order or customer...",
        income_btn: "Add Income",
        expense_btn: "Add Expense",
        handover_btn: "Handover Cash",
        logout: "Logout",
        change_password: "Change Password",
        admin_role: "Admin",
        language_btn: "Urdu"
    }
};

function toggleLanguage() {
    const currentLang = localStorage.getItem('appLanguage') || 'ur';
    const newLang = currentLang === 'ur' ? 'en' : 'ur';
    setLanguage(newLang);
}

function setLanguage(lang) {
    localStorage.setItem('appLanguage', lang);
    document.documentElement.lang = translations[lang].lang;
    document.documentElement.dir = translations[lang].dir;

    // Update body class for potential CSS adjustments
    document.body.classList.remove('lang-ur', 'lang-en');
    document.body.classList.add(`lang-${lang}`);

    updateTranslation();
}

function updateTranslation() {
    const lang = localStorage.getItem('appLanguage') || 'ur';
    const t = translations[lang];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = t[key];
            } else {
                // Find the first text node or span and update it
                // To avoid breaking icons inside buttons/links
                const span = el.querySelector('span');
                if (span) {
                    span.textContent = t[key];
                } else {
                    // If no span, check for direct text children
                    let textNodeFound = false;
                    el.childNodes.forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                            node.textContent = t[key];
                            textNodeFound = true;
                        }
                    });
                    if (!textNodeFound) {
                        el.textContent = t[key];
                    }
                }
            }
        }
    });

    // Handle special cases like the language button itself
    const langBtn = document.getElementById('languageToggleBtn');
    if (langBtn) {
        const btnText = langBtn.querySelector('span');
        if (btnText) btnText.textContent = t.language_btn;
    }
}

// Initialize language on load
window.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('appLanguage') || 'ur';
    setLanguage(savedLang);
});
