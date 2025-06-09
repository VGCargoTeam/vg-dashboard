let requestData = [];

function populateRows() {
  let calendarBase = new Date();

function shiftCalendar(offset) {
  calendarBase.setMonth(calendarBase.getMonth() + offset);
  renderCalendars();
}
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

function filterTable() {
  const refVal = document.getElementById("refSearch").value.toLowerCase();
  const airlineVal = document.getElementById("airlineSearch").value.toLowerCase();
  const flightVal = document.getElementById("flightNumberSearch")?.value?.toLowerCase() || "";

  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);
  const showArchive = document.getElementById("showArchive").checked;

  const rows = document.querySelectorAll("#dataTable tr");
  let totalFlights = 0;
  let totalTonnage = 0;

  rows.forEach(row => {
    const cells = row.children;
    const ref = cells[0].textContent.toLowerCase();
    const flight = cells[1].textContent.toLowerCase();
    const date = new Date(cells[2].textContent.split('.').reverse().join('-'));
    const airline = cells[3].textContent.toLowerCase();
    const tonnage = parseFloat(cells[4].textContent.replace('.', '').replace(',', '.')) || 0;

    const matchesRef = !refVal || ref.includes(refVal);
    const matchesAirline = !airlineVal || airline.includes(airlineVal);
    const matchesFlight = !flightVal || flight.includes(flightVal);
    const matchesDate = (!startDate.getTime() || date >= startDate) && (!endDate.getTime() || date <= endDate);
    const isArchived = r => r.classList ? r.classList.contains('archived') : false;

    const showRow = matchesRef && matchesAirline && matchesFlight && matchesDate && (showArchive || !isArchived(row));
    row.style.display = showRow ? "" : "none";

    if (showRow) {
      totalFlights++;
      totalTonnage += tonnage;
    }
  });

  document.getElementById("summaryInfo").textContent = `Total Flights: ${totalFlights} | Total Tonnage: ${totalTonnage.toLocaleString('de-DE')} kg`;
}

function renderCalendars() {
  const container = document.getElementById("calendarArea");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < 2; i++) {
    const current = new Date(calendarBase.getFullYear(), calendarBase.getMonth() + i);
    container.innerHTML += generateCalendar(current.getFullYear(), current.getMonth());
  }
}

function generateCalendar(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay() || 7;
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

  let html = '<div class="calendar-table">';
  html += `<h4>${monthName} ${year}</h4><table><thead><tr><th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr></thead><tbody>`;
  let day = 1;
  let started = false;

  for (let i = 0; i < 6; i++) {
    html += "<tr>";
    for (let j = 1; j <= 7; j++) {
      const realDay = j;
      if (!started && realDay === firstDay) started = true;

      if (started && day <= daysInMonth) {
        const matches = requestData.filter(x =>
          x.date.getDate() === day &&
          x.date.getMonth() === month &&
          x.date.getFullYear() === year
        );

        const tooltip = matches.map(m =>
          `✈ ${m.ref} – ${m.airline}
Flugnummer: ${m.flightNumber || "-"}
Abflugzeit: ${m.flightTime || "-"}
Tonnage: ${m.tonnage?.toLocaleString('de-DE')} kg`
        ).join('\\n');

        const marked = matches.length ? "marked" : "";
        const onclick = matches.length ? `onclick="openDetails('${matches[0].ref}')"` : "";
        html += `<td class="${marked}" title="${tooltip}" style="cursor:pointer;" ${onclick}>${day}</td>`;
        day++;
      } else {
        html += "<td></td>";
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break;
  }
  html += "</tbody></table></div>";
  return html;
}

function deleteRequest(ref) {
  if (confirm("Möchten Sie diese Anfrage wirklich löschen?")) {
    fetch("https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?mode=delete&ref=" + ref)
      .then(response => response.text())
      .then(result => {
        console.log("Löschergebnis:", result);
        requestData = requestData.filter(x => x.ref !== ref);
        populateRows();
        alert("Anfrage wurde erfolgreich gelöscht!");
      })
      .catch(error => {
        console.error("Fehler beim Löschen:", error);
        alert("Fehler beim Löschen!");
      });
  }
}

function openDetails(ref) {
  const r = requestData.find(r => r.ref === ref);
  if (!r) return;

  document.getElementById("modalRef").value = r.ref;
  document.getElementById("viewRef").textContent = r.ref;
  document.getElementById("airlineInput").value = r.airline || "";
  document.getElementById("flightNumberInput").value = r.flightNumber || "";
  
  const dateInput = document.getElementById("dateInput");
  if (r.date) {
    const year = r.date.getFullYear();
    const month = String(r.date.getMonth() + 1).padStart(2, '0');
    const day = String(r.date.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
  } else {
    dateInput.value = "";
  }
  
  document.getElementById("tonnageInput").value = r.tonnage || 0;
  document.getElementById("billingCompanyInput").value = r.billingCompany || "";
  document.getElementById("billingAddressInput").value = r.billingAddress || "";
  document.getElementById("taxNumberInput").value = r.taxNumber || "";
  document.getElementById("contactNameInput").value = r.contactName || "";
  document.getElementById("contactEmailInput").value = r.contactEmail || "";
  document.getElementById("flightNumberInput").value = r.flightNumber || "";
  document.getElementById("viewEmailRequest").textContent = r.emailRequest || "-";
  document.getElementById("customerName").value = r.customerName || "";
  document.getElementById("flightTime").value = r.flightTime || "";
  document.getElementById("manifestWeight").value = r.manifestWeight || "";
  document.getElementById("rate").value = r.rate || "";
  document.getElementById("otherPrices").value = r.otherPrices || "";
  document.getElementById("apronSupport").checked = r.apronSupport || false;
  document.getElementById("detailModal").style.display = "block";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

function saveDetails() {
  const ref = document.getElementById("modalRef").value;
  const r = requestData.find(r => r.ref === ref);
  if (!r) return;

  const finalWeight = parseFloat(document.getElementById("manifestWeight").value) || 0;
  const extraCharges = document.getElementById("otherPrices").value;
  const rate = parseFloat(document.getElementById("rate").value) || 0;
  const departureTime = document.getElementById("flightTime").value;
  const escort = document.getElementById("apronSupport").checked;
  const comment = document.getElementById("customerName").value;
  const flightNumber = document.getElementById("flightNumberInput").value;
  const airline = document.getElementById("airlineInput").value;
  const flightDate = document.getElementById("dateInput").value;
  const tonnage = parseFloat(document.getElementById("tonnageInput").value) || 0;
  const billingCompany = document.getElementById("billingCompanyInput").value;
  const billingAddress = document.getElementById("billingAddressInput").value;
  const taxNumber = document.getElementById("taxNumberInput").value;
  const contactName = document.getElementById("contactNameInput").value;
  const contactEmail = document.getElementById("contactEmailInput").value;

  // Lokale Anzeige aktualisieren (optional)
  if (flightDate) {
    r.date = new Date(flightDate);
  }
  r.airline = airline;
  r.tonnage = tonnage;
  r.billingCompany = billingCompany;
  r.billingAddress = billingAddress;
  r.taxNumber = taxNumber;
  r.contactName = contactName;
  r.contactEmail = contactEmail;
  r.manifestWeight = finalWeight;
  r.otherPrices = extraCharges;
  r.rate = rate;
  r.flightTime = departureTime;
  r.apronSupport = escort;
  r.customerName = comment;
  r.flightNumber = flightNumber;

  // ❌ NICHT mehr: r.tonnage = r.manifestWeight;

  // In Google Sheet speichern
  saveExtrasToGoogleSheet(ref, finalWeight, extraCharges, rate, departureTime, escort, comment, flightNumber, 
    airline, flightDate, tonnage, billingCompany, billingAddress, taxNumber, contactName, contactEmail);

  closeModal();
  populateRows();
}

function updateClock() {
  const now = new Date();
  const options = {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  const dateOptions = {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  document.getElementById("clock").textContent = "Time: " + now.toLocaleTimeString('de-DE', options);
  document.getElementById("currentDate").textContent = "Date: " + now.toLocaleDateString('de-DE', dateOptions);
}

function renderCalendars() {
  // (Implementierung der Kalender-Übersicht, unverändert aus dem Originalskript)
  // ...
}

document.addEventListener('DOMContentLoaded', function () {
  const url = 'https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest';
  fetch(url)
    .then(response => response.json())
    .then(data => {
      requestData = data.map(row => ({
        ref: row["Ref"],
        flightNumber: row["Flugnummer"],
        date: new Date(row["Flight Date"]),
        airline: row["Airline"],
        billingCompany: row["Billing Company"],
        billingAddress: row["Billing Address"],
        taxNumber: row["Tax Number"],
        contactName: row["Contact Name"],
        contactEmail: row["Contact Email"],
        emailRequest: row["Email Request"],
        tonnage: parseFloat(row["Tonnage"]) || 0,
        apronSupport: row["Vorfeldbegleitung"] === "TRUE" || row["Vorfeldbegleitung"] === "Ja",
        // ManifestWeight, Rate, etc. könnten hier bei Bedarf ebenfalls ausgelesen werden
      }));
      populateRows();
    })
    .catch(error => console.error("Fehler beim Laden:", error));

  setInterval(updateClock, 1000);
  updateClock();
});

function saveExtrasToGoogleSheet(ref, finalWeight, extraCharges, rate, 
  departureTime, escort, comment, flightNumber,
  airline, flightDate, tonnage, billingCompany,
  billingAddress, taxNumber, contactName, contactEmail) {
  const url = "https://script.google.com/macros/s/AKfycbw2c2PSZlsKNGnQXFjhtpmezSSB_67D1BD3gt1jgVveY791Bb8inDIg4y0yb1Zhq_rm/exec";

  const formData = new URLSearchParams();
  formData.append("mode", "updateExtras");
  formData.append("ref", ref);
  formData.append("finalWeight", finalWeight);
  formData.append("extraCharges", extraCharges);
  formData.append("rate", rate);
  formData.append("departureTime", departureTime);
  formData.append("escort", escort ? "Ja" : "Nein");
  formData.append("comment", comment);
  formData.append("flightnumber", flightNumber);
  formData.append("airline", airline);
  formData.append("flightDate", flightDate);
  formData.append("tonnage", tonnage);
  formData.append("billingCompany", billingCompany);
  formData.append("billingAddress", billingAddress);
  formData.append("taxNumber", taxNumber);
  formData.append("contactName", contactName);
  formData.append("contactEmail", contactEmail);

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

// ESC zum Schließen des Detailmodals per Tastatur
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeModal();
  }
});
