/* script.js - iGenkids
   - Firebase (compat) usage (v8)
   - Cart in localStorage
   - Checkout flow
   - Save orders to Firestore
   - Dashboard reads orders from Firestore
   - Products load dynamically from Firestore
*/

/* ============ FIREBASE CONFIG ============ */
const firebaseConfig = {
  apiKey: "AIzaSyABq6b5vH4D5JAjAuHV5uGhA7g4CMMh4eo",
  authDomain: "igenkids-c4e93.firebaseapp.com",
  projectId: "igenkids-c4e93",
  storageBucket: "igenkids-c4e93.firebasestorage.app",
  messagingSenderId: "939973792356",
  appId: "1:939973792356:web:d3dcd769f083616907c571",
  measurementId: "G-TFB9FR78Q3"
};

let db = null;

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.firestore();
} catch (e) {
  console.warn('Firebase failed to init', e);
}

/* ============ CART STORAGE ============ */
function getCart() {
  return JSON.parse(localStorage.getItem('igen_cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('igen_cart', JSON.stringify(cart));
}

function clearCart() {
  if (confirm('Clear cart?')) {
    localStorage.removeItem('igen_cart');
    renderCartPreview();
  }
}

/* ============ ADD TO CART (FIREBASE PRODUCTS) ============ */
function addProductToCart(id, name, price, image) {
  let cart = getCart();

  let existing = cart.find(item => item.id === id);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id,
      title: name,
      price: Number(price),
      image: image,
      qty: 1
    });
  }

  saveCart(cart);
  renderCartPreview();

  alert(name + " added to cart ✅");
}

/* ============ LOAD PRODUCTS TO LANDING PAGE ============ */
function loadProductsToWebsite() {

  const container = document.getElementById("products-container");
  if (!container || !db) return;

  container.innerHTML = "<p>Loading products...</p>";

  db.collection("products").onSnapshot(snapshot => {
    container.innerHTML = "";

    snapshot.forEach(doc => {
      const p = doc.data();

      container.innerHTML += `
        <div class="product-card">
          <img src="${p.image}" alt="${p.name}">
          <h3>${p.name}</h3>
          <p class="product-price">Rs. ${p.price}</p>
          <button onclick="addProductToCart('${doc.id}', '${p.name}', ${p.price}, '${p.image}')">
            Add to Cart
          </button>
        </div>
      `;
    });
  });
}

/* ============ CART VIEW ============ */
function renderCartPreview() {
  const itemsEl = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');

  if (!itemsEl) return;

  const cart = getCart();

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p>Your cart is empty.</p>';
    if (totalEl) totalEl.innerText = 'Total: Rs. 0';
    return;
  }

  itemsEl.innerHTML = cart.map(it => `
    <div class="order-row">
      ${it.title} x ${it.qty} — Rs. ${it.price * it.qty}
    </div>
  `).join('');

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (totalEl) totalEl.innerText = `Total: Rs. ${total}`;
}

/* ============ CHECKOUT ============ */
function populateCheckout() {
  const summary = document.getElementById('summary-items');
  const totalAmtSpan = document.getElementById('summary-total-amt');
  const cart = getCart();

  if (!summary) return;

  if (cart.length === 0) {
    summary.innerHTML = '<p>Your cart is empty.</p>';
    if (totalAmtSpan) totalAmtSpan.innerText = '0';
    return;
  }

  summary.innerHTML = cart.map(it =>
    `<div>${it.title} x ${it.qty} — Rs. ${it.price * it.qty}</div>`
  ).join('');

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (totalAmtSpan) totalAmtSpan.innerText = total;
}

function startPayment() {
  const name = document.getElementById('cust-name')?.value;
  const email = document.getElementById('cust-email')?.value;
  const phone = document.getElementById('cust-phone')?.value;
  const address = document.getElementById('cust-address')?.value;

  const cart = getCart();

  if (!name || !email || !phone) {
    alert('Fill all details');
    return;
  }

  if (cart.length === 0) {
    alert('Cart is empty');
    return;
  }

  const order = {
    id: 'draft_' + Date.now(),
    name,
    email,
    phone,
    address,
    items: cart,
    total: cart.reduce((s, i) => s + i.price * i.qty, 0)
  };

  localStorage.setItem('igen_order_draft', JSON.stringify(order));
  location.href = 'payment.html';
}

/* ============ PAYMENT ============ */
function populatePaymentPage() {
  const desc = document.getElementById('payment-description');
  const draft = JSON.parse(localStorage.getItem('igen_order_draft') || 'null');

  if (desc && draft) {
    desc.innerHTML = `Pay Rs. ${draft.total} for ${draft.items.length} item(s).`;
  }
}

async function completePayment() {
  const status = document.getElementById('payment-status');
  const draft = JSON.parse(localStorage.getItem('igen_order_draft') || 'null');

  if (!draft || !db) {
    if (status) status.innerText = "No order found";
    return;
  }

  if (status) status.innerText = "Saving order...";

  try {
    const ref = await db.collection("orders").add({
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      address: draft.address,
      items: draft.items,
      total: draft.total,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    localStorage.removeItem('igen_cart');
    localStorage.removeItem('igen_order_draft');

    status.innerHTML = `
      ✅ Order Saved Successfully <br>
      <strong>Order ID:</strong> ${ref.id}<br><br>
      <a href="index.html">Go To Home</a>
    `;
  }
  catch (err) {
    status.innerText = "Failed: " + err.message;
  }
}

/* ============ DASHBOARD (FIXED) ============ */
async function loadDashboardOrders() {
  const out = document.getElementById('orders-list');
  if (!out || !db) return;

  out.innerHTML = "Loading orders...";

  const snap = await db
    .collection('orders')
    .orderBy('createdAt', 'desc')
    .get();

  if (snap.empty) {
    out.innerHTML = "<p>No orders found.</p>";
    return;
  }

  out.innerHTML = "";

  snap.forEach(doc => {
    const o = doc.data();

    const div = document.createElement("div");
    div.className = "order-card";

    div.innerHTML = `
      <strong>Order ID:</strong> ${doc.id}<br>
      <strong>Name:</strong> ${o.name || '-'}<br>
      <strong>Email:</strong> ${o.email || '-'}<br>
      <strong>Phone:</strong> ${o.phone || '-'}<br>
      <strong>Total:</strong> ₹${o.total || 0}<br><br>

      <details>
        <summary>View Items</summary>
        ${(o.items || []).map(it => `
          <p>${it.title} x ${it.qty} (₹${it.price})</p>
        `).join('')}
      </details>
    `;

    out.appendChild(div);
  });
}

/* ============ COUNTDOWN ============ */
function initCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;

  const end = Date.now() + 24 * 60 * 60 * 1000;

  setInterval(() => {
    const diff = end - Date.now();
    if (diff <= 0) return el.textContent = "00:00:00";

    const s = Math.floor(diff / 1000);
    const h = String(Math.floor(s/3600)).padStart(2, '0');
    const m = String(Math.floor((s%3600)/60)).padStart(2, '0');
    const sec = String(s%60).padStart(2, '0');
    el.textContent = `${h}:${m}:${sec}`;
  }, 1000);
}

/* ============ INIT ============ */
document.addEventListener('DOMContentLoaded', () => {

  renderCartPreview();
  populateCheckout();
  populatePaymentPage();
  initCountdown();
  loadProductsToWebsite();

  if (document.getElementById('orders-list')) {
    loadDashboardOrders();
  }

});

/* ============ GLOBAL ACCESS ============ */
window.addProductToCart = addProductToCart;
window.clearCart = clearCart;
window.startPayment = startPayment;
window.completePayment = completePayment;
window.loadDashboardOrders = loadDashboardOrders;
