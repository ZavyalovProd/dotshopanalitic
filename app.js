var API_URL = 'http://YOUR_SERVER_IP:5000/api';

var currentPeriod = 'week';
var isConnected = false;

var EUR_TO_USD = 1.08;

function setConnectionStatus(status) {
    var statusEl = document.getElementById('connection-status');
    var dot = statusEl.querySelector('.status-dot');
    var text = statusEl.querySelector('span');
    
    dot.className = 'status-dot ' + status;
    
    if (status === 'online') {
        text.textContent = 'Connected';
        isConnected = true;
    } else if (status === 'connecting') {
        text.textContent = 'Connecting...';
    } else {
        text.textContent = 'Offline';
        isConnected = false;
    }
}

function updateLastUpdate() {
    var now = new Date();
    var time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('last-update').textContent = 'Last update: ' + time;
}

async function fetchStats() {
    setConnectionStatus('connecting');
    
    try {
        var response = await fetch(API_URL + '/stats?period=' + currentPeriod);
        
        if (!response.ok) throw new Error('API error');
        
        var data = await response.json();
        
        setConnectionStatus('online');
        updateLastUpdate();
        renderStats(data);
        
    } catch (error) {
        console.error('Fetch error:', error);
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
    
    var total = 0;
    for (var m in methods) {
        total += methods[m];
    }
    
    if (total === 0) {
        container.innerHTML = '<div class="no-data">No payment data</div>';
        return;
    }
    
    var sorted = Object.entries(methods).sort(function(a, b) { return b[1] - a[1]; });
    
    sorted.forEach(function(item) {
        var method = item[0];
        var count = item[1];
        var percent = (count / total) * 100;
        var color = colors[method] || colors['Other'];
        
        var div = document.createElement('div');
        div.className = 'payment-method';
        div.innerHTML = 
            '<span class="payment-method-name">' + method + '</span>' +
            '<div class="payment-method-bar">' +
                '<div class="payment-method-fill" style="width: ' + percent + '%; background: ' + color + '"></div>' +
            '</div>' +
            '<span class="payment-method-count">' + count + '</span>';
        container.appendChild(div);
    });
}

function renderOrdersTable(orders) {
    var tbody = document.getElementById('orders-table');
    var countBadge = document.getElementById('orders-count');
    
    countBadge.textContent = orders.length + ' orders';
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No orders found</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    orders.slice(0, 20).forEach(function(order) {
        var date = new Date(order.timestamp);
        var dateStr = date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        var items = order.items || '-';
        if (items.length > 30) items = items.substring(0, 30) + '...';
        
        var method = order.payment_method || 'Other';
        var methodClass = method.toLowerCase();
        
        var tr = document.createElement('tr');
        tr.innerHTML = 
            '<td>#' + (order.ticket_number || '-') + '</td>' +
            '<td>' + (order.buyer_name || '-') + '</td>' +
            '<td>' + items + '</td>' +
            '<td><span class="payment-badge ' + methodClass + '">' + method + '</span></td>' +
            '<td>€' + (order.total_cost || 0).toFixed(2) + '</td>' +
            '<td>' + dateStr + '</td>';
        tbody.appendChild(tr);
    });
}

document.querySelectorAll('.period-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.period-btn').forEach(function(b) { 
            b.classList.remove('active'); 
        });
        this.classList.add('active');
        currentPeriod = this.dataset.period;
        fetchStats();
    });
});

fetchStats();

setInterval(fetchStats, 10000);
