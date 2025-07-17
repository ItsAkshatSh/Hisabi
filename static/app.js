console.log('Hisabi app.js loaded');

// Global state
let savedReceipts = [];
let currentReceipt = null;

// DOM elements
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const uploadArea = document.getElementById('uploadArea');
const receiptInput = document.getElementById('receiptInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultSection = document.getElementById('resultSection');
const addItemBtn = document.getElementById('addItemBtn');
const saveManualBtn = document.getElementById('saveManualBtn');
const manualItems = document.getElementById('manualItems');

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOMContentLoaded fired');
    initializeEventListeners();
    loadSavedReceipts();
    setCurrentDate();
});

function initializeEventListeners() {

    menuBtn.addEventListener('click', handleMenuBtnClick);
    document.addEventListener('click', handleDocumentClick);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', handleTabBtnClick);
    });

    uploadArea.addEventListener('click', handleUploadAreaClick);
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    receiptInput.addEventListener('change', handleFileSelect);
    analyzeBtn.addEventListener('click', analyzeReceipt);

    addItemBtn.addEventListener('click', addItemRow);
    saveManualBtn.addEventListener('click', saveManualEntry);

    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', handleAuthTabClick);
    });

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    const googleLoginBtn = document.querySelector('.google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', handleGoogleLogin);
    }
}

// Handler functions
function handleMenuBtnClick(e) {
    toggleSidebar();
}
function handleDocumentClick(e) {
    if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
        closeSidebar();
    }
}
function handleTabBtnClick(e) {
    switchTab(e.currentTarget.dataset.tab);
}
function handleUploadAreaClick(e) {
    receiptInput.click();
}
function handleAuthTabClick(e) {
    switchAuthTab(e.currentTarget.dataset.auth);
}

function toggleSidebar() {
    sidebar.classList.toggle('open');
}

function closeSidebar() {
    sidebar.classList.remove('open');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    });
}

function switchAuthTab(authType) {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.auth === authType);
    });

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (authType === 'login') {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
    }
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect({ target: { files } });
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }

    const uploadText = document.getElementById('uploadText');
    const uploadSubtext = document.getElementById('uploadSubtext');
    
    uploadText.textContent = file.name;
    uploadSubtext.textContent = 'Ready to analyze';
    
    analyzeBtn.disabled = false;
    showToast(`Selected: ${file.name}`, 'success');
}

// Receipt analysis
async function analyzeReceipt() {
    const file = receiptInput.files[0];
    if (!file) {
        showToast('Please select an image first', 'error');
        return;
    }

    setLoadingState(true);

    try {
        const formData = new FormData();
        formData.append('receipt', file);
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok && data.items) {
            const items = data.items.map(item => ({
                name: item.name || item.description || '',
                quantity: item.quantity || 1,
                price: item.price || item.unit_price || 0
            }));
            const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            const receiptData = {
                items,
                total,
                date: new Date().toLocaleDateString(),
                store: 'Scanned Receipt'
            };
            displayResults(receiptData);
            saveReceipt(receiptData);
            showToast('Receipt analyzed successfully!', 'success');
            resetUploadArea();
        } else {
            showToast(data.error || 'Failed to analyze receipt. Please try again.', 'error');
        }
    } catch (error) {
        showToast('Failed to analyze receipt. Please try again.', 'error');
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(loading) {
    analyzeBtn.classList.toggle('loading', loading);
    analyzeBtn.disabled = loading;
}

function resetUploadArea() {
    const uploadText = document.getElementById('uploadText');
    const uploadSubtext = document.getElementById('uploadSubtext');
    
    uploadText.textContent = 'Drop your receipt here';
    uploadSubtext.textContent = 'or click to browse files';
    receiptInput.value = '';
    analyzeBtn.disabled = true;
}

function addItemRow() {
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    itemRow.innerHTML = `
        <input type="text" placeholder="Item name" class="item-name">
        <input type="number" min="1" value="1" class="item-quantity">
        <input type="number" step="0.01" min="0" placeholder="Price" class="item-price">
    `;
    manualItems.appendChild(itemRow);
}

function saveManualEntry() {
    const storeName = document.getElementById('storeName').value.trim();
    const receiptDate = document.getElementById('receiptDate').value;
    const itemRows = document.querySelectorAll('.item-row');

    if (!storeName) {
        showToast('Please enter a store name.', 'error');
        return;
    }
    if (!receiptDate) {
        showToast('Please select a date.', 'error');
        return;
    }

    const items = [];
    itemRows.forEach(row => {
        const name = row.querySelector('.item-name').value.trim();
        const quantity = parseInt(row.querySelector('.item-quantity').value) || 1;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        if (name && price > 0) {
            items.push({ name, quantity, price });
        }
    });

    if (items.length === 0) {
        showToast('Please add at least one valid item (name and price > 0).', 'error');
        return;
    }

    const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const manualData = {
        items,
        total,
        date: receiptDate,
        store: storeName
    };

    displayResults(manualData);
    saveReceipt(manualData);
    showToast('Manual entry saved!', 'success');
    resetManualForm();
}

function resetManualForm() {
    document.getElementById('storeName').value = '';
    document.getElementById('receiptDate').value = '';
    
    manualItems.innerHTML = `
        <div class="item-row">
            <input type="text" placeholder="Item name" class="item-name">
            <input type="number" min="1" value="1" class="item-quantity">
            <input type="number" step="0.01" min="0" placeholder="Price" class="item-price">
        </div>
    `;
    
    setCurrentDate();
}
function setCurrentDate() {
    const dateInput = document.getElementById('receiptDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

// Results display
function displayResults(data) {
    currentReceipt = data;
    const currency = document.getElementById('currencySelect')?.value || 'AED';
    const currencySymbol = {
        'AED': 'AED',
        'EUR': '€',
        'USD': '$'
    }[currency] || currency;
    let totalAmount = 0;
    let tableRows = '';
    data.items.forEach((item, index) => {
        const itemName = item.name || 'Unknown Item';
        const itemQty = Number(item.quantity) || 1;
        const itemPrice = Number(item.price) || 0;
        const itemTotal = Number(item.total) || (itemPrice * itemQty);
        totalAmount += itemTotal;
        tableRows += `
          <tr style="animation: fadeInUp 0.5s ease-out ${index * 0.1}s both">
            <td><strong>${escapeHtml(itemName)}</strong></td>
            <td>${itemQty}</td>
            <td>${currencySymbol} ${itemPrice.toFixed(2)}</td>
            <td><strong>${currencySymbol} ${itemTotal.toFixed(2)}</strong></td>
          </tr>
        `;
    });
    const resultHTML = `
        <div class="result-header">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22,4 12,14.01 9,11.01"></polyline>
            </svg>
            <h2 class="result-title">Receipt Analysis Complete</h2>
        </div>
        <div class="result-meta">
            ${data.store ? `
                <div class="result-meta-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 21h18"></path>
                        <path d="M5 21V7l8-4v18"></path>
                        <path d="M19 21V11l-6-4"></path>
                    </svg>
                    ${data.store}
                </div>
            ` : ''}
            ${data.date ? `
                <div class="result-meta-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    ${data.date}
                </div>
            ` : ''}
        </div>
        <table class="items-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Price</th>
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        <div class="final-total" style="margin-top: 1.5rem; text-align: right;">
            <span class="final-total-label">Grand Total:</span>
            <span class="final-total-amount"><strong>${currencySymbol} ${totalAmount.toFixed(2)}</strong></span>
        </div>
    `;
    resultSection.innerHTML = resultHTML;
    resultSection.style.display = '';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

//Listen for currency changes and re-render results
const currencySelect = document.getElementById('currencySelect');
if (currencySelect) {
    currencySelect.addEventListener('change', () => {
        if (currentReceipt) displayResults(currentReceipt);
        updateSidebar();
    });
}

function saveReceipt(data) {
    savedReceipts.unshift(data);
    updateSidebar();
    
    localStorage.setItem('savedReceipts', JSON.stringify(savedReceipts));
}

function loadSavedReceipts() {
    const saved = localStorage.getItem('savedReceipts');
    if (saved) {
        savedReceipts = JSON.parse(saved);
        updateSidebar();
    } else {
        savedReceipts = [];
        updateSidebar();
    }
}

function updateSidebar() {
    const savedReceiptsContainer = document.getElementById('savedReceipts');
    const currency = document.getElementById('currencySelect')?.value || 'AED';
    const currencySymbol = {
        'AED': 'AED',
        'EUR': '€',
        'USD': '$'
    }[currency] || currency;
    
    if (savedReceipts.length === 0) {
        savedReceiptsContainer.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.5;">
                    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path>
                </svg>
                <p>No receipts saved yet</p>
                <small>Upload or create your first receipt</small>
            </div>
        `;
        return;
    }
    
    const grandTotal = savedReceipts.reduce((sum, receipt) => sum + (Number(receipt.total) || 0), 0);
    
    const receiptsHTML = savedReceipts.map((receipt, index) => `
        <div class="receipt-item" onclick="loadReceipt(${index})">
            <div class="receipt-header">
                <div class="receipt-store">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 21h18"></path>
                        <path d="M5 21V7l8-4v18"></path>
                        <path d="M19 21V11l-6-4"></path>
                    </svg>
                    ${receipt.store || 'Unknown Store'}
                </div>
                <div class="receipt-total">${currencySymbol} ${receipt.total.toFixed(2)}</div>
            </div>
            <div class="receipt-meta">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${receipt.date || 'No date'}
            </div>
            <div class="receipt-items">
                ${receipt.items.length} item${receipt.items.length !== 1 ? 's' : ''}
            </div>
        </div>
    `).join('');
    
    savedReceiptsContainer.innerHTML = `
        <div class="sidebar-grand-total" style="padding: 0.5rem 1rem; font-weight: bold; border-bottom: 1px solid #eee; text-align: right;">
            Total of all receipts: <span style="color: #007bff;">${currencySymbol} ${grandTotal.toFixed(2)}</span>
        </div>
        ${receiptsHTML}
    `;
}

function loadReceipt(index) {
    const receipt = savedReceipts[index];
    if (receipt) {
        displayResults(receipt);
        closeSidebar();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const userEmailValue = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    showToast('Logging in...', 'info');
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmailValue, password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('Logged in successfully!', 'success');
            loadSavedReceipts();
        } else {
            showToast(data.error || 'Login failed. Please try again.', 'error');
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const username = form.querySelector('input[type="text"]').value;
    const userEmailValue = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    showToast('Registering...', 'info');
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email: userEmailValue, password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('Account created successfully!', 'success');
            loadSavedReceipts();
        } else {
            showToast(data.error || 'Registration failed. Please try again.', 'error');
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
    }
}

function handleGoogleLogin() {
    showToast('Google login is not yet implemented. Please use email/password login.', 'info');
    console.info('Google login button clicked. Integrate with backend when ready.');
}

let lastToastMessage = '';
function showToast(message, type = 'info', duration = 3000) {
    if (message === lastToastMessage) return;
    lastToastMessage = message;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '1000',
        padding: '12px 16px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        fontSize: '14px',
        maxWidth: '300px',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
    });
    const colors = {
        success: 'hsl(142 76% 36%)',
        error: 'hsl(0 84% 60%)',
        info: 'hsl(221 83% 53%)',
        warning: 'hsl(38 92% 50%)'
    };
    toast.style.background = colors[type] || colors.info;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            lastToastMessage = '';
        }, 300);
    }, duration);
}


window.loadReceipt = loadReceipt;

function updateAuthUI(email) {
  
}

window.handleGoogleCredentialResponse = async function(response) {
    if (response && response.credential) {
        showToast('Signing in with Google...', 'info');
        try {
            const res = await fetch('/api/google-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Logged in with Google!', 'success');
                loadSavedReceipts();
            } else {
                showToast(data.error || 'Google login failed.', 'error');
            }
        } catch (err) {
            showToast('Network error during Google login.', 'error');
        }
    } else {
        showToast('Google login failed or cancelled.', 'error');
    }
};
