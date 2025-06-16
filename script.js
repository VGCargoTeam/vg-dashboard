
function fetchData() {
  fetch("https://api.airtable.com/v0/app1rwDZULXHzNBXx/CharterRequest", {
    headers: {
      Authorization: "Bearer YOUR_ACCESS_TOKEN"
    }
  })
    .then(res => res.json())
    .then(data => {
      requestData = data.records.map(record => record.fields);
      renderTable();
      renderCalendars();
    })
    .catch(err => {
      console.error("Airtable fetch error:", err);
    });
}

function renderTable() {
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  let totalFlights = 0;
  let totalWeight = 0;

  requestData.forEach((r, i) => {
    const row = document.createElement("tr");
    const ton = parseFloat(r.Tonnage || "0") || 0;
    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${i})">${r.Ref}</a></td>
      <td>${r['Flight Date'] || "-"}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toLocaleString()}</td>
      <td><button class="btn btn-view" onclick="openModal(${i})">View</button> <button class="btn btn-delete" onclick="deleteRow(this)">Delete</button></td>
    `;
    tbody.appendChild(row);
    totalFlights++;
    totalWeight += ton;
  });

  document.getElementById("summaryInfo").textContent =
    `Total Flights: ${totalFlights} | Total Tonnage: ${totalWeight.toLocaleString()} kg`;
}

function openModal(i) {
  const r = requestData[i];
  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "";

  const section = (title, contentHTML) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-section";
    wrap.innerHTML = `<h3>${title}</h3>` + contentHTML;
    return wrap;
  };

  const renderFields = (fields) => {
    return fields.map(({ label, key, type }) => {
      const value = r[key] || "";
      if (type === "checkbox") {
        const checked = value.toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked}/> ${label}</label>`;
      }
      return `<label>${label}:</label><input name="${key}" value="${value}" />`;
    }).join("");
  };

  const customerFields = [    { label: "Ref", key: "Ref" },    { label: "Billing Company", key: "Billing Company" },
    { label: "Billing Address", key: "Billing Address" },
    { label: "Tax Number", key: "Tax Number" },
    { label: "Contact Name Invoicing", key: "Contact Name Invoicing" },
    { label: "Contact E-Mail Invoicing", key: "Contact E-Mail Invoicing" }
  ];

const flightFields = [
  { label: "Airline", key: "Airline" },
  { label: "Aircraft Type", key: "Aircraft Type" },
  { label: "Flugnummer", key: "Flugnummer" },
  { label: "Flight Date", key: "Flight Date" },
  { label: "Abflugzeit", key: "Abflugzeit" },
  { label: "Tonnage", key: "Tonnage" },
  { label: "Vorfeldbegleitung", key: "Vorfeldbegleitung", type: "checkbox" }
];

  const priceFields = [
    { label: "Rate", key: "Rate" },
    { label: "Security charges (X-Ray, ETD, EDD)", key: "Security charges" },
    { label: "Dangerous Goods", key: "Dangerous Goods" },
    { label: "10ft consumables", key: "10ft consumables" },
    { label: "20ft consumables", key: "20ft consumables" }
  ];

  const priceExtra = `
    <label>Zusatzkosten:</label>
    <textarea name="Zusatzkosten" placeholder="Labeln, Fotos" style="height:80px">${r["Zusatzkosten"] || ""}</textarea>
    <label>E-Mail Request:</label>
    <textarea name="Email Request" style="height:150px">${r["Email Request"] || ""}</textarea>
  `;

  modalBody.appendChild(section("Kundendetails", renderFields(customerFields)));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields)));
  modalBody.appendChild(section("Preisdetails", renderFields(priceFields) + priceExtra));
  const saveButton = document.createElement("button");
  saveButton.textContent = "Speichern";
  saveButton.onclick = saveDetails;
  saveButton.style.margin = "10px auto 0";
  saveButton.style.padding = "10px 20px";
  saveButton.style.fontWeight = "bold";
  saveButton.style.backgroundColor = "#28a745";
  saveButton.style.color = "white";
  saveButton.style.border = "none";
  saveButton.style.borderRadius = "6px";
  saveButton.style.cursor = "pointer";
  modalBody.appendChild(saveButton);


  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") closeModal();
});

function saveDetails() {
  const inputs = document.querySelectorAll("#modalBody input[name]:not([disabled]), #modalBody textarea[name]:not([disabled])");
  const data = {};
  inputs.forEach(i => {
    data[i.name] = i.type === "checkbox" ? (i.checked ? "Ja" : "Nein") : i.value;
  });

  data.Ref = document.querySelector("input[name='Ref']").value;
  data.mode = "update";

  console.log("🚀 Daten, die gesendet werden:", data);

  fetch(POST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'  // Wichtig für JSON!
    },
    body: JSON.stringify(data)
  })
  .then(res => res.text())
  .then(text => {
    if (text === "OK" || text === "updated") {
      showSaveFeedback("Gespeichert!", true);
    } else {
      showSaveFeedback("Fehler: " + text, false);
    }
    closeModal();
    fetchData();
  })
  .catch(err => {
    showSaveFeedback("Fehler beim Speichern!", false);
    console.error(err);
  });
}

function deleteRow(btn) {
  const row = btn.closest("tr");
  const ref = row.querySelector("a").textContent;
  fetch(POST_URL, {
    method: 'POST',
    body: new URLSearchParams({ Ref: ref, mode: "delete" })
  }).then(() => fetchData());
  return;
  btn.closest("tr").remove();
}

function shiftCalendar(offset) {
  baseMonth += offset;
  if (baseMonth < 0) { baseMonth += 12; baseYear--; }
  if (baseMonth > 11) { baseMonth -= 12; baseYear++; }
  renderCalendars();
}

function renderCalendars() {
  const container = document.getElementById("calendarArea");
  container.innerHTML = "";
  for (let i = 0; i < 2; i++) {
    const m = baseMonth + i;
    const y = baseYear + Math.floor(m / 12);
    const month = (m % 12 + 12) % 12;
    container.innerHTML += generateCalendarHTML(y, month);
  }
}

function generateCalendarHTML(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
  let html = `<div class="calendar-block"><h3>${monthName} ${year}</h3><table><thead><tr><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th><th>Su</th></tr></thead><tbody>`;
  let day = 1;
  for (let i = 0; i < 6; i++) {
    html += "<tr>";
    for (let j = 1; j <= 7; j++) {
      const realDay = (j + 6) % 7;
      if ((i === 0 && realDay < firstDay) || day > daysInMonth) {
        html += "<td class='empty'></td>";
      } else {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const match = requestData.find(r => r['Flight Date'] === dateStr);
        const tooltip = match ? `${match['Flugnummer'] || ''} ${match['Abflugzeit'] || ''}` : "";
        const mark = match ? "marked" : "";
        html += `<td class='${mark}' title='${tooltip}'>${day}</td>`;
        day++;
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break;
  }
  html += "</tbody></table></div>";
  return html;
}

document.addEventListener("DOMContentLoaded", () => {
  updateClock();
  setInterval(updateClock, 1000);
  fetchData();
});

function updateClock() {
  const now = new Date();
  const local = new Date(now.getTime() + (2 * 60 * 60 * 1000));
  document.getElementById('currentDate').textContent = "Date: " + local.toISOString().substr(0, 10);
  document.getElementById('clock').textContent = "Time: " + local.toISOString().substr(11, 8);
}


function generateReference() {
  const now = new Date();
  const timestamp = now.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CC-${timestamp}-${random}`;
}

function createNewRequest() {
  const newRef = generateReference();
  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "";

  const now = new Date().toISOString();
  const blankRequest = {
    Ref: newRef,
    'Created At': now,    
    'Billing Company': "",
    'Billing Address': "",
    'Tax Number': "",
    'Contact Name Invoicing': "",
    'Contact E-Mail Invoicing': "",
    'Airline': "",
    'Aircraft Type': "",
    'Flugnummer': "",
    'Flight Date': "",
    'Abflugzeit': "",
    'Tonnage': "",
    'Vorfeldbegleitung': "Nein",
    'Rate': "",
    'Security charges': "",
    'Dangerous Goods': "",
    '10ft consumables': "",
    '20ft consumables': "",
    'Zusatzkosten': "",
    'Email Request': ""
  };

  // Nutze openModal() direkt mit dem leeren Objekt
  openCustomModal(blankRequest);
}

function openCustomModal(r) {
  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "";

  const section = (title, contentHTML) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-section";
    wrap.innerHTML = `<h3>${title}</h3>` + contentHTML;
    return wrap;
  };

  const renderFields = (fields) => {
    return fields.map(({ label, key, type }) => {
      const value = r[key] || "";

      if (key === "Flight Date") {
        return `<label>${label}</label><input type="date" name="${key}" value="${value}">`;
      } else if (key === "Abflugzeit") {
        return `<label>${label}</label><input type="time" name="${key}" value="${value}">`;
      } else if (type === "checkbox") {
        const checked = value.toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked}> ${label}</label>`;
      } else {
        return `<label>${label}</label><input name="${key}" value="${value}" />`;
      }
    }).join("");
  };

  const customerFields = [
    { label: "Ref", key: "Ref" },
    { label: "Created At", key: "Created At",},
    { label: "Billing Company", key: "Billing Company" },
    { label: "Billing Address", key: "Billing Address" },
    { label: "Tax Number", key: "Tax Number" },
    { label: "Contact Name Invoicing", key: "Contact Name Invoicing" },
    { label: "Contact E-Mail Invoicing", key: "Contact E-Mail Invoicing" }
  ];

const flightFields = [
  { label: "Airline", key: "Airline" },
  { label: "Aircraft Type", key: "Aircraft Type" },
  { label: "Flugnummer", key: "Flugnummer" },
  { label: "Flight Date", key: "Flight Date" },
  { label: "Abflugzeit", key: "Abflugzeit" },
  { label: "Tonnage", key: "Tonnage" },
  { label: "Vorfeldbegleitung", key: "Vorfeldbegleitung", type: "checkbox" }
];

  const priceFields = [
    { label: "Rate", key: "Rate" },
    { label: "Security charges (X-Ray, ETD, EDD)", key: "Security charges" },
    { label: "Dangerous Goods", key: "Dangerous Goods" },
    { label: "10ft consumables", key: "10ft consumables" },
    { label: "20ft consumables", key: "20ft consumables" }
  ];

  const priceExtra = `
    <label>Zusatzkosten:</label>
    <textarea name="Zusatzkosten" placeholder="Labeln, Fotos" style="height:80px">${r["Zusatzkosten"] || ""}</textarea>
    <label>E-Mail Request:</label>
    <textarea name="Email Request" style="height:150px">${r["Email Request"] || ""}</textarea>
  `;

  modalBody.appendChild(section("Kundendetails", renderFields(customerFields)));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields)));
  modalBody.appendChild(section("Preisdetails", renderFields(priceFields) + priceExtra));

  const saveButton = document.createElement("button");
  saveButton.textContent = "Speichern";
  saveButton.onclick = saveDetails;
  saveButton.style.margin = "10px auto 0";
  saveButton.style.padding = "10px 20px";
  saveButton.style.fontWeight = "bold";
  saveButton.style.backgroundColor = "#28a745";
  saveButton.style.color = "white";
  saveButton.style.border = "none";
  saveButton.style.borderRadius = "6px";
  saveButton.style.cursor = "pointer";
  modalBody.appendChild(saveButton);

  modal.style.display = "flex";
}

// === FEEDBACK ANZEIGEN ===
function showSaveFeedback(message, success) {
  const feedback = document.createElement("div");
  feedback.textContent = message;
  feedback.style.position = "fixed";
  feedback.style.top = "20px";
  feedback.style.right = "20px";
  feedback.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  feedback.style.color = "#fff";
  feedback.style.padding = "10px 16px";
  feedback.style.borderRadius = "8px";
  feedback.style.boxShadow = "0 8px 10px rgba(0,0,0,0.2)";
  feedback.style.zIndex = "9999";
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 3000);
}
