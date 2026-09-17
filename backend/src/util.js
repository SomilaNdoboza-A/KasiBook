const crypto = require("crypto");

function makeId(prefix) {
  return prefix + "_" + crypto.randomBytes(6).toString("hex");
}

function makePaymentRef() {
  return "KB-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { makeId, makePaymentRef, nowIso };
