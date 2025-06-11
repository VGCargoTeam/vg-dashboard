
let requestData = [];

function populateRows() {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";
  requestData.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><button onclick="openDetails('${r.ref}')">${r.ref}</button></td>
      <td>${r.flightNumber || "-"}</td>
      <td>${new Date(r.date).toLocaleDateString('de-DE')}</td>
      <td>${r.airline}</td>
      <td>${r.tonnage}</td>
      <td><button onclick="deleteRequest('${r.ref}')">Delete</button></td>`;
    table.appendChild(row);
  });
}

function openDetails(ref) {
  const r = requestData.find(x => x.ref === ref);
  if (!r) return;
  document.getElementById("modalRef").value = r.ref;
  document.getElementById("airlineInput").value = r.airline || "";
  document.getElementById("dateInput").value = r.date.split("T")[0];
  document.getElementById("tonnageInput").value = r.tonnage || "";
  document.getElementById("billingCompanyInput").value = r.billingCompany || "";
  document.getElementById("billingAddressInput").value = r.billingAddress || "";
  document.getElementById("taxNumberInput").value = r.taxNumber || "";
  document.getElementById("contactNameInput").value = r.contactName || "";
  document.getElementById("contactEmailInput").value = r.contactEmail || "";
  document.getElementById("viewEmailRequest").textContent = r.emailRequest || "-";
  document.getElementById("detailModal").style.display = "block";
}

function saveDetails() {
  const ref = document.getElementById("modalRef").value;
  const r = requestData.find(x => x.ref === ref);
  if (!r) return;

  r.airline = document.getElementById("airlineInput").value;
  r.date = document.getElementById("dateInput").value;
  r.tonnage = parseFloat(document.getElementById("tonnageInput").value) || 0;
  r.billingCompany = document.getElementById("billingCompanyInput").value;
  r.billingAddress = document.getElementById("billingAddressInput").value;
  r.taxNumber = document.getElementById("taxNumberInput").value;
  r.contactName = document.getElementById("contactNameInput").value;
  r.contactEmail = document.getElementById("contactEmailInput").value;

  fetch("https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec", {
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
  }).then(res => res.text()).then(alert);
  closeModal();
  populateRows();
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}
