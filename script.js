
let currentRef = null;
let requestData = [];

function openDetails(ref) {
  const request = requestData.find(r => r.ref === ref);
  if (!request) return;
  currentRef = ref;

  document.getElementById("refDisplay").textContent = ref;
  document.getElementById("billingCompanyInput").value = request.billingCompany || "";
  document.getElementById("billingAddressInput").value = request.billingAddress || "";
  document.getElementById("taxNumberInput").value = request.taxNumber || "";
  document.getElementById("contactNameInput").value = request.contactName || "";
  document.getElementById("contactEmailInput").value = request.contactEmail || "";
  document.getElementById("airlineInput").value = request.airline || "";
  document.getElementById("dateInput").value = request.flightDate || "";
  document.getElementById("tonnageInput").value = request.tonnage || "";
  document.getElementById("emailRequestInput").value = request.emailRequest || "";

  document.getElementById("finalWeightInput").value = request.manifestWeight || "";
  document.getElementById("extraChargesInput").value = request.otherPrices || "";
  document.getElementById("rateInput").value = request.rate || "";
  document.getElementById("flightTimeInput").value = request.flightTime || "";
  document.getElementById("flightnumberInput").value = request.flightNumber || "";
  document.getElementById("escortCheckbox").checked = request.apronSupport === "Ja";

  document.getElementById("detailModal").style.display = "block";
}

function saveExtras() {
  if (!currentRef) return;

  fetch("https://script.google.com/macros/s/AKfycbw4kB0t6-K2oLpC8oOMhMsLvFa-bziRGmt589yC9rMjSO15vpgHzDZwgOQpHkxfykOw/exec", {
    method: "POST",
    body: new URLSearchParams({
      mode: "updateExtras",
      ref: currentRef,
      finalWeight: document.getElementById("finalWeightInput").value,
      extraCharges: document.getElementById("extraChargesInput").value,
      rate: document.getElementById("rateInput").value,
      flightTime: document.getElementById("flightTimeInput").value,
      escort: document.getElementById("escortCheckbox").checked ? "Ja" : "Nein",
      flightnumber: document.getElementById("flightnumberInput").value
    })
  })
  .then(res => res.text())
  .then(res => {
    alert("Gespeichert: " + res);
    loadData();
    closeModal();
  });
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

function loadData() {
  fetch("https://script.google.com/macros/s/AKfycbw4kB0t6-K2oLpC8oOMhMsLvFa-bziRGmt589yC9rMjSO15vpgHzDZwgOQpHkxfykOw/exec?mode=read")
    .then(response => response.json())
    .then(data => {
      requestData = data;
      populateTable();
    });
}

function populateTable() {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";

  requestData.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><button onclick="openDetails('${r.ref}')">${r.ref}</button></td>
      <td>${r.flightNumber || ""}</td>
      <td>${r.flightDate || ""}</td>
      <td>${r.airline || ""}</td>
      <td>${r.tonnage || ""}</td>
    `;
    table.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", loadData);
