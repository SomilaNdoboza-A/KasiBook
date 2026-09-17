/* KasiBook — customer dashboard logic
   Flow: register/login -> dashboard -> browse -> pick service -> pick
   date & time -> pay -> confirmation. Everything after login lives
   inside the dashboard screen; the landing screen is logged-out only.
   Now backed by the real API (see api.js) instead of localStorage. */

let custToken = sessionStorage.getItem("kb_customer_token") || null;
let custInfo = JSON.parse(sessionStorage.getItem("kb_customer_info") || "null");

let businesses = [];       // cached list from GET /api/businesses
let myBookings = [];       // cached list from GET /api/customers/me/bookings
let activeCategory = "All";
let bookingDraft = null;   // { businessId, serviceId, date, time }
let bookedTimesForDraft = []; // taken slots for the currently-selected business+date

const landingScreen = document.getElementById("landingScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const topAuthBtn = document.getElementById("topAuthBtn");
const heroSignupBtn = document.getElementById("heroSignupBtn");
const heroLoginBtn = document.getElementById("heroLoginBtn");
const custGreetName = document.getElementById("custGreetName");
const custLogoutBtn = document.getElementById("custLogoutBtn");
const custTabRow = document.getElementById("custTabRow");
const browseTab = document.getElementById("browseTab");
const bookingsTab = document.getElementById("bookingsTab");
const bookingsList = document.getElementById("bookingsList");

const bizGrid = document.getElementById("bizGrid");
const categoryPills = document.getElementById("categoryPills");
const modalBackdrop = document.getElementById("bizModal");
const modalContent = document.getElementById("bizModalContent");

function currentCustomer() {
  return custInfo;
}

function clearCustomerSession() {
  custToken = null;
  custInfo = null;
  sessionStorage.removeItem("kb_customer_token");
  sessionStorage.removeItem("kb_customer_info");
}

function setCustomerSession(token, customer) {
  custToken = token;
  custInfo = customer;
  sessionStorage.setItem("kb_customer_token", token);
  sessionStorage.setItem("kb_customer_info", JSON.stringify(customer));
}

/* ---------- Screen switching ---------- */
async function renderAuthState() {
  const cust = currentCustomer();
  if (cust && custToken) {
    landingScreen.style.display = "none";
    dashboardScreen.style.display = "block";
    topAuthBtn.style.display = "none";
    custGreetName.textContent = cust.name.split(" ")[0];
    try {
      businesses = (await kbApi("/api/businesses")).businesses;
    } catch (e) {
      businesses = [];
    }
    renderBrowseTab();
  } else {
    landingScreen.style.display = "block";
    dashboardScreen.style.display = "none";
    topAuthBtn.style.display = "inline-block";
    topAuthBtn.textContent = "Log in / Sign up";
  }
}

topAuthBtn.addEventListener("click", () => openAuthModal("login"));
heroSignupBtn.addEventListener("click", () => openAuthModal("register"));
heroLoginBtn.addEventListener("click", () => openAuthModal("login"));
custLogoutBtn.addEventListener("click", () => {
  clearCustomerSession();
  renderAuthState();
});

custTabRow.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (!btn) return;
  custTabRow.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  const tab = btn.dataset.tab;
  browseTab.style.display = tab === "browse" ? "block" : "none";
  bookingsTab.style.display = tab === "bookings" ? "block" : "none";
  if (tab === "bookings") renderBookingsTab();
});

/* ---------- Browse tab ---------- */
function categories() {
  const set = new Set(businesses.map(b => b.category));
  return ["All", ...Array.from(set)];
}

function renderPills() {
  categoryPills.innerHTML = categories().map(cat => `
    <button class="pill ${cat === activeCategory ? "active" : ""}" data-cat="${cat}">${cat}</button>
  `).join("");
  categoryPills.querySelectorAll(".pill").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderPills();
      renderGrid();
    });
  });
}

function renderGrid() {
  const list = businesses.filter(b => activeCategory === "All" || b.category === activeCategory);
  bizGrid.innerHTML = list.map(b => `
    <div class="biz-card" data-id="${b.id}">
      ${b.photo ? `<div class="biz-card-photo" style="background-image:url('${kbPhotoUrl(b.photo)}')"></div>` : ""}
      <div class="biz-icon hue-${b.hue}">${b.icon}</div>
      <div class="biz-cat">${b.category}</div>
      <h3>${b.name}</h3>
      <p>${b.tagline}</p>
      <div class="biz-loc">📍 ${b.location}</div>
    </div>
  `).join("");
  bizGrid.querySelectorAll(".biz-card").forEach(card => {
    card.addEventListener("click", () => openBusiness(card.dataset.id));
  });
}

function renderBrowseTab() {
  renderPills();
  renderGrid();
}

/* ---------- My bookings tab ---------- */
async function renderBookingsTab() {
  bookingsList.innerHTML = `<div class="empty-state">Loading your bookings…</div>`;
  try {
    myBookings = (await kbApi("/api/customers/me/bookings", { token: custToken })).bookings;
  } catch (e) {
    bookingsList.innerHTML = `<div class="empty-state">Couldn't load your bookings — ${e.message}</div>`;
    return;
  }

  const mine = myBookings; // already scoped to this customer, newest first

  bookingsList.innerHTML = mine.length === 0
    ? `<div class="empty-state">No bookings yet — head to Browse businesses to book your first service.</div>`
    : `<div class="table-wrap"><table>
        <thead><tr><th>Business</th><th>Service</th><th>Date</th><th>Time</th><th>Paid</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${mine.map(bk => {
            const cancellable = bk.status === "pending" || bk.status === "confirmed";
            return `
              <tr>
                <td>${bk.business_name || "—"}</td>
                <td>${bk.service_name || "—"}</td>
                <td>${kbFormatDate(bk.date)}</td>
                <td>${bk.time}</td>
                <td>${bk.paid ? kbFormatCurrency(bk.amount_paid) : "—"}</td>
                <td><span class="status-tag status-${bk.status}">${bk.status}</span></td>
                <td>${cancellable ? `<button class="mini-btn decline" data-cancel="${bk.id}">Cancel</button>` : ""}</td>
              </tr>`;
          }).join("")}
        </tbody>
      </table></div>`;

  bookingsList.querySelectorAll("button[data-cancel]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Cancel this booking?")) return;
      try {
        await kbApi(`/api/bookings/${btn.dataset.cancel}/cancel`, { method: "PATCH", token: custToken });
        renderBookingsTab();
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

/* ---------- Modal helpers ---------- */
function openModal(html) {
  modalContent.innerHTML = html;
  modalBackdrop.classList.add("open");
}
function closeModal() {
  modalBackdrop.classList.remove("open");
}
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

/* ---------- Auth modal (login / register) ---------- */
function openAuthModal(mode) {
  renderAuthModal(mode || "login");
}

function renderAuthModal(mode) {
  openModal(`
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <h2>${mode === "login" ? "Log in" : "Create your account"}</h2>
    <p style="font-size:13px;color:rgba(32,27,15,0.6);margin:4px 0 14px;">Browse local businesses, book a service and pay — all in one place.</p>
    <div class="auth-tabs">
      <button data-tab="login" class="${mode === "login" ? "active" : ""}">Log in</button>
      <button data-tab="register" class="${mode === "register" ? "active" : ""}">Sign up</button>
    </div>
    <div id="authFields"></div>
    <div class="error-msg" id="authError"></div>
    <button class="btn btn-orange btn-block" style="margin-top:18px;" id="authSubmit">${mode === "login" ? "Log in" : "Create account"}</button>
  `);

  modalContent.querySelectorAll(".auth-tabs button").forEach(t => {
    t.addEventListener("click", () => renderAuthModal(t.dataset.tab));
  });

  const fields = modalContent.querySelector("#authFields");
  if (mode === "login") {
    fields.innerHTML = `
      <label class="field-label" style="margin-top:0;">Cellphone number</label>
      <input class="field-input" id="authPhone">
      <label class="field-label">Password</label>
      <input class="field-input" id="authPassword" type="password">
    `;
  } else {
    fields.innerHTML = `
      <label class="field-label" style="margin-top:0;">Your name</label>
      <input class="field-input" id="authName">
      <label class="field-label">Cellphone number</label>
      <input class="field-input" id="authPhone">
      <label class="field-label">Choose a password</label>
      <input class="field-input" id="authPassword" type="password">
    `;
  }

  modalContent.querySelector("#authSubmit").addEventListener("click", async () => {
    const errBox = modalContent.querySelector("#authError");
    errBox.style.display = "none";
    const phone = modalContent.querySelector("#authPhone").value.trim();
    const password = modalContent.querySelector("#authPassword").value;

    try {
      if (mode === "login") {
        const { token, customer } = await kbApi("/api/customers/login", {
          method: "POST",
          body: { phone, password }
        });
        setCustomerSession(token, customer);
        closeModal();
        renderAuthState();
      } else {
        const name = modalContent.querySelector("#authName").value.trim();
        if (!name || !phone || !password) {
          throw new Error("Please fill in every field.");
        }
        const { token, customer } = await kbApi("/api/customers/register", {
          method: "POST",
          body: { name, phone, password }
        });
        setCustomerSession(token, customer);
        closeModal();
        renderAuthState();
      }
    } catch (e) {
      errBox.textContent = e.message;
      errBox.style.display = "block";
    }
  });
}

/* ---------- Booking flow (only reachable once logged in) ---------- */

/* Step 1: business profile + service picker */
function openBusiness(id) {
  const biz = businesses.find(b => b.id === id);
  bookingDraft = { businessId: id, serviceId: null, date: null, time: null };
  openModal(`
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <div class="biz-cat">${biz.category}</div>
    <h2>${biz.name}</h2>
    <p style="font-size:14px;color:rgba(32,27,15,0.65);margin:6px 0 4px;">${biz.tagline}</p>
    <p style="font-size:13px;font-weight:600;color:var(--green-deep);">📍 ${biz.location}</p>
    <div class="field-label">Choose a service</div>
    ${biz.services.length === 0 ? `<p style="font-size:13px;color:rgba(32,27,15,0.55);margin-top:10px;">This business hasn't added any services yet.</p>` : biz.services.map(s => `
      <div class="service-row" data-sid="${s.id}">
        <div class="s-left">
          ${s.image
            ? `<img class="s-thumb" src="${kbPhotoUrl(s.image)}" alt="${s.name}">`
            : `<div class="s-thumb s-thumb-empty hue-${biz.hue}">${biz.icon}</div>`}
          <div>
            <div class="s-name">${s.name}</div>
            <div class="s-meta">${s.duration} min</div>
          </div>
        </div>
        <div class="s-price">${kbFormatCurrency(s.price)}</div>
      </div>
    `).join("")}
    <button class="btn btn-orange btn-block" style="margin-top:22px;" id="toStepDate" disabled>Choose date & time</button>
  `);

  modalContent.querySelectorAll(".service-row").forEach(row => {
    row.addEventListener("click", () => {
      modalContent.querySelectorAll(".service-row").forEach(r => r.classList.remove("selected"));
      row.classList.add("selected");
      bookingDraft.serviceId = row.dataset.sid;
      modalContent.querySelector("#toStepDate").disabled = false;
    });
  });
  modalContent.querySelector("#toStepDate").addEventListener("click", () => openDateTime(id));
}

/* Step 2: date & time */
function openDateTime(bizId) {
  const biz = businesses.find(b => b.id === bizId);
  const service = biz.services.find(s => s.id === bookingDraft.serviceId);
  const days = kbNextDays(7);

  openModal(`
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <div class="biz-cat">${biz.category}</div>
    <h2>${biz.name}</h2>
    <p style="font-size:14px;color:rgba(32,27,15,0.65);margin:6px 0 4px;">${service.name} · ${kbFormatCurrency(service.price)} · ${service.duration} min</p>

    <div class="field-label">Pick a date</div>
    <div class="chip-row" id="dateChips">
      ${days.map(d => `<button class="chip" data-date="${d}">${kbFormatDate(d)}</button>`).join("")}
    </div>

    <div class="field-label">Pick a time</div>
    <div class="chip-row" id="timeChips">
      ${KB_TIMES.map(t => `<button class="chip" data-time="${t}">${t}</button>`).join("")}
    </div>

    <button class="btn btn-orange btn-block" style="margin-top:22px;" id="toStepPay" disabled>Continue to payment</button>
  `);

  const dateChips = modalContent.querySelectorAll("#dateChips .chip");
  const timeChips = modalContent.querySelectorAll("#timeChips .chip");
  const continueBtn = modalContent.querySelector("#toStepPay");

  function checkReady() {
    continueBtn.disabled = !(bookingDraft.date && bookingDraft.time);
  }

  function applyTakenSlots() {
    timeChips.forEach(c => {
      const taken = bookedTimesForDraft.includes(c.dataset.time);
      c.disabled = taken;
      c.classList.toggle("taken", taken);
      if (taken && bookingDraft.time === c.dataset.time) {
        bookingDraft.time = null;
      }
    });
    checkReady();
  }

  dateChips.forEach(c => c.addEventListener("click", async () => {
    dateChips.forEach(x => x.classList.remove("selected"));
    c.classList.add("selected");
    bookingDraft.date = c.dataset.date;
    bookingDraft.time = null;
    timeChips.forEach(x => x.classList.remove("selected"));
    try {
      const { times } = await kbApi(`/api/businesses/${bizId}/booked-slots?date=${bookingDraft.date}`);
      bookedTimesForDraft = times;
    } catch (e) {
      bookedTimesForDraft = []; // fail open — the server still enforces this on actual booking
    }
    applyTakenSlots();
  }));
  timeChips.forEach(c => c.addEventListener("click", () => {
    if (c.disabled) return;
    timeChips.forEach(x => x.classList.remove("selected"));
    c.classList.add("selected");
    bookingDraft.time = c.dataset.time;
    checkReady();
  }));

  continueBtn.addEventListener("click", () => openPayment(bizId));
}

/* Step 3: payment (mock — no real card processing) */
function openPayment(bizId) {
  const biz = businesses.find(b => b.id === bizId);
  const service = biz.services.find(s => s.id === bookingDraft.serviceId);
  const cust = currentCustomer();

  openModal(`
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <div class="biz-cat">${biz.category}</div>
    <h2>Pay for your booking</h2>

    <div class="pay-summary">
      <div>${service.name} · ${biz.name}</div>
      <div>📍 ${biz.location}</div>
      <div>${kbFormatDate(bookingDraft.date)} at ${bookingDraft.time}</div>
      <div class="pay-total"><span>Total</span><span>${kbFormatCurrency(service.price)}</span></div>
    </div>

    <label class="field-label" style="margin-top:0;">Name on card</label>
    <input class="field-input" id="payName" value="${cust.name}">

    <label class="field-label">Card number</label>
    <input class="field-input" id="payCard" placeholder="4242 4242 4242 4242" maxlength="19">

    <div class="pay-row">
      <div style="flex:1;">
        <label class="field-label">Expiry</label>
        <input class="field-input" id="payExpiry" placeholder="MM/YY" maxlength="5">
      </div>
      <div style="flex:1;">
        <label class="field-label">CVV</label>
        <input class="field-input" id="payCvv" placeholder="123" maxlength="3">
      </div>
    </div>

    <div class="error-msg" id="payError">Please fill in your card details.</div>

    <button class="btn btn-orange btn-block" style="margin-top:22px;" id="payBtn">Pay ${kbFormatCurrency(service.price)} & confirm booking</button>
    <p style="font-size:11.5px;color:rgba(32,27,15,0.5);text-align:center;margin-top:10px;">Demo payment — no real card is charged.</p>
  `);

  modalContent.querySelector("#payBtn").addEventListener("click", async () => {
    const name = modalContent.querySelector("#payName").value.trim();
    const card = modalContent.querySelector("#payCard").value.replace(/\s/g, "");
    const expiry = modalContent.querySelector("#payExpiry").value.trim();
    const cvv = modalContent.querySelector("#payCvv").value.trim();
    const errBox = modalContent.querySelector("#payError");

    if (!name || card.length < 12 || !expiry || cvv.length < 3) {
      errBox.textContent = "Please check your card details and try again.";
      errBox.style.display = "block";
      return;
    }
    errBox.style.display = "none";

    const payBtn = modalContent.querySelector("#payBtn");
    payBtn.disabled = true;
    payBtn.textContent = "Processing…";

    try {
      const { booking } = await kbApi("/api/bookings", {
        method: "POST",
        token: custToken,
        body: {
          business_id: bizId,
          service_id: service.id,
          date: bookingDraft.date,
          time: bookingDraft.time
        }
      });
      openConfirmation(bizId, service, booking);
    } catch (e) {
      // Most likely a 409 — the slot got taken between selecting and paying.
      errBox.textContent = e.message;
      errBox.style.display = "block";
      payBtn.disabled = false;
      payBtn.textContent = `Pay ${kbFormatCurrency(service.price)} & confirm booking`;
    }
  });
}

/* Step 4: confirmation */
function openConfirmation(bizId, service, booking) {
  const biz = businesses.find(b => b.id === bizId);
  openModal(`
    <button class="modal-close" onclick="closeModal(); renderAuthState();">&times;</button>
    <div class="confirm-box">
      <div class="check">✓</div>
      <h2>Payment successful</h2>
      <p style="font-size:14px;color:rgba(32,27,15,0.65);margin:10px 0 4px;">
        Your <strong>${service.name}</strong> with <strong>${biz.name}</strong> is booked and confirmed for <strong>${kbFormatDate(booking.date)}</strong> at <strong>${booking.time}</strong>.
      </p>
      <p style="font-size:13px;font-weight:600;color:var(--green-deep);margin:0 0 4px;">📍 ${biz.location}</p>
      <div class="ref-box">Reference: ${booking.payment_ref} · ${kbFormatCurrency(booking.amount_paid)} paid</div>
      <button class="btn btn-orange btn-block" style="margin-top:20px;" onclick="closeModal(); showBookingsTab();">View my bookings</button>
    </div>
  `);
}

function showBookingsTab() {
  custTabRow.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
  custTabRow.querySelector('[data-tab="bookings"]').classList.add("active");
  browseTab.style.display = "none";
  bookingsTab.style.display = "block";
  renderBookingsTab();
}

renderAuthState();
