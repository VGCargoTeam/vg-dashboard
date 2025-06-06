let requestData = [];

function populateRows() {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";
  requestData.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><button class="ref-link" onclick="openDetails('${r.ref}')">${r.ref}</button></td>
      <td>${r.flightNumber || "-"}</td>
      <td>${r.date.toLocaleDateString('de-DE')}</td>
      <td>${r.airline}</td>
      <td>${r.tonnage.toLocaleString('de-DE')}</td>
      <td><button class="delete-btn" onclick="deleteRequest('${r.ref}')">Delete</button></td>`;
    table.appendChild(row);
  });
  filterTable();
  renderCalendars();
}

document.addEventListener('DOMContentLoaded', function () {
  fetch("https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest")
    .then(response => response.json())
    .then(data => {
      requestData = data.map(row => ({
        ref: row["Ref"],
        flightNumber: row["Flugnummer"] || "", // ✅ Fix: Flugnummer einlesen
        date: new Date(row["Flight Date"]),
        airline: row["Airline"],
        billingCompany: row["Billing Company"],
        billingAddress: row["Billing Address"],
        taxNumber: row["Tax Number"],
        contactName: row["Contact Name"],
        contactEmail: row["Contact Email"],
        emailRequest: row["Email Request"],
        tonnage: parseFloat(row["Tonnage"]) || 0,
        manifestWeight: parseFloat(row["Final Manifest Weight"]) || 0,
        rate: parseFloat(row["Rate"]) || 0,
        otherPrices: row["Zusatzkosten"] || "",
        flightTime: row["Abflugzeit"] || "",
        apronSupport: row["Vorfeldbegleitung"] === "TRUE" || row["Vorfeldbegleitung"] === "Ja",
        operative: row["Operative"] || "",
        customerEmail: row["Customer Email"] || ""
      }));
      populateRows();
    });
  setInterval(updateClock, 1000);
  updateClock();
});

function saveDetails() {
  const ref = document.getElementById("modalRef").value;
  const r = requestData.find(r => r.ref === ref);
  if (!r) return;

  const finalWeight = parseFloat(document.getElementById("manifestWeight").value) || 0;
  const extraCharges = document.getElementById("otherPrices").value;
  const rate = parseFloat(document.getElementById("rate").value) || 0;
  const departureTime = document.getElementById("flightTime").value;
  const escort = document.getElementById("apronSupport").checked;
  const operative = document.getElementById("customerName").value;
  const flightNumber = document.getElementById("flightNumberInput").value;

  // Lokale Anzeige aktualisieren
  r.manifestWeight = finalWeight;
  r.otherPrices = extraCharges;
  r.rate = rate;
  r.flightTime = departureTime;
  r.apronSupport = escort;
  r.operative = operative;
  r.flightNumber = flightNumber;

  saveExtrasToGoogleSheet(ref, finalWeight, extraCharges, rate, departureTime, escort, operative, flightNumber);
  closeModal();
  populateRows();
}

function saveExtrasToGoogleSheet(ref, finalWeight, otherPrices, rate, departureTime, escort, operative, flightNumber) {
  const url = "https://script.google.com/macros/s/AKfycbw4kB0t6-K2oLpC8oOMhMsLvFa-bziRGmt589yC9rMjSO15vpgHzDZwgOQpHkxfykOw/exec";

  const formData = new URLSearchParams();
  formData.append("mode", "updateExtras");
  formData.append("ref", ref);
  formData.append("finalWeight", finalWeight);
  formData.append("extraCharges", otherPrices);
  formData.append("rate", rate);
  formData.append("departureTime", departureTime);
  formData.append("escort", escort ? "Ja" : "Nein");
  formData.append("operative", operative);
  formData.append("flightnumber", flightNumber); // ✅ Fix: richtig benannt und angehängt

  fetch(url, {
    method: "POST",
    body: formData
  })
    .then(response => response.text())
    .then(result => {
      console.log("Gespeichert:", result);
      alert("Änderungen gespeichert!");
    })
    .catch(error => {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern!");
    });
}
