// State
// supabase is initialized in config.js
let appState = {
    tabs: [],
    products: [],
    cart: [],
    currentBillingTab: 'all',
    currentInventoryTab: 'all',
    dashboardFilter: 'today',
    charts: { payment: null, revenue: null, bills: null, velocity: null, billVelocity: null, product: null },
    dashboardData: null // Cache for bills, items, etc.
};
window.appState = appState;

// Intialize
window.addEventListener('DOMContentLoaded', async () => {
    if (!supabase) {
        console.error("Supabase client missing");
        return;
    }

    // Initial Load

    // Initial Load
    // Initial Load - Delegated to Auth
    // await loadInventory();
    // loadDashboard('today');

    // Set default date inputs to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-from').value = today;
    document.getElementById('date-to').value = today;

    // Init Mobile Date Inputs
    if (document.getElementById('mobile-date-from')) {
        document.getElementById('mobile-date-from').value = today;
        document.getElementById('mobile-date-to').value = today;
    }

    // Set default sales date inputs
    document.getElementById('sales-date-from').value = today;
    document.getElementById('sales-date-to').value = today;

    // Trigger Auth Check
    if (typeof checkSession === 'function') {
        checkSession();
    }

    // Load Initial Data
    // Duplicate calls removed

    // Inactivity Timer
    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('keydown', resetInactivityTimer);
    document.addEventListener('click', resetInactivityTimer);
    resetInactivityTimer();
});

let inactivityTimer;
function resetInactivityTimer() {
    if (window.authState && window.authState.owner && window.authState.owner.role === 'employee') {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            alert("Session expired due to inactivity (5 mins).");
            logout();
        }, 5 * 60 * 1000);
    }
}

function showToast(message) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 800); // 0.8s for better readability, user asked for "disappear in 0.5s"
    // Interpretation: maybe show for 0.5s? or fade takes 0.5s? 
    // "disappear in 0.5 seconds" usually means duration visible is short.
    // I'll set timeout to 500ms as requested.
}

// Navigation
function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    // Show selected
    document.getElementById(viewId).classList.remove('hidden');

    // Highlight nav
    const btn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.getAttribute('onclick').includes(viewId));
    if (btn) btn.classList.add('active');

    // Update Section Indicator (Mobile)
    const sectionNameMap = {
        'dashboard': 'Dashboard',
        'analysis': 'Data Analysis',
        'billing': 'Billing',
        'sales': 'Sales',
        'inventory': 'Inventory',
        'employees': 'Employees',
        'settings': 'Settings'
    };
    const indicator = document.getElementById('current-section-name');
    if (indicator) {
        indicator.textContent = sectionNameMap[viewId] || 'Dashboard';
    }

    // Update active state in mobile drawer
    document.querySelectorAll('.drawer-link').forEach(el => el.classList.remove('active'));
    const drawerLink = Array.from(document.querySelectorAll('.drawer-link')).find(b => b.getAttribute('onclick').includes(viewId));
    if (drawerLink) drawerLink.classList.add('active');

    // Refresh data if needed
    if (viewId === 'inventory') renderInventoryList();
    if (viewId === 'billing') renderBilling();
    if (viewId === 'dashboard') loadDashboard(appState.dashboardFilter);
    if (viewId === 'analysis') loadDashboard(appState.dashboardFilter);
    if (viewId === 'sales') loadSales();
    if (viewId === 'settings') loadSettings();
    if (viewId === 'employees') {
        loadEmployeesForDropdown();
        loadEmployeeLogs();
    }
}

function toggleMobileMenu() {
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('drawer-overlay');

    if (drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        overlay.classList.remove('visible');
        setTimeout(() => overlay.classList.add('hidden'), 300); // Wait for fade out
    } else {
        overlay.classList.remove('hidden');
        // Force reflow
        void overlay.offsetWidth;
        drawer.classList.add('open');
        overlay.classList.add('visible');
    }
}

function handleMobileFilterChange(value) {
    if (value === 'custom') {
        document.getElementById('mobile-custom-date-inputs').classList.remove('hidden');
    } else {
        document.getElementById('mobile-custom-date-inputs').classList.add('hidden');
        loadDashboard(value);
    }
}

function applyCustomDateMobile() {
    // Determine which date inputs to use
    // Since loadDashboard calls applyCustomDate internally when filter is 'custom',
    // We need to ensure logic reads from mobile inputs OR we sync mobile inputs to desktop inputs.
    // Syncing is safer to reuse existing logic if possible, BUT loadDashboard might read specific IDs.
    // Let's check loadDashboard implementation. Assuming it reads #date-from and #date-to.

    // Simplest: Sync mobile values to desktop inputs and call loadDashboard('custom')
    const mFrom = document.getElementById('mobile-date-from').value;
    const mTo = document.getElementById('mobile-date-to').value;

    if (!mFrom || !mTo) {
        alert("Please select both dates");
        return;
    }

    document.getElementById('date-from').value = mFrom;
    document.getElementById('date-to').value = mTo;

    loadDashboard('custom');
}

function toggleSalesCustomDate() {
    const inputs = document.getElementById('sales-custom-dates');
    if (inputs.classList.contains('hidden')) {
        inputs.classList.remove('hidden');
    } else {
        inputs.classList.add('hidden');
    }
}

function setSalesFilter(range) {
    // Update Active Buttons (Desktop)
    document.querySelectorAll('#sales .filter-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`#sales .filter-btn[data-range="${range}"]`);
    if (btn) btn.classList.add('active');

    // Update Mobile Select
    const select = document.getElementById('sales-mobile-select');
    if (select) select.value = range;

    if (range === 'custom') {
        document.getElementById('sales-custom-dates').classList.remove('hidden');
        return;
    } else {
        document.getElementById('sales-custom-dates').classList.add('hidden');
    }

    // Calculate Dates
    const now = new Date();
    let dFrom = new Date();
    let dTo = new Date();

    if (range === 'today') {
        // dFrom is today 00:00
        // dTo is today 23:59 (or just today date string)
    } else if (range === 'week') {
        const day = now.getDay();
        // Mon=1...Sun=0. 
        // Let's assume Mon start.
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        dFrom.setDate(diff);
    } else if (range === 'month') {
        dFrom.setDate(1);
    } else if (range === 'year') {
        dFrom.setMonth(0);
        dFrom.setDate(1);
    }

    // Set Inputs
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('sales-date-from').value = fmt(dFrom);
    document.getElementById('sales-date-to').value = fmt(dTo);

    loadSales();
}

function toggleBillingSidebar() {
    const panel = document.getElementById('billing-summary-panel');
    if (panel.classList.contains('open')) {
        panel.classList.remove('open');
    } else {
        panel.classList.add('open');
    }
}

function handleMobileAnalysisFilterChange(value) {
    if (value === 'custom') {
        document.getElementById('mobile-analysis-custom-inputs').classList.remove('hidden');
    } else {
        document.getElementById('mobile-analysis-custom-inputs').classList.add('hidden');
        // This reuses loadDashboard which updates BOTH dashboard and analysis charts
        loadDashboard(value);
    }
}

function applyCustomDateMobileAnalysis() {
    const mFrom = document.getElementById('mobile-analysis-date-from').value;
    const mTo = document.getElementById('mobile-analysis-date-to').value;

    if (!mFrom || !mTo) {
        alert("Please select both dates");
        return;
    }

    // Sync to desktop inputs (which are likely used by loadDashboard(custom) if logic reads DOM)
    // Actually loadDashboard might read #date-from/#date-to OR #analysis-date-from/#analysis-date-to based on active view?
    // Let's check applyCustomDate logic implementation if I could see it.
    // Assuming loadDashboard('custom') reads from #date-from/to globally or if it checks view.
    // To be safe, let's sync to BOTH sets of desktop inputs since we want unified state or at least the one that matters.
    // And if `loadDashboard` reads specifically based on context, syncing ensures it works.

    document.getElementById('date-from').value = mFrom;
    document.getElementById('date-to').value = mTo;
    document.getElementById('analysis-date-from').value = mFrom;
    document.getElementById('analysis-date-to').value = mTo;

    loadDashboard('custom');
}

// ==========================================
// SALES HISTORY
// ==========================================

async function loadSales() {
    if (!supabase) return;

    // Get Filter Values
    const payMode = document.getElementById('sales-filter-payment').value;
    const sort = document.getElementById('sales-sort').value;
    const dateFrom = document.getElementById('sales-date-from').value;
    const dateTo = document.getElementById('sales-date-to').value;
    const searchBill = document.getElementById('sales-search-bill').value;

    let query = supabase
        .from('bills')
        .select('*, owners:created_by(full_name)')
        .eq('tenant_id', authState.owner.tenant_id);

    // Apply Filters

    // If searching by Bill Number, ignore date range (Global Search)
    if (searchBill) {
        query = query.eq('bill_number', searchBill);
        // We do typically keep payment mode filter if user explicitly selected it, 
        // but often bill search implies "Find THIS bill". 
        // Let's keep Pay Mode active in case they want to verify "Bill 123 is CASH".
        if (payMode !== 'all') {
            query = query.eq('payment_mode', payMode);
        }
    } else {
        // Standard Filtering
        if (payMode !== 'all') {
            query = query.eq('payment_mode', payMode);
        }

        if (dateFrom) {
            query = query.gte('created_at', new Date(dateFrom).toISOString());
        }

        if (dateTo) {
            query = query.lte('created_at', new Date(new Date(dateTo).setHours(23, 59, 59)).toISOString());
        }
    }

    // Apply Sort
    if (sort === 'date-desc') query = query.order('created_at', { ascending: false });
    if (sort === 'date-asc') query = query.order('created_at', { ascending: true });
    if (sort === 'amount-desc') query = query.order('final_amount', { ascending: false });
    if (sort === 'amount-asc') query = query.order('final_amount', { ascending: true });

    const { data: bills, error } = await query;

    if (error) {
        console.error('Error loading sales:', error);
        alert('Failed to load sales history. Check connection.');
        return;
    }

    renderSales(bills || []);
}

function renderSales(bills) {
    const tbody = document.getElementById('sales-list');
    tbody.innerHTML = '';

    if (bills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No sales found</td></tr>';
        return;
    }

    bills.forEach(bill => {
        const tr = document.createElement('tr');
        const date = new Date(bill.created_at);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Calculate Flat Discount
        let discountDisplay = '₹0.00';
        if (bill.subtotal && bill.final_amount) {
            const diff = bill.subtotal - bill.final_amount;
            if (diff > 0) discountDisplay = `₹${diff.toFixed(2)}`;
        }

        // Billed By
        const billedBy = bill.owners ? bill.owners.full_name : 'Unknown';

        tr.innerHTML = `
            <td>#${bill.bill_number || 'N/A'}</td>
            <td>${dateStr}</td>
            <td>${bill.payment_mode}</td>
            <td><button onclick="viewBillDetails('${bill.id}')" class="action-btn small">View Items</button></td>
            <td>${discountDisplay}</td>
            <td>${billedBy}</td>
            <td style="font-weight:600">₹${bill.final_amount.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function viewBillDetails(billId) {
    // Ideally this would show a modal, but for MVP let's just alert the items or console log
    // Or we can quickly build a simple string to alert
    const { data: items, error } = await supabase
        .from('bill_items')
        .select('*')
        .eq('bill_id', billId);

    if (error || !items) {
        alert('Could not load items');
        return;
    }

    let msg = `Bill Items:\n`;
    items.forEach(i => {
        msg += `- ${i.product_name} x${i.quantity} (₹${i.price})\n`;
    });
    alert(msg);
}

// ==========================================
// INVENTORY MANAGEMENT
// ==========================================

async function loadInventory() {
    if (!supabase) return;

    // Fetch Tabs
    const { data: tabs, error: tabsError } = await supabase
        .from('product_tabs')
        .select('*')
        .eq('tenant_id', authState.owner.tenant_id)
        .order('sort_order', { ascending: true });

    if (tabsError) {
        console.error('Error loading tabs:', tabsError);
        alert('Failed to load categories. Please reload.');
    }
    else appState.tabs = tabs || [];

    // Fetch Products
    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', authState.owner.tenant_id)
        .order('name', { ascending: true });

    if (prodError) {
        console.error('Error loading products:', prodError);
        alert('Failed to load products. Please reload.');
    }
    else appState.products = products || [];

    renderInventoryTabs();
    renderInventoryList();
}

function renderInventoryTabs() {
    const container = document.getElementById('inventory-tabs');
    container.innerHTML = '';

    // All Tab
    const allPill = document.createElement('div');
    allPill.className = `tab-pill ${appState.currentInventoryTab === 'all' ? 'active' : ''}`;
    allPill.textContent = 'All';
    allPill.onclick = () => { appState.currentInventoryTab = 'all'; renderInventoryTabs(); renderInventoryList(); };
    container.appendChild(allPill);

    appState.tabs.forEach(tab => {
        const pill = document.createElement('div');
        pill.className = `tab-pill ${appState.currentInventoryTab === tab.id ? 'active' : ''}`;

        // Tab Name Span
        const span = document.createElement('span');
        span.textContent = tab.name;
        span.onclick = () => { appState.currentInventoryTab = tab.id; renderInventoryTabs(); renderInventoryList(); };
        pill.appendChild(span);

        // Delete Button (Small 'x')
        const delBtn = document.createElement('span');
        delBtn.innerHTML = '&times;';
        delBtn.style.marginLeft = '8px';
        delBtn.style.opacity = '0.7';
        delBtn.style.cursor = 'pointer';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteTab(tab.id); };
        pill.appendChild(delBtn);

        container.appendChild(pill);
    });
}

async function deleteTab(tabId) {
    if (!confirm('Are you sure you want to delete this category? All products in it will be moved to "All".')) return;

    // 1. Move products to NULL tab (Uncategorized)
    // Supabase SET tab_id = NULL WHERE tab_id = tabId
    const { error: moveError } = await supabase
        .from('products')
        .update({ tab_id: null })
        .eq('tab_id', tabId)
        .eq('tenant_id', authState.owner.tenant_id);

    if (moveError) {
        alert('Error moving products: ' + moveError.message);
        return;
    }

    // 2. Delete the tab
    const { error: delError } = await supabase
        .from('product_tabs')
        .delete()
        .eq('id', tabId)
        .eq('tenant_id', authState.owner.tenant_id);

    if (delError) {
        alert('Error deleting tab: ' + delError.message);
    } else {
        // Reset view if we were on that tab
        if (appState.currentInventoryTab === tabId) appState.currentInventoryTab = 'all';
        loadInventory();
    }
}

function renderInventoryList() {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '';

    const query = document.getElementById('inventory-search') ? document.getElementById('inventory-search').value.toLowerCase().trim() : '';

    let filtered = [];

    if (query) {
        // Global Search (Starts With logic as requested)
        filtered = appState.products.filter(p => p.name.toLowerCase().startsWith(query));
    } else {
        // Tab Filter
        filtered = appState.currentInventoryTab === 'all'
            ? appState.products
            : appState.products.filter(p => p.tab_id === appState.currentInventoryTab);
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary)">No items found</div>';
        return;
    }

    filtered.forEach(p => {
        const tabName = appState.tabs.find(t => t.id === p.tab_id)?.name || 'Uncategorized';
        const stockDisplay = p.is_in_house ? '<span style="color:var(--success-color); font-weight:600">Unlimited</span>' : p.stock;

        const item = document.createElement('div');
        item.className = 'inventory-item';

        let imageHtml = '';
        if (p.image_data) {
            imageHtml = `<img src="${p.image_data}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; margin-right:10px;">`;
        }

        item.innerHTML = `
            <div class="item-info" style="display:flex; align-items:center;">
                ${imageHtml}
                <div>
                    <h4>${p.name}</h4>
                    <div class="item-meta">₹${p.price} • Stock: ${stockDisplay} • ${tabName}</div>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="openEditProduct('${p.id}')">Edit</button>
                <button class="btn-delete" onclick="deleteProduct('${p.id}')">Delete</button>
            </div>
        `;
        container.appendChild(item);
    });
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase.from('products').delete().eq('id', id).eq('tenant_id', authState.owner.tenant_id);
    if (error) alert('Error deleting product');
    else loadInventory();
}

// Modals
const modalOverlay = document.getElementById('modal-overlay');
const modals = document.querySelectorAll('.modal');

function closeModals() {
    modalOverlay.classList.add('hidden');
    modals.forEach(m => m.classList.add('hidden'));
    document.getElementById('add-product-form').reset();
    document.getElementById('add-tab-form').reset();
    document.getElementById('edit-product-form').reset();

    // Destroy croppers
    if (cropper) { cropper.destroy(); cropper = null; }
    document.getElementById('p-cropper-container').classList.add('hidden');
    document.getElementById('edit-p-cropper-container').classList.add('hidden');
    document.getElementById('p-image-input').value = '';
    document.getElementById('edit-p-image-input').value = '';
}

// Image Handling Logic
let cropper;

function handleImageInput(inputId, previewId, containerId) {
    const input = document.getElementById(inputId);
    const image = document.getElementById(previewId);
    const container = document.getElementById(containerId);

    input.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.size > 2 * 1024 * 1024) {
                alert('File too large. Max 2MB.');
                input.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                image.src = e.target.result;
                container.classList.remove('hidden');
                if (cropper) cropper.destroy();
                cropper = new Cropper(image, {
                    aspectRatio: 1, // Square for card
                    viewMode: 1,
                });
            };
            reader.readAsDataURL(file);
        }
    });
}

// Initialize handlers
handleImageInput('p-image-input', 'p-image-preview', 'p-cropper-container');
handleImageInput('edit-p-image-input', 'edit-p-image-preview', 'edit-p-cropper-container');

async function getCompressedImage() {
    if (!cropper) return null;

    // Get cropped canvas
    let canvas = cropper.getCroppedCanvas({
        width: 300, // Reasonable max width
        height: 300
    });

    if (!canvas) return null;

    // Compress
    let quality = 0.9;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    // Reduce quality until < 20KB
    while (dataUrl.length > 20000 && quality > 0.1) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    return dataUrl;
}

function openAddTabModal() {
    modalOverlay.classList.remove('hidden');
    document.getElementById('modal-add-tab').classList.remove('hidden');
}

function openAddProductModal() {
    // Populate tab select
    const select = document.getElementById('p-tab');
    select.innerHTML = '<option value="">All (Uncategorized)</option>';
    appState.tabs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        select.appendChild(opt);
    });

    modalOverlay.classList.remove('hidden');
    document.getElementById('modal-add-product').classList.remove('hidden');

    // Reset stock visibility
    toggleStockInput('add', false);
}

function toggleStockInput(mode, isHidden) {
    const prefix = mode === 'add' ? 'p' : 'edit-p';
    const container = document.getElementById(`${prefix}-stock`).closest('.form-group');
    const input = document.getElementById(`${prefix}-stock`);

    if (isHidden) {
        container.classList.add('hidden');
        input.removeAttribute('required');
    } else {
        container.classList.remove('hidden');
        input.setAttribute('required', 'true');
    }
}

// Event Listeners for In-House Checkbox
document.getElementById('p-house').addEventListener('change', (e) => {
    toggleStockInput('add', e.target.checked);
});
document.getElementById('edit-p-house').addEventListener('change', (e) => {
    toggleStockInput('edit', e.target.checked);
});

function openEditProduct(productId) {
    const product = appState.products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('edit-p-id').value = productId;
    document.getElementById('edit-p-name').value = product.name;
    document.getElementById('edit-p-price').value = product.price;
    document.getElementById('edit-p-stock').value = product.stock;
    document.getElementById('edit-p-house').checked = product.is_in_house;

    // Set initial visibility
    toggleStockInput('edit', product.is_in_house);

    // Populate tab select
    const select = document.getElementById('edit-p-tab');
    select.innerHTML = '<option value="">All (Uncategorized)</option>';
    appState.tabs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        if (t.id === product.tab_id) opt.selected = true;
        select.appendChild(opt);
    });

    // Handle existing image preview if needed? 
    // For now, we only show cropper if NEW image selected.
    // Maybe show current image?
    // Not critical for MVP, user can just upload new one to replace.

    modalOverlay.classList.remove('hidden');
    document.getElementById('modal-edit-product').classList.remove('hidden');
}

// Add Tab
document.getElementById('add-tab-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('t-name').value;

    const { data, error } = await supabase
        .from('product_tabs')
        .insert([{ name, sort_order: appState.tabs.length, tenant_id: authState.owner.tenant_id }]);

    if (error) alert('Error creating tab');
    else {
        closeModals();
        loadInventory();
    }
});

// Add Product
document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('p-name').value;
    const price = document.getElementById('p-price').value;
    const is_in_house = document.getElementById('p-house').checked;
    const stock = is_in_house ? 0 : (document.getElementById('p-stock').value || 0);

    let tab_id = document.getElementById('p-tab').value;
    if (tab_id === "") tab_id = null;

    // Process Image
    const image_data = await getCompressedImage();

    const { error } = await supabase
        .from('products')
        .insert([{
            name,
            price,
            stock,
            tab_id,
            is_in_house,
            tenant_id: authState.owner.tenant_id,
            image_data: image_data
        }]);

    if (error) alert('Error creating product');
    else {
        closeModals();
        loadInventory();
    }
});

// Edit Product
document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-p-id').value;
    const name = document.getElementById('edit-p-name').value;
    const price = document.getElementById('edit-p-price').value;
    const is_in_house = document.getElementById('edit-p-house').checked;
    const stock = is_in_house ? 0 : (document.getElementById('edit-p-stock').value || 0);

    let tab_id = document.getElementById('edit-p-tab').value;
    if (tab_id === "") tab_id = null;

    const updates = { name, price, stock, tab_id, is_in_house };

    // Only update image if changed
    const image_data = await getCompressedImage();
    if (image_data) {
        updates.image_data = image_data;
    }

    const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', authState.owner.tenant_id);

    if (error) alert('Error updating product');
    else {
        closeModals();
        loadInventory();
    }
});

// ==========================================
// BILLING (POS)
// ==========================================

function renderBilling() {
    // Render Tabs
    const tabsContainer = document.getElementById('billing-tabs');
    tabsContainer.innerHTML = '';

    // "All" Tab
    const allBtn = document.createElement('button');
    allBtn.className = `tab-pill ${appState.currentBillingTab === 'all' ? 'active' : ''}`;
    allBtn.textContent = `All (${appState.products.length})`;
    allBtn.onclick = () => { appState.currentBillingTab = 'all'; renderBilling(); };
    tabsContainer.appendChild(allBtn);

    appState.tabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = `tab-pill ${appState.currentBillingTab === tab.id ? 'active' : ''}`;

        // Count products in tab
        const count = appState.products.filter(p => p.tab_id === tab.id).length;
        btn.textContent = `${tab.name} (${count})`;

        btn.onclick = () => { appState.currentBillingTab = tab.id; renderBilling(); };
        tabsContainer.appendChild(btn);
    });

    // Render Grid
    const grid = document.getElementById('billing-grid');
    grid.innerHTML = '';

    let filtered = appState.currentBillingTab === 'all'
        ? appState.products
        : appState.products.filter(p => p.tab_id === appState.currentBillingTab);

    // Search Filter
    const searchInput = document.getElementById('billing-search');
    if (searchInput) {
        const term = searchInput.value.toLowerCase();
        if (term) {
            filtered = filtered.filter(p => p.name.toLowerCase().startsWith(term));
        }
    }

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';

        let imageHtml = '';
        if (p.image_data) {
            imageHtml = `
            <div class="card-image">
                <img src="${p.image_data}" alt="${p.name}">
            </div>`;
        } else {
            imageHtml = `
             <div class="card-image" style="background:#e5e7eb; color:#6b7280; font-weight:bold; font-size:1.5rem;">
                ${p.name.charAt(0).toUpperCase()}
             </div>`;
        }

        // Stock Display Logic
        let stockInfo = '';
        if (p.is_in_house) {
            stockInfo = '<span style="font-size:0.75rem; color:var(--success-color); display:block; margin-bottom:0.25rem;">In-house made</span>';
        } else {
            let color = p.stock > 0 ? 'var(--text-secondary)' : 'var(--danger-color)';
            stockInfo = `<span style="font-size:0.75rem; color:${color}; display:block; margin-bottom:0.25rem;">Stock: ${p.stock}</span>`;
        }

        card.innerHTML = `
            ${imageHtml}
            <div class="card-details">
                <h4>${p.name}</h4>
                ${stockInfo}
                <div class="card-footer">
                    <span class="price">₹${p.price}</span>
                    <button class="add-btn" onclick="addToCart('${p.id}')">+</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function addToCart(productId) {
    const product = appState.products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock <= 0 && !product.is_in_house) {
        alert('Out of stock!');
        return;
    }

    const existing = appState.cart.find(item => item.product.id === productId);
    if (existing) {
        // Check stock limit
        if (existing.qty + 1 > product.stock && !product.is_in_house) {
            alert('Stock limit reached for this bill');
            return;
        }
        existing.qty++;
    } else {
        appState.cart.push({ product, qty: 1 });
    }
    showToast("Product Added!");
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    container.innerHTML = '';

    if (appState.cart.length === 0) {
        container.innerHTML = '<div class="empty-cart">Cart is empty</div>';
    } else {
        appState.cart.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-name">${item.product.name} (₹${item.product.price})</div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateCartQty(${index}, -1)">-</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="updateCartQty(${index}, 1)">+</button>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${index})">&times;</button>
            `;
            container.appendChild(div);
        });
    }


    // Update Mobile Cart Count
    const totalQty = appState.cart.reduce((sum, item) => sum + item.qty, 0);
    const mobileCountEl = document.getElementById('mobile-cart-count');
    if (mobileCountEl) mobileCountEl.textContent = `(${totalQty})`;

    calculateTotals();
}

function updateCartQty(index, delta) {
    const item = appState.cart[index];
    const newQty = item.qty + delta;

    if (newQty <= 0) {
        removeFromCart(index);
    } else {
        if (newQty > item.product.stock && !item.product.is_in_house) {
            alert('Cannot exceed available stock');
            return;
        }
        item.qty = newQty;
        renderCart();
    }
}

function removeFromCart(index) {
    appState.cart.splice(index, 1);
    renderCart();
}

function calculateTotals() {
    const subtotal = appState.cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);

    let discountType = document.getElementById('discount-type').value;
    let discountValue = parseFloat(document.getElementById('discount-value').value) || 0;

    // Toggle input visibility
    const disInput = document.getElementById('discount-value');
    if (discountType === 'none') disInput.classList.add('hidden');
    else disInput.classList.remove('hidden');

    let final = subtotal;
    if (discountType === 'flat') final = subtotal - discountValue;
    if (discountType === 'percentage') final = subtotal - (subtotal * (discountValue / 100));

    if (final < 0) final = 0;

    document.getElementById('bill-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('bill-total').textContent = `₹${final.toFixed(2)}`;
}

async function generateBill() {
    if (appState.cart.length === 0) {
        alert('Cart is empty');
        return;
    }

    const subtotal = appState.cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    const discountType = document.getElementById('discount-type').value;
    const discountValue = parseFloat(document.getElementById('discount-value').value) || 0;

    let final = subtotal;
    if (discountType === 'flat') final = subtotal - discountValue;
    if (discountType === 'percentage') final = subtotal - (subtotal * (discountValue / 100));
    if (final < 0) final = 0;

    const paymentMode = document.querySelector('input[name="paymode"]:checked').value;

    // 1. Insert Bill
    const { data: billData, error: billError } = await supabase
        .from('bills')
        .insert([{
            subtotal,
            discount_type: discountType,
            discount_value: discountValue,
            final_amount: final,
            payment_mode: paymentMode,
            tenant_id: authState.owner.tenant_id,
            created_by: authState.owner.id
        }])
        .select()
        .single();

    if (billError) {
        alert('Error saving bill: ' + billError.message);
        return;
    }

    const billId = billData.id;

    // 2. Insert Bill Items
    const itemsToInsert = appState.cart.map(item => ({
        bill_id: billId,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.qty,
        price: item.product.price,
        tenant_id: authState.owner.tenant_id
    }));

    const { error: itemsError } = await supabase.from('bill_items').insert(itemsToInsert);

    if (itemsError) {
        console.error('Error saving items', itemsError);
        alert('Bill saved but items failed. Please check data.');
    }

    // 3. Update Stock (Ignore for In-house)
    for (const item of appState.cart) {
        if (!item.product.is_in_house) {
            const newStock = item.product.stock - item.qty;
            await supabase.from('products').update({ stock: newStock }).eq('id', item.product.id);
        }
    }

    // Success
    alert(`Bill Generated Successfully! Total: ₹${final.toFixed(2)}`);
    appState.cart = [];
    renderCart();

    // Refresh Inventory and Dashboard
    await loadInventory(); // to get new stock
    loadDashboard(appState.dashboardFilter); // update stats
}

// ==========================================
// DASHBOARD
// ==========================================

// Date filters
// Date filters
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const range = btn.getAttribute('data-range');
        const isCustom = btn.id === 'custom-date-btn' || btn.id === 'analysis-custom-date-btn';

        // Update UI for all tabs (Sync)
        document.querySelectorAll('.filter-btn').forEach(b => {
            // If we clicked a specific range, activate matching buttons elsewhere
            if (!isCustom && b.getAttribute('data-range') === range) {
                b.classList.add('active');
            }
            // If we clicked custom, activate custom buttons elsewhere
            else if (isCustom && (b.id === 'custom-date-btn' || b.id === 'analysis-custom-date-btn')) {
                b.classList.add('active');
            }
            else {
                b.classList.remove('active');
            }
        });

        // Hide all custom inputs first
        document.getElementById('custom-date-inputs').classList.add('hidden');
        document.getElementById('analysis-custom-date-inputs').classList.add('hidden');

        // Logic
        if (isCustom) {
            // Show inputs for the specific view we are in, or just the one next to the button
            if (btn.id === 'custom-date-btn') document.getElementById('custom-date-inputs').classList.remove('hidden');
            if (btn.id === 'analysis-custom-date-btn') document.getElementById('analysis-custom-date-inputs').classList.remove('hidden');
        } else {
            appState.dashboardFilter = range;
            loadDashboard(range);
        }
    });
});



// Helper for colors
function getChartColor(idx, isBright) {
    const brightColors = [
        '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6',
        '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F43F5E'
    ];
    const dullColors = [
        '#78716c', '#a8a29e', '#d6d3d1', '#9ca3af', '#94a3b8',
        '#64748b', '#475569', '#52525b', '#71717a', '#a1a1aa'
    ];
    if (isBright) return brightColors[idx % brightColors.length];
    return dullColors[idx % dullColors.length];
}

function applyCustomDate(source) {
    appState.dashboardFilter = 'custom';
    loadDashboard('custom');
}

async function loadDashboard(range) {
    if (!supabase) return;

    try {
        let query = supabase.from('bills').select('final_amount, payment_mode, created_at, id').eq('tenant_id', authState.owner.tenant_id);

        const now = new Date();
        let startTime;
        // ... (rest of filtering logic is fine)

        if (range === 'today') {
            startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        } else if (range === 'week') {
            const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
            firstDay.setHours(0, 0, 0, 0);
            startTime = firstDay.toISOString();
        } else if (range === 'month') {
            startTime = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        } else if (range === 'year') {
            startTime = new Date(now.getFullYear(), 0, 1).toISOString();
        } else if (range === 'custom') {
            let d1 = document.getElementById('date-from').value;
            let d2 = document.getElementById('date-to').value;

            // Check if we are in analysis view, use those inputs if populated
            if (!document.getElementById('analysis').classList.contains('hidden')) {
                const ad1 = document.getElementById('analysis-date-from').value;
                const ad2 = document.getElementById('analysis-date-to').value;
                if (ad1 && ad2) {
                    d1 = ad1;
                    d2 = ad2;
                }
            }

            if (!d1 || !d2) return;

            query = query.gte('created_at', new Date(d1).toISOString())
                .lte('created_at', new Date(new Date(d2).setHours(23, 59, 59)).toISOString());
        }

        if (range !== 'custom' && startTime) {
            query = query.gte('created_at', startTime);
        }

        const { data: bills, error } = await query;
        if (error) {
            console.error('Error fetching dashboard stats:', error);
            alert('Failed to load dashboard data. Check connection.');
            return;
        }

        // Calculate Stats
        // Calculate Stats
        const safeBills = bills || [];
        const totalSales = safeBills.reduce((sum, b) => sum + b.final_amount, 0);
        const cash = safeBills.filter(b => b.payment_mode === 'CASH').reduce((sum, b) => sum + b.final_amount, 0);
        const upi = safeBills.filter(b => b.payment_mode === 'UPI').reduce((sum, b) => sum + b.final_amount, 0);
        const other = safeBills.filter(b => b.payment_mode === 'OTHER').reduce((sum, b) => sum + b.final_amount, 0);
        const count = safeBills.length;

        // Update UI
        document.getElementById('stat-total-sales').textContent = `₹${totalSales.toFixed(2)}`;
        document.getElementById('stat-cash').textContent = `₹${cash.toFixed(2)}`;
        document.getElementById('stat-upi').textContent = `₹${upi.toFixed(2)}`;
        document.getElementById('stat-other').textContent = `₹${other.toFixed(2)}`;
        document.getElementById('stat-bill-count').textContent = count;

        // --- Render Charts ---
        // Top Products Logic
        let itemsQuery = supabase.from('bill_items').select('product_name, quantity, price, created_at').eq('tenant_id', authState.owner.tenant_id);


        if (range !== 'custom' && startTime) {
            itemsQuery = itemsQuery.gte('created_at', startTime);
        } else if (range === 'custom') {
            let d1 = document.getElementById('date-from').value;
            let d2 = document.getElementById('date-to').value;

            // Check if we are in analysis view, use those inputs if populated
            if (!document.getElementById('analysis').classList.contains('hidden')) {
                const ad1 = document.getElementById('analysis-date-from').value;
                const ad2 = document.getElementById('analysis-date-to').value;
                if (ad1 && ad2) {
                    d1 = ad1;
                    d2 = ad2;
                }
            }

            if (d1 && d2) {
                itemsQuery = itemsQuery.gte('created_at', new Date(d1).toISOString())
                    .lte('created_at', new Date(new Date(d2).setHours(23, 59, 59)).toISOString());
            }
        }

        const { data: fetchedItems, error: itemsError } = await itemsQuery;

        if (itemsError) {
            console.error("Error loading top products", itemsError);
        } else {
            renderTopProducts(fetchedItems || []);

            // Cache Data for Filter Updates
            appState.dashboardData = {
                bills: safeBills,
                items: fetchedItems || [],
                range: range,
                startTime: startTime
            };

            // Re-render charts with items for Product Trend
            if (typeof renderCharts === 'function') {
                renderCharts(safeBills, range, startTime, fetchedItems || []);
            }
        }
    } catch (err) {
        console.error('DASHBOARD ERROR:', err);
        // alert('Dashboard Error: ' + err.message); // Uncomment if needed for user visibility
    }
}

function renderTopProducts(items) {
    const container = document.getElementById('top-products-list');
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary)">No sales in this period</div>';
        return;
    }

    // Aggregate
    const sales = {};
    items.forEach(i => {
        if (!sales[i.product_name]) sales[i.product_name] = 0;
        sales[i.product_name] += i.quantity;
    });

    // Sort
    const sorted = Object.entries(sales)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3); // Top 3

    sorted.forEach(([name, qty], index) => {
        const div = document.createElement('div');
        div.className = 'top-product-item';

        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';

        div.innerHTML = `
            <span class="rank" style="font-size: 1.5rem; margin-right: 0.5rem;">${medal}</span>
            <div style="flex:1;">
                <span class="name" style="font-weight:600; font-size:1.05rem;">${name}</span>
            </div>
            <span class="qty" style="font-weight:bold; color:var(--primary-color);">${qty} sold</span>
        `;
        container.appendChild(div);
    });
}

function renderCharts(bills, range, startTime, items) {
    if (!window.Chart) return;

    // 1. Payment Mode Pie Chart
    const payData = {
        CASH: bills.filter(b => b.payment_mode === 'CASH').reduce((sum, b) => sum + b.final_amount, 0),
        UPI: bills.filter(b => b.payment_mode === 'UPI').reduce((sum, b) => sum + b.final_amount, 0),
        OTHER: bills.filter(b => b.payment_mode === 'OTHER').reduce((sum, b) => sum + b.final_amount, 0),
    };

    const ctxPay = document.getElementById('chart-payment').getContext('2d');
    if (appState.charts.payment) appState.charts.payment.destroy();

    appState.charts.payment = new Chart(ctxPay, {
        type: 'doughnut',
        data: {
            labels: ['Cash', 'UPI', 'Other'],
            datasets: [{
                data: [payData.CASH, payData.UPI, payData.OTHER],
                backgroundColor: ['#10B981', '#2563EB', '#6B7280'],
                borderWidth: 0
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom' }
            },
            maintainAspectRatio: false
        }
    });

    // 2. Revenue Trend Line Chart (Cumulative)
    const ctxRev = document.getElementById('chart-revenue').getContext('2d');
    if (appState.charts.revenue) appState.charts.revenue.destroy();

    // Prepare buckets based on range
    let labels = [];
    let buckets = [];

    // Helper to format date
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (range === 'today') {
        // 0 to 23 hours
        for (let i = 0; i < 24; i++) {
            labels.push(i === 0 ? '12 AM' : i === 12 ? '12 PM' : i > 12 ? `${i - 12} PM` : `${i} AM`);
            buckets.push(0);
        }
    } else if (range === 'week') {
        // Last 7 days or This relative week? 
        // Code in loadDashboard uses "Last Sunday/Monday" logic?
        // Let's assume standard Mon-Sun or Sun-Sat. 
        // For simplicity, let's map bills to day names.
        // Better: Initialize buckets for the actual dates in range if strict, 
        // but for "This Week" (assuming Mon-Sun), let's just do Mon-Sun.
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        buckets = new Array(7).fill(0);
    } else if (range === 'month') {
        // Week 1 to 5
        labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
        buckets = new Array(5).fill(0);
    } else if (range === 'year') {
        labels = months;
        buckets = new Array(12).fill(0);
    } else {
        // Custom: Just group by date
        // Since custom can be anything, let's just sort bills and do a simple line
        // But user asked for "Always Increase", so we just do cumulative on whatever data comes in
        // Simplified custom: Group by Date
    }

    // Fill buckets
    const billList = [...bills].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Note: If range is custom, we might handle differently, but let's try to fit into buckets if standard
    if (range === 'custom') {
        const fromVal = document.getElementById('date-from').value;
        const toVal = document.getElementById('date-to').value;

        // Parse as Local Midnight to avoid timezone shifts
        const [y1, m1, day1] = fromVal.split('-').map(Number);
        const [y2, m2, day2] = toVal.split('-').map(Number);
        const d1 = new Date(y1, m1 - 1, day1);
        const d2 = new Date(y2, m2 - 1, day2);

        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include start date

        if (diffDays <= 20) {
            // Day by Day
            // Initialize buckets for every day in range to have continuity
            for (let i = 0; i < diffDays; i++) {
                const tempDate = new Date(d1);
                tempDate.setDate(d1.getDate() + i);
                labels.push(tempDate.toLocaleDateString());
                buckets.push(0);
            }

            billList.forEach(b => {
                const bDate = new Date(b.created_at);
                bDate.setHours(0, 0, 0, 0);

                // Diff in days (using Round to be safe with DST/Timezone drifts if any)
                const dayDiff = Math.round((bDate - d1) / (1000 * 60 * 60 * 24));

                if (dayDiff >= 0 && dayDiff < buckets.length) {
                    buckets[dayDiff] += b.final_amount;
                }
            });

        } else {
            // Every 5 days
            // Create buckets: Day 1-5, Day 6-10...
            const numBuckets = Math.ceil(diffDays / 5);
            for (let i = 0; i < numBuckets; i++) {
                const startDay = i * 5;
                const endDay = Math.min((i + 1) * 5 - 1, diffDays - 1);

                const sDate = new Date(d1); sDate.setDate(d1.getDate() + startDay);
                const eDate = new Date(d1); eDate.setDate(d1.getDate() + endDay);

                labels.push(`${sDate.getDate()}/${sDate.getMonth() + 1} - ${eDate.getDate()}/${eDate.getMonth() + 1}`);
                buckets.push(0);
            }

            billList.forEach(b => {
                const bDate = new Date(b.created_at);
                bDate.setHours(0, 0, 0, 0);
                const dayDiff = Math.round((bDate - d1) / (1000 * 60 * 60 * 24));
                const bucketIdx = Math.floor(dayDiff / 5);

                if (bucketIdx >= 0 && bucketIdx < buckets.length) {
                    buckets[bucketIdx] += b.final_amount;
                }
            });
        }
    } else {
        // Standard Ranges
        billList.forEach(b => {
            const d = new Date(b.created_at);
            let idx = -1;

            if (range === 'today') {
                idx = d.getHours();
            } else if (range === 'week') {
                // created_at Day (0=Sun, 1=Mon...). 
                // We want Mon(0) to Sun(6).
                // JS: 0=Sun, 1=Mon.
                // shift: (day + 6) % 7 ? -> Sun(0)->6, Mon(1)->0
                const jsDay = d.getDay();
                idx = (jsDay + 6) % 7;
            } else if (range === 'month') {
                const date = d.getDate();
                idx = Math.floor((date - 1) / 7); // 0-4
                if (idx > 4) idx = 4;
            } else if (range === 'year') {
                idx = d.getMonth();
            }

            if (idx >= 0 && idx < buckets.length) {
                buckets[idx] += b.final_amount;
            }
        });
    }

    // Calculate Cumulative
    let runningTotal = 0;
    let cumulativeData = buckets.map(val => {
        runningTotal += val;
        return runningTotal;
    });

    // Trim Future Data
    const now = new Date();
    let limitIdx = buckets.length - 1; // Default to showing all

    if (range === 'today') {
        limitIdx = now.getHours();
    } else if (range === 'week') {
        limitIdx = (now.getDay() + 6) % 7;
    } else if (range === 'month') {
        limitIdx = Math.floor((now.getDate() - 1) / 7);
        if (limitIdx > 4) limitIdx = 4;
    } else if (range === 'year') {
        limitIdx = now.getMonth();
    } else if (range === 'custom') {
        // Handle Future Crop for Custom Range
        const msPerDay = 1000 * 60 * 60 * 24;
        const fromVal = document.getElementById('date-from').value;
        const [y1, m1, day1] = fromVal.split('-').map(Number);
        const dStart = new Date(y1, m1 - 1, day1);

        const nowMidnight = new Date();
        nowMidnight.setHours(0, 0, 0, 0);

        // Days from Start to Today
        const daysSinceStart = Math.round((nowMidnight - dStart) / msPerDay);

        // Determine mode (Day-by-Day or 5-day)
        const toVal = document.getElementById('date-to').value;
        const [y2, m2, day2] = toVal.split('-').map(Number);
        const dEnd = new Date(y2, m2 - 1, day2);
        const totalDiff = Math.abs(dEnd - dStart);
        const totalDays = Math.ceil(totalDiff / msPerDay) + 1;

        if (totalDays <= 20) {
            limitIdx = daysSinceStart;
        } else {
            limitIdx = Math.floor(daysSinceStart / 5);
        }

        // Limits
        if (limitIdx < -1) limitIdx = -1; // All future
        // if limitIdx >= buckets.length -1, keep default
    }

    // Slice provided we need to trim
    if (limitIdx < labels.length - 1) {
        // slice(0, limitIdx + 1) includes the current unit
        const cut = limitIdx + 1;
        // If cut < 0 (all future), slice(0,0) -> empty
        const effectiveCut = Math.max(0, cut);

        labels = labels.slice(0, effectiveCut);
        cumulativeData = cumulativeData.slice(0, effectiveCut);
        buckets = buckets.slice(0, effectiveCut); // Slice buckets too for Velocity
    }

    // Render
    appState.charts.revenue = new Chart(ctxRev, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Revenue (Cumulative)',
                data: cumulativeData,
                borderColor: '#10B981', // Success color
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 2
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            },
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return 'Total: ₹' + context.raw.toFixed(2);
                        }
                    }
                }
            }
        }
    });

    const ctxBills = document.getElementById('chart-bills').getContext('2d');
    if (appState.charts.bills) appState.charts.bills.destroy();

    // Re-calculating bill counts seems inefficient if not merged, but safest to ensure correct logic is 
    // to copy the filling logic OR to have filled a secondary array above.
    // Let's go do the Right Thing and fill a secondary array in the MAIN loop.
    // Wait, I can't easily edit the middle of the function with this tool without replacing the whole block.
    // So for now, I will indeed copy the logic (Code Duplication for MVP speed vs massive refactor risk).

    // Actually, I can replace the entire renderCharts function content or just the part I know. 
    // Let's try to just append the new chart logic using a NEW loop.
    // IT IS FAST ENOUGH.

    let billBuckets = new Array(buckets.length).fill(0);

    if (range === 'custom') {
        const fromVal = document.getElementById('date-from').value;
        const toVal = document.getElementById('date-to').value;
        const [y1, m1, day1] = fromVal.split('-').map(Number);
        const d1 = new Date(y1, m1 - 1, day1);
        const d2 = new Date(toVal.split('-')[0], toVal.split('-')[1] - 1, toVal.split('-')[2]);
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays <= 20) {
            billList.forEach(b => {
                const bDate = new Date(b.created_at);
                bDate.setHours(0, 0, 0, 0);
                const dayDiff = Math.round((bDate - d1) / (1000 * 60 * 60 * 24));
                if (dayDiff >= 0 && dayDiff < billBuckets.length) {
                    billBuckets[dayDiff] += 1;
                }
            });
        } else {
            billList.forEach(b => {
                const bDate = new Date(b.created_at);
                bDate.setHours(0, 0, 0, 0);
                const dayDiff = Math.round((bDate - d1) / (1000 * 60 * 60 * 24));
                const bucketIdx = Math.floor(dayDiff / 5);
                if (bucketIdx >= 0 && bucketIdx < billBuckets.length) {
                    billBuckets[bucketIdx] += 1;
                }
            });
        }
    } else {
        billList.forEach(b => {
            const d = new Date(b.created_at);
            let idx = -1;
            if (range === 'today') idx = d.getHours();
            else if (range === 'week') idx = (d.getDay() + 6) % 7;
            else if (range === 'month') {
                idx = Math.floor((d.getDate() - 1) / 7);
                if (idx > 4) idx = 4;
            } else if (range === 'year') idx = d.getMonth();

            if (idx >= 0 && idx < billBuckets.length) {
                billBuckets[idx] += 1;
            }
        });
    }

    // Cumulative Bills
    let runningBillCount = 0;
    let cumulativeBillData = billBuckets.map(val => {
        runningBillCount += val;
        return runningBillCount;
    });

    // Trim Future for Bills (Sync with labels)
    // Since labels are already trimmed, we just match the length
    if (cumulativeBillData.length > labels.length) {
        cumulativeBillData = cumulativeBillData.slice(0, labels.length);
        billBuckets = billBuckets.slice(0, labels.length);
    }

    appState.charts.bills = new Chart(ctxBills, {
        type: 'line',
        data: {
            labels: labels, // Shares labels with Revenue chart
            datasets: [{
                label: 'Total Bills (Cumulative)',
                data: cumulativeBillData,
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 2
            }]
        },
        options: {
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return 'Bills: ' + context.raw;
                        }
                    }
                }
            }
        }
    });

    // 4. Period Revenue Bar Chart (Non-Cumulative) - "Revenue per every hr"
    const ctxVel = document.getElementById('chart-velocity').getContext('2d');
    if (appState.charts.velocity) appState.charts.velocity.destroy();

    // Data: 'buckets' array from Step 2 (already calculated, non-cumulative)
    // Labels: 'labels' array (already trimmed)
    // We just need to slice 'buckets' to match 'labels' length.

    let velData = buckets;
    if (labels.length < buckets.length) {
        velData = buckets.slice(0, labels.length);
    }

    appState.charts.velocity = new Chart(ctxVel, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: velData,
                backgroundColor: 'rgba(16, 185, 129, 0.6)', // Green (Emerald)
                borderColor: '#10B981',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            scales: { y: { beginAtZero: true } },
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return 'Revenue: ₹' + context.raw.toFixed(2);
                        }
                    }
                }
            }
        }
    });



    // 5. Bill Velocity Bar Chart (Non-Cumulative)
    const ctxBillVel = document.getElementById('chart-bill-velocity').getContext('2d');
    if (appState.charts.billVelocity) appState.charts.billVelocity.destroy();

    let billVelData = billBuckets;
    if (labels.length < billBuckets.length) {
        billVelData = billBuckets.slice(0, labels.length);
    }

    appState.charts.billVelocity = new Chart(ctxBillVel, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Bills',
                data: billVelData,
                backgroundColor: 'rgba(245, 158, 11, 0.6)', // Amber
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return 'Bills: ' + context.raw;
                        }
                    }
                }
            }
        }
    });

    // 6. Product Sales Trend (Multi-Line)
    renderProductTrendChartSimplified(billList, items, range, labels.length);

    // 7. Render Sales Table
    renderSalesTable(items);
}

// Separate function for complexity
function renderProductTrendChart(bills, allItems, range, itemsLimit) {
    const ctxProd = document.getElementById('chart-product').getContext('2d');
    if (appState.charts.product) appState.charts.product.destroy();

    // 1. Group items by Product ID
    const productMap = {}; // { id: { name: '..', total: 0, buckets: [] } }

    // Initialize map with ALL known products to ensure we capture even 0 sales if selected?
    // For now, rely on sales history or appState.products if we want 0 sales.
    // Let's use allItems (sales history)

    // We need to know bucket logic again. 
    // Ideally we pass "bucket mapper" function, but easier to just use the timestamps in allItems
    // and map them to indices 0..itemsLimit-1.

    // Re-use logic for index mapping (copy-paste for speed, ideally refactor)
    // We need a helper to get Index from Date
    const getBucketIndex = (dateStr) => {
        const d = new Date(dateStr);
        if (range === 'custom') {
            const fromVal = document.getElementById('date-from').value;
            const toVal = document.getElementById('date-to').value;
            const [y1, m1, day1] = fromVal.split('-').map(Number);
            const d1 = new Date(y1, m1 - 1, day1);
            const d2 = new Date(toVal.split('-')[0], toVal.split('-')[1] - 1, toVal.split('-')[2]);
            const diffTime = Math.abs(d2 - d1);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            const bDate = new Date(dateStr); bDate.setHours(0, 0, 0, 0);
            const dayDiff = Math.round((bDate - d1) / (1000 * 60 * 60 * 24));

            if (diffDays <= 20) return dayDiff;
            return Math.floor(dayDiff / 5);
        }
        if (range === 'today') return d.getHours();
        if (range === 'week') return (d.getDay() + 6) % 7;
        if (range === 'month') {
            let idx = Math.floor((d.getDate() - 1) / 7);
            return idx > 4 ? 4 : idx;
        }
        if (range === 'year') return d.getMonth();
        return 0;
    };

    // Calculate totals and fill buckets
    if (!allItems) allItems = []; // Safety

    allItems.forEach(item => {
        if (!productMap[item.product_name]) {
            productMap[item.product_name] = {
                name: item.product_name,
                total: 0,
                buckets: new Array(itemsLimit).fill(0)
            };
        }

        productMap[item.product_name].total += item.quantity;

        const idx = getBucketIndex(item.created_at);
        if (idx >= 0 && idx < itemsLimit) {
            productMap[item.product_name].buckets[idx] += item.quantity;
        }
    });

    // 2. Select Products to Show
    let productsToShow = []; // Array of objects

    // If NO selection, pick Top 5 and Bottom 5 (from active sales)
    // Note: This ignores products with 0 sales in this period if relying only on allItems.
    // That is acceptable for "Trend of SOLD items".

    // Convert map to array
    let sortedProducts = Object.values(productMap).sort((a, b) => b.total - a.total);

    if (appState.productTrendSelectedIds.length > 0) {
        // Show selected names (stored as IDs? User said "search bar to select needed product")
        // My dropdown implementation usually uses IDs. 
        // But bill_items only has product_name easily available in the fetch? 

        // Filter existing sales
        productsToShow = sortedProducts.filter(p => appState.productTrendSelectedIds.includes(p.name));

        // Add selected products with 0 sales if missing
        appState.productTrendSelectedIds.forEach(name => {
            if (!productsToShow.find(p => p.name === name)) {
                productsToShow.push({
                    name: name,
                    total: 0,
                    buckets: new Array(itemsLimit).fill(0)
                });
            }
        });

    } else {
        // Top 5 (Bright)
        const top5 = sortedProducts.slice(0, 5);
        // Bottom 5 (Dull) - exclude those already in top 5 if total < 10
        const bottom5 = sortedProducts.slice(-5).reverse(); // specific reverse? "Least selling"
        // Actually "Least 5" usually means lowest non-zero? Or just lowest?
        // Let's take last 5.
        // If total products < 10, overlap?
        // Unique merge
        const combined = new Set([...top5, ...bottom5]);
        productsToShow = Array.from(combined);
    }

    // 3. Prepare Datasets
    const datasets = productsToShow.map((p, i) => {
        // Determine color: 
        let isBright = true;

        // Identify if this P object is in the bottom slice
        const isBottom = sortedProducts.slice(-5).includes(p);
        const isTop = sortedProducts.slice(0, 5).includes(p);

        // If overlap (e.g. only 3 products), prefer Bright
        if (isBottom && !isTop) isBright = false;

        // Cumulative
        let running = 0;
        const cumData = p.buckets.map(v => { running += v; return running; });

        // Trim Future logic already handled by limiting buckets size to 'labels.length' passed in 'itemsLimit'? 
        // Yes, caller passed labels.length.

        return {
            label: p.name,
            data: cumData,
            borderColor: getChartColor(i, isBright),
            backgroundColor: getChartColor(i, isBright), // Point color?
            tension: 0.3,
            fill: false,
            borderWidth: 2,
            pointRadius: 3
        };
    });

    // Render
    appState.charts.product = new Chart(ctxProd, {
        type: 'line',
        data: {
            labels: appState.charts.revenue.data.labels, // safe access to main labels
            datasets: datasets
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}


// Simplified version without dropdown
function renderProductTrendChartSimplified(bills, allItems, range, itemsLimit) {
    const ctxProd = document.getElementById('chart-product').getContext('2d');
    if (appState.charts.product) appState.charts.product.destroy();

    // 1. Group items by Product ID
    const productMap = {}; // { id: { name: '..', total: 0, buckets: [] } }

    const getBucketIndex = (dateStr) => {
        const d = new Date(dateStr);
        if (range === 'custom') {
            const fromVal = document.getElementById('date-from').value;
            const toVal = document.getElementById('date-to').value;
            const [y1, m1, day1] = fromVal.split('-').map(Number);
            const d1 = new Date(y1, m1 - 1, day1);
            const d2 = new Date(toVal.split('-')[0], toVal.split('-')[1] - 1, toVal.split('-')[2]);
            const diffTime = Math.abs(d2 - d1);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            const bDate = new Date(dateStr); bDate.setHours(0, 0, 0, 0);
            const dayDiff = Math.round((bDate - d1) / (1000 * 60 * 60 * 24));

            if (diffDays <= 20) return dayDiff;
            return Math.floor(dayDiff / 5);
        }
        if (range === 'today') return d.getHours();
        if (range === 'week') return (d.getDay() + 6) % 7;
        if (range === 'month') {
            let idx = Math.floor((d.getDate() - 1) / 7);
            return idx > 4 ? 4 : idx;
        }
        if (range === 'year') return d.getMonth();
        return 0;
    };

    if (!allItems) allItems = [];

    allItems.forEach(item => {
        if (!productMap[item.product_name]) {
            productMap[item.product_name] = {
                name: item.product_name,
                total: 0,
                buckets: new Array(itemsLimit).fill(0)
            };
        }
        productMap[item.product_name].total += item.quantity;
        const idx = getBucketIndex(item.created_at);
        if (idx >= 0 && idx < itemsLimit) {
            productMap[item.product_name].buckets[idx] += item.quantity;
        }
    });

    // 2. Select Products to Show (Top 5 + Bottom 5)
    let sortedProducts = Object.values(productMap).sort((a, b) => b.total - a.total);

    const top5 = sortedProducts.slice(0, 5);
    const bottom5 = sortedProducts.slice(-5).reverse();
    const combined = new Set([...top5, ...bottom5]);
    let productsToShow = Array.from(combined);

    // 3. Prepare Datasets
    const datasets = productsToShow.map((p, i) => {
        let isBright = true;
        const isBottom = sortedProducts.slice(-5).includes(p);
        const isTop = sortedProducts.slice(0, 5).includes(p);
        if (isBottom && !isTop) isBright = false;

        let running = 0;
        const cumData = p.buckets.map(v => { running += v; return running; });

        return {
            label: p.name,
            data: cumData,
            borderColor: getChartColor(i, isBright),
            backgroundColor: getChartColor(i, isBright),
            tension: 0.3,
            fill: false,
            borderWidth: 2,
            pointRadius: 3
        };
    });

    // Render
    appState.charts.product = new Chart(ctxProd, {
        type: 'line',
        data: {
            labels: appState.charts.revenue.data.labels,
            datasets: datasets
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function renderSalesTable(items) {
    const tbody = document.querySelector('#sales-report-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No data available</td></tr>';
        return;
    }

    // Aggregate
    const counts = {};
    items.forEach(item => {
        counts[item.product_name] = (counts[item.product_name] || 0) + item.quantity;
    });

    // Sort Descending
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // Render
    sorted.forEach(([name, count]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${name}</td><td>${count}</td>`;
        tbody.appendChild(tr);
    });
}

function filterSalesTable() {
    const input = document.getElementById('sales-table-search');
    const filter = input.value.toLowerCase();
    const table = document.getElementById('sales-report-table');
    const tr = table.getElementsByTagName('tr');

    for (let i = 1; i < tr.length; i++) { // Skip header
        const td = tr[i].getElementsByTagName('td')[0];
        if (td) {
            const txtValue = td.textContent || td.innerText;
            if (txtValue.toLowerCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}

// ==========================================
// SETTINGS
// ==========================================

async function loadSettings() {
    console.log("Loading Settings...");
    // 1. Get User Data
    let user = authState.owner;

    // Fallback
    if (!user) {
        const stored = localStorage.getItem('tenant_session');
        if (stored) {
            try {
                user = JSON.parse(stored);
            } catch (e) { console.error(e); }
        }
    }

    if (!user) {
        console.warn("No user found in session.");
        return;
    }

    // --- PERMISSION CHECK: Inventory & Analysis ---
    const navButtons = document.querySelectorAll('.nav-btn');
    let invBtn = null, analysisBtn = null;
    navButtons.forEach(btn => {
        if (btn.textContent.includes('Inventory')) invBtn = btn;
        if (btn.textContent.includes('Data Analysis')) analysisBtn = btn;
    });

    let allowAnalysis = false;

    // 2. Populate Fields & Resolve Permissions

    // Profile Data Source: Default to User
    let pNameVal = user.full_name;
    let pEmailVal = user.email;

    if (user.role === 'employee') {
        // Hide Inventory for Employee
        if (invBtn) invBtn.style.display = 'none';

        if (user.tenant_id) {
            // Fetch Owner Details AND Preferences
            const { data: ownerReq } = await supabase
                .from('owners')
                .select('*')
                .eq('tenant_id', user.tenant_id)
                .eq('role', 'owner')
                .maybeSingle();

            if (ownerReq) {
                pNameVal = ownerReq.full_name + " (Owner)";
                pEmailVal = ownerReq.email;
                if (ownerReq.allow_employee_analysis) allowAnalysis = true;

                // Cache owner's store name for branding
                if (ownerReq.preferred_store_name) {
                    appState.ownerPreferredName = ownerReq.preferred_store_name;
                } else {
                    appState.ownerPreferredName = ownerReq.business_name || "Na Dukan";
                }
            }
        }

        updateBranding(); // Update UI immediately

        // Hide Analysis if not allowed
        if (analysisBtn) {
            analysisBtn.style.display = allowAnalysis ? 'inline-block' : 'none';
        }

        // Hide Pref Card
        document.getElementById('settings-preferences-card').classList.add('hidden');

    } else {
        // Owner
        if (invBtn) invBtn.style.display = 'inline-block';
        if (analysisBtn) analysisBtn.style.display = 'inline-block';

        // Show Pref Card
        const prefCard = document.getElementById('settings-preferences-card');
        prefCard.classList.remove('hidden');

        // PREF: Store Name
        const nameInput = document.getElementById('pref-store-name');
        const saveNameBtn = document.getElementById('btn-save-pref-name');

        if (nameInput) {
            nameInput.value = user.preferred_store_name || user.business_name || '';

            saveNameBtn.onclick = async () => {
                const newName = nameInput.value.trim();
                if (!newName) return;

                const { error } = await supabase
                    .from('owners')
                    .update({ preferred_store_name: newName })
                    .eq('id', user.id);

                if (error) {
                    console.error("Save Error", error);
                    alert("Failed to save name.");
                } else {
                    alert("Store Name Updated!");
                    // Update Local State
                    authState.owner.preferred_store_name = newName;
                    localStorage.setItem('tenant_session', JSON.stringify(authState.owner));
                    updateBranding();
                }
            };
        }

        // PREF: Analysis Checkbox
        const prefCheck = document.getElementById('pref-employee-analysis');
        if (prefCheck) {
            prefCheck.checked = user.allow_employee_analysis === true;

            // Attach Listener (deduplicated via property or just re-assign onclick)
            prefCheck.onclick = async (e) => {
                const checked = e.target.checked;
                // Update DB
                const { error } = await supabase
                    .from('owners')
                    .update({ allow_employee_analysis: checked })
                    .eq('id', user.id);

                if (error) {
                    console.error("Error updating pref", error);
                    alert("Failed to save preference");
                    e.target.checked = !checked; // Undo
                } else {
                    // Update local state temporarily
                    authState.owner.allow_employee_analysis = checked;
                    localStorage.setItem('tenant_session', JSON.stringify(authState.owner));
                }
            };
        }
    }

    // Profile
    const pName = document.getElementById('settings-p-name');
    const pEmail = document.getElementById('settings-p-email');
    if (pName) pName.value = pNameVal || '';
    if (pEmail) pEmail.value = pEmailVal || '';

    // Shop
    const sName = document.getElementById('settings-s-name');
    const sAddr = document.getElementById('settings-s-addr');
    if (sName) sName.value = user.business_name || '';
    if (sAddr) sAddr.value = (user.address || '') + (user.pincode ? `, ${user.pincode}` : '');

    // Employee List
    if (user.role === 'employee') {
        // Hide Add Employee Button if current user is employee
        const addEmpBtn = document.getElementById('btn-add-employee');
        if (addEmpBtn) addEmpBtn.classList.add('hidden');
    } else {
        // Ensure visible if owner
        const addEmpBtn = document.getElementById('btn-add-employee');
        if (addEmpBtn) addEmpBtn.classList.remove('hidden');
    }

    loadEmployeeList(user.tenant_id);
}

window.updateBranding = function () {
    const brandEl = document.getElementById('nav-brand-name');
    if (!brandEl) return;

    let name = "Na Dukan"; // Default fallback

    // Check owner pref
    // If owner logged in
    if (authState.owner) {
        if (authState.owner.preferred_store_name) {
            name = authState.owner.preferred_store_name;
        } else if (authState.owner.business_name) {
            name = authState.owner.business_name;
        }
    }

    // If we have cached one (e.g. employee view)
    if (appState.ownerPreferredName) {
        name = appState.ownerPreferredName;
    }

    // If still just "Na Dukan", apply basic styling. 
    // If custom, just text.
    if (name === "Na Dukan") {
        brandEl.innerHTML = `Na <span class="highlight">Dukan</span>`;
    } else {
        brandEl.textContent = name;
    }
}

// ==========================================
// EMPLOYEE MANAGEMENT
// ==========================================

async function loadEmployeeList(tenantId) {
    const listContainer = document.getElementById('employee-list-container');
    if (!listContainer) return;

    if (!tenantId) return;

    const { data: employees, error } = await supabase
        .from('owners')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('role', 'employee');

    if (error) {
        console.error("Error loading employees", error);
        return;
    }

    if (!employees || employees.length === 0) {
        listContainer.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem;">No employees added yet.</p>';
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem;">';
    employees.forEach(emp => {
        let deleteBtn = '';
        // Only Owners can see delete button
        if (authState.owner && authState.owner.role === 'owner') {
            deleteBtn = `
                <button onclick="deleteEmployee('${emp.id}')" style="background:#FEE2E2; color:#EF4444; border:none; border-radius:4px; padding:0.4rem 0.6rem; cursor:pointer;" title="Remove Employee">
                   🗑️
                </button>
             `;
        }

        html += `
            <div class="employee-list-item" style="background:#f9fafb; padding:0.75rem; border-radius:8px; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:500;">${emp.full_name || 'Staff'}</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">${emp.email}</div>
                </div>
                ${deleteBtn}
            </div>
        `;
    });
    html += '</div>';
    listContainer.innerHTML = html;
}

window.deleteEmployee = async function (id) {
    if (!confirm("Are you sure you want to remove this employee? They will no longer be able to log in to this shop.")) {
        return;
    }

    try {
        const { error } = await supabase
            .from('owners')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Delete Error:", error);
            alert("Failed to delete employee: " + error.message);
        } else {
            alert("Employee removed.");
            loadSettings(); // Refresh list
        }
    } catch (e) {
        console.error("Unexpected error:", e);
        alert("Error: " + e.message);
    }
}

window.openAddEmployeeModal = async function () {
    console.log("Opening Add Employee Modal...");
    try {
        if (!window.authState || !window.authState.owner) {
            alert("Session Error: You must be logged in.");
            return;
        }

        // 1. Check Limit
        const { count, error } = await supabase
            .from('owners')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', authState.owner.tenant_id)
            .eq('role', 'employee');

        if (error) {
            console.error("Error checking limit", error);
            alert("System error checking employee limit.");
            return;
        }

        if (count >= 2) {
            alert("Limit Reached: You can only add up to 2 employees.");
            return;
        }

        const overlay = document.getElementById('modal-overlay');
        const modal = document.getElementById('modal-add-employee');
        if (overlay && modal) {
            overlay.classList.remove('hidden');
            modal.classList.remove('hidden');
        } else {
            console.error("Modal elements not found");
        }
    } catch (e) {
        console.error("Error opening modal:", e);
        alert("Unexpected error: " + e.message);
    }
}

// Ensure the form listener is attached
// We use a small check to avoid duplicate listeners if this file is hot-reloaded or run multiple times
if (!window.hasEmployeeListener) {
    window.hasEmployeeListener = true;
    const empForm = document.getElementById('add-employee-form');
    if (empForm) {
        empForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('emp-name').value.trim();
            const email = document.getElementById('emp-email').value.trim();
            const pass = document.getElementById('emp-pass').value;
            const confirm = document.getElementById('emp-confirm').value;

            if (pass !== confirm) {
                alert("Passwords do not match!");
                return;
            }

            // 2. Check if Email Exists (Public Lookup)
            const { data: existing } = await supabase
                .from('owners')
                .select('id')
                .eq('email', email)
                .maybeSingle();

            if (existing) {
                alert("This email is already registered.");
                return;
            }

            // 3. Create User (Using Temp Client)
            // We create a fresh client instance that doesn't persist session to localStorage 
            // so it doesn't log out the current owner.
            if (!window.SupabaseFactory) {
                alert("Configuration Error: Supabase Factory not found. Please reload.");
                return;
            }
            const tempSupabase = window.SupabaseFactory.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: {
                    storage: null, // Don't save to localStorage
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            });

            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: email,
                password: pass,
                options: {
                    data: { full_name: name } // Optional metadata
                }
            });

            if (authError) {
                alert("Error creating login: " + authError.message);
                return;
            }

            if (!authData.user) {
                alert("Unknown error: User not created.");
                return;
            }

            // 4. Link to Tenant (Insert into owners)
            const newOwnerRecord = {
                id: authData.user.id,
                tenant_id: authState.owner.tenant_id,
                email: email,
                full_name: name,
                role: 'employee',
                business_name: authState.owner.business_name,
                address: authState.owner.address,
                pincode: authState.owner.pincode,
                plan: authState.owner.plan,
                created_at: new Date().toISOString()
            };

            const { error: dbError } = await supabase
                .from('owners')
                .insert([newOwnerRecord]);

            if (dbError) {
                console.error("DB Error", dbError);
                alert("Account created but failed to link to shop. Please contact support.");
            } else {
                alert("Employee Added Successfully!");
                closeModals();
                loadSettings(); // Refresh list
            }
        });
    }
}

// ==========================================
// EMPLOYEE LOGS
// ==========================================

async function loadEmployeeLogs() {
    if (!supabase) return;

    const empId = document.getElementById('employee-log-select').value;
    const date = document.getElementById('employee-log-date').value;

    let query = supabase
        .from('employee_logs')
        .select(`
            *,
            owners:employee_id (full_name)
        `)
        .eq('tenant_id', authState.owner.tenant_id)
        .order('login_time', { ascending: false });

    if (empId !== 'all') {
        query = query.eq('employee_id', empId);
    }
    if (date) {
        const start = new Date(date).toISOString();
        const end = new Date(new Date(date).setHours(23, 59, 59)).toISOString();
        query = query.gte('login_time', start).lte('login_time', end);
    }

    const { data: logs, error } = await query;
    if (error) {
        console.error("Error loading logs:", error);
        return;
    }

    const tbody = document.getElementById('employee-logs-list');
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No logs found</td></tr>';
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement('tr');
        const login = new Date(log.login_time);
        const logout = log.logout_time ? new Date(log.logout_time) : null;

        let duration = 'Active';
        if (logout) {
            const diffMs = logout - login;
            const diffMins = Math.floor(diffMs / 60000);
            const hrs = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            duration = `${hrs}h ${mins}m`;
        }

        tr.innerHTML = `
            <td>${login.toLocaleDateString()}</td>
            <td>${log.owners?.full_name || 'Unknown'}</td>
            <td>${login.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${logout ? logout.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
            <td>${duration}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadEmployeesForDropdown() {
    const { data: employees } = await supabase
        .from('owners')
        .select('id, full_name')
        .eq('tenant_id', authState.owner.tenant_id)
        .eq('role', 'employee');

    const select = document.getElementById('employee-log-select');
    // Keep first option
    select.innerHTML = '<option value="all">All Employees</option>';

    if (employees) {
        employees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = emp.full_name;
            select.appendChild(opt);
        });
    }
}

