/* script.js - fancy UI + image fallback + cart + Razorpay trigger */

/* --- Image fallback: preload placeholder and global error handler --- */
(function installImageFallback() {
  const placeholder = 'images/placeholder.png';
  const _ph = new Image();
  _ph.src = placeholder;

  document.addEventListener('error', function onImgError(e) {
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

/* --- App state --- */
let cart = [];
let productsData = null;
let currentCategory = 'all';
let currentSearch = '';

/* DOM helpers */
const el = id => document.getElementById(id);
const productListEl = () => el('productList');
const cartCountBadge = () => el('cartCountBadge');
const cartItemsEl = () => el('cartItems');
const totalEl = () => el('total');
const toastContainer = () => el('toastContainer');

/* --- Load products with skeleton --- */
async function loadProducts() {
  showSkeletons();
  try {
    const res = await fetch('products.json');
    productsData = await res.json();
  } catch (err) {
    console.error('Failed to load products.json', err);
    productsData = { categories: [] };
  }

  // populate categories
  const filter = el('categoryFilter');
  if (productsData.categories) {
    productsData.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      filter.appendChild(opt);
    });
  }

  // restore cart
  const saved = localStorage.getItem('cart');
  if (saved) cart = JSON.parse(saved);

  renderProducts();
  renderCart();
}

/* skeleton UI while loading */
function showSkeletons() {
  const container = productListEl();
  container.innerHTML = '';
  for (let i=0;i<6;i++){
    const col = document.createElement('div');
    col.className = 'col-sm-6 col-md-4';
    col.innerHTML = `
      <div class="card product-card h-100">
        <div class="skeleton" style="height:220px;border-radius:12px 12px 0 0"></div>
        <div class="card-body">
          <div class="skeleton" style="height:18px;width:60%;margin-bottom:8px;border-radius:6px"></div>
          <div class="skeleton" style="height:14px;width:40%;margin-bottom:12px;border-radius:6px"></div>
          <div class="d-flex gap-2">
            <div class="skeleton" style="height:36px;width:100%;border-radius:8px"></div>
            <div class="skeleton" style="height:36px;width:48px;border-radius:8px"></div>
          </div>
        </div>
      </div>`;
    container.appendChild(col);
  }
}

/* render star rating HTML */
function renderStars(r) {
  const full = Math.floor(r);
  const half = (r - full) >= 0.5;
  let html = '';
  for (let i=0;i<full;i++) html += '<i class="bi bi-star-fill star"></i>';
  if (half) html += '<i class="bi bi-star-half star"></i>';
  const empty = 5 - full - (half?1:0);
  for (let i=0;i<empty;i++) html += '<i class="bi bi-star star" style="opacity:.25"></i>';
  html += ` <small class="text-muted">(${r.toFixed(1)})</small>`;
  return html;
}

/* render products with badges and ratings */
function renderProducts() {
  const container = productListEl();
  container.innerHTML = '';
  let anyShown = false;

  if (!productsData || !productsData.categories) {
    el('noResults').classList.remove('d-none');
    return;
  }

  productsData.categories.forEach(cat => {
    if (currentCategory !== 'all' && currentCategory !== cat.name) return;

    const filtered = cat.items.filter(i => i.name.toLowerCase().includes(currentSearch.toLowerCase()));
    if (!filtered.length) return;

    // category header
    const header = document.createElement('div');
    header.className = 'col-12';
    header.innerHTML = `<h4 class="mt-3 mb-2 text-secondary">${cat.name}</h4>`;
    container.appendChild(header);

    filtered.forEach(item => {
      anyShown = true;
      const col = document.createElement('div');
      col.className = 'col-sm-6 col-md-4';
      const saleHtml = item.sale ? `<div class="sale-badge">${item.sale}% OFF</div>` : '';
      const rating = item.rating || 4.8;
      const stars = renderStars(rating);
      col.innerHTML = `
        <div class="card product-card h-100 position-relative">
          ${saleHtml}
          <img src="${item.image || 'images/placeholder.png'}" class="card-img-top" alt="${item.name}" loading="lazy">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title mb-0">${item.name}</h5>
              <span class="badge badge-price">${item.price}₹</span>
            </div>
            <p class="text-muted small mb-2">${item.short || ''}</p>
            <div class="mb-2">${stars}</div>
            <div class="mt-auto d-flex gap-2">
              <button class="btn btn-outline-primary btn-sm w-100" onclick="openQuickView(${item.id})">
                <i class="bi bi-eye"></i> Quick view
              </button>
              <button class="btn btn-primary btn-sm w-100" onclick="addToCartAnimated(${item.id}, '${escapeQuotes(item.name)}', ${item.price}, this)">
                <i class="bi bi-cart-plus"></i> Add
              </button>
            </div>
          </div>
        </div>
      `;
      container.appendChild(col);
    });
  });

  el('noResults').classList.toggle('d-none', anyShown);
}

/* helpers */
function escapeQuotes(s) { return s.replace(/'/g, "\\'").replace(/"/g, '\\"'); }

/* filters & search */
function filterCategory() {
  currentCategory = el('categoryFilter').value;
  renderProducts();
}
function searchProducts() {
  currentSearch = el('searchInput').value;
  renderProducts();
}

/* cart logic */
function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); updateCartBadge(); }
function updateCartBadge() {
  const count = cart.reduce((s,i)=>s+i.quantity,0);
  const badge = cartCountBadge();
  badge.textContent = count;
  badge.style.display = count ? 'inline-block' : 'none';
}

/* add to cart (simple) */
function addToCart(id, name, price, qty = 1) {
  const existing = cart.find(i => i.id === id);
  if (existing) existing.quantity += qty;
  else cart.push({ id, name, price, quantity: qty });
  saveCart();
  renderCart();
  showToast(`${name} added to cart`, 'success');
}

/* animated add-to-cart: clones image and flies to cart */
function addToCartAnimated(id, name, price, btnEl) {
  const card = btnEl.closest('.card');
  const img = card.querySelector('img');
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

    setTimeout(() => {
      clone.remove();
      addToCart(id, name, price, 1);
      badge.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 420 });
    }, 720);
  } else {
    addToCart(id, name, price, 1);
  }
}

/* update quantity */
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
  saveCart();
  renderCart();
}

/* render cart offcanvas */
function renderCart() {
  const list = cartItemsEl();
  list.innerHTML = '';
  let total = 0;

  if (!cart.length) {
    list.innerHTML = `<li class="list-group-item text-center text-muted">Your cart is empty</li>`;
  } else {
    cart.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `
        <div class="d-flex align-items-center gap-3">
          <div style="width:56px;height:56px;overflow:hidden;border-radius:8px">
            <img src="${findImageForId(item.id)}" style="width:100%;height:100%;object-fit:cover" alt="${item.name}">
          </div>
          <div>
            <div class="fw-semibold">${item.name}</div>
            <div class="small text-muted">₹${item.price} x ${item.quantity}</div>
          </div>
        </div>
        <div class="d-flex align-items-center gap-1">
          <button class="btn btn-sm btn-outline-secondary" onclick="updateQuantity(${idx}, -1)">-</button>
          <button class="btn btn-sm btn-outline-secondary" onclick="updateQuantity(${idx}, 1)">+</button>
          <button class="btn btn-sm btn-danger" onclick="updateQuantity(${idx}, -${item.quantity})"><i class="bi bi-trash"></i></button>
        </div>
      `;
      list.appendChild(li);
      total += item.price * item.quantity;
    });
  }

  totalEl().textContent = `Total: ₹${total}`;
  const message = encodeURIComponent(
    'Hello, I want to order:\n' +
    cart.map(i => `${i.name} - ₹${i.price} x ${i.quantity}`).join('\n') +
    `\nTotal: ₹${total}`
  );
  el('whatsappLink').href = `https://wa.me/91XXXXXXXXXX?text=${message}`;
  saveCart();
}

/* find product image by id */
function findImageForId(id) {
  for (const cat of (productsData.categories || [])) {
    const p = cat.items.find(i => i.id === id);
    if (p) return p.image || 'images/placeholder.png';
  }
  return 'images/placeholder.png';
}

/* toasts */
function showToast(message, type='info') {
  const id = 't' + Date.now();
  const bg = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : type === 'warning' ? 'bg-warning' : 'bg-info';
  const textClass = (type === 'warning' || type === 'info') ? 'text-dark' : 'text-white';
  const html = `
    <div id="${id}" class="toast align-items-center ${bg} ${textClass} border-0 mb-2" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>`;
  toastContainer().insertAdjacentHTML('beforeend', html);
  const elToast = document.getElementById(id);
  const bs = new bootstrap.Toast(elToast, { delay: 3000 });
  bs.show();
  elToast.addEventListener('hidden.bs.toast', () => elToast.remove());
}

/* contact form */
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

/* quick view modal */
let currentModalProduct = null;
function openQuickView(productId) {
  let found = null;
  for (const cat of (productsData.categories || [])) {
    const p = cat.items.find(i => i.id === productId);
    if (p) { found = p; break; }
  }
  if (!found) return;

  currentModalProduct = found;
  el('modalImage').src = found.image || 'images/placeholder.png';
  el('modalName').textContent = found.name;
  el('modalPrice').textContent = `₹${found.price}`;
  el('modalDesc').textContent = found.desc || 'High quality product.';
  el('modalRating').innerHTML = renderStars(found.rating || 4.8);
  el('modalQty').value = 1;

  const modal = new bootstrap.Modal(el('productModal'));
  modal.show();
}

/* modal qty handlers */
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'modalQtyPlus') {
    const elq = el('modalQty'); elq.value = parseInt(elq.value) + 1;
  } else if (e.target && e.target.id === 'modalQtyMinus') {
    const elq = el('modalQty'); elq.value = Math.max(1, parseInt(elq.value) - 1);
  } else if (e.target && e.target.id === 'modalAddBtn') {
    const qty = parseInt(el('modalQty').value);
    if (currentModalProduct) {
      addToCart(currentModalProduct.id, currentModalProduct.name, currentModalProduct.price, qty);
      bootstrap.Modal.getInstance(el('productModal')).hide();
    }
  }
});

/* Razorpay payment trigger */
async function startPayment(total) {
  if (!total || total <= 0) { showToast('Cart is empty', 'warning'); return; }

  const customerEmail = el('email') ? el('email').value || 'guest@example.com' : 'guest@example.com';
  const customerName = el('name') ? el('name').value || 'Guest' : 'Guest';
  const customerPhone = el('phone') ? el('phone').value || '9999999999' : '9999999999';

  try {
    const res = await fetch('/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total, customerEmail, customerName, customerPhone })
    });
    const order = await res.json();

    const options = {
      key: 'YOUR_KEY_ID',
      amount: order.amount,
      currency: 'INR',
      name: 'Magical Moments Merchandise',
      description: 'Order Payment',
      order_id: order.id,
      prefill: { name: customerName, email: customerEmail, contact: customerPhone },
      handler: function(response) {
        showToast('Payment successful: ' + response.razorpay_payment_id, 'success');
        // TODO: verify on backend
      },
      theme: { color: '#3399cc' }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error(err);
    showToast('Payment initialization failed', 'error');
  }
}

/* pay button */
document.addEventListener('DOMContentLoaded', () => {
  const payBtn = el('payButton');
  if (payBtn) payBtn.addEventListener('click', () => {
    const total = cart.reduce((s,i) => s + i.price * i.quantity, 0);
    startPayment(total);
  });
});

/* init */
loadProducts();
