const API = 'https://api.dotinfo.com.ru/api';
let period = 'week', token = null, isAdmin = false, data = null, allOrders = [], reviewerIds = new Set();
let filterPay = 'all', filterCur = 'all';

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
                document.getElementById('loader').classList.add('hide');
                checkAuth();
            }, 300);
        }
    }, 400);
}

// Auth
function checkAuth() {
    const saved = localStorage.getItem('dotshop_token');
    if (saved) { token = saved; verify(); }
    else showLogin();
}

function showLogin() { document.getElementById('login').classList.add('show'); }

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
            showDash();
        } else {
            localStorage.removeItem('dotshop_token');
            showLogin();
        }
    } catch { showLogin(); }
}

async function login() {
    const t = document.getElementById('inp-token').value.trim();
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
            document.getElementById('login').classList.remove('show');
            showDash();
        } else err(d.error || 'Invalid token');
    } catch { err('Connection error'); }
}

function logout() {
    localStorage.removeItem('dotshop_token');
    token = null;
    isAdmin = false;
    const dash = document.getElementById('dash');
    dash.classList.remove('show', 'admin');
    document.querySelectorAll('.admin-nav').forEach(e => e.classList.add('hide'));
    showLogin();
}

function showDash() {
    const dash = document.getElementById('dash');
    dash.classList.add('show');
    
    // ONLY show admin nav and red theme if isAdmin is true
    if (isAdmin === true) {
        dash.classList.add('admin');
        document.querySelectorAll('.admin-nav').forEach(e => e.classList.remove('hide'));
    } else {
        dash.classList.remove('admin');
        document.querySelectorAll('.admin-nav').forEach(e => e.classList.add('hide'));
    }
    
    fetchStats();
    fetchReviews();
}

function err(msg) {
    const e = document.getElementById('error');
    e.textContent = msg;
    setTimeout(() => e.textContent = '', 3000);
}

// Admin login
function showAdminForm() {
    document.getElementById('form-token').classList.add('hide');
    document.getElementById('form-pass').classList.remove('hide');
}

function backToToken() {
    document.getElementById('form-pass').classList.add('hide');
    document.getElementById('form-code').classList.add('hide');
    document.getElementById('form-token').classList.remove('hide');
}

async function sendCode() {
    const pw = document.getElementById('inp-pass').value.trim();
    if (!pw) return err('Enter password');
    
    try {
        const r = await fetch(API + '/admin/request-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('form-pass').classList.add('hide');
            document.getElementById('form-code').classList.remove('hide');
        } else err(d.error || 'Error');
    } catch { err('Connection error'); }
}

async function verifyCode() {
    const code = document.getElementById('inp-code').value.trim();
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
            document.getElementById('login').classList.remove('show');
            showDash();
        } else err(d.error || 'Invalid code');
    } catch { err('Connection error'); }
}

// Connection status
function setConn(s) {
    const el = document.getElementById('conn');
    el.className = 'conn ' + s;
    el.querySelector('.txt').textContent = s === 'on' ? 'Connected' : s === 'wait' ? 'Connecting...' : 'Offline';
}

// Fetch data
async function fetchStats() {
    if (!token) return;
    setConn('wait');
    
    try {
        const r = await fetch(API + '/stats?period=' + period, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!r.ok) throw 0;
        data = await r.json();
        allOrders = data.recent_orders || [];
        setConn('on');
        document.getElementById('upd').textContent = 'Updated: ' + new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
        
        // Update payment filter options
        updatePaymentFilter(data.payment_methods || {});
        
        render();
    } catch { setConn(''); }
}

async function fetchReviews() {
    if (!token) return;
    
    try {
        const r = await fetch(API + '/reviews', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const d = await r.json();
        
        // Store reviewer IDs for badge display
        if (d.reviewer_ids) {
            reviewerIds = new Set(d.reviewer_ids);
        }
        
        renderReviews(d);
    } catch {}
}

// Update payment filter dropdown
function updatePaymentFilter(methods) {
    const sel = document.getElementById('filter-pay');
    const current = sel.value;
    sel.innerHTML = '<option value="all">All Methods</option>';
    Object.keys(methods).sort().forEach(m => {
        sel.innerHTML += `<option value="${m}">${m}</option>`;
    });
    sel.value = current;
}

// Apply filters
function getFilteredOrders() {
    return allOrders.filter(o => {
        // Payment filter
        if (filterPay !== 'all') {
            const pm = (o.payment_method || '').toLowerCase();
            if (pm !== filterPay.toLowerCase()) return false;
        }
        
        // Currency filter
        if (filterCur !== 'all') {
            const cost = o.total_cost || 0;
            // Estimate currency by amount
            if (filterCur === 'eur' && cost > 500) return false; // RUB amounts are usually larger
            if (filterCur === 'rub' && cost < 100) return false;
            if (filterCur === 'usd' && (cost > 500 || cost < 1)) return false;
        }
        
        return true;
    });
}

// Render
function render() {
    if (!data) return;
    
    const filtered = getFilteredOrders();
    const totalFiltered = filtered.length;
    
    // Calculate filtered revenue
    let filteredRevenue = filtered.reduce((sum, o) => sum + (o.total_cost || 0), 0);
    
    document.getElementById('s-orders').textContent = totalFiltered;
    document.getElementById('s-reviews').textContent = data.total_reviews || 0;
    document.getElementById('s-buyers').textContent = data.unique_buyers || 0;
    document.getElementById('s-revenue').textContent = '€' + filteredRevenue.toFixed(2);
    
    document.getElementById('c-eur').textContent = '€' + (data.revenue_eur || 0).toFixed(2);
    document.getElementById('c-usd').textContent = '$' + (data.revenue_usd || 0).toFixed(2);
    document.getElementById('c-rub').textContent = '₽' + Math.round(data.revenue_rub || 0).toLocaleString();
    
    renderPayments(data.payment_methods || {});
    renderProducts(data.top_products || []);
    renderBuyers(data.top_buyers || []);
    renderOrders(filtered);
}

function renderPayments(m) {
    const c = document.getElementById('t-payments');
    const total = Object.values(m).reduce((a,b) => a+b, 0);
    if (!total) { c.innerHTML = '<div class="no-data">No data</div>'; return; }
    
    const colors = {Crypto:'#fbbf24',Card:'#818cf8',PayPal:'#3b82f6',SOL:'#fbbf24',BTC:'#f7931a','RU-Card':'#818cf8',Stripe:'#818cf8'};
    c.innerHTML = Object.entries(m).sort((a,b) => b[1]-a[1]).map(([n,v]) => 
        `<div class="item"><span class="name">${n}</span><div class="bar"><div class="bar-fill" style="width:${v/total*100}%;background:${colors[n]||'#6b7280'}"></div></div><span class="val">${v}</span></div>`
    ).join('');
}

function renderProducts(p) {
    const c = document.getElementById('t-products');
    if (!p.length) { c.innerHTML = '<div class="no-data">No data</div>'; return; }
    c.innerHTML = p.map((x,i) => `<div class="item"><span class="rank ${i<3?['g','s','b'][i]:''}">${i+1}</span><span class="name">${x.name}</span><span class="val">${x.sold} • €${x.revenue.toFixed(2)}</span></div>`).join('');
}

function renderBuyers(b) {
    const c = document.getElementById('t-buyers');
    if (!b.length) { c.innerHTML = '<div class="no-data">No data</div>'; return; }
    c.innerHTML = b.map((x,i) => {
        const hasReview = reviewerIds.has(String(x.id));
        return `<div class="item"><span class="rank ${i<3?['g','s','b'][i]:''}">${i+1}</span><span class="name ${hasReview?'reviewer':''}">${x.name}</span><span class="val">${x.orders} • €${x.spent.toFixed(2)}</span></div>`;
    }).join('');
}

function renderOrders(orders) {
    const t = document.getElementById('o-body');
    document.getElementById('o-badge').textContent = orders.length;
    if (!orders.length) { t.innerHTML = '<tr><td colspan="7" class="no-data">No orders</td></tr>'; return; }
    
    t.innerHTML = orders.map((x,i) => {
        const d = new Date(x.timestamp);
        const ds = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
        const m = (x.payment_method||'Other').toLowerCase().replace(/[^a-z]/g,'');
        const hasReview = reviewerIds.has(String(x.buyer_id));
        const buyerClass = hasReview ? 'reviewer' : '';
        return `<tr><td>#${i+1}</td><td><span class="${buyerClass}">${x.buyer_name||'?'}</span></td><td class="hm">${x.items_short||'-'}</td><td><span class="pay ${m}">${x.payment_method||'?'}</span></td><td>€${(x.total_cost||0).toFixed(2)}</td><td class="hm">${ds}</td><td><button class="vbtn" onclick="showOrder(${i})">View</button></td></tr>`;
    }).join('');
}

function renderReviews(d) {
    document.getElementById('r-total').textContent = d.total_reviews || 0;
    document.getElementById('r-avg').textContent = d.average_rating || '5.0';
    
    const list = document.getElementById('r-list');
    if (!d.reviews || !d.reviews.length) {
        list.innerHTML = '<div class="no-data">No reviews yet</div>';
        return;
    }
    
    list.innerHTML = d.reviews.map(r => {
        const date = new Date(r.timestamp);
        const dateStr = date.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
        const avatar = r.avatar ? `<img src="${r.avatar}" alt="">` : r.author[0];
        const images = r.attachments?.length ? `<div class="r-imgs">${r.attachments.map(a => `<img src="${a}" onclick="window.open('${a}')">`).join('')}</div>` : '';
        
        return `<div class="r-card">
            <div class="r-head">
                <div class="r-ava">${avatar}</div>
                <div><div class="r-author">${r.author}</div><div class="r-date">${dateStr}</div></div>
            </div>
            <div class="r-stars">${'⭐'.repeat(r.stars || 5)}</div>
            <div class="r-text">${r.content}</div>
            ${images}
        </div>`;
    }).join('');
}

// Modal
function showOrder(i) {
    const orders = getFilteredOrders();
    if (!orders[i]) return;
    const o = orders[i];
    const d = new Date(o.timestamp);
    const ds = d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    
    let items = '';
    if (o.items_full?.length) {
        items = o.items_full.map(x => `<div class="m-item"><span>${x.name||'?'}</span><span>x${x.qty||1} • €${((x.price||0)*(x.qty||1)).toFixed(2)}</span></div>`).join('');
    }
    
    const hasReview = reviewerIds.has(String(o.buyer_id));
    const reviewBadge = hasReview ? ' ⭐' : '';
    
    document.getElementById('modal-body').innerHTML = `
        <h2 class="m-title">Order #${i+1}</h2>
        <div class="m-row"><span>Buyer</span><span>${o.buyer_name||'?'}${reviewBadge}</span></div>
        <div class="m-row"><span>Nickname</span><span>${o.nickname||'N/A'}</span></div>
        <div class="m-row"><span>Coordinates</span><span>${o.coordinates||'N/A'}</span></div>
        <div class="m-row"><span>Payment</span><span>${o.payment_method||'N/A'}</span></div>
        <div class="m-row"><span>Delivery</span><span>${o.delivery_speed||'Default'}</span></div>
        <div class="m-row"><span>Delivered by</span><span>${o.delivery_person||'N/A'}</span></div>
        <div class="m-row"><span>Date</span><span>${ds}</span></div>
        <div class="m-row"><span>Total</span><span style="color:#ffb070;font-weight:700">€${(o.total_cost||0).toFixed(2)}</span></div>
        <div class="m-items"><h4>Items</h4>${items||'<div class="no-data">No items</div>'}</div>`;
    document.getElementById('modal').classList.add('show');
}

function closeModal() { document.getElementById('modal').classList.remove('show'); }

// Admin functions
async function createToken() {
    const name = document.getElementById('tk-name').value.trim() || 'Token';
    const uses = parseInt(document.getElementById('tk-uses').value) || -1;
    
    try {
        const r = await fetch(API + '/tokens/create', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, max_uses: uses })
        });
        const d = await r.json();
        if (d.success) {
            document.getElementById('tk-new').textContent = d.token;
            document.getElementById('tk-done').classList.remove('hide');
            loadTokens();
        }
    } catch {}
}

function copyToken() {
    navigator.clipboard.writeText(document.getElementById('tk-new').textContent);
    document.getElementById('tk-copy').textContent = 'Copied!';
    setTimeout(() => document.getElementById('tk-copy').textContent = 'Copy', 2000);
}

async function loadTokens() {
    if (!isAdmin) return;
    try {
        const r = await fetch(API + '/tokens', { headers: { 'Authorization': 'Bearer ' + token } });
        const d = await r.json();
        const c = document.getElementById('tk-list');
        if (!d.tokens?.length) { c.innerHTML = '<div class="no-data">No tokens</div>'; return; }
        c.innerHTML = d.tokens.map(t => `<div class="tk-item"><div class="info"><div class="name">${t.name}</div><div class="meta">ID: ${t.id} • Uses: ${t.max_uses===-1?'∞':t.current_uses+'/'+t.max_uses}</div></div><button class="del" onclick="delToken('${t.id}')">Del</button></div>`).join('');
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
        document.getElementById('log-login').innerHTML = d1.logs?.length ? d1.logs.map(l => {
            const t = new Date(l.timestamp);
            return `<div class="log ${l.success?'success':'error'}"><div class="time">${t.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div><div class="msg">${l.token_type} from ${l.ip||'?'} ${l.success?'✓':'✗'}</div></div>`;
        }).join('') : '<div class="no-data">No logs</div>';
    } catch {}
    
    try {
        const r2 = await fetch(API + '/logs/bot', { headers: { 'Authorization': 'Bearer ' + token } });
        const d2 = await r2.json();
        document.getElementById('log-bot').innerHTML = d2.logs?.length ? d2.logs.map(l => {
            const t = new Date(l.timestamp);
            return `<div class="log ${l.level||'info'}"><div class="time">${t.toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div><div class="msg">${l.message}</div></div>`;
        }).join('') : '<div class="no-data">No logs</div>';
    } catch {}
}

// Events
document.addEventListener('DOMContentLoaded', () => {
    loader();
    
    document.getElementById('btn-login').onclick = login;
    document.getElementById('inp-token').onkeypress = e => e.key === 'Enter' && login();
    document.getElementById('logout').onclick = logout;
    document.getElementById('modal-x').onclick = closeModal;
    document.getElementById('modal').onclick = e => e.target.id === 'modal' && closeModal();
    
    document.getElementById('btn-admin').onclick = showAdminForm;
    document.getElementById('btn-back1').onclick = backToToken;
    document.getElementById('btn-send').onclick = sendCode;
    document.getElementById('btn-back2').onclick = () => {
        document.getElementById('form-code').classList.add('hide');
        document.getElementById('form-pass').classList.remove('hide');
    };
    document.getElementById('btn-verify').onclick = verifyCode;
    document.getElementById('inp-code').onkeypress = e => e.key === 'Enter' && verifyCode();
    
    document.getElementById('tk-create').onclick = createToken;
    document.getElementById('tk-copy').onclick = copyToken;
    
    // Period buttons
    document.querySelectorAll('#periods button').forEach(b => {
        b.onclick = () => {
            document.querySelectorAll('#periods button').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            period = b.dataset.p;
            fetchStats();
        };
    });
    
    // Filters
    document.getElementById('filter-pay').onchange = e => {
        filterPay = e.target.value;
        render();
    };
    document.getElementById('filter-cur').onchange = e => {
        filterCur = e.target.value;
        render();
    };
    document.getElementById('filter-reset').onclick = () => {
        filterPay = 'all';
        filterCur = 'all';
        document.getElementById('filter-pay').value = 'all';
        document.getElementById('filter-cur').value = 'all';
        render();
    };
    
    // Tabs
    document.querySelectorAll('.tabs button').forEach(b => {
        b.onclick = () => {
            const p = b.parentElement;
            p.querySelectorAll('button').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            p.parentElement.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
            document.getElementById('t-' + b.dataset.t).classList.add('active');
        };
    });
    
    // Navigation
    document.querySelectorAll('#nav .nav').forEach(n => {
        n.onclick = e => {
            e.preventDefault();
            const s = n.dataset.s;
            
            // Don't allow access to admin section if not admin
            if (s === 'admin' && !isAdmin) return;
            
            document.querySelectorAll('#nav .nav').forEach(x => x.classList.remove('active'));
            document.querySelectorAll('.sec').forEach(x => x.classList.remove('active'));
            n.classList.add('active');
            document.getElementById('sec-' + s).classList.add('active');
            if (s === 'admin' && isAdmin) { loadTokens(); loadLogs(); }
            document.getElementById('side').classList.remove('open');
            document.getElementById('overlay').classList.remove('show');
        };
    });
    
    // Mobile menu
    document.getElementById('menu-btn').onclick = () => {
        document.getElementById('side').classList.toggle('open');
        document.getElementById('overlay').classList.toggle('show');
    };
    document.getElementById('overlay').onclick = () => {
        document.getElementById('side').classList.remove('open');
        document.getElementById('overlay').classList.remove('show');
    };
    
    // Auto refresh
    setInterval(() => token && fetchStats(), 30000);
});
