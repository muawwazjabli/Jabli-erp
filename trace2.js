const fs = require("fs");
const path = require("path");
const { JSDOM } = require("c:/Users/MUAWWAZ JABLI/AppData/Local/Temp/node_modules/jsdom");

const htmlContent = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
const jsContent = fs.readFileSync(path.join(__dirname, "app.js"), "utf-8");

const dom = new JSDOM(htmlContent, {
    runScripts: "dangerously",
    url: "http://localhost/"
});

const window = dom.window;
const document = window.document;

window.addEventListener('error', (event) => {
    console.error("Window Error:", event.error);
});

const localStorageData = {};
window.localStorage = {
    getItem: key => localStorageData[key] || null,
    setItem: (key, val) => { localStorageData[key] = String(val); },
    removeItem: key => { delete localStorageData[key]; }
};

const scriptEl = document.createElement("script");
scriptEl.textContent = jsContent;
document.body.appendChild(scriptEl);

setTimeout(() => {
    try {
        window.currentUser = 'admin_1';
        window.currentRole = 'superadmin';
        window.USERS = {
            'admin_1': { id: 'admin_1', name: 'Al-Abbasi', username: 'admin', role: 'superadmin', pass: '1122', avatar: 'A', color: 'var(--primary)', textColor: 'white' }
        };

        let tx = [{ type: 'income', amount: 50, date: new Date().toISOString(), userId: 'admin_1' }];
        window.localStorage.setItem('alAbbasiTransactions', JSON.stringify(tx));

        const event = document.createEvent("Event");
        event.initEvent("DOMContentLoaded", true, true);
        document.dispatchEvent(event);

        const btn = document.getElementById('navFinance');
        console.log("Clicking navFinance...");
        btn.click();

        console.log("Finance Page Style: ", document.getElementById('financePage').style.display);
        console.log("Dashboard Page Style: ", document.getElementById('dashboardPage').style.display);

    } catch (err) {
        console.error("FAIL:", err.message);
        console.error(err.stack);
    }
}, 500);
