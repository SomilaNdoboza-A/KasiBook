/* KasiBook — shared data layer
   Built for small business owners of every kind (barbers, salons, nail
   techs, beauty therapists, food vendors, mechanics and more) who need
   an easy way to manage bookings without a backend. Everything lives in
   localStorage under "kasibook_v1" so the demo persists across page
   loads without a server. Services can carry a photo (image) so
   customers can see exactly what they're booking, and every business
   can carry a cover photo (photo) for their page. Bookings can be
   "pending", "confirmed", "declined" (turned down by the business) or
   "cancelled" (called off by the customer) — business owners can see
   all of these, including a dedicated cancelled view. */

const KB_KEY = "kasibook_v1";

const KB_SEED = {
  businesses: [
    {
      id: "b1",
      name: "Thabo's Fade Palace",
      category: "Barber",
      owner: "Thabo Mokoena",
      password: "kasi123",
      location: "NY1, Khayelitsha",
      tagline: "Sharpest fades in the kasi. No appointment, no wait.",
      icon: "✂️",
      hue: "orange",
      services: [
        { id: "s1", name: "Skin Fade", price: 60, duration: 30 },
        { id: "s2", name: "Fade + Beard Line", price: 90, duration: 45 },
        { id: "s3", name: "Kids Cut", price: 40, duration: 20 }
      ]
    },
    {
      id: "b2",
      name: "Nolwazi Nails & Beauty",
      category: "Nail Technician",
      owner: "Nolwazi Dlamini",
      password: "kasi123",
      location: "Site C, Khayelitsha",
      tagline: "Gel sets, nail art and pamper sessions done right.",
      icon: "💅",
      hue: "gold",
      services: [
        { id: "s1", name: "Gel Overlay", price: 120, duration: 60 },
        { id: "s2", name: "Full Set + Art", price: 180, duration: 90 },
        { id: "s3", name: "Pedicure", price: 100, duration: 45 }
      ]
    },
    {
      id: "b3",
      name: "Sis' Ntombi Kota Corner",
      category: "Food Vendor",
      owner: "Ntombi Zulu",
      password: "kasi123",
      location: "Harare, Khayelitsha",
      tagline: "The kota that started the queue down the street.",
      icon: "🥪",
      hue: "green",
      services: [
        { id: "s1", name: "Full House Kota", price: 45, duration: 15 },
        { id: "s2", name: "Half Kota", price: 30, duration: 15 },
        { id: "s3", name: "Kota + Amagwinya Combo", price: 55, duration: 15 }
      ]
    },
    {
      id: "b4",
      name: "Sipho's Auto Repairs",
      category: "Mechanic",
      owner: "Sipho Nkosi",
      password: "kasi123",
      location: "Town 2, Khayelitsha",
      tagline: "Honest diagnostics and same-day fixes.",
      icon: "🔧",
      hue: "orange",
      services: [
        { id: "s1", name: "General Service", price: 450, duration: 120 },
        { id: "s2", name: "Brake Check & Fix", price: 350, duration: 90 },
        { id: "s3", name: "Diagnostic Scan", price: 150, duration: 30 }
      ]
    },
    {
      id: "b5",
      name: "Zanele's Hair Studio",
      category: "Salon",
      owner: "Zanele Mtshali",
      password: "kasi123",
      location: "Ilitha Park, Khayelitsha",
      tagline: "Braids, weaves and blow-outs for every occasion.",
      icon: "💇🏾‍♀️",
      hue: "gold",
      services: [
        { id: "s1", name: "Box Braids", price: 250, duration: 180 },
        { id: "s2", name: "Wash & Blow Dry", price: 100, duration: 45 },
        { id: "s3", name: "Weave Install", price: 300, duration: 150 }
      ]
    },
    {
      id: "b6",
      name: "Amanda's Beauty Bar",
      category: "Beauty Therapist",
      owner: "Amanda Peters",
      password: "kasi123",
      location: "Town Centre, Khayelitsha",
      tagline: "Facials, lashes and nails — look good, feel better.",
      icon: "💄",
      hue: "orange",
      services: [
        { id: "s1", name: "Classic Facial", price: 220, duration: 60 },
        { id: "s2", name: "Lash Extensions", price: 280, duration: 75 },
        { id: "s3", name: "Manicure", price: 90, duration: 30 }
      ]
    }
  ],
  bookings: [],
  customers: []
};

function kbLoad() {
  const raw = localStorage.getItem(KB_KEY);
  if (!raw) {
    localStorage.setItem(KB_KEY, JSON.stringify(KB_SEED));
    return JSON.parse(JSON.stringify(KB_SEED));
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    localStorage.setItem(KB_KEY, JSON.stringify(KB_SEED));
    return JSON.parse(JSON.stringify(KB_SEED));
  }
}

function kbSave(state) {
  localStorage.setItem(KB_KEY, JSON.stringify(state));
}

function kbResetDemo() {
  localStorage.setItem(KB_KEY, JSON.stringify(KB_SEED));
}

function kbNextId(prefix, list) {
  return prefix + (list.length + 1) + "_" + Math.random().toString(36).slice(2, 7);
}

function kbFormatCurrency(n) {
  return "R" + Number(n).toFixed(0);
}

function kbFormatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

/* Next 7 available days, skipping nothing (kept simple for the demo) */
function kbNextDays(count = 7) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const KB_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

/* ---------- Shared auth helpers (demo-grade: plaintext, no hashing) ---------- */

function kbFindCustomerByPhone(state, phone) {
  return state.customers.find(c => c.phone === phone);
}

function kbFindBusinessByName(state, name) {
  return state.businesses.find(b => b.name.toLowerCase() === name.toLowerCase());
}

/* ---------- Photo upload helper ----------
   Reads a chosen file (from an <input type="file"> change event) and
   resolves to a base64 data URL so it can be saved straight into
   localStorage — no server or file storage needed for the demo. */
function kbFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
    if (file.size > 2 * 1024 * 1024) return reject(new Error("Image is too large (max 2MB)."));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

