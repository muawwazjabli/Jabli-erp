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

        // Trigger DOMContentLoaded
        const event = document.createEvent("Event");
        event.initEvent("DOMContentLoaded", true, true);
        document.dispatchEvent(event);

        console.log("Initial Dashboard Display:", document.getElementById('dashboardPage').style.display);

        const btn = document.getElementById('navFinance');
        // Add a mutation observer to see if display changes back later
        const observer = new window.MutationObserver(mutations => {
            mutations.forEach(m => {
                if (m.target.id === 'dashboardPage' || m.target.id === 'financePage') {
                    console.log(`Mutation: ${m.target.id} style display is now ${m.target.style.display}`);
                }
            });
        });
        observer.observe(document.getElementById('dashboardPage'), { attributes: true, attributeFilter: ['style'] });
        observer.observe(document.getElementById('financePage'), { attributes: true, attributeFilter: ['style'] });

        console.log("Clicking navFinance...");
        btn.click();

        console.log("Immediate display - Finance:", document.getElementById('financePage').style.display);
        console.log("Immediate display - Dashboard:", document.getElementById('dashboardPage').style.display);

        // Wait and check again
        setTimeout(() => {
            console.log("Delayed display - Finance:", document.getElementById('financePage').style.display);
            console.log("Delayed display - Dashboard:", document.getElementById('dashboardPage').style.display);
        }, 100);

    } catch (err) {
        console.error("FAIL:", err.message);
        console.error(err.stack);
    }
}, 500);
