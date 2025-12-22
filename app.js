var API_URL = 'https://api.dotinfo.com.ru/api';
var ACCESS_TOKEN = 'jsdc&fg12@dot312shop*&^654analitics';

var currentPeriod = 'week';
var isAuthenticated = false;
var currentData = null;

// ==================== LOADER ====================
function runLoader() {
    var status = document.getElementById('loader-status');
    var steps = [
        'Initializing...',
        'Connecting to server...',
        'Loading data...',
        'Almost ready...',
        'Welcome!'
    ];
    
    var i = 0;
    var interval = setInterval(function() {
        if (i < steps.length) {
            status.textContent = steps[i];
            i++;
        } else {
            clearInterval(interval);
            setTimeout(function() {
                document.getElementById('loader-screen').classList.add('hidden');
                checkAuth();
            }, 300);
        }
    }, 500);
}

// ==================== AUTH ====================
function checkAuth() {
    var saved = localStorage.getItem('dotshop_token');
    if (saved === ACCESS_TOKEN) {
        showDashboard();
    } else {
        document.getElementById('login-screen').classList.add('visible');
    }
}

function login() {
    var input = document.getElementById('token-input');
    var error = document.getElementById('login-error');
    var token = input.value.trim();
    
    if (token === ACCESS_TOKEN) {
        localStorage.setItem('dotshop_token', token);
        document.getElementById('login-screen').classList.remove('visible');
        showDashboard();
    } else {
        error.textContent = 'Invalid access token';
        input.style.borderColor = '#ef4444';
        setTimeout(function() {
            error.textContent = '';
            input.style.borderColor = '';
        }, 3000);
    }
}

function logout() {
    localStorage.removeItem('dotshop_token');
    document.getElementById('dashboard').classList.remove('visible');
    document.getElementById('login-screen').classList.add('visible');
    document.getElementById('token-input').value = '';
    isAuthenticated = false;
}

function showDashboard() {
    document.getElementById('dashboard').classList.add('visible');
    isAuthenticated = true;
    fetchStats();
}

// ==================== CONNECTION ====================
function setConnectionStatus(status) {
    var el = document.getElementById('connection-status');
    var dot = el.querySelector('.status-dot');
    var text = el.querySelector('span');
    
    dot.className = 'status-dot ' + status;
    if (status === 'online') {
        text.textContent = 'Connected';
    } else if (status === 'connecting') {
        text.textContent = 'Connecting...';
    } else {
        text.textContent = 'Offline';
    }
}

function updateLastUpdate() {
    var now = new Date();
    var time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('last-update').textContent = 'Updated: ' + time;
}

// ==================== FETCH DATA ====================
async function fetchStats() {
    if (!isAuthenticated) return;
    
    setConnectionStatus('connecting');
    
    try {
        var response = await fetch(API_URL + '/stats?period=' + currentPeriod, {
            headers: { 'Authorization': 'Bearer ' + ACCESS_TOKEN }
        });
        
        if (!response.ok) throw new Error('API error');
        
        var data = await response.json();
        currentData = data;
        setConnectionStatus('online');
        updateLastUpdate();
        renderStats(data);
    } catch (error) {
        console.error('Fetch error:', error);
        setConnectionStatus('offline');
    }
}

// ==================== RENDER ====================
function renderStats(data) {
    document.getElementById('total-orders').textContent = data.total_orders || 0;
    document.getElementById('total-reviews').textContent = data.total_reviews || 0;
    document.getElementById('unique-buyers').textContent = data.unique_buyers || 0;
    document.getElementById('total-revenue').textContent = '€' + (data.revenue_eur || 0).toFixed(2);
    
    document.getElementById('revenue-eur').textContent = '€' + (data.revenue_eur || 0).toFixed(2);
    document.getElementById('revenue-usd').textContent = '$' + (data.revenue_usd || 0).toFixed(2);
    document.getElementById('revenue-rub').textContent = '₽' + Math.round(data.revenue_rub || 0).toLocaleString();
    
    document.getElementById('reviews-total').textContent = data.total_reviews || 0;
    
    renderPaymentMethods(data.payment_methods || {});
    renderTopProducts(data.top_products || []);
    renderTopBuyers(data.top_buyers || []);
    renderOrdersTable(data.recent_orders || []);
}

function renderPaymentMethods(methods) {
    var container = document.getElementById('payment-methods');
    container.innerHTML = '';
    
    var colors = {
        'Crypto': '#fbbf24',
        'Card': '#818cf8',
        'PayPal': '#3b82f6',
        'Stripe': '#818cf8',
        'Manual': '#22c55e',
        'Bank': '#3b82f6',
        'SOL': '#fbbf24',
        'BTC': '#f7931a',
        'RU-Card': '#818cf8'
    };
    
    var total = Object.values(methods).reduce(function(a, b) { return a + b; }, 0);
    
    if (total === 0) {
        container.innerHTML = '<div class="no-data">No data for this period</div>';
        return;
    }
    
    var sorted = Object.entries(methods).sort(function(a, b) { return b[1] - a[1]; });
    
    sorted.forEach(function(item) {
        var method = item[0];
        var count = item[1];
        var percent = (count / total) * 100;
        var color = colors[method] || '#6b7280';
        
        var div = document.createElement('div');
        div.className = 'payment-method';
        div.innerHTML = 
            '<span class="payment-method-name">' + method + '</span>' +
            '<div class="payment-method-bar"><div class="payment-method-fill" style="width:' + percent + '%;background:' + color + '"></div></div>' +
            '<span class="payment-method-count">' + count + '</span>';
        container.appendChild(div);
    });
}

function renderTopProducts(products) {
    var container = document.getElementById('top-products');
    container.innerHTML = '';
    
    if (!products || products.length === 0) {
        container.innerHTML = '<div class="no-data">No data for this period</div>';
        return;
    }
    
    products.forEach(function(product, idx) {
        var rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
        var div = document.createElement('div');
        div.className = 'top-item';
        div.innerHTML = 
            '<div class="top-item-rank ' + rankClass + '">' + (idx + 1) + '</div>' +
            '<div class="top-item-name">' + product.name + '</div>' +
            '<div class="top-item-value">' + product.sold + ' sold • €' + product.revenue.toFixed(2) + '</div>';
        container.appendChild(div);
    });
}

function renderTopBuyers(buyers) {
    var container = document.getElementById('top-buyers');
    container.innerHTML = '';
    
    if (!buyers || buyers.length === 0) {
        container.innerHTML = '<div class="no-data">No data for this period</div>';
        return;
    }
    
    buyers.forEach(function(buyer, idx) {
        var rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
        var div = document.createElement('div');
        div.className = 'top-item';
        div.innerHTML = 
            '<div class="top-item-rank ' + rankClass + '">' + (idx + 1) + '</div>' +
            '<div class="top-item-name">' + buyer.name + '</div>' +
            '<div class="top-item-value">' + buyer.orders + ' orders • €' + buyer.spent.toFixed(2) + '</div>';
        container.appendChild(div);
    });
}

function renderOrdersTable(orders) {
    var tbody = document.getElementById('orders-table');
    var badge = document.getElementById('orders-count');
    
    badge.textContent = orders.length + ' orders';
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No orders for this period</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    orders.forEach(function(order, idx) {
        var date = new Date(order.timestamp);
        var dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + 
                      date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        var method = order.payment_method || 'Other';
        var methodClass = method.toLowerCase().replace(/[^a-z]/g, '');
        
        var itemsShort = order.items_short || '-';
        var totalCost = typeof order.total_cost === 'number' ? order.total_cost.toFixed(2) : '0.00';
        
        var row = document.createElement('tr');
        row.innerHTML = 
            '<td>#' + (idx + 1) + '</td>' +
            '<td>' + (order.buyer_name || 'Unknown') + '</td>' +
            '<td class="hide-mobile">' + itemsShort + '</td>' +
            '<td><span class="payment-badge ' + methodClass + '">' + method + '</span></td>' +
            '<td>€' + totalCost + '</td>' +
            '<td class="hide-mobile">' + dateStr + '</td>' +
            '<td><button class="view-btn" data-idx="' + idx + '">View</button></td>';
        tbody.appendChild(row);
    });
    
    tbody.querySelectorAll('.view-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var idx = parseInt(this.getAttribute('data-idx'));
            showOrderModal(idx);
        });
    });
}

// ==================== MODAL ====================
function showOrderModal(idx) {
    if (!currentData || !currentData.recent_orders || !currentData.recent_orders[idx]) {
        console.error('Order not found');
        return;
    }
    
    var order = currentData.recent_orders[idx];
    var date = new Date(order.timestamp);
    var dateStr = date.toLocaleString('en-GB', { 
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit' 
    });
    
    var itemsHtml = '';
    if (order.items_full && order.items_full.length > 0) {
        order.items_full.forEach(function(item) {
            var itemTotal = (item.price || 0) * (item.qty || 1);
            itemsHtml += '<div class="modal-item">' +
                '<span class="modal-item-name">' + (item.name || 'Unknown') + '</span>' +
                '<span class="modal-item-qty">x' + (item.qty || 1) + ' • €' + itemTotal.toFixed(2) + '</span>' +
                '</div>';
        });
    } else {
        itemsHtml = '<div class="no-data">No items data</div>';
    }
    
    var totalCost = typeof order.total_cost === 'number' ? order.total_cost.toFixed(2) : '0.00';
    
    var html = '<h2 class="modal-title">Order #' + (idx + 1) + '</h2>' +
        '<div class="modal-row"><span class="modal-label">Buyer</span><span class="modal-value">' + (order.buyer_name || 'Unknown') + '</span></div>' +
        '<div class="modal-row"><span class="modal-label">Nickname</span><span class="modal-value">' + (order.nickname || 'N/A') + '</span></div>' +
        '<div class="modal-row"><span class="modal-label">Coordinates</span><span class="modal-value">' + (order.coordinates || 'N/A') + '</span></div>' +
        '<div class="modal-row"><span class="modal-label">Payment</span><span class="modal-value">' + (order.payment_method || 'N/A') + '</span></div>' +
        '<div class="modal-row"><span class="modal-label">Delivery Speed</span><span class="modal-value">' + (order.delivery_speed || 'Default') + '</span></div>' +
        '<div class="modal-row"><span class="modal-label">Delivered by</span><span class="modal-value">' + (order.delivery_person || 'N/A') + '</span></div>' +
        '<div class="modal-row"><span class="modal-label">Date</span><span class="modal-value">' + dateStr + '</span></div>' +
        '<div class="modal-row"><span class="modal-label">Total</span><span class="modal-value" style="color:#ffb070;font-weight:700">€' + totalCost + '</span></div>' +
        '<div class="modal-items"><h4>Items</h4>' + itemsHtml + '</div>';
    
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('order-modal').classList.add('visible');
}

function closeModal() {
    document.getElementById('order-modal').classList.remove('visible');
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', function() {
    runLoader();
    
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('token-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('order-modal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    
    document.querySelectorAll('.period-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.period-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            currentPeriod = this.dataset.period;
            fetchStats();
        });
    });
    
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tab = this.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('tab-' + tab).classList.add('active');
        });
    });
    
    document.querySelectorAll('.nav-item[data-section]').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var section = this.dataset.section;
            document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
            document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
            this.classList.add('active');
            document.getElementById('section-' + section).classList.add('active');
            
            var sidebar = document.getElementById('sidebar');
            var overlay = document.getElementById('overlay');
            if (sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                overlay.classList.remove('visible');
            }
        });
    });
    
    document.getElementById('mobile-menu-btn').addEventListener('click', function() {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('overlay');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
    });
    
    document.getElementById('overlay').addEventListener('click', function() {
        document.getElementById('sidebar').classList.remove('open');
        this.classList.remove('visible');
    });
    
    setInterval(function() {
        if (isAuthenticated) fetchStats();
    }, 30000);
});
