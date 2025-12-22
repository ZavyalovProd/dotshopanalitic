const API = 'https://api.dotinfo.com.ru/api';
let period = 'week', token = null, isAdmin = false, data = null;

// Loader
function loader() {
    const el = document.getElementById('loader-status');
    const steps = ['Initializing...', 'Connecting...', 'Loading...', 'Welcome!'];
    let i = 0;
    const int = setInterval(() => {
        if (i < steps.length) el.textContent = steps[i++];
        else {
            clearInterval(int);
            setTimeout(() => {
                document.getElementById('loader-screen').classList.add('hidden');
                checkAuth();
            }, 300);
        }
    }, 400);
}

// Auth
function checkAuth() {
    const saved = localStorage.getItem('dotshop_token');
    if (saved) {
        token = saved;
        verify();
    } else showLogin();
}

function showLogin() {
    document.getElementById('login-screen').classList.add('visible');
}

async function verify() {
    try {
        const r = await fetch(API + '/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const d = await r.json();
        if (d.success) {
            isAdmin = d.is_admin === true;
            showDashboard();
        } else {
            localStorage.removeItem('dotshop_token');
            showLogin();
        }
    } catch { showLogin(); }
}

async function login() {
    const t = document.getElementById('token-input').value.trim();
    if (!t) return err('Enter token');
    
    try {
        const r = await fetch(API + '/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: t })
        });
        const d = await r.json();
        if (d.success) {
            token = t;
            isAdmin = d.is_admin === true;
            localStorage.setItem('dotshop_token', t);
            document.getElementById('login-screen').classList.remove('visible');
            showDashboard();
        } else err(d.error || 'Invalid token');
    } catch { err('Connection error'); }
}

function logout() {
    localStorage.removeItem('dotshop_token');
    token = null;
    isAdmin = false;
    document.getElementById('dashboard').classList.remove('visible', 'admin-mode');
    document.querySelectorAll('.admin-nav').forEach(e => e.classList.add('hidden'));
    showLogin();
}

function showDashboard() {
    const dash = document.getElementById('dashboard');
    dash.classList.add('visible');
    
    // Admin mode - show admin nav and red theme
    if (isAdmin) {
        dash.classList.add('admin-mode');
        document.querySelectorAll('.admin-nav').forEach(e => e.classList.remove('hidden'));
    } else {
        dash.classList.remove('admin-mode');
        document.querySelectorAll('.admin-nav').forEach(e => e.classList.add('hidden'));
    }
    
    fetchStats();
    fetchReviews();
}

function err(msg) {
    const e = document.getElementById('login-error');
    e.textContent = msg;
    setTimeout(() => e.textContent = '', 3000);
}

// Admin login
function showAdminForm() {
    document.getElementById('token-login-form').classList.add('hidden');
    document.getElementById('admin-form').classList.remove('hidden');
}

function backToToken() {
    document.getElementById('admin-form').classList.add('hidden');
    document.getElementById('code-form').classList.add('hidden');
    document.getElementById('token-login-form').classList.remove('hidden');
}

async function sendCode() {
    const pw = document.getElementById('admin-password').value.trim();
    if (!pw) return err('Enter password');
    
    try {
        const r = await fetch(API + '/admin/request-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('admin-form').classList.add('hidden');
            document.getElementById('code-form').classList.remove('hidden');
        } else err(d.error || 'Error');
    } catch { err('Connection error'); }
}

async function verifyCode() {
    const code = document.getElementById('code-input').value.trim();
    if (!code) return err('Enter code');
    
    try {
        const r = await fetch(API + '/admin/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const d = await r.json();
        if (d.success) {
            token = d.admin_token;
            isAdmin = true;
            localStorage.setItem('dotshop_token', token);
            document.getElementById('login-screen').classList.remove('visible');
            showDashboard();
        } else err(d.error || 'Invalid code');
    } catch { err('Connection error'); }
}

// Status
function setStatus(s) {
    const el = document.getElementById('status');
    el.className = 'status ' + s;
    el.querySelector('.status-text').textContent = s === 'online' ? 'Connected' : s === 'connecting' ? 'Connecting...' : 'Offline';
}

// Fetch
async function fetchStats() {
    if (!token) return;
    setStatus('connecting');
    
    try {
        const r = await fetch(API + '/stats?period=' + period, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!r.ok) throw 0;
        data = await r.json();
        setStatus('online');
        document.getElementById('update-time').textContent = 'Updated: ' + new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
        render();
    } catch { setStatus('offline'); }
}

async function fetchReviews() {
    if (!token) return;
    
    try {
        const r = await fetch(API + '/reviews', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const d = await r.json();
        renderReviews(d);
    } catch {}
}

// Render
function render() {
    if (!data) return;
    
    document.getElementById('stat-orders').textContent = data.total_orders || 0;
    document.getElementById('stat-reviews').textContent = data.total_reviews || 0;
    document.getElementById('stat-buyers').textContent = data.unique_buyers || 0;
    document.getElementById('stat-revenue').textContent = '€' + (data.revenue_eur || 0).toFixed(2);
    
    document.getElementById('cur-eur').textContent = '€' + (data.revenue_eur || 0).toFixed(2);
    document.getElementById('cur-usd').textContent = '$' + (data.revenue_usd || 0).toFixed(2);
    document.getElementById('cur-rub').textContent = '₽' + Math.round(data.revenue_rub || 0).toLocaleString();
    
    renderPayments(data.payment_methods || {});
    renderProducts(data.top_products || []);
    renderBuyers(data.top_buyers || []);
    renderOrders(data.recent_orders || []);
}

function renderPayments(m) {
    const c = document.getElementById('tab-payments');
    const total = Object.values(m).reduce((a,b) => a+b, 0);
    if (!total) { c.innerHTML = '<div class="no-data">No data</div>'; return; }
    
    const colors = {Crypto:'#fbbf24',Card:'#818cf8',PayPal:'#3b82f6',SOL:'#fbbf24',BTC:'#f7931a','RU-Card':'#818cf8'};
    c.innerHTML = Object.entries(m).sort((a,b) => b[1]-a[1]).map(([n,v]) => 
        `<div class="list-item"><span class="name">${n}</span><div class="bar"><div class="bar-fill" style="width:${v/total*100}%;background:${colors[n]||'#6b7280'}"></div></div><span class="val">${v}</span></div>`
    ).join('');
}

function renderProducts(p) {
    const c = document.getElementById('tab-products');
    if (!p.length) { c.innerHTML = '<div class="no-data">No data</div>'; return; }
    c.innerHTML = p.map((x,i) => `<div class="list-item"><span class="rank ${i<3?['g','s','b'][i]:''}">${i+1}</span><span class="name">${x.name}</span><span class="val">${x.sold} • €${x.revenue.toFixed(2)}</span></div>`).join('');
}

function renderBuyers(b) {
    const c = document.getElementById('tab-buyers');
    if (!b.length) { c.innerHTML = '<div class="no-data">No data</div>'; return; }
    c.innerHTML = b.map((x,i) => `<div class="list-item"><span class="rank ${i<3?['g','s','b'][i]:''}">${i+1}</span><span class="name">${x.name}</span><span class="val">${x.orders} • €${x.spent.toFixed(2)}</span></div>`).join('');
}

function renderOrders(o) {
    const t = document.getElementById('orders-tbody');
    document.getElementById('orders-badge').textContent = o.length;
    if (!o.length) { t.innerHTML = '<tr><td colspan="7" class="no-data">No orders</td></tr>'; return; }
    
    t.innerHTML = o.map((x,i) => {
        const d = new Date(x.timestamp);
        const ds = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
        const m = (x.payment_method||'Other').toLowerCase().replace(/[^a-z]/g,'');
        return `<tr><td>#${i+1}</td><td>${x.buyer_name||'?'}</td><td class="hide-m">${x.items_short||'-'}</td><td><span class="pay ${m}">${x.payment_method||'?'}</span></td><td>€${(x.total_cost||0).toFixed(2)}</td><td class="hide-m">${ds}</td><td><button class="view-btn" onclick="showOrder(${i})">View</button></td></tr>`;
    }).join('');
}

function renderReviews(d) {
    document.getElementById('reviews-total').textContent = d.total_reviews || 0;
    
    const list = document.getElementById('reviews-list');
    if (!d.reviews || !d.reviews.length) {
        list.innerHTML = '<div class="no-data">No reviews yet</div>';
        return;
    }
    
    list.innerHTML = d.reviews.map(r => {
        const date = new Date(r.timestamp);
        const dateStr = date.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
        const avatar = r.avatar ? `<img src="${r.avatar}" alt="">` : r.author[0];
        const images = r.attachments?.length ? `<div class="review-images">${r.attachments.map(a => `<img src="${a}" onclick="window.open('${a}')">`).join('')}</div>` : '';
        
        return `<div class="review-card">
            <div class="review-header">
                <div class="review-avatar">${avatar}</div>
                <div><div class="review-author">${r.author}</div><div class="review-date">${dateStr}</div></div>
            </div>
            <div class="review-stars">${'⭐'.repeat(r.stars || 5)}</div>
            <div class="review-text">${r.content}</div>
            ${images}
        </div>`;
    }).join('');
}

// Modal
function showOrder(i) {
    if (!data?.recent_orders?.[i]) return;
    const o = data.recent_orders[i];
    const d = new Date(o.timestamp);
    const ds = d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    
    let items = '';
    if (o.items_full?.length) {
        items = o.items_full.map(x => `<div class="m-item"><span>${x.name||'?'}</span><span>x${x.qty||1} • €${((x.price||0)*(x.qty||1)).toFixed(2)}</span></div>`).join('');
    }
    
    document.getElementById('modal-body').innerHTML = `
        <h2 class="m-title">Order #${i+1}</h2>
        <div class="m-row"><span>Buyer</span><span>${o.buyer_name||'?'}</span></div>
        <div class="m-row"><span>Nickname</span><span>${o.nickname||'N/A'}</span></div>
        <div class="m-row"><span>Coordinates</span><span>${o.coordinates||'N/A'}</span></div>
        <div class="m-row"><span>Payment</span><span>${o.payment_method||'N/A'}</span></div>
        <div class="m-row"><span>Delivery</span><span>${o.delivery_speed||'Default'}</span></div>
        <div class="m-row"><span>Delivered by</span><span>${o.delivery_person||'N/A'}</span></div>
        <div class="m-row"><span>Date</span><span>${ds}</span></div>
        <div class="m-row"><span>Total</span><span style="color:#ffb070;font-weight:700">€${(o.total_cost||0).toFixed(2)}</span></div>
        <div class="m-items"><h4>Items</h4>${items||'<div class="no-data">No items</div>'}</div>`;
    document.getElementById('modal').classList.add('visible');
}

function closeModal() { document.getElementById('modal').classList.remove('visible'); }

// Admin
async function createToken() {
    const name = document.getElementById('token-name').value.trim() || 'Token';
    const uses = parseInt(document.getElementById('token-uses').value) || -1;
    
    try {
        const r = await fetch(API + '/tokens/create', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, max_uses: uses })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('new-token').textContent = d.token;
            document.getElementById('token-created').classList.remove('hidden');
            loadTokens();
        }
    } catch {}
}

function copyToken() {
    navigator.clipboard.writeText(document.getElementById('new-token').textContent);
    document.getElementById('copy-btn').textContent = 'Copied!';
    setTimeout(() => document.getElementById('copy-btn').textContent = 'Copy', 2000);
}

async function loadTokens() {
    if (!isAdmin) return;
    try {
        const r = await fetch(API + '/tokens', { headers: { 'Authorization': 'Bearer ' + token } });
        const d = await r.json();
        const c = document.getElementById('tokens-list');
        if (!d.tokens?.length) { c.innerHTML = '<div class="no-data">No tokens</div>'; return; }
        c.innerHTML = d.tokens.map(t => `<div class="token-item"><div class="info"><div class="name">${t.name}</div><div class="meta">ID: ${t.id} • Uses: ${t.max_uses===-1?'∞':t.current_uses+'/'+t.max_uses}</div></div><button class="del" onclick="delToken('${t.id}')">Del</button></div>`).join('');
    } catch {}
}

async function delToken(id) {
    if (!confirm('Delete?')) return;
    try {
        await fetch(API + '/tokens/delete', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        loadTokens();
    } catch {}
}

async function loadLogs() {
    if (!isAdmin) return;
    
    try {
        const r1 = await fetch(API + '/logs/login', { headers: { 'Authorization': 'Bearer ' + token } });
        const d1 = await r1.json();
        const c1 = document.getElementById('login-logs');
        c1.innerHTML = d1.logs?.length ? d1.logs.map(l => {
            const t = new Date(l.timestamp);
            return `<div class="log ${l.success?'success':'error'}"><div class="time">${t.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div><div class="msg">${l.token_type} from ${l.ip||'?'} ${l.success?'✓':'✗'}</div></div>`;
        }).join('') : '<div class="no-data">No logs</div>';
    } catch {}
    
    try {
        const r2 = await fetch(API + '/logs/bot', { headers: { 'Authorization': 'Bearer ' + token } });
        const d2 = await r2.json();
        const c2 = document.getElementById('bot-logs');
        c2.innerHTML = d2.logs?.length ? d2.logs.map(l => {
            const t = new Date(l.timestamp);
            return `<div class="log ${l.level||'info'}"><div class="time">${t.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div><div class="msg">${l.message}</div></div>`;
        }).join('') : '<div class="no-data">No logs</div>';
    } catch {}
}

// Events
document.addEventListener('DOMContentLoaded', () => {
    loader();
    
    document.getElementById('login-btn').onclick = login;
    document.getElementById('token-input').onkeypress = e => e.key === 'Enter' && login();
    document.getElementById('logout-btn').onclick = logout;
    document.getElementById('modal-x').onclick = closeModal;
    document.getElementById('modal').onclick = e => e.target.id === 'modal' && closeModal();
    
    document.getElementById('admin-login-btn').onclick = showAdminForm;
    document.getElementById('back-btn-1').onclick = backToToken;
    document.getElementById('send-code-btn').onclick = sendCode;
    document.getElementById('back-btn-2').onclick = () => {
        document.getElementById('code-form').classList.add('hidden');
        document.getElementById('admin-form').classList.remove('hidden');
    };
    document.getElementById('verify-btn').onclick = verifyCode;
    document.getElementById('code-input').onkeypress = e => e.key === 'Enter' && verifyCode();
    
    document.getElementById('create-token-btn').onclick = createToken;
    document.getElementById('copy-btn').onclick = copyToken;
    
    document.querySelectorAll('#periods button').forEach(b => {
        b.onclick = () => {
            document.querySelectorAll('#periods button').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            period = b.dataset.period;
            fetchStats();
        };
    });
    
    document.querySelectorAll('.tabs button').forEach(b => {
        b.onclick = () => {
            const p = b.parentElement;
            p.querySelectorAll('button').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            p.parentElement.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
            document.getElementById('tab-' + b.dataset.tab).classList.add('active');
        };
    });
    
    document.querySelectorAll('#nav .nav-item').forEach(n => {
        n.onclick = e => {
            e.preventDefault();
            const s = n.dataset.section;
            document.querySelectorAll('#nav .nav-item').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
            n.classList.add('active');
            document.getElementById('section-' + s).classList.add('active');
            if (s === 'admin' && isAdmin) { loadTokens(); loadLogs(); }
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('overlay').classList.remove('visible');
        };
    });
    
    document.getElementById('menu-btn').onclick = () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('overlay').classList.toggle('visible');
    };
    document.getElementById('overlay').onclick = () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('visible');
    };
    
    setInterval(() => token && fetchStats(), 30000);
});
