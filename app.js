var API_URL = 'https://147.45.229.179/api';
var ACCESS_TOKEN = 'jsdc&fg12@dot312shop*&^654analitics';

var currentPeriod = 'week';
var isAuthenticated = false;

function checkAuth() {
    var saved = localStorage.getItem('dotshop_token');
    if (saved === ACCESS_TOKEN) {
        showDashboard();
    }
}

function login() {
    var input = document.getElementById('token-input');
    var error = document.getElementById('login-error');
    var token = input.value.trim();
    
    if (token === ACCESS_TOKEN) {
        localStorage.setItem('dotshop_token', token);
        showDashboard();
    } else {
        error.textContent = 'Invalid token';
        input.classList.add('error');
        setTimeout(function() {
            error.textContent = '';
            input.classList.remove('error');
        }, 3000);
    }
}

function logout() {
    localStorage.removeItem('dotshop_token');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard').classList.remove('visible');
    document.getElementById('token-input').value = '';
    isAuthenticated = false;
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.add('visible');
    isAuthenticated = true;
    fetchStats();
}

function setConnectionStatus(status) {
    var el = document.getElementById('connection-status');
    var dot = el.querySelector('.status-dot');
    var text = el.querySelector('span');
    
    dot.className = 'status-dot ' + status;
    text.textContent = status === 'online' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Offline';
}

function updateLastUpdate() {
    var now = new Date();
    var time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('last-update').textContent = 'Updated: ' + time;
}

async function fetchStats() {
    if (!isAuthenticated) return;
    
    setConnectionStatus('connecting');
    
    try {
        var response = await fetch(API_URL + '/stats?period=' + currentPeriod, {
            headers: { 'Authorization': 'Bearer ' + ACCESS_TOKEN }
        });
        
        if (!response.ok) throw new Error('API error');
        
        var data = await response.json();
        setConnectionStatus('online');
        updateLastUpdate();
        renderStats(data);
    } catch (error) {
        setConnectionStatus('offline');
    }
}

function renderStats(data) {
    document.getElementById('total-orders').textContent = data.total_orders || 0;
    document.getElementById('total-reviews').textContent = data.total_reviews || 0;
    document.getElementById('unique-buyers').textContent = data.unique_buyers || 0;
    document.getElementById('total-revenue').textContent = '€' + (data.revenue_eur || 0).toFixed(2);
    
    document.getElementById('revenue-eur').textContent = '€' + (data.revenue_eur || 0).toFixed(2);
    document.getElementById('revenue-usd').textContent = '$' + (data.revenue_usd || 0).toFixed(2);
    document.getElementById('revenue-rub').textContent = '₽' + (data.revenue_rub || 0).toFixed(2);
    
    renderPaymentMethods(data.payment_methods || {});
    renderOrdersTable(data.recent_orders || []);
}

function renderPaymentMethods(methods) {
    var container = document.getElementById('payment-methods');
    container.innerHTML = '';
    
    var colors = {
        'Crypto': '#fbbf24',
        'Card': '#818cf8',
        'Manual': '#22c55e',
        'Bank': '#3b82f6',
        'Other': '#6b7280'
    };
    
    var total = Object.values(methods).reduce(function(a, b) { return a + b; }, 0);
    
    if (total === 0) {
        container.innerHTML = '<div class="no-data">No data</div>';
        return;
    }
    
    Object.entries(methods).sort(function(a, b) { return b[1] - a[1]; }).forEach(function(item) {
        var method = item[0];
        var count = item[1];
        var percent = (count / total) * 100;
        var color = colors[method] || colors['Other'];
        
        var div = document.createElement('div');
        div.className = 'payment-method';
        div.innerHTML = 
            '<span class="payment-method-name">' + method + '</span>' +
            '<div class="payment-method-bar"><div class="payment-method-fill" style="width:' + percent + '%;background:' + color + '"></div></div>' +
            '<span class="payment-method-count">' + count + '</span>';
        container.appendChild(div);
    });
}

function renderOrdersTable(orders) {
    var tbody = document.getElementById('orders-table');
    var badge = document.getElementById('orders-count');
    
    badge.textContent = orders.length + ' orders';
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No orders</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    orders.slice(0, 15).forEach(function(order) {
        var date = new Date(order.timestamp);
        var dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        
        var items = order.items || '-';
        if (items.length > 25) items = items.substring(0, 25) + '...';
        
        var method = order.payment_method || 'Other';
        
        var tr = document.createElement('tr');
        tr.innerHTML = 
            '<td>#' + (order.ticket_number || '-') + '</td>' +
            '<td>' + (order.buyer_name || '-') + '</td>' +
            '<td class="hide-mobile">' + items + '</td>' +
            '<td><span class="payment-badge ' + method.toLowerCase() + '">' + method + '</span></td>' +
            '<td>€' + (order.total_cost || 0).toFixed(2) + '</td>' +
            '<td class="hide-mobile">' + dateStr + '</td>';
        tbody.appendChild(tr);
    });
}

document.getElementById('login-btn').addEventListener('click', login);
document.getElementById('token-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') login();
});
document.getElementById('logout-btn').addEventListener('click', logout);

document.querySelectorAll('.period-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.period-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        currentPeriod = this.dataset.period;
        fetchStats();
    });
});

document.getElementById('mobile-menu-btn').addEventListener('click', function() {
    var sidebar = document.querySelector('.sidebar');
    var overlay = document.querySelector('.overlay') || createOverlay();
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
});

function createOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function() {
        document.querySelector('.sidebar').classList.remove('open');
        overlay.classList.remove('visible');
    });
    return overlay;
}

checkAuth();
setInterval(fetchStats, 10000);
