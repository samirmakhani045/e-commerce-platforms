const TOKEN_KEY = 'ecommerce_admin_token';
const USER_KEY = 'ecommerce_admin_user';

const loginView = document.getElementById('login-view');
const adminView = document.getElementById('admin-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const adminEmail = document.getElementById('admin-email');
const navButtons = document.querySelectorAll('.nav-btn');
const productsPanel = document.getElementById('products-panel');
const couponsPanel = document.getElementById('coupons-panel');
const reportsPanel = document.getElementById('reports-panel');
const couponSettingsForm = document.getElementById('coupon-settings-form');
const couponSettingsMessage = document.getElementById('coupon-settings-message');
const createCouponForm = document.getElementById('create-coupon-form');
const generateMilestoneBtn = document.getElementById('generate-milestone-btn');
const milestonePercentDisplay = document.getElementById('milestone-percent-display');
const couponSettingsSummary = document.getElementById('coupon-settings-summary');
const milestoneGenerateSummary = document.getElementById('milestone-generate-summary');
const milestoneStatusNote = document.getElementById('milestone-status-note');
const couponsMessage = document.getElementById('coupons-message');
const couponsTableBody = document.getElementById('coupons-table-body');
const productsTableBody = document.getElementById('products-table-body');
const productsMessage = document.getElementById('products-message');
const reportsMessage = document.getElementById('reports-message');
const kpiGrid = document.getElementById('kpi-grid');
const recentOrdersBody = document.getElementById('recent-orders-body');
const addProductBtn = document.getElementById('add-product-btn');
const refreshReportsBtn = document.getElementById('refresh-reports-btn');
const productDialog = document.getElementById('product-dialog');
const productForm = document.getElementById('product-form');
const productDialogTitle = document.getElementById('product-dialog-title');
const productFormError = document.getElementById('product-form-error');
const closeProductDialogBtn = document.getElementById('close-product-dialog');
const cancelProductDialogBtn = document.getElementById('cancel-product-dialog');

let revenueChart = null;
let ordersChart = null;
let editingProductId = null;
let productsCache = [];

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  const raw = sessionStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function showLogin() {
  loginView.hidden = false;
  adminView.hidden = true;
}

function showAdmin(user) {
  loginView.hidden = true;
  adminView.hidden = false;
  adminEmail.textContent = user?.email ?? '';
}

function showBanner(element, message, isError = false) {
  if (!message) {
    element.hidden = true;
    element.textContent = '';
    element.classList.remove('is-error');
    return;
  }

  element.hidden = false;
  element.textContent = message;
  element.classList.toggle('is-error', isError);
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value) || 0);
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearSession();
    showLogin();
    throw new Error(payload.message || 'Session expired. Please sign in again.');
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload.data;
}

async function handleLogin(event) {
  event.preventDefault();
  loginError.hidden = true;

  const formData = new FormData(loginForm);
  const email = formData.get('email');
  const password = formData.get('password');

  try {
    const data = await apiRequest('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.user?.role !== 'admin') {
      throw new Error('This account is not an admin. Use admin@example.com.');
    }

    setSession(data.token, data.user);
    showAdmin(data.user);
    await loadProducts();
    setActiveTab('products');
  } catch (error) {
    loginError.hidden = false;
    loginError.textContent = error.message;
  }
}

function setActiveTab(tab) {
  navButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === tab);
  });

  productsPanel.hidden = tab !== 'products';
  couponsPanel.hidden = tab !== 'coupons';
  reportsPanel.hidden = tab !== 'reports';

  if (tab === 'coupons') {
    loadCouponAdmin();
  }

  if (tab === 'reports') {
    loadReports();
  }
}

function formatPreMilestoneCounts(n, examples = 4) {
  return Array.from({ length: examples }, (_, index) => (index + 1) * n - 1).join(', ');
}

function formatMilestoneOrderNumbers(n, examples = 4) {
  return Array.from({ length: examples }, (_, index) => (index + 1) * n).join(', ');
}

function applyCouponSettingsUi(settings) {
  couponSettingsForm.elements.orderIntervalN.value = settings.orderIntervalN;
  couponSettingsForm.elements.discountPercentX.value = settings.discountPercentX;
  couponSettingsForm.elements.reservationSeconds.value = settings.reservationSeconds;
  milestonePercentDisplay.value = `${settings.discountPercentX}% (from settings x)`;

  couponSettingsSummary.innerHTML = `Every <strong>${settings.orderIntervalN}</strong> successful orders (system-wide) creates one milestone coupon for <strong>${settings.discountPercentX}%</strong> off. One coupon, one use, <strong>${settings.reservationSeconds}s</strong> checkout hold.`;

  milestoneGenerateSummary.textContent = `Percent-only, one use. Allowed when paid orders are ${formatPreMilestoneCounts(
    settings.orderIntervalN,
  )}, … (n=${settings.orderIntervalN}). If you skip this, checkout auto-creates a code for orders ${formatMilestoneOrderNumbers(
    settings.orderIntervalN,
  )}, …`;
}

async function refreshMilestoneSection() {
  const milestoneStatus = await apiRequest('/api/coupons/milestone-status');
  applyCouponSettingsUi(milestoneStatus.settings);
  renderMilestoneStatus(milestoneStatus);
}

async function loadCouponAdmin() {
  showBanner(couponSettingsMessage, '');
  showBanner(couponsMessage, '');

  try {
    const settings = await apiRequest('/api/coupons/settings');
    applyCouponSettingsUi(settings);
    await refreshMilestoneSection();

    const coupons = await apiRequest('/api/coupons');
    renderCouponsTable(coupons);
  } catch (error) {
    showBanner(couponSettingsMessage, error.message, true);
  }
}

function renderMilestoneStatus(status) {
  const paid = status.paidOrderCount ?? 0;
  const n = status.settings?.orderIntervalN ?? 5;
  const nextSlot = status.milestoneInfo?.nextOrderNumber;
  const canGenerate = Boolean(status.canGenerateMilestone);

  generateMilestoneBtn.disabled = !canGenerate;

  if (canGenerate && nextSlot) {
    milestoneStatusNote.classList.remove('is-blocked');
    milestoneStatusNote.textContent = `Paid orders: ${paid}. You can generate the ${status.settings.discountPercentX}% coupon for system order #${nextSlot} now.`;
    return;
  }

  milestoneStatusNote.classList.add('is-blocked');
  milestoneStatusNote.textContent =
    status.blockedReason ??
    `Paid orders: ${paid}. Next milestone slot is order #${Math.ceil((paid + 1) / n) * n}.`;
}

function renderCouponsTable(coupons) {
  couponsTableBody.innerHTML = '';

  if (!coupons.length) {
    couponsTableBody.innerHTML =
      '<tr><td colspan="5">No coupons yet. Milestone coupons appear automatically at checkout.</td></tr>';
    return;
  }

  for (const coupon of coupons) {
    const discountLabel =
      coupon.discountType === 'percent'
        ? `${coupon.discountValue}%`
        : formatMoney(coupon.discountValue);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(coupon.code)}</strong></td>
      <td>${discountLabel}</td>
      <td>${escapeHtml(coupon.source)}</td>
      <td>${escapeHtml(coupon.status)}</td>
      <td>${coupon.reservedUntil ? formatDate(coupon.reservedUntil) : '—'}</td>
    `;
    couponsTableBody.appendChild(row);
  }
}

async function saveCouponSettings(event) {
  event.preventDefault();
  showBanner(couponSettingsMessage, '');

  const formData = new FormData(couponSettingsForm);

  try {
    const settings = await apiRequest('/api/coupons/settings', {
      method: 'PUT',
      body: JSON.stringify({
        orderIntervalN: Number(formData.get('orderIntervalN')),
        discountPercentX: Number(formData.get('discountPercentX')),
        reservationSeconds: Number(formData.get('reservationSeconds')),
      }),
    });

    applyCouponSettingsUi(settings);
    await refreshMilestoneSection();
    showBanner(couponSettingsMessage, 'Coupon settings saved.');
  } catch (error) {
    showBanner(couponSettingsMessage, error.message, true);
  }
}

async function handleCreateCoupon(event) {
  event.preventDefault();
  showBanner(couponsMessage, '');

  const formData = new FormData(createCouponForm);
  const code = String(formData.get('code') ?? '').trim();

  try {
    await apiRequest('/api/coupons/generate-milestone', {
      method: 'POST',
      body: JSON.stringify(code ? { code } : {}),
    });

    createCouponForm.reset();
    showBanner(couponsMessage, 'Milestone coupon generated (percent discount).');
    await loadCouponAdmin();
  } catch (error) {
    showBanner(couponsMessage, error.message, true);
  }
}

function renderProducts(products) {
  productsCache = products;
  productsTableBody.innerHTML = '';

  if (products.length === 0) {
    productsTableBody.innerHTML =
      '<tr><td colspan="5">No products yet. Click “Add product” to create one.</td></tr>';
    return;
  }

  for (const product of products) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="product-cell">
          <img src="${product.imageUrl}" alt="" loading="lazy" />
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(truncate(product.description, 70))}</span>
          </div>
        </div>
      </td>
      <td>${product.quantity}</td>
      <td>${formatMoney(product.purchasePrice)}</td>
      <td>${formatMoney(product.sellingPrice)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost" data-action="edit" data-id="${product.id}">Edit</button>
          <button type="button" class="btn btn-danger" data-action="delete" data-id="${product.id}">Delete</button>
        </div>
      </td>
    `;

    productsTableBody.appendChild(row);
  }
}

async function loadProducts() {
  showBanner(productsMessage, '');

  try {
    const products = await apiRequest('/api/products/manage');
    renderProducts(products);
  } catch (error) {
    showBanner(productsMessage, error.message, true);
  }
}

function openProductDialog(product = null) {
  editingProductId = product?.id ?? null;
  productDialogTitle.textContent = product ? 'Edit product' : 'Add product';
  productFormError.hidden = true;
  productForm.reset();

  if (product) {
    productForm.elements.name.value = product.name;
    productForm.elements.description.value = product.description;
    productForm.elements.imageUrl.value = product.imageUrl;
    productForm.elements.quantity.value = product.quantity;
    productForm.elements.purchasePrice.value = product.purchasePrice;
    productForm.elements.sellingPrice.value = product.sellingPrice;
  }

  productDialog.showModal();
}

function closeProductDialog() {
  productDialog.close();
  editingProductId = null;
}

async function saveProduct(event) {
  event.preventDefault();
  productFormError.hidden = true;

  const formData = new FormData(productForm);
  const body = {
    name: formData.get('name'),
    description: formData.get('description'),
    imageUrl: formData.get('imageUrl'),
    quantity: Number(formData.get('quantity')),
    purchasePrice: Number(formData.get('purchasePrice')),
    sellingPrice: Number(formData.get('sellingPrice')),
  };

  try {
    if (editingProductId) {
      await apiRequest(`/api/products/${editingProductId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      showBanner(productsMessage, 'Product updated.');
    } else {
      await apiRequest('/api/products', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showBanner(productsMessage, 'Product created.');
    }

    closeProductDialog();
    await loadProducts();
  } catch (error) {
    productFormError.hidden = false;
    productFormError.textContent = error.message;
  }
}

async function deleteProduct(productId) {
  const product = productsCache.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  const confirmed = window.confirm(`Delete “${product.name}”? This cannot be undone.`);

  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(`/api/products/${productId}`, { method: 'DELETE' });
    showBanner(productsMessage, 'Product deleted.');
    await loadProducts();
  } catch (error) {
    showBanner(productsMessage, error.message, true);
  }
}

function renderKpis(summary) {
  const cards = [
    { label: 'Orders', value: summary.orderCount },
    { label: 'Revenue', value: formatMoney(summary.revenue) },
    { label: 'Discounts', value: formatMoney(summary.totalDiscount) },
    { label: 'Cost', value: formatMoney(summary.totalCost) },
    { label: 'Profit', value: formatMoney(summary.totalProfit) },
  ];

  kpiGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </article>
      `,
    )
    .join('');
}

function renderRecentOrders(orders) {
  recentOrdersBody.innerHTML = '';

  if (!orders.length) {
    recentOrdersBody.innerHTML = '<tr><td colspan="6">No orders yet.</td></tr>';
    return;
  }

  for (const order of orders) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${order.id.slice(0, 8)}…</td>
      <td>${formatMoney(order.total)}</td>
      <td>${formatMoney(order.discountAmount)}</td>
      <td>${formatMoney(order.grossProfit)}</td>
      <td>${order.couponCode ? escapeHtml(order.couponCode) : '—'}</td>
      <td>${formatDate(order.createdAt)}</td>
    `;
    recentOrdersBody.appendChild(row);
  }
}

function renderCharts(chartData) {
  const labels = chartData.map((row) => row.date);
  const revenueValues = chartData.map((row) => row.revenue);
  const profitValues = chartData.map((row) => row.profit);
  const orderValues = chartData.map((row) => row.orderCount);

  if (revenueChart) {
    revenueChart.destroy();
  }

  if (ordersChart) {
    ordersChart.destroy();
  }

  revenueChart = new Chart(document.getElementById('revenue-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data: revenueValues,
          borderColor: '#1b4965',
          backgroundColor: 'rgba(27, 73, 101, 0.12)',
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Profit',
          data: profitValues,
          borderColor: '#d4a373',
          backgroundColor: 'rgba(212, 163, 115, 0.15)',
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => `$${value}`,
          },
        },
      },
    },
  });

  ordersChart = new Chart(document.getElementById('orders-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Orders',
          data: orderValues,
          backgroundColor: '#1b4965',
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });
}

async function loadReports() {
  showBanner(reportsMessage, '');

  try {
    const dashboard = await apiRequest('/api/orders/reports/dashboard');
    renderKpis(dashboard.summary);
    renderCharts(dashboard.chart);
    renderRecentOrders(dashboard.recentOrders);
  } catch (error) {
    showBanner(reportsMessage, error.message, true);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function truncate(value, maxLength) {
  const text = String(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

loginForm.addEventListener('submit', handleLogin);
logoutBtn.addEventListener('click', () => {
  clearSession();
  showLogin();
});

navButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tab));
});

addProductBtn.addEventListener('click', () => openProductDialog());
refreshReportsBtn.addEventListener('click', () => loadReports());
couponSettingsForm.addEventListener('submit', saveCouponSettings);
createCouponForm.addEventListener('submit', handleCreateCoupon);
productForm.addEventListener('submit', saveProduct);
closeProductDialogBtn.addEventListener('click', closeProductDialog);
cancelProductDialogBtn.addEventListener('click', closeProductDialog);

productsTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button) {
    return;
  }

  const productId = button.dataset.id;
  const product = productsCache.find((item) => item.id === productId);

  if (button.dataset.action === 'edit' && product) {
    openProductDialog(product);
  }

  if (button.dataset.action === 'delete') {
    deleteProduct(productId);
  }
});

const storedUser = getStoredUser();

if (getToken() && storedUser?.role === 'admin') {
  showAdmin(storedUser);
  loadProducts();
} else {
  clearSession();
  showLogin();
}
