let requestData = [];

function refreshDashboard() {
  Promise.all([
    fetch("https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest").then(r => r.json()),
    fetch("https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/FlightTime").then(r => r.json())
  ]).then(([mainData, timeData]) => {
    requestData = mainData.map(row => {
      const matchingTime = timeData.find(t => t.Ref === row["Ref"]);
      return {
        ref: row["Ref"],
        date: row["Flight Date"],
        airline: row["Airline"],
        flightNumber: row["Flugnummer"],
        billingCompany: row["Billing Company"],
        billingAddress: row["Billing Address"],
        taxNumber: row["Tax Number"],
        contactName: row["Contact Name"],
        contactEmail: row["Contact Email"],
        emailRequest: row["Email Request"],
        tonnage: parseFloat(row["Tonnage"]) || 0,
        rate: row["Rate"] || "",
        otherPrices: row["Zusatzkosten"] || "",
        apronSupport: row["Vorfeldbegleitung"] || "",
        flightTime: matchingTime?.FlightTime || "",
        manifestWeight: row["Final Manifest Weight"] || ""
      };
    });
    populateRows();
    renderCalendar();
  });
}

function populateRows() {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";
  requestData.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><button onclick="openDetails('${r.ref}')">${r.ref}</button></td>
      <td>${r.flightNumber || "-"}</td>
      <td>${new Date(r.date).toLocaleDateString("de-DE")}</td>
      <td>${r.airline}</td>
      <td>${r.tonnage.toLocaleString("de-DE")} kg</td>
      <td><button onclick="deleteRequest('${r.ref}')">Delete</button></td>`;
    table.appendChild(row);
  });
}

function openDetails(ref) {
  const r = requestData.find(x => x.ref === ref);
  if (!r) return;
  document.getElementById("modalRef").value = r.ref;
  document.getElementById("airlineInput").value = r.airline || "";
  document.getElementById("dateInput").value = r.date?.split("T")[0] || "";
  document.getElementById("flightTimeInput").value = r.flightTime || "";
  document.getElementById("tonnageInput").value = r.tonnage || "";
  document.getElementById("billingCompanyInput").value = r.billingCompany || "";
  document.getElementById("billingAddressInput").value = r.billingAddress || "";
  document.getElementById("taxNumberInput").value = r.taxNumber || "";
  document.getElementById("contactNameInput").value = r.contactName || "";
  document.getElementById("contactEmailInput").value = r.contactEmail || "";
  document.getElementById("flightNumberInput").value = r.flightNumber || "";
  document.getElementById("rateInput").value = r.rate || "";
  document.getElementById("otherPricesInput").value = r.otherPrices || "";
  document.getElementById("apronSupportInput").checked = r.apronSupport === "Ja";
  document.getElementById("viewEmailRequest").textContent = r.emailRequest || "-";
  document.getElementById("detailModal").style.display = "block";
}

function saveDetails() {
  const ref = document.getElementById("modalRef").value;
  const r = requestData.find(x => x.ref === ref);
  if (!r) return;

  r.airline = document.getElementById("airlineInput").value;
  r.date = document.getElementById("dateInput").value;
  r.flightTime = document.getElementById("flightTimeInput").value;
  r.tonnage = parseFloat(document.getElementById("tonnageInput").value) || 0;
  r.billingCompany = document.getElementById("billingCompanyInput").value;
  r.billingAddress = document.getElementById("billingAddressInput").value;
  r.taxNumber = document.getElementById("taxNumberInput").value;
  r.contactName = document.getElementById("contactNameInput").value;
  r.contactEmail = document.getElementById("contactEmailInput").value;
  r.flightNumber = document.getElementById("flightNumberInput").value;
  r.rate = document.getElementById("rateInput").value;
  r.otherPrices = document.getElementById("otherPricesInput").value;
  r.apronSupport = document.getElementById("apronSupportInput").checked ? "Ja" : "Nein";

  const postURL = "https://script.google.com/macros/s/AKfycbw4kB0t6-K2oLpC8oOMhMsLvFa-bziRGmt589yC9rMjSO15vpgHzDZwgOQpHkxfykOw/exec";

  fetch(postURL, {
    method: "POST",
    body: new URLSearchParams({
      mode: "updateCustomerData",
      ref,
      airline: r.airline,
      date: r.date,
      tonnage: r.tonnage,
      billingCompany: r.billingCompany,
      billingAddress: r.billingAddress,
      taxNumber: r.taxNumber,
      contactName: r.contactName,
      contactEmail: r.contactEmail
    })
  });

  fetch(postURL, {
    method: "POST",
    body: new URLSearchParams({
      mode: "updateExtras",
      ref,
      flightnumber: r.flightNumber,
      rate: r.rate,
      extraCharges: r.otherPrices,
      escort: r.apronSupport,
      flightTime: r.flightTime
    })
  });
// Speichere die Abflugzeit zusätzlich per Vercel API
fetch('/api/saveFlightTime', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ref: r.ref,
    flightTime: r.flightTime
  })
})
.then(response => response.json())
.then(data => console.log("API gespeichert:", data))
.catch(error => console.error("Fehler bei API-Speicherung:", error));

  closeModal();
  refreshDashboard();
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

function renderCalendar() {
  const container = document.getElementById("calendarArea");
  container.innerHTML = "";
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const monthName = today.toLocaleString("default", { month: "long" });
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  let html = "<table><tr>";
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const match = requestData.find(r => r.date?.startsWith(dateStr));
    html += `<td style="padding:4px;border:1px solid #ccc;background:${match ? '#ffc107' : '#fff'}" title="${match ? match.ref : ''}">${i}</td>`;
    if (i % 7 === 0) html += "</tr><tr>";
  }
  html += "</tr></table>";
  container.innerHTML = `<h3>${monthName} ${currentYear}</h3>` + html;
}

document.addEventListener("DOMContentLoaded", refreshDashboard);
setInterval(refreshDashboard, 3000);
