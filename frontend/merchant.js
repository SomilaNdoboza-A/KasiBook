/* KasiBook — merchant dashboard logic. Now backed by the real API
   (see api.js) instead of localStorage. */

let bizToken = sessionStorage.getItem("kb_biz_token") || null;
let bizInfo = JSON.parse(sessionStorage.getItem("kb_biz_info") || "null");
let bizServices = []; // cached from GET /api/businesses/:id
let currentView = "bookings";
let bookingFilter = "all";
let allBusinessesForLogin = []; // for the login dropdown

const authWrap = document.getElementById("authWrap");
const dashShell = document.getElementById("dashShell");
const loginBizSelect = document.getElementById("loginBiz");
const loginPass = document.getElementById("loginPass");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authTitle = document.getElementById("authTitle");
const authSub = document.getElementById("authSub");
const registerBtn = document.getElementById("registerBtn");
const registerError = document.getElementById("registerError");

function setAuthMode(mode) {
  const isLogin = mode === "login";
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);
  loginForm.style.display = isLogin ? "block" : "none";
  registerForm.style.display = isLogin ? "none" : "block";
  authTitle.textContent = isLogin ? "Business login" : "Register your business";
  authSub.textContent = isLogin ? "No more WhatsApp bookings or notebooks — see your bookings, cancellations, services and customers in one place." : "List your business on KasiBook in under a minute — any service, any trade.";
}
tabLogin.addEventListener("click", () => setAuthMode("login"));
tabRegister.addEventListener("click", () => setAuthMode("register"));

function setBizSession(token, business) {
  bizToken = token;
  bizInfo = business;
  sessionStorage.setItem("kb_biz_token", token);
  sessionStorage.setItem("kb_biz_info", JSON.stringify(business));
}
function clearBizSession() {
  bizToken = null;
  bizInfo = null;
  sessionStorage.removeItem("kb_biz_token");
  sessionStorage.removeItem("kb_biz_info");
}

registerBtn.addEventListener("click", async () => {
  const name = document.getElementById("regName").value.trim();
  const category = document.getElementById("regCategory").value.trim();
  const owner = document.getElementById("regOwner").value.trim();
  const location = document.getElementById("regLocation").value.trim();
  const password = document.getElementById("regPassword").value;

  if (!name || !category || !owner || !location || !password) {
    registerError.textContent = "Please fill in every field.";
    registerError.style.display = "block";
    return;
  }

  try {
    const { token, business } = await kbApi("/api/businesses/register", {
      method: "POST",
      body: { name, category, owner, location, password }
    });
    registerError.style.display = "none";
    setBizSession(token, business);
    showDashboard();
  } catch (e) {
    registerError.textContent = e.message;
    registerError.style.display = "block";
  }
});

const dashMain = document.getElementById("dashMain");
const sideBizName = document.getElementById("sideBizName");
const sideBizCat = document.getElementById("sideBizCat");
const dashNav = document.getElementById("dashNav");
const logoutBtn = document.getElementById("logoutBtn");

async function populateLoginOptions() {
  try {
    allBusinessesForLogin = (await kbApi("/api/businesses")).businesses;
    loginBizSelect.innerHTML = allBusinessesForLogin.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
  } catch (e) {
    loginError.textContent = "Couldn't reach the server — is the backend running?";
    loginError.style.display = "block";
  }
}

function currentBiz() {
  return bizInfo;
}

async function tryLogin() {
  const business_id = loginBizSelect.value;
  const password = loginPass.value;
  try {
    const { token, business } = await kbApi("/api/businesses/login", {
      method: "POST",
      body: { business_id, password }
    });
    setBizSession(token, business);
    loginError.style.display = "none";
    showDashboard();
  } catch (e) {
    loginError.textContent = e.message;
    loginError.style.display = "block";
  }
}
loginBtn.addEventListener("click", tryLogin);
loginPass.addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });

logoutBtn.addEventListener("click", () => {
  clearBizSession();
  authWrap.style.display = "flex";
  dashShell.style.display = "none";
  loginPass.value = "";
  setAuthMode("login");
  populateLoginOptions();
});

dashNav.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-view]");
  if (!btn) return;
  currentView = btn.dataset.view;
  dashNav.querySelectorAll("button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderView();
});

async function showDashboard() {
  authWrap.style.display = "none";
  dashShell.style.display = "flex";
  const biz = currentBiz();
  sideBizName.textContent = biz.name;
  sideBizCat.textContent = biz.category;
  await refreshBizServices();
  renderView();
}

async function refreshBizServices() {
  try {
    const { business } = await kbApi(`/api/businesses/${bizInfo.id}`);
    bizServices = business.services;
    bizInfo = { ...bizInfo, ...business }; // keep tagline/location/photo in sync
  } catch (e) {
    bizServices = [];
  }
}

function renderView() {
  if (currentView === "bookings") renderBookings();
  else if (currentView === "services") renderServices();
  else if (currentView === "customers") renderCustomers();
  else if (currentView === "profile") renderProfile();
}

/* ---------- Bookings view ---------- */
const KB_BOOKING_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "cancelled", label: "Cancelled" }
];

async function renderBookings() {
  dashMain.innerHTML = `<div class="empty-state">Loading bookings…</div>`;
  let bookings;
  try {
    bookings = (await kbApi("/api/businesses/me/bookings", { token: bizToken })).bookings;
  } catch (e) {
    dashMain.innerHTML = `<div class="empty-state">Couldn't load bookings — ${e.message}</div>`;
    return;
  }

  const pending = bookings.filter(b => b.status === "pending").length;
  const confirmed = bookings.filter(b => b.status === "confirmed").length;
  const cancelled = bookings.filter(b => b.status === "cancelled" || b.status === "declined").length;
  const revenue = bookings
    .filter(b => b.status === "confirmed")
    .reduce((sum, bk) => sum + (bk.amount_paid || 0), 0);

  const visible = bookings.filter(bk => {
    if (bookingFilter === "all") return true;
    if (bookingFilter === "active") return bk.status === "pending" || bk.status === "confirmed";
    if (bookingFilter === "cancelled") return bk.status === "cancelled" || bk.status === "declined";
    return bk.status === bookingFilter;
  });

  dashMain.innerHTML = `
    <h2>Bookings</h2>
    <div class="dash-sub">View incoming requests, keep track of cancellations and manage your schedule.</div>
    <div class="stat-grid">
      <div class="stat-card"><div class="val">${bookings.length}</div><div class="lbl">Total bookings</div></div>
      <div class="stat-card"><div class="val">${pending}</div><div class="lbl">Pending</div></div>
      <div class="stat-card"><div class="val">${confirmed}</div><div class="lbl">Confirmed</div></div>
      <div class="stat-card"><div class="val">${cancelled}</div><div class="lbl">Cancelled</div></div>
      <div class="stat-card"><div class="val">${kbFormatCurrency(revenue)}</div><div class="lbl">Confirmed revenue</div></div>
    </div>
    <div class="pill-row" id="bookingFilterRow" style="margin-bottom:16px;">
      ${KB_BOOKING_FILTERS.map(f => `<button class="pill ${bookingFilter === f.key ? "active" : ""}" data-filter="${f.key}">${f.label}</button>`).join("")}
    </div>
    <div class="table-wrap">
      ${visible.length === 0 ? `<div class="empty-state">${bookings.length === 0 ? "No bookings yet. Share your KasiBook page to get your first one." : "No bookings in this view."}</div>` : `
      <table>
        <thead><tr><th>Customer</th><th>Service</th><th>Date</th><th>Time</th><th>Paid</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${visible.map(bk => {
            let note = "";
            if (bk.status === "cancelled") note = `<div style="font-size:11.5px;color:rgba(32,27,15,0.5);margin-top:3px;">Cancelled by customer</div>`;
            if (bk.status === "declined") note = `<div style="font-size:11.5px;color:rgba(32,27,15,0.5);margin-top:3px;">Declined by you</div>`;
            return `
              <tr>
                <td>${bk.customer_name}<br><span style="color:rgba(32,27,15,0.55);font-size:12.5px;">${bk.customer_phone}</span></td>
                <td>${bk.service_name || "—"}</td>
                <td>${kbFormatDate(bk.date)}</td>
                <td>${bk.time}</td>
                <td>${bk.paid ? kbFormatCurrency(bk.amount_paid) : "—"}</td>
                <td><span class="status-tag status-${bk.status}">${bk.status}</span>${note}</td>
                <td>
                  ${bk.status === "pending" ? `
                    <div class="row-actions">
                      <button class="mini-btn accept" data-act="accept" data-id="${bk.id}">Accept</button>
                      <button class="mini-btn decline" data-act="decline" data-id="${bk.id}">Decline</button>
                    </div>` : ""}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>`}
    </div>
  `;

  dashMain.querySelector("#bookingFilterRow").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;
    bookingFilter = btn.dataset.filter;
    renderBookings();
  });

  dashMain.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.act === "accept" ? "accept" : "decline";
      try {
        await kbApi(`/api/bookings/${btn.dataset.id}/${action}`, { method: "PATCH", token: bizToken });
        renderBookings();
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

/* ---------- Services view ---------- */
function renderServices() {
  const biz = currentBiz();
  dashMain.innerHTML = `
    <h2>Services</h2>
    <div class="dash-sub">These are what customers see and book on your page. Add a photo of each service — a good picture is often what convinces a customer to book.</div>
    ${bizServices.length === 0 ? `<div class="empty-state">You haven't added any services yet — add your first one below.</div>` : bizServices.map(s => `
      <div class="service-manage-row">
        <div class="svc-manage-left">
          ${s.image
            ? `<img class="svc-thumb" src="${kbPhotoUrl(s.image)}" alt="${s.name}">`
            : `<div class="svc-thumb svc-thumb-empty hue-${biz.hue}">${biz.icon}</div>`}
          <div>
            <div style="font-weight:700;">${s.name}</div>
            <div style="font-size:12.5px;color:rgba(32,27,15,0.6);">${s.duration} min · ${kbFormatCurrency(s.price)}</div>
          </div>
        </div>
        <div class="row-actions">
          <label class="mini-btn photo-btn">
            ${s.image ? "Change photo" : "Add photo"}
            <input type="file" accept="image/*" class="photo-input-hidden" data-photo-for="${s.id}">
          </label>
          ${s.image ? `<button class="mini-btn decline" data-remove-photo="${s.id}">Remove photo</button>` : ""}
          <button class="mini-btn decline" data-remove="${s.id}">Remove</button>
        </div>
      </div>
    `).join("")}
    <div class="add-service-box">
      <div>
        <label class="field-label" style="margin-top:0;">Service name</label>
        <input class="field-input" id="newServiceName" placeholder="e.g. Haircut">
      </div>
      <div>
        <label class="field-label" style="margin-top:0;">Price (R)</label>
        <input class="field-input" id="newServicePrice" type="number" min="0">
      </div>
      <div>
        <label class="field-label" style="margin-top:0;">Duration (min)</label>
        <input class="field-input" id="newServiceDuration" type="number" min="0">
      </div>
      <div>
        <label class="field-label" style="margin-top:0;">Photo (optional)</label>
        <input class="field-input" id="newServicePhoto" type="file" accept="image/*">
      </div>
      <button class="btn btn-orange" id="addServiceBtn">Add</button>
    </div>
    <div class="error-msg" id="servicePhotoError"></div>
  `;

  const photoErr = dashMain.querySelector("#servicePhotoError");
  function showPhotoError(msg) {
    photoErr.textContent = msg;
    photoErr.style.display = "block";
  }

  dashMain.querySelectorAll("button[data-remove]").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await kbApi(`/api/services/${btn.dataset.remove}`, { method: "DELETE", token: bizToken });
        await refreshBizServices();
        renderServices();
      } catch (e) {
        showPhotoError(e.message);
      }
    });
  });

  dashMain.querySelectorAll("button[data-remove-photo]").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await kbApi(`/api/services/${btn.dataset.removePhoto}/photo`, { method: "DELETE", token: bizToken });
        await refreshBizServices();
        renderServices();
      } catch (e) {
        showPhotoError(e.message);
      }
    });
  });

  dashMain.querySelectorAll("input[data-photo-for]").forEach(input => {
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      const form = new FormData();
      form.append("photo", file);
      try {
        await kbApi(`/api/services/${input.dataset.photoFor}/photo`, { method: "PATCH", token: bizToken, body: form, isForm: true });
        await refreshBizServices();
        renderServices();
      } catch (err) {
        showPhotoError(err.message);
      }
    });
  });

  dashMain.querySelector("#addServiceBtn").addEventListener("click", async () => {
    const name = dashMain.querySelector("#newServiceName").value.trim();
    const price = dashMain.querySelector("#newServicePrice").value;
    const duration = dashMain.querySelector("#newServiceDuration").value;
    const photoFile = dashMain.querySelector("#newServicePhoto").files[0];
    if (!name || price === "" || duration === "") {
      showPhotoError("Please fill in the service name, price and duration.");
      return;
    }

    const form = new FormData();
    form.append("name", name);
    form.append("price", price);
    form.append("duration", duration);
    if (photoFile) form.append("photo", photoFile);

    try {
      await kbApi(`/api/businesses/${bizInfo.id}/services`, { method: "POST", token: bizToken, body: form, isForm: true });
      await refreshBizServices();
      renderServices();
    } catch (err) {
      showPhotoError(err.message);
    }
  });
}

/* ---------- Customers view ---------- */
async function renderCustomers() {
  dashMain.innerHTML = `<div class="empty-state">Loading customers…</div>`;
  let customers;
  try {
    customers = (await kbApi("/api/businesses/me/customers", { token: bizToken })).customers;
  } catch (e) {
    dashMain.innerHTML = `<div class="empty-state">Couldn't load customers — ${e.message}</div>`;
    return;
  }

  dashMain.innerHTML = `
    <h2>Customers</h2>
    <div class="dash-sub">Everyone who has booked with you, built automatically from your bookings.</div>
    <div class="table-wrap">
      ${customers.length === 0 ? `<div class="empty-state">No customer records yet.</div>` : `
      <table>
        <thead><tr><th>Name</th><th>Phone</th><th>Bookings</th><th>Last visit</th></tr></thead>
        <tbody>
          ${customers.map(c => `
            <tr>
              <td>${c.name}</td>
              <td>${c.phone}</td>
              <td>${c.count}</td>
              <td>${kbFormatDate(c.last)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`}
    </div>
  `;
}

/* ---------- Profile view ---------- */
function renderProfile() {
  const biz = currentBiz();
  dashMain.innerHTML = `
    <h2>Business profile</h2>
    <div class="dash-sub">This is what customers see on your KasiBook page. A cover photo helps customers recognise and trust your business at a glance.</div>
    <div class="profile-form">
      <label class="field-label" style="margin-top:0;">Cover photo</label>
      <div class="svc-manage-left" style="margin-bottom:6px;">
        ${biz.photo
          ? `<img class="svc-thumb svc-thumb-lg" src="${kbPhotoUrl(biz.photo)}" alt="${biz.name}">`
          : `<div class="svc-thumb svc-thumb-lg svc-thumb-empty hue-${biz.hue}">${biz.icon}</div>`}
        <div class="row-actions">
          <label class="mini-btn photo-btn">
            ${biz.photo ? "Change photo" : "Add photo"}
            <input type="file" accept="image/*" class="photo-input-hidden" id="pPhotoInput">
          </label>
          ${biz.photo ? `<button class="mini-btn decline" id="pPhotoRemove">Remove photo</button>` : ""}
        </div>
      </div>
      <div class="error-msg" id="pPhotoError"></div>

      <label class="field-label">Business name</label>
      <input class="field-input" id="pName" value="${biz.name}">

      <label class="field-label">Tagline</label>
      <input class="field-input" id="pTagline" value="${biz.tagline}">

      <label class="field-label">Location</label>
      <input class="field-input" id="pLocation" value="${biz.location}">

      <button class="btn btn-orange btn-block" style="margin-top:20px;" id="saveProfileBtn">Save changes</button>
      <div id="savedMsg" style="display:none;color:var(--green-deep);font-weight:700;font-size:13px;margin-top:10px;">Saved.</div>
    </div>
  `;

  const pPhotoError = dashMain.querySelector("#pPhotoError");

  dashMain.querySelector("#pPhotoInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append("photo", file);
    try {
      await kbApi(`/api/businesses/${bizInfo.id}/photo`, { method: "POST", token: bizToken, body: form, isForm: true });
      await refreshBizServices();
      renderProfile();
    } catch (err) {
      pPhotoError.textContent = err.message;
      pPhotoError.style.display = "block";
    }
  });

  const removeBtn = dashMain.querySelector("#pPhotoRemove");
  if (removeBtn) {
    removeBtn.addEventListener("click", async () => {
      try {
        await kbApi(`/api/businesses/${bizInfo.id}/photo`, { method: "DELETE", token: bizToken });
        await refreshBizServices();
        renderProfile();
      } catch (err) {
        pPhotoError.textContent = err.message;
        pPhotoError.style.display = "block";
      }
    });
  }

  dashMain.querySelector("#saveProfileBtn").addEventListener("click", async () => {
    const name = dashMain.querySelector("#pName").value.trim() || biz.name;
    const tagline = dashMain.querySelector("#pTagline").value.trim() || biz.tagline;
    const location = dashMain.querySelector("#pLocation").value.trim() || biz.location;
    try {
      const { business } = await kbApi(`/api/businesses/${bizInfo.id}`, {
        method: "PATCH",
        token: bizToken,
        body: { name, tagline, location }
      });
      bizInfo = { ...bizInfo, ...business };
      sessionStorage.setItem("kb_biz_info", JSON.stringify(bizInfo));
      sideBizName.textContent = bizInfo.name;
      document.getElementById("savedMsg").style.display = "block";
    } catch (err) {
      pPhotoError.textContent = err.message;
      pPhotoError.style.display = "block";
    }
  });
}

/* ---------- Init ---------- */
populateLoginOptions();
if (bizToken && bizInfo) {
  showDashboard();
}
