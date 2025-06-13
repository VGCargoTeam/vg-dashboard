const POST_URL = "https://script.google.com/macros/s/AKfycbzeMLGSAM9l5hkBD0RyYd7s-AScP5861yhxb6bT6NHLTvJcASontCh06tKcwn0WQEPu4w/exec";
let requestData = [];

// Öffnet das Modal mit Daten zur gewählten Referenz
function openModal(index) {
  const r = requestData[index];
  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "<form id='detailForm'></form>";
  const form = document.getElementById("detailForm");

  const section = (title, contentHTML) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-section";
    wrap.innerHTML = `<h3>${title}</h3>` + contentHTML;
    return wrap;
  };

  const renderFields = (fields) => {
    return fields.map(({ label, key, type }) => {
      const value = r[key] || "";
      if (key === "Datum" || key === "Flight Date") {
        return `<label>${label}</label><input type="date" name="${key}" value="${value}" />`;
      } else if (key === "Abflugzeit") {
        return `<label>${label}</label><input type="time" name="${key}" value="${value}" />`;
      } else if (type === "checkbox") {
        const checked = value.toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked}/> ${label}</label>`;
      }
      return `<label>${label}</label><input name="${key}" value="${value}" />`;
    }).join("");
  };

  const customerFields = [
    { label: "Ref", key: "Ref" },
    { label: "Datum", key: "Datum" },
    { label: "Billing Company", key: "Billing Company" },
    { label: "Billing Address", key: "Billing Address" },
    { label: "Tax Number", key: "Tax Number" },
    { label: "Contact Name (Invoicing)", key: "Contact Name Invoicing" },
    { label: "Contact E-Mail (Invoicing)", key: "Contact E-Mail Invoicing" }
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
  <textarea name="Email Request" style="height:150px">${r["Email Request"] || ""}</textarea>`;

  form.appendChild(section("Kundendetails", renderFields(customerFields)));
  form.appendChild(section("Flugdetails", renderFields(flightFields)));
  form.appendChild(section("Preisdetails", renderFields(priceFields) + priceExtra));

  const saveButton = document.createElement("button");
  saveButton.textContent = "Speichern";
  saveButton.onclick = saveDetails;
  saveButton.type = "button";
  saveButton.className = "save-button";
  form.appendChild(saveButton);

  modal.style.display = "flex";
}

// Modal schließen
function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// Speichern der Daten ins Google Sheet
function saveDetails() {
  const form = document.getElementById("detailForm");
  const formData = new FormData(form);
  const ref = formData.get("Ref");
  const existing = requestData.find(x => x.Ref === ref);
  const mode = existing ? "update" : "create";
  formData.append("mode", mode);

  fetch(POST_URL, {
    method: "POST",
    body: new URLSearchParams(formData)
  })
  .then(res => res.text())
  .then(msg => {
    showSaveFeedback(`Gespeichert: ${msg}`, true);
    closeModal();
    fetchData();
  })
  .catch(() => showSaveFeedback("Fehler beim Speichern!", false));
}

function showSaveFeedback(message, success) {
  const feedback = document.createElement("div");
  feedback.textContent = message;
  feedback.style.position = "fixed";
  feedback.style.right = "20px";
  feedback.style.top = "20px";
  feedback.style.padding = "10px 16px";
  feedback.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  feedback.style.color = "white";
  feedback.style.borderRadius = "6px";
  feedback.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
  feedback.style.zIndex = "9999";
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 3000);
}
