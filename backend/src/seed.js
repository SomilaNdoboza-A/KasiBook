require("dotenv").config();
const db = require("./db");
const { hashPassword } = require("./auth");
const { makeId, nowIso } = require("./util");

const SEED_BUSINESSES = [
  {
    name: "Thabo's Fade Palace", category: "Barber", owner: "Thabo Mokoena",
    location: "NY1, Khayelitsha", tagline: "Sharpest fades in the kasi. No appointment, no wait.",
    icon: "✂️", hue: "orange",
    services: [
      { name: "Skin Fade", price: 60, duration: 30 },
      { name: "Fade + Beard Line", price: 90, duration: 45 },
      { name: "Kids Cut", price: 40, duration: 20 }
    ]
  },
  {
    name: "Nolwazi Nails & Beauty", category: "Nail Technician", owner: "Nolwazi Dlamini",
    location: "Site C, Khayelitsha", tagline: "Gel sets, nail art and pamper sessions done right.",
    icon: "💅", hue: "gold",
    services: [
      { name: "Gel Overlay", price: 120, duration: 60 },
      { name: "Full Set + Art", price: 180, duration: 90 },
      { name: "Pedicure", price: 100, duration: 45 }
    ]
  },
  {
    name: "Sis' Ntombi Kota Corner", category: "Food Vendor", owner: "Ntombi Zulu",
    location: "Harare, Khayelitsha", tagline: "The kota that started the queue down the street.",
    icon: "🥪", hue: "green",
    services: [
      { name: "Full House Kota", price: 45, duration: 15 },
      { name: "Half Kota", price: 30, duration: 15 },
      { name: "Kota + Amagwinya Combo", price: 55, duration: 15 }
    ]
  },
  {
    name: "Sipho's Auto Repairs", category: "Mechanic", owner: "Sipho Nkosi",
    location: "Town 2, Khayelitsha", tagline: "Honest diagnostics and same-day fixes.",
    icon: "🔧", hue: "orange",
    services: [
      { name: "General Service", price: 450, duration: 120 },
      { name: "Brake Check & Fix", price: 350, duration: 90 },
      { name: "Diagnostic Scan", price: 150, duration: 30 }
    ]
  },
  {
    name: "Zanele's Hair Studio", category: "Salon", owner: "Zanele Mtshali",
    location: "Ilitha Park, Khayelitsha", tagline: "Braids, weaves and blow-outs for every occasion.",
    icon: "💇🏾‍♀️", hue: "gold",
    services: [
      { name: "Box Braids", price: 250, duration: 180 },
      { name: "Wash & Blow Dry", price: 100, duration: 45 },
      { name: "Weave Install", price: 300, duration: 150 }
    ]
  },
  {
    name: "Amanda's Beauty Bar", category: "Beauty Therapist", owner: "Amanda Peters",
    location: "Town Centre, Khayelitsha", tagline: "Facials, lashes and nails — look good, feel better.",
    icon: "💄", hue: "orange",
    services: [
      { name: "Classic Facial", price: 220, duration: 60 },
      { name: "Lash Extensions", price: 280, duration: 75 },
      { name: "Manicure", price: 90, duration: 30 }
    ]
  }
];

const DEMO_PASSWORD = "kasi123";

function seed() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM businesses").get();
  if (existing.n > 0) {
    console.log("Businesses already exist — skipping seed. Delete kasibook.db to reseed from scratch.");
    return;
  }

  const insertBiz = db.prepare(`
    INSERT INTO businesses (id, name, category, owner, password_hash, location, tagline, icon, hue, photo, created_at)
    VALUES (@id, @name, @category, @owner, @password_hash, @location, @tagline, @icon, @hue, NULL, @created_at)
  `);
  const insertService = db.prepare(`
    INSERT INTO services (id, business_id, name, price, duration, image)
    VALUES (@id, @business_id, @name, @price, @duration, NULL)
  `);

  const passwordHash = hashPassword(DEMO_PASSWORD);

  db.exec("BEGIN");
  try {
    for (const biz of SEED_BUSINESSES) {
      const bizId = makeId("b");
      insertBiz.run({
        id: bizId,
        name: biz.name,
        category: biz.category,
        owner: biz.owner,
        password_hash: passwordHash,
        location: biz.location,
        tagline: biz.tagline,
        icon: biz.icon,
        hue: biz.hue,
        created_at: nowIso()
      });
      for (const svc of biz.services) {
        insertService.run({
          id: makeId("s"),
          business_id: bizId,
          name: svc.name,
          price: svc.price,
          duration: svc.duration
        });
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  console.log(`Seeded ${SEED_BUSINESSES.length} businesses. Demo password for all: "${DEMO_PASSWORD}"`);
}

seed();
