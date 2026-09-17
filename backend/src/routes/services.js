const express = require("express");
const db = require("../db");
const { authRequired } = require("../auth");
const { makeId } = require("../util");
const upload = require("../upload");

const router = express.Router();

function ownsService(businessId, serviceId) {
  const svc = db.prepare("SELECT * FROM services WHERE id = ?").get(serviceId);
  if (!svc) return null;
  return svc.business_id === businessId ? svc : false;
}

// POST /api/businesses/:id/services  (business-auth, must be self)
router.post("/businesses/:id/services", authRequired("business"), upload.single("photo"), (req, res) => {
  if (req.auth.id !== req.params.id) return res.status(403).json({ error: "You can only edit your own business." });

  const { name, price, duration } = req.body || {};
  const priceNum = parseFloat(price);
  const durationNum = parseInt(duration, 10);
  if (!name || Number.isNaN(priceNum) || Number.isNaN(durationNum)) {
    return res.status(400).json({ error: "Please fill in the service name, price and duration." });
  }

  const service = {
    id: makeId("s"),
    business_id: req.params.id,
    name: name.trim(),
    price: priceNum,
    duration: durationNum,
    image: req.file ? `/uploads/${req.file.filename}` : null
  };
  db.prepare(`
    INSERT INTO services (id, business_id, name, price, duration, image)
    VALUES (@id, @business_id, @name, @price, @duration, @image)
  `).run(service);

  res.status(201).json({ service });
});

// DELETE /api/services/:id  (business-auth, must own the service)
router.delete("/services/:id", authRequired("business"), (req, res) => {
  const svc = ownsService(req.auth.id, req.params.id);
  if (svc === null) return res.status(404).json({ error: "Service not found." });
  if (svc === false) return res.status(403).json({ error: "You don't own this service." });

  db.prepare("DELETE FROM services WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// PATCH /api/services/:id/photo  (upload a new photo)
router.patch("/services/:id/photo", authRequired("business"), upload.single("photo"), (req, res) => {
  const svc = ownsService(req.auth.id, req.params.id);
  if (svc === null) return res.status(404).json({ error: "Service not found." });
  if (svc === false) return res.status(403).json({ error: "You don't own this service." });
  if (!req.file) return res.status(400).json({ error: "No image uploaded." });

  const url = `/uploads/${req.file.filename}`;
  db.prepare("UPDATE services SET image = ? WHERE id = ?").run(url, req.params.id);
  res.json({ image: url });
});

// DELETE /api/services/:id/photo  (remove photo, keep the service)
router.delete("/services/:id/photo", authRequired("business"), (req, res) => {
  const svc = ownsService(req.auth.id, req.params.id);
  if (svc === null) return res.status(404).json({ error: "Service not found." });
  if (svc === false) return res.status(403).json({ error: "You don't own this service." });

  db.prepare("UPDATE services SET image = NULL WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
