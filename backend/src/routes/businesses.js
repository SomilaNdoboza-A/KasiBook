const express = require("express");
const db = require("../db");
const { hashPassword, checkPassword, signToken, authRequired } = require("../auth");
const { makeId, nowIso } = require("../util");
const upload = require("../upload");

const router = express.Router();

function publicBusiness(biz) {
  const { password_hash, ...rest } = biz;
  return rest;
}

// POST /api/businesses/register
router.post("/register", (req, res) => {
  const { name, category, owner, location, password } = req.body || {};
  if (!name || !category || !owner || !location || !password) {
    return res.status(400).json({ error: "Please fill in every field." });
  }
  const existing = db.prepare("SELECT id FROM businesses WHERE lower(name) = lower(?)").get(name);
  if (existing) {
    return res.status(409).json({ error: "A business with that name already exists." });
  }
  const biz = {
    id: makeId("b"),
    name: name.trim(),
    category: category.trim(),
    owner: owner.trim(),
    password_hash: hashPassword(password),
    location: location.trim(),
    tagline: "New on KasiBook — set your tagline in Business profile.",
    icon: "🏪",
    hue: "green",
    created_at: nowIso()
  };
  db.prepare(`
    INSERT INTO businesses (id, name, category, owner, password_hash, location, tagline, icon, hue, created_at)
    VALUES (@id, @name, @category, @owner, @password_hash, @location, @tagline, @icon, @hue, @created_at)
  `).run(biz);

  const token = signToken({ role: "business", id: biz.id });
  res.status(201).json({ token, business: publicBusiness(biz) });
});

// POST /api/businesses/login  (business_id + password, matching the dashboard's "pick your business" dropdown)
router.post("/login", (req, res) => {
  const { business_id, password } = req.body || {};
  if (!business_id || !password) return res.status(400).json({ error: "Please fill in every field." });

  const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(business_id);
  if (!biz || !checkPassword(password, biz.password_hash)) {
    return res.status(401).json({ error: "Incorrect password. Try again." });
  }
  const token = signToken({ role: "business", id: biz.id });
  res.json({ token, business: publicBusiness(biz) });
});

// GET /api/businesses  (public browse list, with each business's services)
router.get("/", (req, res) => {
  const { category } = req.query;
  const businesses = category && category !== "All"
    ? db.prepare("SELECT * FROM businesses WHERE category = ?").all(category)
    : db.prepare("SELECT * FROM businesses").all();

  const services = db.prepare("SELECT * FROM services WHERE business_id = ?");
  const withServices = businesses.map(b => ({
    ...publicBusiness(b),
    services: services.all(b.id)
  }));
  res.json({ businesses: withServices });
});

// GET /api/businesses/:id  (public single business + services)
router.get("/:id", (req, res) => {
  const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(req.params.id);
  if (!biz) return res.status(404).json({ error: "Business not found." });
  const services = db.prepare("SELECT * FROM services WHERE business_id = ?").all(biz.id);
  res.json({ business: { ...publicBusiness(biz), services } });
});

// PATCH /api/businesses/:id  (business-auth, must be self)
router.patch("/:id", authRequired("business"), (req, res) => {
  if (req.auth.id !== req.params.id) return res.status(403).json({ error: "You can only edit your own business." });
  const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(req.params.id);
  if (!biz) return res.status(404).json({ error: "Business not found." });

  const name = (req.body.name || biz.name).trim();
  const tagline = (req.body.tagline || biz.tagline || "").trim();
  const location = (req.body.location || biz.location).trim();

  db.prepare("UPDATE businesses SET name = ?, tagline = ?, location = ? WHERE id = ?")
    .run(name, tagline, location, biz.id);

  const updated = db.prepare("SELECT * FROM businesses WHERE id = ?").get(biz.id);
  res.json({ business: publicBusiness(updated) });
});

// POST /api/businesses/:id/photo  (business-auth, must be self)
router.post("/:id/photo", authRequired("business"), upload.single("photo"), (req, res) => {
  if (req.auth.id !== req.params.id) return res.status(403).json({ error: "You can only edit your own business." });
  if (!req.file) return res.status(400).json({ error: "No image uploaded." });

  const url = `/uploads/${req.file.filename}`;
  db.prepare("UPDATE businesses SET photo = ? WHERE id = ?").run(url, req.params.id);
  res.json({ photo: url });
});

// DELETE /api/businesses/:id/photo
router.delete("/:id/photo", authRequired("business"), (req, res) => {
  if (req.auth.id !== req.params.id) return res.status(403).json({ error: "You can only edit your own business." });
  db.prepare("UPDATE businesses SET photo = NULL WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// GET /api/businesses/me/bookings  (business-auth; optional ?status= filter)
router.get("/me/bookings", authRequired("business"), (req, res) => {
  const { status } = req.query;
  let rows;
  if (status && status !== "all") {
    rows = db.prepare(`
      SELECT bookings.*, services.name AS service_name, services.price AS service_price
      FROM bookings JOIN services ON services.id = bookings.service_id
      WHERE bookings.business_id = ? AND bookings.status = ?
      ORDER BY bookings.date ASC, bookings.time ASC
    `).all(req.auth.id, status);
  } else {
    rows = db.prepare(`
      SELECT bookings.*, services.name AS service_name, services.price AS service_price
      FROM bookings JOIN services ON services.id = bookings.service_id
      WHERE bookings.business_id = ?
      ORDER BY bookings.date ASC, bookings.time ASC
    `).all(req.auth.id);
  }
  res.json({ bookings: rows });
});

// GET /api/businesses/me/customers  (business-auth; rolled up from bookings)
router.get("/me/customers", authRequired("business"), (req, res) => {
  const rows = db.prepare(`
    SELECT customer_phone AS phone, customer_name AS name, COUNT(*) AS count, MAX(date) AS last
    FROM bookings
    WHERE business_id = ?
    GROUP BY customer_phone, customer_name
    ORDER BY last DESC
  `).all(req.auth.id);
  res.json({ customers: rows });
});

module.exports = router;
