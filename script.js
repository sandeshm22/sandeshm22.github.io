/* script.js - Vibrant Marketplace frontend
   - Loads products.json
   - Renders product grid (Tailwind cards)
   - Search, category filter, sort, price & rating filters
   - Pagination, animated add-to-cart, cart drawer, quick view modal
   - Placeholder image fallback
*/

(function imageFallback() {
  const placeholder = 'images/placeholder.png';
  const _ph = new Image(); _ph.src = placeholder;
  document.addEventListener('error', function (e) {
    const tgt = e.target;
    if (tgt && tgt.tagName === 'IMG') {
      if (!tgt.dataset.fallbackApplied) {
        tgt.dataset.fallbackApplied = 'true';
        tgt.src = placeholder;
      }
    }
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img').forEach(img => {
      if (!img.getAttribute('src')) img.src = placeholder;
    });
  });
})();

let productsData = null;
let cart = [];
let currentCategory = 'all';
let currentSearch = '';
let currentSort = 'relevance';
let priceFilter = { min: null, max: null };
let ratingFilter = 0;
let page = 1;
const PAGE_SIZE = 12;

const el = id => document.getElementById(id);
const productListEl = () => el('productList');
const cartCountBadge = () => el('cartCountBadge');
const cartItemsEl = () => el('cartItems');
const totalEl = () => el('total');
const toastContainer = () => el('toastContainer');

async function loadProducts() {
  showSkeletons();
  try {
    const res = await fetch('products.json');
    productsData = await res.json();
  } catch (err) {
    console.error('Failed to load products.json', err);
    productsData = { categories: [] };
  }
  populateCategoryFilter();
  restoreCart();
  renderProducts();
  renderCart();
}

function showSkeletons() {
  const container = productListEl();
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const div = document.createElement('div');
    div.className = 'animate-pulse bg-white/60 p-4 rounded-lg';
    div.innerHTML = `<div class="h-56 bg-slate-200 rounded mb-3"></div>
                     <div class="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                     <div class="h-3 bg-slate-200 rounded w-1/2"></div>`;
    container.appendChild(div);
  }
}

function populateCategoryFilter() {
  const filter = el('categoryFilter');
  filter.innerHTML = '<option value="all">All Categories</option>';
  (productsData.categories || []).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = cat.name;
    filter.appendChild(opt);
  });
}

function getAllItems() {
  const cats = productsData.categories || [];
  return cats.flatMap(c => c.items.map(it => ({ ...it, category: c.name })));
}

function applyFilters(items) {
  let out = items;
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    out = out.filter(i => i.name.toLowerCase().includes(q) || (i.short || '').toLowerCase().includes(q));
  }
  if (currentCategory !== 'all') out = out.filter(i => i.category === currentCategory);
  if (priceFilter.min != null) out = out.filter(i => i.price >= priceFilter.min);
  if (priceFilter.max != null) out = out.filter(i => i.price <= priceFilter.max);
  if (ratingFilter > 0) out = out.filter(i => (i.rating || 0) >= ratingFilter);
  return out;
}

function applySort(items) {
  const arr = [...items];
  if (currentSort === 'price_asc') arr.sort((a,b)=>a.price-b.price);
  else if (currentSort === 'price_desc') arr.sort((a,b)=>b.price-a.price);
  else if (currentSort === 'rating_desc') arr.sort((a,b)=>(b.rating||0)-(a.rating||0));
  return arr;
}

function paginate(items) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * PAGE_SIZE;
  return { items: items.slice(start, start + PAGE_SIZE), totalPages };
}

function renderProducts() {
  const all = getAllItems();
  const filtered = applyFilters(all);
  const sorted = applySort(filtered);
  const { items, totalPages } = paginate(sorted);

  const container = productListEl();
  container.innerHTML = '';

  if (!items.length) {
    el('noResults').classList.remove('hidden');
    return;
  } else {
    el('noResults').classList.add('hidden');
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg overflow-hidden card-hover shadow-sm';
    const saleHtml = item.sale ? `<div class="absolute top-3 left-3 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded">${item.sale}% OFF</div>` : '';
    const stars = renderStars(item.rating || 4.5);

    card.innerHTML = `
      <div class="relative">
        ${saleHtml}
        <img src="${item.image || 'images/placeholder.png'}" alt="${item.name}" class="product-img" loading="lazy">
      </div>
      <div class="p-4">
        <div class="flex justify-between items-start">
          <h4 class="text-md font-semibold">${item.name}</h4>
          <div class="badge-price">${item.price}₹</div>
        </div>
        <p class="text-sm text-slate-500 mt-2">${item.short || ''}</p>
        <div class="mt-3">${stars}</div>
        <div class="mt-4 flex gap-2">
          <button class="flex-1 px-3 py-2 border rounded text-sm" onclick="openQuickView(${item.id})"><i class="bi bi-eye me-2"></i>Quick view</button>
          <button class="flex-1 px-3 py-2 bg-indigo-600 text-white rounded text-sm" onclick="addToCartAnimated(${item.id}, '${escapeQuotes(item.name)}', ${item.price}, this)"><i class="bi bi-cart-plus me-2"></i>Add</button>
        </div>
      </div>
    `;
    const wrapper = document.createElement('div');
    wrapper.className = 'col-span-1';
    wrapper.appendChild(card);
    container.appendChild(wrapper);
  });

  // pagination controls
  const existingPager = document.getElementById('vm-pager');
  if (existingPager) existingPager.remove();
  const pager = document.createElement('div');
  pager.id = 'vm-pager';
  pager.className = 'lg:col-span-3 flex items-center justify-center gap-3 mt-6';
  pager.innerHTML = `
    <button class="px-3 py-1 border rounded" ${page===1?'disabled':''} onclick="changePage(${page-1})">Prev</button>
    <span class="text-sm text-slate-600">Page ${page} of ${totalPages}</span>
    <button class="px-3 py-1 border rounded" ${page===totalPages?'disabled':''} onclick="changePage(${page+1})">Next</button>
  `;
  productListEl().parentElement.appendChild(pager);
}

function escapeQuotes(s) { return s.replace(/'/g, "\\'").replace(/"/g, '\\"'); }
function renderStars(r) {
  const full = Math.floor(r);
  const half = (r - full) >= 0.5;
  let html = '';
  for (let i=0;i<full;i++) html += '<i class="bi bi-star-fill text-amber-400"></i>';
  if (half) html += '<i class="bi bi-star-half text-amber-400"></i>';
  const empty = 5 - full - (half?1:0);
  for (let i=0;i<empty;i++) html += '<i class="bi bi-star text-amber-200"></i>';
  html += ` <span class="text-sm text-slate-500">(${r.toFixed(1)})</span>`;
  return html;
}

/* Filters & controls */
function filterCategory() { currentCategory = el('categoryFilter').value; page = 1; renderProducts(); }
function searchProducts() { currentSearch = el('searchInput').value.trim(); page = 1; renderProducts(); }
function sortProducts() { currentSort = el('sortSelect').value; page = 1; renderProducts(); }
function applyPriceFilter() {
  const min = parseFloat(el('minPrice').value) || null;
  const max = parseFloat(el('maxPrice').value) || null;
  priceFilter = { min, max }; page = 1; renderProducts();
}
function applyRatingFilter(r) { ratingFilter = r; page = 1; renderProducts(); }
function changePage(p) { page = Math.max(1, p); renderProducts(); }
function openMobileFilters() { el('searchInput').focus(); }

/* Cart logic */
function restoreCart() {
  const saved = localStorage.getItem('cart');
  if (saved) cart = JSON.parse(saved);
  updateCartBadge();
}
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); updateCartBadge(); }
function updateCartBadge() {
  const count = cart.reduce((s,i)=>s+i.quantity,0);
  const badge = cartCountBadge();
  badge.textContent = count;
  badge.style.display = count ? 'inline-block' : 'none';
}
function addToCart(id, name, price, qty=1) {
  const existing = cart.find(i=>i.id===id);
  if (existing) existing.quantity += qty;
  else cart.push({ id, name, price, quantity: qty });
  saveCart(); renderCart(); showToast(`${name} added to cart`, 'success');
}

/* Animated add-to-cart */
function addToCartAnimated(id, name, price, btnEl) {
  const card = btnEl.closest('.bg-white') || btnEl.closest('.card-hover');
  const img = card ? card.querySelector('img') : null;
  if (img) {
    const imgRect = img.getBoundingClientRect();
    const badge = cartCountBadge();
    const badgeRect = badge.getBoundingClientRect();
    const clone = img.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = imgRect.left + 'px';
    clone.style.top = imgRect.top + 'px';
    clone.style.width = imgRect.width + 'px';
    clone.style.height = imgRect.height + 'px';
    clone.style.transition = 'transform 700ms cubic-bezier(.2,.9,.3,1), opacity 700ms';
    clone.style.zIndex = 9999;
    document.body.appendChild(clone);
    void clone.offsetWidth;
    const dx = badgeRect.left + badgeRect.width/2 - (imgRect.left + imgRect.width/2);
    const dy = badgeRect.top + badgeRect.height/2 - (imgRect.top + imgRect.height/2);
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(.15) rotate(20deg)`;
    clone.style.opacity = '0.8';
    setTimeout(()=> {
      clone.remove();
      addToCart(id, name, price, 1);
      badge.animate([{ transform:'scale(1)' },{ transform:'scale(1.25)' },{ transform:'scale(1)' }], { duration:420 });
    }, 720);
  } else {
    addToCart(id, name, price, 1);
  }
}

function updateQuantity(index, change) {
  if (!cart[index]) return;
  cart[index].quantity += change;
  if (cart[index].quantity <= 0) {
    const removed = cart[index].name;
    cart.splice(index,1);
    showToast(`${removed} removed`, 'warning');
  } else {
    showToast(`${cart[index].name} quantity updated`, 'info');
  }
  saveCart(); renderCart();
}

function renderCart() {
  const list = cartItemsEl();
  list.innerHTML = '';
  let total = 0;
  if (!cart.length) {
    list.innerHTML = `<li class="text-center text-slate-500">Your cart is empty</li>`;
  } else {
    cart.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'flex items-center justify-between gap-3 p-3 border rounded';
      li.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 overflow-hidden rounded">
            <img src="${findImageForId(item.id)}" alt="${item.name}" class="w-full h-full object-cover">
          </div>
          <div>
            <div class="font-medium">${item.name}</div>
            <div class="text-sm text-slate-500">₹${item.price} x ${item.quantity}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="px-2 py-1 border rounded" onclick="updateQuantity(${idx}, -1)">-</button>
          <button class="px-2 py-1 border rounded" onclick="updateQuantity(${idx}, 1)">+</button>
          <button class="px-2 py-1 bg-red-500 text-white rounded" onclick="updateQuantity(${idx}, -${item.quantity})"><i class="bi bi-trash"></i></button>
        </div>
      `;
      list.appendChild(li);
      total += item.price * item.quantity;
    });
  }
  totalEl().textContent = `Total: ₹${total}`;
  const message = encodeURIComponent('Hello, I want to order:\n' + cart.map(i=>`${i.name} - ₹${i.price} x ${i.quantity}`).join('\n') + `\nTotal: ₹${total}`);
  el('whatsappLink').href = `https://wa.me/91XXXXXXXXXX?text=${message}`;
  saveCart();
}

/* find image by id */
function findImageForId(id) {
  for (const cat of (productsData.categories || [])) {
    const p = cat.items.find(i=>i.id===id);
    if (p) return p.image || 'images/placeholder.png';
  }
  return 'images/placeholder.png';
}

/* Toasts */
function showToast(message, type='info') {
  const id = 't' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = `px-4 py-2 rounded shadow ${type==='success'?'bg-green-500 text-white':type==='error'?'bg-red-500 text-white':type==='warning'?'bg-amber-300 text-slate-800':'bg-slate-200 text-slate-800'}`;
  div.textContent = message;
  toastContainer().appendChild(div);
  setTimeout(()=> div.remove(), 3000);
}

/* Quick view modal */
let currentModalProduct = null;
function openQuickView(productId) {
  let found = null;
  for (const cat of (productsData.categories || [])) {
    const p = cat.items.find(i=>i.id===productId);
    if (p) { found = p; break; }
  }
  if (!found) return;
  currentModalProduct = found;
  el('modalImage').src = found.image || 'images/placeholder.png';
  el('modalName').textContent = found.name;
  el('modalPrice').textContent = `₹${found.price}`;
  el('modalDesc').textContent = found.desc || 'High quality product.';
  el('modalRating').innerHTML = renderStars(found.rating || 4.5);
  el('modalQty').value = 1;
  document.getElementById('productModal').classList.remove('hidden');
}
document.getElementById('modalClose').addEventListener('click', ()=> document.getElementById('productModal').classList.add('hidden'));
document.addEventListener('click', (e)=> {
  if (e.target && e.target.id === 'modalQtyPlus') { el('modalQty').value = parseInt(el('modalQty').value) + 1; }
  if (e.target && e.target.id === 'modalQtyMinus') { el('modalQty').value = Math.max(1, parseInt(el('modalQty').value) - 1); }
  if (e.target && e.target.id === 'modalAddBtn') {
    const qty = parseInt(el('modalQty').value);
    if (currentModalProduct) {
      addToCart(currentModalProduct.id, currentModalProduct.name, currentModalProduct.price, qty);
      document.getElementById('productModal').classList.add('hidden');
    }
  }
});

/* Cart drawer toggle */
(function cartDrawerToggle() {
  const openBtn = document.getElementById('openCartBtn');
  const closeBtn = document.getElementById('closeCartBtn');
  const drawer = document.getElementById('cartDrawer');
  if (!drawer) return;
  function showDrawer() {
    drawer.classList.remove('translate-x-full'); drawer.classList.add('translate-x-0'); drawer.setAttribute('aria-hidden','false');
  }
  function hideDrawer() {
    drawer.classList.remove('translate-x-0'); drawer.classList.add('translate-x-full'); drawer.setAttribute('aria-hidden','true');
  }
  if (openBtn) openBtn.addEventListener('click', (e)=>{ e.preventDefault(); showDrawer(); });
  if (closeBtn) closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); hideDrawer(); });
  document.addEventListener('keydown', (ev)=> { if (ev.key === 'Escape' && drawer.classList.contains('translate-x-0')) hideDrawer(); });
  hideDrawer();
})();

/* Contact form */
function sendContact(e) {
  e.preventDefault();
  const name = el('name').value;
  const email = el('email').value;
  const phone = el('phone').value || '';
  const message = el('message').value;
  const subject = encodeURIComponent("Customer Inquiry - Magical Moments Merchandise");
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${message}`);
  window.location.href = `mailto:yourbusiness@example.com?subject=${subject}&body=${body}`;
  const whatsappMessage = encodeURIComponent(`Hello, my name is ${name}.\nEmail: ${email}\nPhone: ${phone}\nMessage:\n${message}`);
  el('whatsappContact').href = `https://wa.me/91XXXXXXXXXX?text=${whatsappMessage}`;
  showToast('Message prepared for Email/WhatsApp', 'success');
  document.getElementById('contactForm').reset();
}

/* Razorpay payment trigger (placeholder) */
async function startPayment(total) {
  if (!total || total <= 0) { showToast('Cart is empty', 'warning'); return; }
  showToast('Payment flow not configured. Implement server create-order endpoint.', 'info');
}
document.addEventListener('DOMContentLoaded', () => {
  const payBtn = el('payButton');
  if (payBtn) payBtn.addEventListener('click', () => {
    const total = cart.reduce((s,i)=>s+i.price*i.quantity,0);
    startPayment(total);
  });
});

/* Init */
loadProducts();