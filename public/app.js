// State variables
let currentCursor = null;
let selectedCategory = null;
let loadedCount = 0;
let isLoading = false;
let hasMore = true;

// DOM elements
const productsGrid = document.getElementById('products-grid');
const categoryChips = document.getElementById('category-chips');
const loadingSkeletons = document.getElementById('loading-skeletons');
const emptyState = document.getElementById('empty-state');
const loadMoreBtn = document.getElementById('load-more-btn');
const spinner = document.getElementById('infinite-scroll-spinner');
const resetFiltersBtn = document.getElementById('reset-filters-btn');

// Metrics elements
const metricQueryTime = document.getElementById('metric-query-time');
const metricLoadedCount = document.getElementById('metric-loaded-count');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  fetchCategories();
  fetchProducts(true); // Initial load (resetting catalog)

  // Event listener for manual load more fallback
  loadMoreBtn.addEventListener('click', () => {
    if (!isLoading && hasMore) {
      fetchProducts(false);
    }
  });

  // Event listener for resetting filters
  resetFiltersBtn.addEventListener('click', () => {
    if (selectedCategory !== null) {
      selectedCategory = null;
      // Remove active class from all chips
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      fetchProducts(true);
    }
  });

  // Setup infinite scroll observer
  setupInfiniteScroll();
});

// Fetch distinct categories from the backend
async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    const categories = await res.json();

    // Clear skeletons
    categoryChips.innerHTML = '';

    // Render dynamic category chips
    categories.forEach(category => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = category;
      chip.addEventListener('click', () => handleCategoryClick(chip, category));
      categoryChips.appendChild(chip);
    });
  } catch (err) {
    console.error('Error loading categories:', err);
    categoryChips.innerHTML = '<span class="text-error">Failed to load categories</span>';
  }
}

// Handle Category chip selection
function handleCategoryClick(chipElement, category) {
  // If clicked category is already active, deselect it
  if (chipElement.classList.contains('active')) {
    chipElement.classList.remove('active');
    selectedCategory = null;
  } else {
    // Deactivate all other chips and activate the clicked one
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chipElement.classList.add('active');
    selectedCategory = category;
  }

  // Re-fetch products starting from page 1
  fetchProducts(true);
}

// Fetch products from backend
async function fetchProducts(reset = false) {
  if (isLoading) return;

  if (reset) {
    currentCursor = null;
    hasMore = true;
    loadedCount = 0;
    productsGrid.innerHTML = '';
    emptyState.classList.add('hidden');
    metricLoadedCount.textContent = '0';
  }

  if (!hasMore) return;

  isLoading = true;
  showLoadingState(true, reset);

  try {
    // Build query URL
    let url = `/api/products?limit=24`;
    if (selectedCategory) {
      url += `&category=${encodeURIComponent(selectedCategory)}`;
    }
    if (currentCursor) {
      url += `&cursor=${encodeURIComponent(currentCursor)}`;
    }

    const startTime = Date.now();
    const res = await fetch(url);
    const fetchDuration = Date.now() - startTime;

    if (!res.ok) throw new Error('Failed to fetch products');

    const data = await res.json();

    // Update metrics HUD
    // Use header-derived db query time if available, otherwise fallback to fetchDuration
    const dbQueryTime = res.headers.get('X-Query-Time-Ms') || data.queryTimeMs;
    metricQueryTime.textContent = `${dbQueryTime} ms`;

    const products = data.products || [];
    currentCursor = data.nextCursor;

    // Render cards
    if (products.length === 0 && reset) {
      emptyState.classList.remove('hidden');
    } else {
      products.forEach(product => {
        const card = createProductCard(product);
        productsGrid.appendChild(card);
      });

      loadedCount += products.length;
      metricLoadedCount.textContent = loadedCount.toLocaleString();
    }

    // Determine if there is more data
    if (!currentCursor || products.length < 24) {
      hasMore = false;
    }

  } catch (err) {
    console.error('Error loading products:', err);
    if (reset) {
      productsGrid.innerHTML = '<p class="error-msg">Error loading catalog. Please check your DB connection and try again.</p>';
    }
  } finally {
    isLoading = false;
    showLoadingState(false, reset);
  }
}

// HElper to create product card DOM elements
function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';

  // Format dates cleanly
  const createdAtFormatted = new Date(product.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  card.innerHTML = `
    <span class="product-category">${escapeHtml(product.category)}</span>
    <h4 class="product-name">${escapeHtml(product.name)}</h4>
    <div class="product-price-row">
      <span class="product-price">${parseFloat(product.price).toFixed(2)}</span>
      <span class="product-id-badge">ID: #${product.id}</span>
    </div>
    <div class="product-time">
      <span>Created:</span>
      <span>${createdAtFormatted}</span>
    </div>
  `;
  return card;
}

// Toggle loader elements depending on active operation
function showLoadingState(show, isReset) {
  if (show) {
    if (isReset) {
      loadingSkeletons.classList.remove('hidden');
      loadMoreBtn.classList.add('hidden');
      spinner.classList.add('hidden');
    } else {
      spinner.classList.remove('hidden');
      loadMoreBtn.classList.add('hidden');
    }
  } else {
    loadingSkeletons.classList.add('hidden');
    spinner.classList.add('hidden');

    if (hasMore) {
      loadMoreBtn.classList.remove('hidden');
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  }
}

// Setup IntersectionObserver for Infinite Scrolling
function setupInfiniteScroll() {
  const triggerZone = document.querySelector('.pagination-trigger-zone');

  const observer = new IntersectionObserver((entries) => {
    // If spinner or load-more is in view and we aren't loading, load more
    if (entries[0].isIntersecting && !isLoading && hasMore) {
      fetchProducts(false);
    }
  }, {
    rootMargin: '200px', // Trigger load 200px before reaching the bottom
    threshold: 0.1
  });

  observer.observe(triggerZone);
}

// HTML Escaping Utility to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
