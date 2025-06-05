document.addEventListener('DOMContentLoaded', function () {
  const url = 'https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest';

  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error("Fehler beim Abrufen der Daten");
      }
      return response.json();
    })
    .then(data => {
      // ✅ Google-Sheets-Daten umwandeln und in requestData speichern
      requestData = data.map(row => ({
        ref: row["Ref"] || "-",
        date: row["Datum"] || "-",
        airline: row["Airline"] || "-",
        billingCompany: row["Billing Company"] || "-",
        billingAddress: row["Billing Address"] || "-",
        taxNumber: row["Tax Number"] || "-",
        contactName: row["Contact Name"] || "-",
        contactEmail: row["Contact Email"] || "-",
        emailRequest: row["Email Request"] || "-",
        customerName: "", // Optional leer
        customerEmail: "",
        flightTime: "",
        manifestWeight: parseFloat(row["Tonnage"]) || 0,
        rate: 0,
        otherPrices: "",
        tonnage: parseFloat(row["Tonnage"]) || 0
      }));

      populateRows(); // 🔁 Dashboard neu befüllen
    })
    .catch(error => {
      console.error("Fehler beim Laden der Google Sheet Daten:", error);
    });
});
