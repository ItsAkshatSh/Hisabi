console.log('Hisabi visualizations.js loaded');

// DOM elements
const timeRangeSelect = document.getElementById('timeRange');
const chartTypeSelect = document.getElementById('chartType');
const categoryChartCanvas = document.getElementById('categoryChart');
const storeChartCanvas = document.getElementById('storeChart');
const timeChartCanvas = document.getElementById('timeChart');
const totalSpendingElement = document.getElementById('totalSpending');
const avgPerReceiptElement = document.getElementById('avgPerReceipt');
const topCategoryElement = document.getElementById('topCategory');
const receiptCountElement = document.getElementById('receiptCount');
const topExpensesElement = document.getElementById('topExpenses');

// Chart instances
let categoryChart = null;
let storeChart = null;
let timeChart = null;

// Global data
let allReceipts = [];
let filteredReceipts = [];
let categories = {}; // We'll infer categories from item names

// Colors for charts
const chartColors = [
  'rgba(54, 162, 235, 0.8)',
  'rgba(255, 99, 132, 0.8)',
  'rgba(75, 192, 192, 0.8)',
  'rgba(255, 159, 64, 0.8)',
  'rgba(153, 102, 255, 0.8)',
  'rgba(255, 205, 86, 0.8)',
  'rgba(201, 203, 207, 0.8)',
  'rgba(255, 99, 71, 0.8)',
  'rgba(50, 205, 50, 0.8)',
  'rgba(138, 43, 226, 0.8)'
];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  initializeEventListeners();
  loadReceiptData();
});

function initializeEventListeners() {
  // Add event listeners for filter changes
  timeRangeSelect.addEventListener('change', function() {
    // When time range changes, reload data from API
    loadReceiptData();
  });
  
  chartTypeSelect.addEventListener('change', updateVisualizations);
  
  // Currency selector event listener
  const currencySelect = document.getElementById('currencySelect');
  if (currencySelect) {
    currencySelect.addEventListener('change', updateVisualizations);
  }
  
  // Menu button for sidebar
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', toggleSidebar);
  }
  
  // Close sidebar when clicking outside
  document.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
      closeSidebar();
    }
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('open');
  }
}

// Load receipt data from localStorage or API
async function loadReceiptData() {
  try {
    // First try to get from localStorage
    const savedReceipts = localStorage.getItem('savedReceipts');
    if (savedReceipts) {
      allReceipts = JSON.parse(savedReceipts);
      processReceiptData();
      return;
    }
    
    // If not in localStorage, try to fetch from API
    // First try the new spending summary endpoint
    const timeRange = timeRangeSelect.value;
    let apiUrl = '/api/spending/summary';
    
    // Add time range parameters if needed
    if (timeRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }
      
      if (startDate) {
        apiUrl += `?start_date=${startDate.toISOString().split('T')[0]}`;
      }
    }
    
    const summaryResponse = await fetch(apiUrl);
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      
      // Update charts directly from summary data
      updateChartsFromSummary(summaryData);
      return;
    }
    
    // Fallback to the old method if the summary endpoint fails
    const response = await fetch('/api/receipts');
    if (response.ok) {
      const data = await response.json();
      if (data.receipts && Array.isArray(data.receipts)) {
        // We need to fetch each receipt's details
        const receiptPromises = data.receipts.map(async (receipt) => {
          const detailResponse = await fetch(`/api/receipt/${receipt.id}`);
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            return {
              ...detailData,
              items: JSON.parse(detailData.data).items || [],
              total: JSON.parse(detailData.data).total || 0,
              store: JSON.parse(detailData.data).store || 'Unknown Store',
              date: JSON.parse(detailData.data).date || detailData.saved_at
            };
          }
          return null;
        });
        
        const receiptsWithDetails = (await Promise.all(receiptPromises)).filter(r => r !== null);
        allReceipts = receiptsWithDetails;
        processReceiptData();
      }
    } else {
      showError('Failed to load receipt data');
    }
  } catch (error) {
    console.error('Error loading receipt data:', error);
    showError('Error loading receipt data');
  }
}

// Process receipt data to extract categories and prepare for visualization
function processReceiptData() {
  // Apply time range filter
  filterReceiptsByTimeRange();
  
  // Infer categories from item names (in a real app, you'd have proper categories)
  inferCategories();
  
  // Update all visualizations
  updateVisualizations();
  
  // Update sidebar with recent receipts
  updateSidebar();
}

// Filter receipts based on selected time range
function filterReceiptsByTimeRange() {
  const timeRange = timeRangeSelect.value;
  const now = new Date();
  let startDate = new Date(0); // Jan 1, 1970
  
  switch (timeRange) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default: // 'all'
      startDate = new Date(0);
  }
  
  filteredReceipts = allReceipts.filter(receipt => {
    const receiptDate = new Date(receipt.date);
    return receiptDate >= startDate;
  });
}

// Infer categories from item names
function inferCategories() {
  // Simple category mapping based on keywords
  const categoryKeywords = {
    'Grocery': ['food', 'grocery', 'fruit', 'vegetable', 'meat', 'dairy', 'bread', 'milk', 'egg'],
    'Restaurant': ['restaurant', 'cafe', 'dining', 'lunch', 'dinner', 'breakfast', 'meal', 'coffee'],
    'Electronics': ['electronics', 'computer', 'phone', 'laptop', 'tablet', 'gadget', 'tech'],
    'Clothing': ['clothing', 'shirt', 'pants', 'dress', 'shoes', 'apparel', 'fashion'],
    'Household': ['household', 'furniture', 'kitchen', 'home', 'decor', 'cleaning'],
    'Transportation': ['transport', 'gas', 'fuel', 'car', 'bus', 'train', 'taxi', 'uber'],
    'Entertainment': ['entertainment', 'movie', 'game', 'book', 'music', 'concert', 'show'],
    'Health': ['health', 'medicine', 'doctor', 'pharmacy', 'medical', 'fitness'],
    'Beauty': ['beauty', 'cosmetic', 'makeup', 'hair', 'salon', 'spa'],
    'Other': []
  };
  
  // Reset categories
  categories = {};
  
  // Process each receipt and its items
  filteredReceipts.forEach(receipt => {
    if (!receipt.items || !Array.isArray(receipt.items)) return;
    
    receipt.items.forEach(item => {
      if (!item.name) return;
      
      const itemName = item.name.toLowerCase();
      const itemTotal = (item.quantity || 1) * (item.price || 0);
      
      // Find matching category
      let assignedCategory = 'Other';
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => itemName.includes(keyword))) {
          assignedCategory = category;
          break;
        }
      }
      
      // Add to category total
      if (!categories[assignedCategory]) {
        categories[assignedCategory] = 0;
      }
      categories[assignedCategory] += itemTotal;
    });
  });
}

// Update all visualizations
function updateVisualizations() {
  // Apply time range filter
  filterReceiptsByTimeRange();
  
  // Infer categories
  inferCategories();
  
  // Update charts
  updateCategoryChart();
  updateStoreChart();
  updateTimeChart();
  updateSummaryStats();
  updateTopExpenses();
}

// Update category chart
function updateCategoryChart() {
  const chartType = chartTypeSelect.value;
  
  // Prepare data
  const categoryNames = Object.keys(categories);
  const categoryValues = Object.values(categories);
  
  // Sort by value (descending)
  const sortedIndices = categoryValues.map((_, i) => i)
    .sort((a, b) => categoryValues[b] - categoryValues[a]);
  
  const sortedNames = sortedIndices.map(i => categoryNames[i]);
  const sortedValues = sortedIndices.map(i => categoryValues[i]);
  
  // Get currency symbol
  const currency = document.getElementById('currencySelect')?.value || 'AED';
  const currencySymbol = getCurrencySymbol(currency);
  
  // Destroy previous chart if it exists
  if (categoryChart) {
    categoryChart.destroy();
  }
  
  // Create new chart
  const ctx = categoryChartCanvas.getContext('2d');
  
  const chartConfig = {
    type: chartType === 'bar' ? 'bar' : 'pie',
    data: {
      labels: sortedNames,
      datasets: [{
        label: 'Spending by Category',
        data: sortedValues,
        backgroundColor: chartColors.slice(0, sortedNames.length),
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: 'white'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${currencySymbol} ${value.toFixed(2)} (${percentage}%)`;
            }
          }
        }
      }
    }
  };
  
  // Additional options for bar chart
  if (chartType === 'bar') {
    chartConfig.options.scales = {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'white',
          callback: function(value) {
            return currencySymbol + ' ' + value;
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      x: {
        ticks: {
          color: 'white'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    };
  }
  
  categoryChart = new Chart(ctx, chartConfig);
}

// Update store chart
function updateStoreChart() {
  // Group by store
  const storeData = {};
  
  filteredReceipts.forEach(receipt => {
    const store = receipt.store || 'Unknown Store';
    const total = receipt.total || 0;
    
    if (!storeData[store]) {
      storeData[store] = 0;
    }
    storeData[store] += total;
  });
  
  // Sort stores by total (descending)
  const storeNames = Object.keys(storeData);
  const storeValues = Object.values(storeData);
  
  const sortedIndices = storeValues.map((_, i) => i)
    .sort((a, b) => storeValues[b] - storeValues[a]);
  
  // Limit to top 5 stores
  const topStoreNames = sortedIndices.slice(0, 5).map(i => storeNames[i]);
  const topStoreValues = sortedIndices.slice(0, 5).map(i => storeValues[i]);
  
  // Get currency symbol
  const currency = document.getElementById('currencySelect')?.value || 'AED';
  const currencySymbol = getCurrencySymbol(currency);
  
  // Destroy previous chart if it exists
  if (storeChart) {
    storeChart.destroy();
  }
  
  // Create new chart
  const ctx = storeChartCanvas.getContext('2d');
  const chartType = chartTypeSelect.value;
  
  const chartConfig = {
    type: chartType === 'bar' ? 'bar' : 'pie',
    data: {
      labels: topStoreNames,
      datasets: [{
        label: 'Spending by Store',
        data: topStoreValues,
        backgroundColor: chartColors.slice(0, topStoreNames.length),
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: 'white'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${currencySymbol} ${value.toFixed(2)} (${percentage}%)`;
            }
          }
        }
      }
    }
  };
  
  // Additional options for bar chart
  if (chartType === 'bar') {
    chartConfig.options.scales = {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'white',
          callback: function(value) {
            return currencySymbol + ' ' + value;
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      x: {
        ticks: {
          color: 'white'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    };
  }
  
  storeChart = new Chart(ctx, chartConfig);
}

// Update time chart
function updateTimeChart() {
  // Group by month
  const timeData = {};
  
  filteredReceipts.forEach(receipt => {
    const date = new Date(receipt.date);
    const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const total = receipt.total || 0;
    
    if (!timeData[monthYear]) {
      timeData[monthYear] = 0;
    }
    timeData[monthYear] += total;
  });
  
  // Sort by date
  const sortedMonths = Object.keys(timeData).sort();
  const monthlyTotals = sortedMonths.map(month => timeData[month]);
  
  // Format labels
  const formattedLabels = sortedMonths.map(month => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  });
  
  // Get currency symbol
  const currency = document.getElementById('currencySelect')?.value || 'AED';
  const currencySymbol = getCurrencySymbol(currency);
  
  // Destroy previous chart if it exists
  if (timeChart) {
    timeChart.destroy();
  }
  
  // Create new chart
  const ctx = timeChartCanvas.getContext('2d');
  
  timeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: formattedLabels,
      datasets: [{
        label: 'Monthly Spending',
        data: monthlyTotals,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'white'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${currencySymbol} ${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white',
            callback: function(value) {
              return currencySymbol + ' ' + value;
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  });
}

// Update summary statistics
function updateSummaryStats() {
  // Get currency symbol
  const currency = document.getElementById('currencySelect')?.value || 'AED';
  const currencySymbol = getCurrencySymbol(currency);
  
  // Calculate total spending
  const totalSpending = filteredReceipts.reduce((sum, receipt) => sum + (receipt.total || 0), 0);
  
  // Calculate average per receipt
  const avgPerReceipt = filteredReceipts.length > 0 ? totalSpending / filteredReceipts.length : 0;
  
  // Find top category
  let topCategory = 'None';
  let topCategoryAmount = 0;
  
  for (const [category, amount] of Object.entries(categories)) {
    if (amount > topCategoryAmount) {
      topCategory = category;
      topCategoryAmount = amount;
    }
  }
  
  // Update DOM elements
  totalSpendingElement.querySelector('.stat-value').textContent = `${currencySymbol} ${totalSpending.toFixed(2)}`;
  avgPerReceiptElement.querySelector('.stat-value').textContent = `${currencySymbol} ${avgPerReceipt.toFixed(2)}`;
  topCategoryElement.querySelector('.stat-value').textContent = topCategory;
  receiptCountElement.querySelector('.stat-value').textContent = filteredReceipts.length;
}

// Update top expenses list
function updateTopExpenses() {
  // Get currency symbol
  const currency = document.getElementById('currencySelect')?.value || 'AED';
  const currencySymbol = getCurrencySymbol(currency);
  
  // Collect all items from all receipts
  const allItems = [];
  
  filteredReceipts.forEach(receipt => {
    if (!receipt.items || !Array.isArray(receipt.items)) return;
    
    receipt.items.forEach(item => {
      if (!item.name) return;
      
      const itemTotal = (item.quantity || 1) * (item.price || 0);
      allItems.push({
        name: item.name,
        total: itemTotal,
        store: receipt.store || 'Unknown Store',
        date: receipt.date
      });
    });
  });
  
  // Sort by total (descending)
  allItems.sort((a, b) => b.total - a.total);
  
  // Take top 5
  const topItems = allItems.slice(0, 5);
  
  // Update DOM
  if (topItems.length === 0) {
    topExpensesElement.innerHTML = `
      <div class="empty-state">
        <p>No receipt data available</p>
      </div>
    `;
    return;
  }
  
  const itemsHTML = topItems.map((item, index) => `
    <div class="expense-item">
      <div class="expense-rank">${index + 1}</div>
      <div class="expense-details">
        <div class="expense-name">${escapeHtml(item.name)}</div>
        <div class="expense-meta">${escapeHtml(item.store)} · ${formatDate(item.date)}</div>
      </div>
      <div class="expense-amount">${currencySymbol} ${item.total.toFixed(2)}</div>
    </div>
  `).join('');
  
  topExpensesElement.innerHTML = itemsHTML;
}

// Update sidebar with recent receipts
function updateSidebar() {
  const savedReceiptsContainer = document.getElementById('savedReceipts');
  if (!savedReceiptsContainer) return;
  
  const currency = document.getElementById('currencySelect')?.value || 'AED';
  const currencySymbol = getCurrencySymbol(currency);
  
  if (allReceipts.length === 0) {
    savedReceiptsContainer.innerHTML = `
      <div class="sidebar-section-title">Recent Receipts</div>
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
  
  // Sort receipts by date (newest first)
  const sortedReceipts = [...allReceipts].sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });
  
  // Take the 5 most recent receipts
  const recentReceipts = sortedReceipts.slice(0, 5);
  
  const receiptsHTML = recentReceipts.map((receipt, index) => `
    <div class="receipt-item">
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
        ${formatDate(receipt.date)}
      </div>
      <div class="receipt-items">
        ${receipt.items ? receipt.items.length : 0} item${receipt.items && receipt.items.length !== 1 ? 's' : ''}
      </div>
    </div>
  `).join('');
  
  savedReceiptsContainer.innerHTML = `
    <div class="sidebar-section-title">Recent Receipts</div>
    ${receiptsHTML}
  `;
}

// Helper function to get currency symbol
function getCurrencySymbol(currency) {
  const symbols = {
    'AED': 'AED',
    'EUR': '€',
    'USD': '$'
  };
  return symbols[currency] || currency;
}

// Helper function to format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Helper function to escape HTML
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

// Update charts directly from summary data
function updateChartsFromSummary(summaryData) {
  // Get currency symbol
  const currency = document.getElementById('currencySelect')?.value || 'AED';
  const currencySymbol = getCurrencySymbol(currency);
  
  // Update summary statistics
  if (totalSpendingElement) {
    totalSpendingElement.querySelector('.stat-value').textContent = `${currencySymbol} ${summaryData.total_spending.toFixed(2)}`;
  }
  
  if (avgPerReceiptElement && summaryData.receipt_count > 0) {
    const avgSpending = summaryData.total_spending / summaryData.receipt_count;
    avgPerReceiptElement.querySelector('.stat-value').textContent = `${currencySymbol} ${avgSpending.toFixed(2)}`;
  }
  
  if (receiptCountElement) {
    receiptCountElement.querySelector('.stat-value').textContent = summaryData.receipt_count;
  }
  
  // Find top category
  if (topCategoryElement && summaryData.category_spending && summaryData.category_spending.length > 0) {
    const sortedCategories = [...summaryData.category_spending].sort((a, b) => b.total - a.total);
    topCategoryElement.querySelector('.stat-value').textContent = sortedCategories[0].category;
  }
  
  // Update category chart
  if (categoryChartCanvas && summaryData.category_spending) {
    updateCategoryChartFromSummary(summaryData.category_spending, currencySymbol);
  }
  
  // Update store chart
  if (storeChartCanvas && summaryData.top_stores) {
    updateStoreChartFromSummary(summaryData.top_stores, currencySymbol);
  }
  
  // Update time chart
  if (timeChartCanvas && summaryData.monthly_spending) {
    updateTimeChartFromSummary(summaryData.monthly_spending, currencySymbol);
  }
  
  // Update top expenses
  if (topExpensesElement && summaryData.top_expenses) {
    updateTopExpensesFromSummary(summaryData.top_expenses, currencySymbol);
  }
}

// Update category chart from summary data
function updateCategoryChartFromSummary(categoryData, currencySymbol) {
  const chartType = chartTypeSelect.value;
  
  // Sort categories by total (descending)
  const sortedCategories = [...categoryData].sort((a, b) => b.total - a.total);
  
  const categoryNames = sortedCategories.map(item => item.category);
  const categoryValues = sortedCategories.map(item => item.total);
  
  // Destroy previous chart if it exists
  if (categoryChart) {
    categoryChart.destroy();
  }
  
  // Create new chart
  const ctx = categoryChartCanvas.getContext('2d');
  
  const chartConfig = {
    type: chartType === 'bar' ? 'bar' : 'pie',
    data: {
      labels: categoryNames,
      datasets: [{
        label: 'Spending by Category',
        data: categoryValues,
        backgroundColor: chartColors.slice(0, categoryNames.length),
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: 'white'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${currencySymbol} ${value.toFixed(2)} (${percentage}%)`;
            }
          }
        }
      }
    }
  };
  
  // Additional options for bar chart
  if (chartType === 'bar') {
    chartConfig.options.scales = {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'white',
          callback: function(value) {
            return currencySymbol + ' ' + value;
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      x: {
        ticks: {
          color: 'white'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    };
  }
  
  categoryChart = new Chart(ctx, chartConfig);
}

// Update store chart from summary data
function updateStoreChartFromSummary(storeData, currencySymbol) {
  const chartType = chartTypeSelect.value;
  
  const storeNames = storeData.map(item => item.name);
  const storeValues = storeData.map(item => item.total);
  
  // Destroy previous chart if it exists
  if (storeChart) {
    storeChart.destroy();
  }
  
  // Create new chart
  const ctx = storeChartCanvas.getContext('2d');
  
  const chartConfig = {
    type: chartType === 'bar' ? 'bar' : 'pie',
    data: {
      labels: storeNames,
      datasets: [{
        label: 'Spending by Store',
        data: storeValues,
        backgroundColor: chartColors.slice(0, storeNames.length),
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: 'white'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${currencySymbol} ${value.toFixed(2)} (${percentage}%)`;
            }
          }
        }
      }
    }
  };
  
  // Additional options for bar chart
  if (chartType === 'bar') {
    chartConfig.options.scales = {
      y: {
        beginAtZero: true,
        ticks: {
          color: 'white',
          callback: function(value) {
            return currencySymbol + ' ' + value;
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      x: {
        ticks: {
          color: 'white'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    };
  }
  
  storeChart = new Chart(ctx, chartConfig);
}

// Update time chart from summary data
function updateTimeChartFromSummary(monthlyData, currencySymbol) {
  // Sort by month
  const sortedMonthly = [...monthlyData].sort((a, b) => a.month.localeCompare(b.month));
  
  const months = sortedMonthly.map(item => item.month);
  const values = sortedMonthly.map(item => item.total);
  
  // Format labels
  const formattedLabels = months.map(month => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  });
  
  // Destroy previous chart if it exists
  if (timeChart) {
    timeChart.destroy();
  }
  
  // Create new chart
  const ctx = timeChartCanvas.getContext('2d');
  
  timeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: formattedLabels,
      datasets: [{
        label: 'Monthly Spending',
        data: values,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: 'white'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${currencySymbol} ${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white',
            callback: function(value) {
              return currencySymbol + ' ' + value;
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: 'white'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  });
}

// Update top expenses from summary data
function updateTopExpensesFromSummary(expensesData, currencySymbol) {
  if (expensesData.length === 0) {
    topExpensesElement.innerHTML = `
      <div class="empty-state">
        <p>No receipt data available</p>
      </div>
    `;
    return;
  }
  
  const itemsHTML = expensesData.slice(0, 5).map((item, index) => `
    <div class="expense-item">
      <div class="expense-name">${escapeHtml(item.name)}</div>
      <div class="expense-amount">${currencySymbol} ${item.total.toFixed(2)}</div>
    </div>
  `).join('');
  
  topExpensesElement.innerHTML = itemsHTML;
}

// Helper function to show error
function showError(message) {
  // You could implement a toast notification here
  console.error(message);
  
  // Update charts with empty data
  updateVisualizations();
}