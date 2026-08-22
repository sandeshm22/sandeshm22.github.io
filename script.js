let cart = [];
let productsData = null;
let currentCategory = 'all';
let currentSearch = '';

async function loadProducts() {
  const response = await fetch('products.json');
  productsData = await response.json();

  // Populate category filter
  const filter = document.getElementById('categoryFilter');
  productsData.categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.name;
    option.textContent = cat.name;
    filter.appendChild(option);
  });

  // Restore cart from LocalStorage
  const savedCart = localStorage.getItem('cart');
  if (savedCart) {
    cart = JSON.parse(savedCart);
    renderCart();
  }

  renderProducts();
}

function renderProducts() {
  const container = document.getElementById('productList');
  container.innerHTML = '';

  productsData.categories.forEach(cat => {
    if (currentCategory === 'all' || currentCategory === cat.name) {
      const filteredItems = cat.items.filter(item =>
        item.name.toLowerCase().includes(currentSearch.toLowerCase())
      );

      if (filteredItems.length > 0) {
        const catHeader = document.createElement('h3');
        catHeader.className = 'mt-4 text-secondary';
        catHeader.textContent = cat.name;
        container.appendChild(catHeader);

        filteredItems.forEach(item => {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'col-md-4 mb-3';
          itemDiv.innerHTML = `
            <div class="card h-100">
              <img src="${item.image}" class="card-img-top" alt="${item.name}">
              <div class="card-body">
                <h5 class="card-title">${item.name}</h5>
                <p class="card-text">₹${item.price}</p>
                <button class="btn btn-primary" onclick="addToCart(${item.id}, '${item.name}', ${item.price})">Add to Cart</button>
              </div>
            </div>
          `;
          container.appendChild(itemDiv);
        });
      }
    }
  });
}

function filterCategory() {
  currentCategory = document.getElementById('categoryFilter').value;
  renderProducts();
}

function searchProducts() {
  currentSearch = document.getElementById('searchInput').value;
  renderProducts();
}

function addToCart(id, name, price) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += 1;
    showToast(`${name} quantity increased`, 'success');
  } else {
    cart.push({ id, name, price, quantity: 1 });
    showToast(`${name} added to cart`, 'success');
  }
  saveCart();
  renderCart();
}

function updateQuantity(index, change) {
  cart[index].quantity += change;
  if (cart[index].quantity <= 0) {
    showToast(`${cart[index].name} removed from cart`, 'error');
    cart.splice(index, 1);
  } else {
    showToast(`${cart[index].name} quantity updated`, 'info');
  }
  saveCart();
  renderCart();
}

function renderCart() {
  const cartList = document.getElementById('cartItems');
  cartList.innerHTML = '';
  let total = 0;

  cart.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    li.innerHTML = `
      ${item.name} - ₹${item.price} x ${item.quantity}
      <div>
        <button class="btn btn-sm btn-secondary me-1" onclick="updateQuantity(${index}, -1)">-</button>
        <button class="btn btn-sm btn-secondary me-1" onclick="updateQuantity(${index}, 1)">+</button>
        <button class="btn btn-sm btn-danger" onclick="updateQuantity(${index}, -${item.quantity})">Remove</button>
      </div>
    `;
    cartList.appendChild(li);
    total += item.price * item.quantity;
  });

  document.getElementById('total').textContent = `Total: ₹${total}`;

  const message = encodeURIComponent(
    'Hello, I want to order:\n' +
    cart.map(i => `${i.name} - ₹${i.price} x ${i.quantity}`).join('\n') +
    `\nTotal: ₹${total}`
  );

  document.getElementById('whatsappLink').href =
    `https://wa.me/91XXXXXXXXXX?text=${message}`;
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

// Toast notifications
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  const toastId = 'toast' + Date.now();

  const bgClass = type === 'success' ? 'bg-success' :
                  type === 'error' ? 'bg-danger' :
                  type === 'warning' ? 'bg-warning' : 'bg-info';

  const toastHTML = `
    <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 mb-2" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHTML);

  const toastElement = document.getElementById(toastId);
  const bsToast = new bootstrap.Toast(toastElement, { delay: 3000 });
  bsToast.show();
}

// Contact form
function sendContact(event) {
  event.preventDefault();
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const message = document.getElementById('message').value;

  const subject = encodeURIComponent("Customer Inquiry - Magical Moments Merchandise");
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nMessage:\n${message}`);
  window.location.href = `mailto:yourbusiness@example.com?subject=${subject}&body=${body}`;

  const whatsappMessage = encodeURIComponent(
    `Hello, my name is ${name}.\nEmail: ${email}\nMessage:\n${message}`
  );
  document.getElementById('whatsappContact').href =
    `https://wa.me/91XXXXXXXXXX?text=${whatsappMessage}`;

  showToast("Message prepared for Email/WhatsApp", 'success');
}

// Razorpay payment
async function startPayment(total) {
  const customerEmail = document.getElementById("email").value || "guest@example.com";
  const customerName = document.getElementById("name").value || "Guest";
  const customerPhone = "9999999999"; // add phone field if needed

  const res = await fetch("/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: total, customerEmail, customerName, customerPhone })
  });
  const order = await res.json();

  const options = {
    "key": "YOUR_KEY_ID",
    "amount": order.amount,
    "currency": "INR",
    "name": "Magical Moments Merchandise",
    "description": "Order Payment",
    "order_id": order.id,
    "prefill": {
      "name": customerName,
      "email": customerEmail,
      "contact": customerPhone
    },
    "handler": function (response) {
      showToast("Payment successful: " + response.razorpay_payment_id, "success");
    },
    "theme": { "color": "#3399cc" }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

document.getElementById("payButton").onclick = () => {
  const total = cart.reduce((t, i) => t + i.price * i.quantity, 0);
  startPayment(total);
};

loadProducts();