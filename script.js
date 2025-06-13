
const POST_URL = "https://script.google.com/macros/s/AKfycbw4kB0t6-K2oLpC8oOMhMsLvFa-bziRGmt589yC9rMjSO15vpgHzDZwgOQpHkxfykOw/exec";
let requestData = [];

function fetchData() {
  fetch("https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest")
    .then(res => res.json())
    .then(data => {
      requestData = data;
      populateTable();
    });
}

function startClock() {
  setInterval(() => {
    const now = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
    document.getElementById("clock").textContent = now;
  }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  fetchData();
  startClock();
});

function saveDetails() {
  const formData = new FormData(document.getElementById("detailForm"));
  const ref = formData.get("Ref");
  if (!ref) {
    alert("Referenznummer fehlt!");
    return;
  }

  formData.append("mode", "update");

  fetch(POST_URL, {
    method: "POST",
    body: formData
  })
  .then(res => res.text())
  .then(text => {
    showSaveFeedback("Gespeichert: " + text, true);
    fetchData();
  })
  .catch(() => showSaveFeedback("Fehler beim Speichern!", false));
}

function deleteRequest(ref) {
  if (!confirm("Wirklich löschen?")) return;

  fetch(POST_URL, {
    method: "POST",
    body: new URLSearchParams({ ref, mode: "delete" })
  })
  .then(res => res.text())
  .then(msg => {
    showSaveFeedback("Gelöscht: " + msg, true);
    fetchData();
  })
  .catch(() => showSaveFeedback("Fehler beim Löschen!", false));
}

function showSaveFeedback(msg, success) {
  const info = document.getElementById("saveFeedback");
  info.textContent = msg;
  info.style.color = success ? "green" : "red";
  setTimeout(() => (info.textContent = ""), 3000);
}
