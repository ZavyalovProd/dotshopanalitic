var API_URL = 'https://api.dotinfo.com.ru/api';
var currentPeriod = 'week';
var isAuthenticated = false;
var isAdmin = false;
var authToken = null;
var currentData = null;

// Loader
function runLoader() {
    var status = document.getElementById('loader-status');
    var steps = ['Initializing...', 'Connecting...', 'Loading...', 'Welcome!'];
    var i = 0;
    var interval = setInterval(function() {
        if (i < steps.length) { status.textContent = steps[i]; i++; }
        else {
            clearInterval(interval);
            setTimeout(function() {
                document.getElementById('loader-screen').classList.add('hidden');
                checkAuth();
            }, 300);
        }
    }, 400);
}

// Auth
function checkAuth() {
    var saved = localStorage.getItem('dotshop_auth');
    if (saved) {
        try {
            var data = JSON.parse(saved);
            authToken = data.token;
            isAdmin = data.isAdmin;
            verifyToken();
        } catch (e) { showLogin(); }
    } else { showLogin(); }
}

function showLogin() {
    document.getElementById('login-screen').classList.add('visible');
}

async function verifyToken() {
    try {
        var r = await fetch(API_URL + '/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: authToken })
        });
        var d = await r.json();
        if (d.success) { isAdmin = d.is_admin; showDashboard(); }
        else { localStorage.removeItem('dotshop_auth'); showLogin(); }
    } catch (e) { showLogin(); }
}

async function login() {
    var token = document.getElementById('token-input').value.trim();
    if (!token) { showError('Enter token'); return; }
    
    try {
        var r = await fetch(API_URL + '/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        var d = await r.json();
        if (d.success) {
            authToken = token;
            isAdmin = d.is_admin;
            localStorage.setItem('dotshop_auth', JSON.stringify({ token: token, isAdmin: isAdmin }));
            document.getElementById('login-screen').classList.remove('visible');
            showDashboard();
        } else { showError(d.error || 'Invalid token'); }
    } catch (e) { showError('Connection error'); }
}

function logout() {
    localStorage.removeItem('dotshop_auth');
    authToken = null;
    isAdmin = false;
    isAuthenticated = false;
    document.getElementById('dashboard').classList.remove('visible');
    showLogin();
}

function showDashboard() {
    document.getElementById('dashboard').classList.add('visible');
    isAuthenticated = true;
    if (isAdmin) {
        document.querySelectorAll('.admin-only').forEach(function(el) { el.classList.remove('hidden'); });
    }
    fetchStats();
}

function showError(msg) {
    var e = document.getElementById('login-error');
    e.textContent = msg;
    setTimeout(function() { e.textContent = ''; }, 3000);
}

// Admin login flow
function showAdminLogin() {
    document.getElementById('token-login-form').classList.add('hidden');
    document.getElementById('admin-password-form').classList.remove('hidden');
}

function showTokenLogin() {
    document.getElementById('admin-password-form').classList.add('hidden');
    document.getElementById('code-verify-form').classList.add('hidden');
    document.getElementById('token-login-form').classList.remove('hidden');
}

async function requestCode() {
    var pw = document.getElementById('admin-password').value.trim();
    
    if (!pw) { showError('Enter admin password'); return; }
    
    try {
        var r = await fetch(API_URL + '/admin/request-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        var d = await r.json();
        if (d.success) {
            document.getElementById('admin-password-form').classList.add('hidden');
            document.getElementById('code-verify-form').classList.remove('hidden');
            if (d.code) showError('Dev code: ' + d.code);
        } else { showError(d.error || 'Error'); }
    } catch (e) { showError('Connection error'); }
}

async function verifyCode() {
    var code = document.getElementById('code-input').value.trim();
    if (!code) { showError('Enter code'); return; }
    
    try {
        var r = await fetch(API_URL + '/admin/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });
        var d = await r.json();
        if (d.success) {
            authToken = d.admin_token;
            isAdmin = true;
            localStorage.setItem('dotshop_auth', JSON.stringify({ token: authToken, isAdmin: true }));
            document.getElementById('login-screen').classList.remove('visible');
            showDashboard();
        } else { showError(d.error || 'Invalid code'); }
    } catch (e) { showError('Connection error'); }
}

// Connection
function setStatus(s) {
    var el = document.getElementById('connection-status');
    el.querySelector('.status-dot').className = 'status-dot ' + s;
    el.querySelector('span').textContent = s === 'online' ? 'Connected' : s === 'connecting' ? 'Connecting...' : 'Offline';
}

function updateTime() {
    var now = new Date();
    document.getElementById('last-update').textContent = 'Updated: ' + now.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
}

// Fetch
async function fetchStats() {
    if (!isAuthenticated || !authToken) return;
    setStatus('connecting');
    
    try {
        var r = await fetch(API_URL + '/stats?period=' + currentPeriod, {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        if (!r.ok) throw new Error();
        var d = await r.json();
        currentData = d;
        setStatus('online');
        updateTime();
        render(d);
    } catch (e) { setStatus('offline'); }
}

// Render
function render(d) {
    document.getElementById('total-orders').textContent = d.total_orders || 0;
    document.getElementById('total-reviews').textContent = d.total_reviews || 0;
    document.getElementById('unique-buyers').textContent = d.unique_buyers || 0;
    document.getElementById('total-revenue').textContent = '€' + (d.revenue_eur || 0).toFixed(2);
    document.getElementById('revenue-eur').textContent = '€' + (d.revenue_eur || 0).toFixed(2);
    document.getElementById('revenue-usd').textContent = '$' + (d.revenue_usd || 0).toFixed(2);
    document.getElementById('revenue-rub').textContent = '₽' + Math.round(d.revenue_rub || 0).toLocaleString();
    document.getElementById('reviews-total').textContent = d.total_reviews || 0;
    
    renderPayments(d.payment_methods || {});
    renderProducts(d.top_products || []);
    renderBuyers(d.top_buyers || []);
    renderOrders(d.recent_orders || []);
}

function renderPayments(m) {
    var c = document.getElementById('payment-methods');
    var total = Object.values(m).reduce((a,b) => a+b, 0);
    if (total === 0) { c.innerHTML = '<div class="no-data">No data</div>'; return; }
    
    var colors = {Crypto:'#fbbf24',Card:'#818cf8',PayPal:'#3b82f6',Stripe:'#818cf8',SOL:'#fbbf24',BTC:'#f7931a','RU-Card':'#818cf8'};
    c.innerHTML = Object.entries(m).sort((a,b) => b[1]-a[1]).map(([n,v]) => {
        var pct = (v/total)*100;
        return `<div class="list-item"><span class="list-name">${n}</span><div class="payment-bar"><div class="payment-fill" style="width:${pct}%;background:${colors[n]||'#6b7280'}"></div></div><span class="list-value">${v}</span></div>`;
    }).join('');
}

function renderProducts(p) {
    var c = document.getElementById('top-products');
    if (!p.length) { c.innerHTML = '<div class="no-data">No data</div>'; return; }
    c.innerHTML = p.map((x,i) => `<div class="list-item"><span class="list-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i+1}</span><span class="list-name">${x.name}</span><span class="list-value">${x.sold} • €${x.revenue.toFixed(2)}</span></div>`).join('');
}

function renderBuyers(b) {
    var c = document.getElementById('top-buyers');
    if (!b.length) { c.innerHTML = '<div class="no-data">No data</div>'; return; }
    c.innerHTML = b.map((x,i) => `<div class="list-item"><span class="list-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i+1}</span><span class="list-name">${x.name}</span><span class="list-value">${x.orders} • €${x.spent.toFixed(2)}</span></div>`).join('');
}

function renderOrders(o) {
    var t = document.getElementById('orders-table');
    document.getElementById('orders-count').textContent = o.length + ' orders';
    if (!o.length) { t.innerHTML = '<tr><td colspan="7" class="no-data">No orders</td></tr>'; return; }
    
    t.innerHTML = o.map((x,i) => {
        var d = new Date(x.timestamp);
        var ds = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
        var m = (x.payment_method||'Other').toLowerCase().replace(/[^a-z]/g,'');
        return `<tr><td>#${i+1}</td><td>${x.buyer_name||'?'}</td><td class="hide-mobile">${x.items_short||'-'}</td><td><span class="payment-badge ${m}">${x.payment_method||'Other'}</span></td><td>€${(x.total_cost||0).toFixed(2)}</td><td class="hide-mobile">${ds}</td><td><button class="view-btn" onclick="showModal(${i})">View</button></td></tr>`;
    }).join('');
}

// Modal
function showModal(i) {
    if (!currentData || !currentData.recent_orders[i]) return;
    var o = currentData.recent_orders[i];
    var d = new Date(o.timestamp);
    var ds = d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    
    var items = '';
    if (o.items_full && o.items_full.length) {
        items = o.items_full.map(x => `<div class="modal-item"><span>${x.name||'?'}</span><span>x${x.qty||1} • €${((x.price||0)*(x.qty||1)).toFixed(2)}</span></div>`).join('');
    }
    
    document.getElementById('modal-content').innerHTML = `
        <h2 class="modal-title">Order #${i+1}</h2>
        <div class="modal-row"><span class="modal-label">Buyer</span><span class="modal-value">${o.buyer_name||'?'}</span></div>
        <div class="modal-row"><span class="modal-label">Nickname</span><span class="modal-value">${o.nickname||'N/A'}</span></div>
        <div class="modal-row"><span class="modal-label">Coordinates</span><span class="modal-value">${o.coordinates||'N/A'}</span></div>
        <div class="modal-row"><span class="modal-label">Payment</span><span class="modal-value">${o.payment_method||'N/A'}</span></div>
        <div class="modal-row"><span class="modal-label">Delivery</span><span class="modal-value">${o.delivery_speed||'Default'}</span></div>
        <div class="modal-row"><span class="modal-label">Delivered by</span><span class="modal-value">${o.delivery_person||'N/A'}</span></div>
        <div class="modal-row"><span class="modal-label">Date</span><span class="modal-value">${ds}</span></div>
        <div class="modal-row"><span class="modal-label">Total</span><span class="modal-value" style="color:#ffb070;font-weight:700">€${(o.total_cost||0).toFixed(2)}</span></div>
        <div class="modal-items"><h4>Items</h4>${items||'<div class="no-data">No items</div>'}</div>
    `;
    document.getElementById('order-modal').classList.add('visible');
}

function closeModal() {
    document.getElementById('order-modal').classList.remove('visible');
}

// Admin
async function createToken() {
    var name = document.getElementById('new-token-name').value.trim() || 'Token';
    var uses = parseInt(document.getElementById('new-token-uses').value) || -1;
    
    try {
        var r = await fetch(API_URL + '/tokens/create', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + authToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, max_uses: uses })
        });
        var d = await r.json();
        if (d.success) {
            document.getElementById('new-token-value').textContent = d.token;
            document.getElementById('token-result').classList.remove('hidden');
            loadTokens();
        }
    } catch (e) {}
}

function copyToken() {
    navigator.clipboard.writeText(document.getElementById('new-token-value').textContent);
    document.getElementById('copy-token-btn').textContent = 'Copied!';
    setTimeout(() => document.getElementById('copy-token-btn').textContent = 'Copy', 2000);
}

async function loadTokens() {
    if (!isAdmin) return;
    try {
        var r = await fetch(API_URL + '/tokens', { headers: { 'Authorization': 'Bearer ' + authToken } });
        var d = await r.json();
        var c = document.getElementById('tokens-list');
        if (!d.tokens || !d.tokens.length) { c.innerHTML = '<div class="no-data">No tokens</div>'; return; }
        c.innerHTML = d.tokens.map(t => `<div class="token-item"><div class="token-info"><div class="token-name">${t.name}</div><div class="token-meta">ID: ${t.id} • Uses: ${t.max_uses===-1?'∞':t.current_uses+'/'+t.max_uses}</div></div><button class="delete-btn" onclick="deleteToken('${t.id}')">Delete</button></div>`).join('');
    } catch (e) {}
}

async function deleteToken(id) {
    if (!confirm('Delete?')) return;
    try {
        await fetch(API_URL + '/tokens/delete', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + authToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        loadTokens();
    } catch (e) {}
}

async function loadLoginLogs() {
    if (!isAdmin) return;
    try {
        var r = await fetch(API_URL + '/logs/login', { headers: { 'Authorization': 'Bearer ' + authToken } });
        var d = await r.json();
        var c = document.getElementById('login-logs');
        if (!d.logs || !d.logs.length) { c.innerHTML = '<div class="no-data">No logs</div>'; return; }
        c.innerHTML = d.logs.map(l => {
            var t = new Date(l.timestamp);
            return `<div class="log-item ${l.success?'success':'error'}"><div class="log-time">${t.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div><div class="log-msg">${l.token_type} from ${l.ip||'?'} ${l.success?'✓':'✗ '+( l.reason||'')}</div></div>`;
        }).join('');
    } catch (e) {}
}

async function loadBotLogs() {
    if (!isAdmin) return;
    try {
        var r = await fetch(API_URL + '/logs/bot', { headers: { 'Authorization': 'Bearer ' + authToken } });
        var d = await r.json();
        var c = document.getElementById('bot-logs');
        if (!d.logs || !d.logs.length) { c.innerHTML = '<div class="no-data">No logs</div>'; return; }
        c.innerHTML = d.logs.map(l => {
            var t = new Date(l.timestamp);
            return `<div class="log-item ${l.level||'info'}"><div class="log-time">${t.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div><div class="log-msg">${l.message}</div></div>`;
        }).join('');
    } catch (e) {}
}

// Events
document.addEventListener('DOMContentLoaded', function() {
    runLoader();
    
    document.getElementById('login-btn').onclick = login;
    document.getElementById('token-input').onkeypress = e => e.key==='Enter' && login();
    document.getElementById('logout-btn').onclick = logout;
    document.getElementById('modal-close').onclick = closeModal;
    document.getElementById('order-modal').onclick = e => e.target.id==='order-modal' && closeModal();
    
    document.getElementById('admin-login-btn').onclick = showAdminLogin;
    document.getElementById('back-to-token').onclick = showTokenLogin;
    document.getElementById('request-code-btn').onclick = requestCode;
    document.getElementById('back-to-password').onclick = () => {
        document.getElementById('code-verify-form').classList.add('hidden');
        document.getElementById('admin-password-form').classList.remove('hidden');
    };
    document.getElementById('verify-code-btn').onclick = verifyCode;
    document.getElementById('code-input').onkeypress = e => e.key==='Enter' && verifyCode();
    
    document.getElementById('create-token-btn').onclick = createToken;
    document.getElementById('copy-token-btn').onclick = copyToken;
    
    document.querySelectorAll('.period-btn').forEach(b => {
        b.onclick = function() {
            document.querySelectorAll('.period-btn').forEach(x => x.classList.remove('active'));
            this.classList.add('active');
            currentPeriod = this.dataset.period;
            fetchStats();
        };
    });
    
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.onclick = function() {
            document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('tab-' + this.dataset.tab).classList.add('active');
        };
    });
    
    document.querySelectorAll('.nav-item[data-section]').forEach(n => {
        n.onclick = function(e) {
            e.preventDefault();
            var s = this.dataset.section;
            document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('section-' + s).classList.add('active');
            if (s === 'admin' && isAdmin) { loadTokens(); loadLoginLogs(); loadBotLogs(); }
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('overlay').classList.remove('visible');
        };
    });
    
    document.getElementById('mobile-menu-btn').onclick = () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('overlay').classList.toggle('visible');
    };
    document.getElementById('overlay').onclick = () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('visible');
    };
    
    setInterval(() => isAuthenticated && fetchStats(), 30000);
});
