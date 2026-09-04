/* ============================================================
   CONFIG — edit these for your own shop
   ============================================================ */
const CONFIG = {
  // WhatsApp number in international format, digits only (no +, spaces or dashes).
  // Example: 91 98765 43210  ->  "919876543210"
  whatsappNumber: "919876543210",
  storeName: "Amber & Clay",
  currency: "\u20B9" // ₹
};

/* ============================================================
   State
   ============================================================ */
let PRODUCTS = [];
let activeCategory = "All";
const cart = new Map(); // id -> qty

/* ============================================================
   DOM refs
   ============================================================ */
const els = {
  categoryFilter: document.getElementById("categoryFilter"),
  productGrid: document.getElementById("productGrid"),
  cartToggle: document.getElementById("cartToggle"),
  cartClose: document.getElementById("cartClose"),
  cartOverlay: document.getElementById("cartOverlay"),
  cartDrawer: document.getElementById("cartDrawer"),
  cartItems: document.getElementById("cartItems"),
  cartTotal: document.getElementById("cartTotal"),
  cartCount: document.getElementById("cartCount"),
  checkoutBtn: document.getElementById("checkoutBtn")
};

/* ============================================================
   Init
   ============================================================ */
init();

async function init() {
  bindStaticEvents();
  try {
    const res = await fetch("data/products.json");
    if (!res.ok) throw new Error("Request failed");
    const data = await res.json();
    PRODUCTS = data.products || [];
    renderCategories();
    renderProducts();
  } catch (err) {
    els.productGrid.innerHTML = `
      <div class="grid-message">
        Couldn't load the collection. If you opened this file directly from
        disk, run a local server (see README.md) or host the folder online —
        browsers block loading products.json straight from a file path.
      </div>`;
  }
  updateCartUI();
}

/* ============================================================
   Rendering: categories
   ============================================================ */
function renderCategories() {
  const categories = ["All", ...new Set(PRODUCTS.map(p => p.category))];
  els.categoryFilter.innerHTML = categories
    .map(
      cat => `
      <button class="filter-pill${cat === activeCategory ? " is-active" : ""}" data-category="${escapeAttr(cat)}">
        ${escapeHtml(cat)}
      </button>`
    )
    .join("");

  els.categoryFilter.querySelectorAll(".filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      renderCategories();
      renderProducts();
    });
  });
}

/* ============================================================
   Rendering: product grid
   ============================================================ */
function renderProducts() {
  const list =
    activeCategory === "All"
      ? PRODUCTS
      : PRODUCTS.filter(p => p.category === activeCategory);

  if (list.length === 0) {
    els.productGrid.innerHTML = `<div class="grid-message">Nothing in this category yet.</div>`;
    return;
  }

  els.productGrid.innerHTML = list
    .map(
      p => `
      <article class="product-card">
        <div class="product-media">
          <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" loading="lazy">
        </div>
        <div class="product-body">
          <div class="product-category">${escapeHtml(p.category)}</div>
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <p class="product-desc">${escapeHtml(p.description || "")}</p>
          <div class="product-footer">
            <span class="product-price">${formatPrice(p.price)}</span>
            <button class="add-to-cart" data-id="${p.id}">Add to cart</button>
          </div>
        </div>
      </article>`
    )
    .join("");

  els.productGrid.querySelectorAll(".add-to-cart").forEach(btn => {
    btn.addEventListener("click", () => addToCart(Number(btn.dataset.id), btn));
  });
}

/* ============================================================
   Cart operations
   ============================================================ */
function addToCart(id, btnEl) {
  cart.set(id, (cart.get(id) || 0) + 1);
  updateCartUI();

  if (btnEl) {
    const original = btnEl.textContent;
    btnEl.textContent = "Added";
    btnEl.classList.add("is-added");
    setTimeout(() => {
      btnEl.textContent = original;
      btnEl.classList.remove("is-added");
    }, 1000);
  }
}

function changeQty(id, delta) {
  const current = cart.get(id) || 0;
  const next = current + delta;
  if (next <= 0) {
    cart.delete(id);
  } else {
    cart.set(id, next);
  }
  updateCartUI();
}

function removeFromCart(id) {
  cart.delete(id);
  updateCartUI();
}

function cartTotalValue() {
  let total = 0;
  cart.forEach((qty, id) => {
    const product = PRODUCTS.find(p => p.id === id);
    if (product) total += product.price * qty;
  });
  return total;
}

function cartItemCount() {
  let count = 0;
  cart.forEach(qty => (count += qty));
  return count;
}

/* ============================================================
   Rendering: cart drawer
   ============================================================ */
function updateCartUI() {
  const count = cartItemCount();
  els.cartCount.textContent = count;
  els.cartCount.classList.toggle("is-empty", count === 0);

  if (cart.size === 0) {
    els.cartItems.innerHTML = `<div class="cart-empty">Your cart is empty — add a piece from the collection to begin.</div>`;
  } else {
    els.cartItems.innerHTML = [...cart.entries()]
      .map(([id, qty]) => {
        const p = PRODUCTS.find(prod => prod.id === id);
        if (!p) return "";
        return `
          <div class="cart-line">
            <div class="cart-line-img"><img src="${escapeAttr(p.image)}" alt=""></div>
            <div>
              <div class="cart-line-name">${escapeHtml(p.name)}</div>
              <div class="cart-line-price">${formatPrice(p.price)} each</div>
              <div class="qty-stepper">
                <button data-action="dec" data-id="${p.id}" aria-label="Decrease quantity">&minus;</button>
                <span>${qty}</span>
                <button data-action="inc" data-id="${p.id}" aria-label="Increase quantity">+</button>
              </div>
            </div>
            <div class="cart-line-right">
              <div class="cart-line-subtotal">${formatPrice(p.price * qty)}</div>
              <button class="remove-line" data-action="remove" data-id="${p.id}">Remove</button>
            </div>
          </div>`;
      })
      .join("");

    els.cartItems.querySelectorAll("[data-action]").forEach(btn => {
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      btn.addEventListener("click", () => {
        if (action === "inc") changeQty(id, 1);
        if (action === "dec") changeQty(id, -1);
        if (action === "remove") removeFromCart(id);
      });
    });
  }

  els.cartTotal.textContent = formatPrice(cartTotalValue());
  els.checkoutBtn.disabled = cart.size === 0;
}

/* ============================================================
   Drawer open / close
   ============================================================ */
function openCart() {
  els.cartDrawer.classList.add("is-open");
  els.cartOverlay.classList.add("is-open");
  els.cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  els.cartDrawer.classList.remove("is-open");
  els.cartOverlay.classList.remove("is-open");
  els.cartDrawer.setAttribute("aria-hidden", "true");
}

/* ============================================================
   WhatsApp checkout
   ============================================================ */
function checkoutOnWhatsApp() {
  if (cart.size === 0) return;

  const lines = [`Hi ${CONFIG.storeName}! I'd like to order:`, ""];

  cart.forEach((qty, id) => {
    const p = PRODUCTS.find(prod => prod.id === id);
    if (!p) return;
    lines.push(`${qty} x ${p.name} - ${formatPrice(p.price * qty)}`);
  });

  lines.push("", `Total: ${formatPrice(cartTotalValue())}`, "", "Thank you!");

  const message = encodeURIComponent(lines.join("\n"));
  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${message}`;
  window.open(url, "_blank", "noopener");
}

/* ============================================================
   Static events
   ============================================================ */
function bindStaticEvents() {
  els.cartToggle.addEventListener("click", openCart);
  els.cartClose.addEventListener("click", closeCart);
  els.cartOverlay.addEventListener("click", closeCart);
  els.checkoutBtn.addEventListener("click", checkoutOnWhatsApp);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeCart();
  });
}

/* ============================================================
   Helpers
   ============================================================ */
function formatPrice(n) {
  return `${CONFIG.currency}${Number(n).toLocaleString("en-IN")}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}