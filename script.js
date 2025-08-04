// Charter Dashboard Script – 3-spaltige strukturierte Detailansicht
const API_URL = 'https://script.google.com/macros/s/AKfycbzo-FgxA6TMJYK4xwLbrsRnNTAU_AN-FEJJoZH6w7aJ3BlcsaB751LjdUJ9nieGtu1P/exec'; // <<< AKTUALISIERT: NEUER LINK VOM BENUTZER

let currentUser = null; // Stores the currently logged-in user
let requestData = []; // Stores all retrieved charter data
let baseMonth = new Date().getMonth(); // Current month (0-indexed)
let baseYear = new Date().getFullYear(); // Current year

const today = new Date();
today.setHours(0, 0, 0, 0); // Sets the time to midnight for comparison

// Global variables for chart instances, to destroy them if necessary
let tonnagePerMonthChartInstance = null;
let tonnagePerCustomerChartInstance = null;

// Variable to store the data currently displayed in the modal
let currentModalData = null;


// === AUTHENTICATION AND USER MANAGEMENT ===
function checkAuthStatus() {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    updateUIBasedOnUserRole();
    fetchData(); // Load data if logged in
  } else {
    // If not logged in, redirect to the login page
    window.location.href = 'login.html';
  }
}

function updateUIBasedOnUserRole() {
  const adminElements = document.querySelectorAll(".admin-only");
  const loggedInUsernameSpan = document.getElementById('loggedInUsername');
  const loggedInUserRoleSpan = document.getElementById('loggedInUserRole');
  const loggedInUsernameProfileSpan = document.getElementById('loggedInUsernameProfile');
  const loggedInUserRoleProfileSpan = document.getElementById('loggedInUserRoleProfile');

  if (currentUser) {
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = currentUser.name;
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = currentUser.role;
    if (loggedInUsernameProfileSpan) loggedInUsernameProfileSpan.textContent = currentUser.name;
    if (loggedInUserRoleProfileSpan) loggedInUserRoleProfileSpan.textContent = currentUser.role;

    if (currentUser.role === 'admin') {
      adminElements.forEach(el => el.style.display = ""); // Default display
    } else {
      adminElements.forEach(el => el.style.display = "none"); // Hide
    }
  } else {
    // If no user is logged in (should be caught by checkAuthStatus)
    adminElements.forEach(el => el.style.display = "none");
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = 'N/A';
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = 'N/A';
    if (loggedInUsernameProfileSpan) loggedInUsernameProfileSpan.textContent = 'N/A';
    if (loggedInUserRoleProfileSpan) loggedInUserRoleProfileSpan.textContent = 'N/A';
  }
}

function openProfileModal() {
  const profileModal = document.getElementById('profileModal');
  if (profileModal) { // Ensure the modal exists
    profileModal.style.display = 'flex'; // Show modal
    // Set initial values
    const newPassInput = document.getElementById('newPasswordInput');
    const confirmPassInput = document.getElementById('confirmPasswordInput');
    const passwordChangeMessage = document.getElementById('passwordChangeMessage');
    if (newPassInput) newPassInput.value = '';
    if (confirmPassInput) confirmPassInput.value = '';
    if (passwordChangeMessage) passwordChangeMessage.textContent = '';
  } else {
    console.warn("Profile modal (id='profileModal') not found.");
  }
}

function closeProfileModal() {
  const profileModal = document.getElementById('profileModal');
  if (profileModal) {
    profileModal.style.display = 'none'; // Close modal
  }
}

async function changePassword() {
  const oldPass = prompt("Please enter your current password to confirm the change:"); // For security, ask for current password
  if (oldPass === null) { // User cancelled
      return;
  }

  const newPass = document.getElementById('newPasswordInput').value;
  const confirmPass = document.getElementById('confirmPasswordInput').value;
  const messageElem = document.getElementById('passwordChangeMessage');

  if (!messageElem) {
    console.error("Password change message element not found.");
    return;
  }

  if (newPass === '' || confirmPass === '') {
    messageElem.textContent = 'Bitte beide Passwortfelder ausfüllen.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass !== confirmPass) {
    messageElem.textContent = 'Neue Passwörter stimmen nicht überein.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass.length < 6) { // Example: Minimum length
      messageElem.textContent = 'Passwort muss mindestens 6 Zeichen lang sein.';
      messageElem.style.color = 'red';
      return;
  }
  if (currentUser.username === undefined) {
      messageElem.textContent = 'Benutzername für Passwortänderung nicht verfügbar.';
      messageElem.style.color = 'red';
      return;
  }

  const payload = {
      mode: 'updatePassword',
      username: currentUser.username, // The user whose password is to be changed
      oldPassword: oldPass, // Current password for verification
      newPassword: newPass, // New password
      user: currentUser.name // For audit log
  };

  try {
      const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(payload).toString(),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
          messageElem.textContent = 'Passwort erfolgreich geändert! Bitte melden Sie sich neu an.';
          messageElem.style.color = 'green';
          // Clear the fields after successful change
          const newPassInput = document.getElementById('newPasswordInput');
          const confirmPassInput = document.getElementById('confirmPassInput');
          if (newPassInput) newPassInput.value = '';
          if (confirmPassInput) confirmPassInput.value = '';

          // Optional: Automatic logout after successful password change
          setTimeout(() => {
              logoutUser();
          }, 2000);

      } else {
          messageElem.textContent = result.message || 'Fehler beim Ändern des Passworts.';
          messageElem.style.color = 'red';
      }
  } catch (error) {
      console.error('Password change error:', error);
      messageElem.textContent = 'Ein Fehler ist beim Ändern des Passworts aufgetreten. Bitte versuchen Sie es später erneut.';
      messageElem.style.color = 'red';
  }
}

function logoutUser() {
  localStorage.removeItem('currentUser'); // End session
  currentUser = null;
  window.location.href = 'login.html'; // Redirect to login page
}

// === DATA RETRIEVAL AND TABLE RENDERING ===
function fetchData() {
  fetch(API_URL + "?mode=read")
    .then(r => {
      if (!r.ok) {
        throw new Error(`HTTP error! Status: ${r.status}`);
      }
      return r.json();
    })
    .then(d => {
      requestData = d.data; // Stores the data array
      console.log("Raw data from API:", JSON.parse(JSON.stringify(d.data))); // For debugging
      filterTable(); // Calls filterTable to update both table and calendar
    })
    .catch((error) => {
      console.error("Error loading data:", error);
      showSaveFeedback("Error loading data!", false);
    });
}

function renderTables(unconfirmedData, confirmedData) { // Allows rendering of filtered data
  const unconfirmedTbody = document.querySelector("#unconfirmedDataTable tbody");
  const confirmedTbody = document.querySelector("#confirmedDataTable tbody");
  unconfirmedTbody.innerHTML = "";
  confirmedTbody.innerHTML = "";

  let totalUnconfirmedFlights = 0;
  let totalUnconfirmedWeight = 0;
  let totalConfirmedFlights = 0;
  let totalConfirmedWeight = 0;

  // Helper function to render rows for a given tbody
  const appendRowsToTable = (tbody, data, isConfirmedTable) => {
    data.forEach((r) => {
      const row = document.createElement("tr");
      const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
      const originalIndex = requestData.findIndex(item => item.Ref === r.Ref);
      let displayFlightDate = r['Flight Date'] || "-";
      if (displayFlightDate !== "-") {
          try {
              let dateObj;
              if (typeof displayFlightDate === 'string' && displayFlightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  const parts = displayFlightDate.split('-');
                  dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              } else if (displayFlightDate instanceof Date) {
                  dateObj = new Date(displayFlightDate.getFullYear(), displayDate.getMonth(), displayDate.getDate());
              } else {
                  dateObj = new Date('Invalid Date');
              }
              dateObj.setHours(0, 0, 0, 0);
              if (!isNaN(dateObj.getTime())) {
                  displayFlightDate = dateObj.toLocaleDateString('de-DE');
              }
          } catch (e) {
               console.error("Error converting date for table display:", displayFlightDate, e);
          }
      }
      const deleteButtonHTML = (currentUser && currentUser.role === 'admin') ? `<button class="btn btn-delete admin-only" data-ref="${r.Ref}">Delete</button>` : '';
      const confirmationIcon = isConfirmedTable ? '<span class="text-green-500 ml-1">&#10004;</span>' : '';

      row.innerHTML = `
        <td><a href="javascript:void(0);" class="open-modal-link" data-index="${originalIndex}">${r.Ref}</a>${confirmationIcon}</td>
        <td>${displayFlightDate}</td>
        <td>${r.Airline || "-"}</td>
        <td>${ton.toLocaleString('de-DE')}</td>
        <td>
          <button class="btn btn-view open-modal-btn" data-index="${originalIndex}">View</button>
          ${deleteButtonHTML}
        </td>
      `;
      tbody.appendChild(row);

      // Attach event listeners dynamically
      const refLink = row.querySelector(`.open-modal-link[data-index="${originalIndex}"]`);
      if (refLink) {
          refLink.addEventListener('click', (event) => {
              event.preventDefault(); // Prevents default link behavior
              openModal(parseInt(event.target.dataset.index));
          });
      }
      const viewButton = row.querySelector(`.btn-view.open-modal-btn[data-index="${originalIndex}"]`);
      if (viewButton) {
          viewButton.addEventListener('click', (event) => {
              openModal(parseInt(event.target.dataset.index));
          });
      }
      const deleteButton = row.querySelector(`.btn-delete.admin-only[data-ref="${r.Ref}"]`);
      if (deleteButton) {
          deleteButton.addEventListener('click', (event) => {
              deleteRow(event.target);
          });
      }

      if (isConfirmedTable) {
        totalConfirmedFlights++;
        totalConfirmedWeight += ton;
      } else {
        totalUnconfirmedFlights++;
        totalUnconfirmedWeight += ton;
      }
    });
  };

  // Render Unconfirmed Table
  appendRowsToTable(unconfirmedTbody, unconfirmedData, false);
  document.getElementById("unconfirmedSummaryInfo").textContent =
    `Total Flights: ${totalUnconfirmedFlights} | Total Tonnage: ${totalUnconfirmedWeight.toLocaleString('de-DE')} kg`;

  // Render Confirmed Table
  appendRowsToTable(confirmedTbody, confirmedData, true);
  document.getElementById("confirmedSummaryInfo").textContent =
    `Total Flights: ${totalConfirmedFlights} | Total Tonnage: ${totalConfirmedWeight.toLocaleString('de-DE')} kg`;

  updateUIBasedOnUserRole();
}


function filterTable() {
  const refSearch = document.getElementById("refSearch").value.toLowerCase();
  const airlineSearch = document.getElementById("airlineSearch").value.toLowerCase();
  const flightNumberSearchInput = document.getElementById("flightNumberSearch");
  const flightNumberSearch = flightNumberSearchInput ? flightNumberSearchInput.value.toLowerCase() : '';
  const fromDateInput = document.getElementById("fromDate").value;
  const toDateInput = document.getElementById("toDate").value;
  const showArchive = document.getElementById("archiveCheckbox") ? document.getElementById("archiveCheckbox").checked : false; // Archive checkbox, if present

  const filtered = requestData.filter(r => {
    const matchesRef = (r.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (r.Airline || '').toLowerCase().includes(airlineSearch);
    const matchesFlightNumber = (r.Flugnummer || '').toLowerCase().includes(flightNumberSearch);

    let matchesDateRange = true;
    let isPastOrTodayAndGoneFlight = false;

    let flightDateFromData = r['Flight Date'];
    let flightDateObj;

    // Robust date parsing to avoid timezone issues
    if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) { // Expects YYYY-MM-DD from backend
        const parts = flightDateFromData.split('-');
        flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (flightDateFromData instanceof Date) { // If it's already a Date object
        flightDateObj = new Date(flightDateFromData.getFullYear(), flightDateFromData.getMonth(), flightDateFromData.getDate());
    } else {
        flightDateObj = new Date('Invalid Date'); // Invalid date
    }
    flightDateObj.setHours(0, 0, 0, 0); // Ensure time is set to midnight
    console.log(`[filterTable] Original: "${flightDateFromData}", Parsed (Local): ${flightDateObj}`);


    if (flightDateObj && !isNaN(flightDateObj.getTime())) {
      if (flightDateObj < today) {
          isPastOrTodayAndGoneFlight = true;
      } else if (flightDateObj.getTime() === today.getTime()) {
          const abflugzeit = r['Abflugzeit'];
          if (abflugzeit) {
              // Departure time must also be parsed as a local time for comparison
              let flightTimeAsDate = new Date();
              if (typeof abflugzeit === 'string' && abflugzeit.match(/^\d{2}:\d{2}$/)) { // Expects HH:MM from backend
                  const [hours, minutes] = abflugzeit.split(':').map(Number);
                  flightTimeAsDate.setHours(hours, minutes, 0, 0);
              } else if (abflugzeit instanceof Date) {
                  flightTimeAsDate = abflugzeit; // If already a Date object
              } else {
                 flightTimeAsDate = new Date('Invalid Date');
              }

              const now = new Date();
              now.setSeconds(0, 0);
              now.setMilliseconds(0);

              if (!isNaN(flightTimeAsDate.getTime()) && flightTimeAsDate <= now) {
                  isPastOrTodayAndGoneFlight = true;
              }
          }
      }

      // Filter by date range
      if (fromDateInput) {
          const fromDateParts = fromDateInput.split('-');
          const fromDateObj = new Date(parseInt(fromDateParts[0]), parseInt(fromDateParts[1]) - 1, parseInt(fromDateParts[2]));
          fromDateObj.setHours(0,0,0,0); // Also set filter date to midnight
          if (flightDateObj < fromDateObj) matchesDateRange = false;
      }
      if (toDateInput) {
          const toDateParts = toDateInput.split('-');
          const toDateObj = new Date(parseInt(toDateParts[0]), parseInt(toDateParts[1]) - 1, parseInt(toDateParts[2]));
          toDateObj.setHours(0,0,0,0); // Also set filter date to midnight
          if (flightDateObj > toDateObj) matchesDateRange = false;
      }
    } else {
        isPastOrTodayAndGoneFlight = false;
    }

    const passesPastFlightFilter = showArchive || !isPastOrTodayAndGoneFlight;

    return matchesRef && matchesAirline && matchesFlightNumber && matchesDateRange && passesPastFlightFilter;
  });

  const unconfirmedFiltered = filtered.filter(r => String(r['Final Confirmation Sent'] || '').toLowerCase() !== 'ja');
  const confirmedFiltered = filtered.filter(r => String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja');

  renderTables(unconfirmedFiltered, confirmedFiltered);
  renderCalendars();
}

// === MODAL FUNCTIONS ===
function openModal(originalIndex) {
  console.log("openModal called. currentUser:", currentUser); // Debug: Check currentUser
  if (!currentUser) {
      console.error("Attempt to open modal without logged-in user. Redirecting to login.");
      // Using a custom alert/message box instead of window.alert
      showSaveFeedback("Please log in to use this feature.", false);
      setTimeout(() => { window.location.href = 'login.html'; }, 1500); // Redirect after message
      return;
  }

  const r = originalIndex === -1 ? {
    Ref: generateReference(),
    'Created At': new Date().toLocaleString('de-DE'),
    'Billing Company': "", 'Billing Address': "", 'Tax Number': "",
    'Contact Name Invoicing': "", 'Contact E-Mail Invoicing': "",
    'Airline': "", 'Aircraft Type': "", 'Flugnummer': "",
    'Call Sign': "", // NEW: Call Sign added
    'Flight Date': "", 'Abflugzeit': "", 'Tonnage': "",
    'Rate': "", 'Security charges': "", "Dangerous Goods": "Nein", // Default value "No"
    '10ft consumables': "", '20ft consumables': "",
    'Zusatzkosten': "", 'Email Request': "",
    'AGB Accepted': "Ja", // Default value "Yes" for new requests
    'Service Description Accepted': "Ja", // Default value "Yes" for new requests
    'Accepted By Name': "",
    'Acceptance Timestamp': "",
    'Final Confirmation Sent': "Nein", // NEW: Default value for new requests
    'Flight Type Import': "Nein", // NEW: Default value
    'Flight Type Export': "Nein",  // NEW: Default value
    'Origin': '', // NEW: Origin for Import
    'Destination': '' // NEW: Destination for Export
  } : requestData[originalIndex];

  // Store the current data in the modal to use it later for the email
  currentModalData = r;

  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "";

  // Set the Call Sign input in the FlightRadar24 search section
  const callSignSearchInput = document.getElementById('callSignSearchInput');
  if (callSignSearchInput) {
      callSignSearchInput.value = r['Call Sign'] || '';
  }

  // Modified section function to accept a color class
  const section = (title, contentHTML, colorClass = '') => {
    const wrap = document.createElement("div");
    wrap.className = `modal-section ${colorClass}`; // Add color class here
    wrap.innerHTML = `<h3>${title}</h3>` + contentHTML;
    return wrap;
  };

  const renderFields = (fields) => {
    return fields.map(({ label, key, type }) => {
      let value = r[key];
      if (value === undefined || value === null) value = "";

      const isAlwaysReadOnlyField = [
          "Ref", "Created At", "Acceptance Timestamp", "Email Request", "Accepted By Name", "Final Confirmation Sent"
      ].includes(key);

      let readOnlyAttr = '';
      let styleAttr = '';

      if (isAlwaysReadOnlyField) {
          readOnlyAttr = 'readonly';
          styleAttr = 'background-color:#eee; cursor: not-allowed;';
      }

      // Special handling for Price-related fields and 'Zusatzkosten'
      // These fields should be completely invisible to viewers.
      const isPriceRelatedOrZusatzkostenField = [
        'Rate', 'Security charges', 'Dangerous Goods',
        '10ft consumables', '20ft consumables', 'Zusatzkosten'
      ].includes(key);

      // If the user is a Viewer and it's a price-specific field, skip.
      if (isPriceRelatedOrZusatzkostenField && currentUser.role === 'viewer') {
          return ''; // Empty string to completely skip the field
      }
      // For Admins, these fields are editable unless they are in isAlwaysReadOnlyField.


      if (key === "Flight Date") {
        let dateValue = "";
        if (value) {
            try {
                // Parse the date to display it correctly in the input (YYYY-MM-DD format)
                if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) { // Expects YYYY-MM-DD from backend
                    dateValue = value;
                } else if (value instanceof Date) {
                    dateValue = value.toISOString().split('T')[0]; // Convert Date object to YYYY-MM-DD
                }
            } catch (e) {
                console.error("Error parsing flight date for modal input:", value, e);
            }
        }
        return `<label>${label}</label><input type="date" name="${key}" value="${dateValue}" ${readOnlyAttr} style="${styleAttr}">`;
      } else if (key === "Abflugzeit") {
        let timeValue = "";
        if (value) {
            if (typeof value === 'string' && value.match(/^\d{2}:\d{2}$/)) { // Expects HH:MM from backend
                timeValue = value;
            } else if (value instanceof Date) {
                timeValue = value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            }
        }
        return `<label>${label}:</label><input type="time" name="${key}" value="${timeValue}" ${readOnlyAttr} style="${styleAttr}">`;
      } else if (key === "AGB Accepted" || key === "Service Description Accepted") {
          // Always show a green checkmark, as the customer MUST accept the T&Cs to send a request.
          const icon = '&#10004;'; // Green checkmark
          const color = 'green';
          return `<label>${label}: <span style="color: ${color}; font-size: 1.2em; font-weight: bold;">${icon}</span></label>`;
      } else if (key === "Vorfeldbegleitung" && type === "checkbox") {
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}"> ${label}</label>`;
      } else if (['Tonnage'].includes(key)) { // Tonnage can be seen and edited by Viewer
          const numericValue = parseFloat(String(value).replace(',', '.') || "0") || 0;
          return `<label>${label}:</label><input type="text" name="${key}" value="${numericValue.toLocaleString('de-DE', {useGrouping: false})}" ${readOnlyAttr} style="${styleAttr}" />`;
      } else if (key === "Email Request") { // Email Request is a normal text field
          return `<label>${label}:</label><textarea name="${key}" rows="5" ${readOnlyAttr} style="${styleAttr}">${value}</textarea>`;
      } else if (key === "Flight Type Import") { // NEW: Checkbox for Import
          const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
          const originInput = (String(r['Flight Type Import']).toLowerCase() === 'ja') ? `<label>Origin:</label><input type="text" name="Origin" value="${r.Origin || ''}" ${readOnlyAttr} style="${styleAttr}" />` : '';
          return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}" onchange="toggleOriginDestinationFields(this, 'Origin')"> ${label}</label>${originInput}`;
      } else if (key === "Flight Type Export") { // NEW: Checkbox for Export
          const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
          const destinationInput = (String(r['Flight Type Export']).toLowerCase() === 'ja') ? `<label>Destination:</label><input type="text" name="Destination" value="${r.Destination || ''}" ${readOnlyAttr} style="${styleAttr}" />` : '';
          return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}" onchange="toggleOriginDestinationFields(this, 'Destination')"> ${label}</label>${destinationInput}`;
      } else if (key === "Final Confirmation Sent") { // Display for "Final Confirmation Sent"
          const statusText = String(value).toLowerCase() === 'ja' ? 'Ja (Gesendet)' : 'Nein (Nicht gesendet)';
          const statusColor = String(value).toLowerCase() === 'ja' ? 'green' : 'red';
          return `<label>${label}: <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></label>`;
      }
      return `<label>${label}:</label><input type="text" name="${key}" value="${value}" ${readOnlyAttr} style="${styleAttr}" />`;
    }).join("");
  };

  const customerFields = [
    { label: "Ref", key: "Ref" },
    { label: "Created At", key: "Created At" },
    { label: "Billing Company", key: "Billing Company" },
    { label: "Billing Address", key: "Billing Address" },
    { label: "Tax Number", key: "Tax Number" },
    { label: "Contact Name Invoicing", key: "Contact Name Invoicing" },
    { label: "Contact E-Mail Invoicing", key: "Contact E-Mail Invoicing" },
    { label: "AGB Accepted", key: "AGB Accepted" },
    { label: "Service Description Accepted", key: "Service Description Accepted" },
    { label: "Accepted By Name", key: "Accepted By Name" },
    { label: "Acceptance Timestamp", key: "Acceptance Timestamp" },
    { label: "Final Confirmation Sent", key: "Final Confirmation Sent" } // NEW: Field added
  ];

  const flightFields = [
    { label: "Airline", key: "Airline" },
    { label: "Aircraft Type", key: "Aircraft Type" },
    { label: "Flugnummer", key: "Flugnummer" },
    { label: "Call Sign", key: "Call Sign" }, // NEW: Call Sign added
    { label: "Flight Date", key: "Flight Date" },
    { label: "Abflugzeit", key: "Abflugzeit" },
    { label: "Tonnage", key: "Tonnage" },
    { label: "Vorfeldbegleitung", key: "Vorfeldbegleitung", type: "checkbox" },
    { label: "Flight Type Import", key: "Flight Type Import", type: "checkbox" }, // NEW
    { label: "Flight Type Export", key: "Flight Type Export", type: "checkbox" }, // NEW
    { label: "E-Mail Request", key: "Email Request" }
  ];

  // Price-related fields, visible only to Admins
  const priceFields = [
    { label: "Rate", key: "Rate" },
    { label: "Security charges (X-Ray, ETD, EDD)", key: "Security charges" },
    { label: "Dangerous Goods", key: "Dangerous Goods" },
    { label: "10ft consumables", key: "10ft consumables" },
    { label: "20ft consumables", key: "20ft consumables" },
    { label: "Zusatzkosten", key: "Zusatzkosten", type: "textarea" } // Additional costs as textarea
  ];

  // Adding sections with specific background colors
  modalBody.appendChild(section("Customer Details", renderFields(customerFields), 'bg-blue-50'));
  modalBody.appendChild(section("Flight Details", renderFields(flightFields), 'bg-green-50'));

  // Show price details only for Admins
  if (currentUser && currentUser.role === 'admin') {
    // Create HTML for price details
    let priceDetailsHTML = priceFields.map(({ label, key, type }) => {
        let value = r[key] || "";
        if (key === "Zusatzkosten") {
            // Ensure the textarea for additional costs is rendered correctly
            return `<label>${label}:</label><textarea name="${key}" placeholder="Labeln, Fotos" style="height:80px">${value}</textarea>`;
        } else if (key === "Dangerous Goods") {
            const options = ["Ja", "Nein", "N/A"]; // Example options
            return `<label>${label}:</label>
                    <select name="${key}">
                        ${options.map(opt => `<option value="${opt}" ${String(value).toLowerCase() === opt.toLowerCase() ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>`;
        } else {
            const numericValue = parseFloat(String(value).replace(',', '.') || "0") || 0;
            return `<label>${label}:</label><input type="text" name="${key}" value="${numericValue.toLocaleString('de-DE', {useGrouping: false})}" />`;
        }
    }).join("");

    modalBody.appendChild(section("Price Details", priceDetailsHTML, 'bg-yellow-50')); // Color class for price details
  }
  // The 'else' block for Viewers was removed, as 'Zusatzkosten'
  // is handled directly in renderFields() to skip it completely.


  const buttonContainer = document.createElement("div");
  buttonContainer.style.width = "100%";
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "center";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.marginTop = "20px";

  // The save button is already present in the modal's HTML, so no need to add it dynamically here.
  // if (currentUser) {
  //   const saveButton = document.createElement("button");
  //   saveButton.textContent = "Speichern";
  //   saveButton.onclick = saveDetails;
  //   saveButton.style.padding = "10px 20px";
  //   saveButton.style.fontWeight = "bold";
  //   saveButton.style.backgroundColor = "#28a745";
  //   saveButton.style.color = "white";
  //   saveButton.style.border = "none";
  //   saveButton.style.borderRadius = "6px";
  //   saveButton.style.cursor = "pointer";
  //   buttonContainer.appendChild(saveButton);
  // }

  const historyButton = document.createElement("button");
  historyButton.textContent = "History";
  historyButton.style.padding = "10px 20px";
  historyButton.style.fontWeight = "bold";
  historyButton.style.backgroundColor = "#17a2b8";
  historyButton.style.color = "white";
  historyButton.style.border = "none";
  historyButton.style.borderRadius = "6px";
  historyButton.style.cursor = "pointer";
  historyButton.onclick = () => showHistory(r.Ref);
  buttonContainer.appendChild(historyButton);

  if (currentUser && originalIndex !== -1) { // Button for all roles, when an entry is open
    const sendConfirmationButton = document.createElement("button");
    sendConfirmationButton.textContent = "Final Charter Confirmation senden";
    sendConfirmationButton.style.padding = "10px 20px";
    sendConfirmationButton.style.fontWeight = "bold";
    sendConfirmationButton.style.backgroundColor = "#007BFF"; // Blue for Send
    sendConfirmationButton.style.color = "white";
    sendConfirmationButton.style.border = "none";
    sendConfirmationButton.style.borderRadius = "6px";
    sendConfirmationButton.style.cursor = "pointer";
    sendConfirmationButton.onclick = () => sendFinalConfirmationEmail(r); // Calls new function that sends directly
    buttonContainer.appendChild(sendConfirmationButton);

    // NEW: Add button for email preview
    const previewEmailButton = document.createElement("button");
    previewEmailButton.textContent = "E-Mail Vorschau anzeigen";
    previewEmailButton.style.padding = "10px 20px";
    previewEmailButton.style.fontWeight = "bold";
    previewEmailButton.style.backgroundColor = "#6c757d"; // Gray for preview
    previewEmailButton.style.color = "white";
    previewEmailButton.style.border = "none";
    previewEmailButton.style.borderRadius = "6px";
    previewEmailButton.style.cursor = "pointer";
    previewEmailButton.onclick = () => generateEmailPreview(r); // Calls preview function
    buttonContainer.appendChild(previewEmailButton);
  }

  if (currentUser && currentUser.role === 'admin' && originalIndex !== -1) {
    const deleteButtonModal = document.createElement("button");
    deleteButtonModal.textContent = "Eintrag löschen";
    deleteButtonModal.className = "btn btn-delete";
    deleteButtonModal.style.padding = "10px 20px";
    deleteButtonModal.style.fontWeight = "bold";
    deleteButtonModal.style.backgroundColor = "#dc3545";
    deleteButtonModal.style.color = "white";
    deleteButtonModal.style.border = "none";
    deleteButtonModal.style.borderRadius = "6px";
    deleteButtonModal.style.cursor = "pointer";
    deleteButtonModal.onclick = () => deleteRowFromModal(r.Ref);
    buttonContainer.appendChild(deleteButtonModal);
  }

  modalBody.appendChild(buttonContainer);
  modal.style.display = "flex";
}

// NEW: Function to search on FlightRadar24
function searchFlightRadar24() {
    const callSign = document.getElementById('callSignSearchInput').value.trim();
    if (callSign) {
        window.open(`https://www.flightradar24.com/${callSign}`, '_blank');
    } else {
        showSaveFeedback("Please enter a Call Sign to search on FlightRadar24.", false);
    }
}

// NEW: Function to toggle Origin/Destination fields based on checkbox
function toggleOriginDestinationFields(checkbox, fieldType) {
    const parentLabel = checkbox.closest('label');
    let inputElement = parentLabel.nextElementSibling; // Try to find the next sibling element

    // If it's not an input element or it's not the right one, search for it
    if (!inputElement || (inputElement.tagName !== 'INPUT' && inputElement.tagName !== 'LABEL')) {
        // Search within the same modal-section Div
        const sectionDiv = checkbox.closest('.modal-section');
        if (sectionDiv) {
            inputElement = sectionDiv.querySelector(`input[name="${fieldType}"]`);
        }
    }

    if (checkbox.checked) {
        // If the checkbox is checked, add the field if it doesn't exist
        if (!inputElement || inputElement.name !== fieldType) {
            const newLabel = document.createElement('label');
            newLabel.textContent = `${fieldType}:`;
            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.name = fieldType;
            newInput.value = currentModalData[fieldType] || ''; // Set existing value
            newInput.style.cssText = 'width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px;';

            // Add the label and input after the checkbox
            parentLabel.parentNode.insertBefore(newLabel, parentLabel.nextSibling);
            newLabel.parentNode.insertBefore(newInput, newLabel.nextSibling);
        } else {
            // If the field already exists, ensure it is visible
            inputElement.style.display = '';
            inputElement.previousElementSibling.style.display = ''; // Also show label
        }
    } else {
        // If the checkbox is unchecked, hide the field
        if (inputElement && inputElement.name === fieldType) {
            inputElement.style.display = 'none';
            inputElement.previousElementSibling.style.display = 'none'; // Also hide label
        }
    }
}


function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

// NEW: Function to close the day overview modal
function closeDayOverviewModal() {
    document.getElementById('dayOverviewModal').style.display = 'none';
}

// Event Listener for ESC key to close all modals
document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeHistoryModal();
    closeProfileModal();
    closeStatisticsModal();
    closeEmailConfirmationModal();
    closeEmailPreviewModal();
    closeDayOverviewModal(); // NEW: Also close the day overview modal
  }
});


async function saveDetails() {
  const modal = document.getElementById("detailModal");
  const inputs = modal.querySelectorAll("input, select, textarea");
  const data = {};
  inputs.forEach((input) => {
    let key = input.name;
    let value;

    if (input.type === 'checkbox') {
        value = input.checked ? 'Ja' : 'Nein';
    } else if (input.tagName === 'SELECT') {
        value = input.value;
    }
    else {
        value = input.value;
    }
    data[key] = value;
  });

  // Removed required field validation
  // const requiredFields = ['Airline', 'Flugnummer', 'Flight Date', 'Tonnage'];
  // for (const field of requiredFields) {
  //     if (!data[field] || String(data[field]).trim() === '') {
  //         showSaveFeedback(`Fehler: Das Feld '${field}' ist ein Pflichtfeld.`, false);
  //         return; // Abort if required field is missing
  //     }
  // }

  // Additional checks for 'Flight Type Import' and 'Flight Type Export'
  // Removed validation for Origin and Destination
  /*
  if (data['Flight Type Import'] === 'Ja' && (!data['Origin'] || String(data['Origin']).trim() === '')) {
      showSaveFeedback('Error: If "Flight Type Import" is selected, "Origin" must be filled.', false);
      return;
  }
  if (data['Flight Type Export'] === 'Ja' && (!data['Destination'] || String(data['Destination']).trim() === '')) {
      showSaveFeedback('Error: If "Flight Type Export" is selected, "Destination" must be filled.', false);
      return;
  }
  */

  // Ref and Created At should not be changeable
  data.Ref = currentModalData.Ref; // Ensure reference is retained
  data['Created At'] = currentModalData['Created At'];

  const payload = {
    mode: "write",
    data: data,
    user: currentUser ? currentUser.name : "Unknown", // Username for audit log
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(payload).toString(),
    });

    const result = await response.json();

    if (response.ok && result.status === "success") {
      showSaveFeedback("Data saved successfully!", true);
      closeModal();
      fetchData(); // Reload data and update table
    } else {
      showSaveFeedback(
        result.message || "Error saving data!",
        false
      );
    }
  } catch (error) {
    console.error("Save error:", error);
    showSaveFeedback("An error occurred. Please try again later.", false);
  }
}

async function deleteRow(buttonElement) {
  if (!currentUser || currentUser.role !== 'admin') {
      showSaveFeedback("You do not have permission to delete data.", false);
      return;
  }

  const ref = buttonElement.dataset.ref; // Get ref from data-ref attribute

  if (!confirm("Are you sure you want to delete this entry?")) {
    return;
  }

  await deleteData(ref);
}

async function deleteRowFromModal(ref) {
  if (!currentUser || currentUser.role !== 'admin') {
      showSaveFeedback("You do not have permission to delete data.", false);
      return;
  }

  if (!confirm(`Are you sure you want to delete the entry with reference "${ref}"?`)) {
    return;
  }

  await deleteData(ref);
  closeModal(); // Close modal after deleting
}

async function deleteData(ref) {
  const payload = {
    mode: "delete",
    ref: ref,
    user: currentUser ? currentUser.name : "Unknown", // Username for audit log
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(payload).toString(),
    });

    const result = await response.json();

    if (response.ok && result.status === "success") {
      showSaveFeedback("Entry deleted successfully!", true);
      fetchData(); // Reload data and update table
    } else {
      showSaveFeedback(
        result.message || "Error deleting entry!",
        false
      );
    }
  } catch (error) {
    console.error("Deletion error:", error);
    showSaveFeedback("An error occurred. Please try again later.", false);
  }
}

function generateReference() {
  const date = new Date();
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); // 4 random digits
  return `REF-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}


function showSaveFeedback(message, isSuccess) {
  const feedbackElement = document.getElementById("saveFeedback");
  if (!feedbackElement) {
    // If the feedback element does not exist, create it
    const mainContent = document.querySelector('.main');
    if (mainContent) {
        const div = document.createElement('div');
        div.id = 'saveFeedback';
        div.style.position = 'fixed';
        div.style.bottom = '20px';
        div.style.left = '50%';
        div.style.transform = 'translateX(-50%)';
        div.style.padding = '10px 20px';
        div.style.borderRadius = '8px';
        div.style.color = 'white';
        div.style.textAlign = 'center';
        div.style.opacity = '0';
        div.style.transition = 'opacity 0.5s ease-in-out';
        div.style.zIndex = '3000'; // Ensure it's above other content
        mainContent.appendChild(div);
        feedbackElement = div;
    } else {
        console.warn("Feedback element and .main container not found. Feedback cannot be displayed.");
        return;
    }
  }

  feedbackElement.textContent = message;
  feedbackElement.style.backgroundColor = isSuccess ? "#28a745" : "#dc3545";
  feedbackElement.style.opacity = '1';
  feedbackElement.style.display = 'block'; // Ensure it's visible

  setTimeout(() => {
    feedbackElement.style.opacity = '0';
    // Wait until the transition is finished before setting display to 'none'
    feedbackElement.addEventListener('transitionend', function handler() {
        feedbackElement.style.display = 'none';
        feedbackElement.removeEventListener('transitionend', handler);
    }, { once: true });
  }, 3000);
}


// === CALENDAR FUNCTIONS ===
function renderCalendars() {
  const calendarArea = document.getElementById("calendarArea");
  calendarArea.innerHTML = "";

  // Set months for display (current and next month)
  const monthsToShow = [
    new Date(baseYear, baseMonth),     // Current month
    new Date(baseYear, baseMonth + 1)  // Next month
  ];

  monthsToShow.forEach(date => {
    calendarArea.appendChild(createMonthCalendar(date));
  });
}

function createMonthCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthName = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0); // Last day of the month
  const daysInMonth = lastDay.getDate();

  const calendarBlock = document.createElement("div");
  calendarBlock.className = "calendar-block";
  calendarBlock.innerHTML = `
    <h4>${monthName}</h4>
    <table>
      <thead>
        <tr>
          <th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    </table>
  `;

  const tbody = calendarBlock.querySelector("tbody");
  let dayCounter = 1;
  const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0, Sunday = 6

  for (let i = 0; i < 6; i++) { // Max 6 weeks in a month
    const row = document.createElement("tr");
    for (let j = 0; j < 7; j++) {
      const cell = document.createElement("td");
      if (i === 0 && j < startDay) {
        cell.className = "calendar-day empty";
      } else if (dayCounter > daysInMonth) {
        cell.className = "calendar-day empty";
      } else {
        const currentDay = dayCounter;
        const fullDate = new Date(year, month, currentDay);
        fullDate.setHours(0,0,0,0); // Set time to midnight

        // Filter flights for this day and capture types
        const flightsOnDay = requestData.filter(d => {
            let flightDateObj;
            if (typeof d['Flight Date'] === 'string' && d['Flight Date'].match(/^\d{4}-\d{2}-\d{2}$/)) {
                const parts = d['Flight Date'].split('-');
                flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (d['Flight Date'] instanceof Date) {
                flightDateObj = d['Flight Date'];
            } else {
                flightDateObj = new Date('Invalid Date');
            }
            flightDateObj.setHours(0,0,0,0); // Also set flight date to midnight
            return flightDateObj.getTime() === fullDate.getTime();
        });

        let hasImport = false;
        let hasExport = false;
        let tooltipContent = [];

        flightsOnDay.forEach(flight => {
            if (String(flight['Flight Type Import']).toLowerCase() === 'ja') {
                hasImport = true;
            }
            if (String(flight['Flight Type Export']).toLowerCase() === 'ja') {
                hasExport = true;
            }

            // Create tooltip content
            tooltipContent.push(`Ref: ${flight.Ref || '-'}`);
            tooltipContent.push(`Airline: ${flight.Airline || '-'}`);
            tooltipContent.push(`Flugnummer: ${flight.Flugnummer || '-'}`);
            tooltipContent.push(`Call Sign: ${flight['Call Sign'] || '-'}`);
            tooltipContent.push(`Abflugzeit: ${flight['Abflugzeit'] || '-'}`);

            if (String(flight['Flight Type Import']).toLowerCase() === 'ja' && flight.Origin) {
                tooltipContent.push(`Origin: ${flight.Origin}`);
            } else if (String(flight['Flight Type Export']).toLowerCase() === 'ja' && flight.Destination) {
                tooltipContent.push(`Destination: ${flight.Destination}`);
            } else {
                tooltipContent.push(`Type: N/A`); // If neither import nor export
            }
            tooltipContent.push(`Tonnage: ${parseFloat(String(flight.Tonnage).replace(',', '.') || "0").toLocaleString('de-DE')} kg`);
            tooltipContent.push('---'); // Separator between flights
        });

        if (tooltipContent.length > 0) {
            tooltipContent.pop(); // Remove the last separator
        }


        cell.textContent = currentDay;
        cell.className = "calendar-day";
        
        // NEW: Logic for clicking on calendar cells
        if (flightsOnDay.length === 1) {
            const singleFlightIndex = requestData.findIndex(item => item.Ref === flightsOnDay[0].Ref);
            cell.onclick = () => openModal(singleFlightIndex);
        } else if (flightsOnDay.length > 1) {
            cell.onclick = () => showSaveFeedback('Multiple flights for this day. Please use the table view for filtering.', false);
        } else {
            // No flights, no click handler
            cell.onclick = null;
        }


        if (flightsOnDay.length > 0) {
            cell.dataset.tooltip = tooltipContent.join('\n'); // Add all flights to the tooltip
            if (hasImport && hasExport) {
                cell.classList.add('import-export');
            } else if (hasImport) {
                cell.classList.add('import-only');
            } else if (hasExport) {
                cell.classList.add('export-only');
            } else {
                cell.classList.add('has-flights'); // Existing class for other flights
            }
        }
        dayCounter++;
      }
      row.appendChild(cell);
    }
    tbody.appendChild(row);
    if (dayCounter > daysInMonth) break; // End loop if all days of the month have been rendered
  }

  return calendarBlock;
}


function shiftCalendar(direction) {
  baseMonth += direction;
  if (baseMonth > 11) {
    baseMonth = 0;
    baseYear++;
  } else if (baseMonth < 0) {
    baseMonth = 11;
    baseYear--;
  }
  renderCalendars();
}

// This function is no longer directly accessible via calendar cell clicks,
// but remains for other potential uses or debugging.
function openDayOverview(dateString, flights) {
    const dayOverviewModal = document.getElementById('dayOverviewModal');
    const dayOverviewDateSpan = document.getElementById('dayOverviewDate');
    const dayOverviewBody = document.getElementById('dayOverviewBody');

    dayOverviewDateSpan.textContent = new Date(dateString).toLocaleDateString('de-DE');
    dayOverviewBody.innerHTML = ''; // Clear old content

    if (flights.length === 0) {
        dayOverviewBody.innerHTML = '<p>No flights for this date.</p>';
    } else {
        const ul = document.createElement('ul');
        flights.forEach(flight => {
            const li = document.createElement('li');
            const originalIndex = requestData.findIndex(item => item.Ref === flight.Ref);
            console.log(`Debug: Flight Ref: ${flight.Ref}, Original Index: ${originalIndex}`);

            li.innerHTML = `
                <strong>Ref:</strong> <a href="javascript:void(0);" class="open-modal-link" data-index="${originalIndex}">${flight.Ref}</a><br>
                <strong>Airline:</strong> ${flight.Airline || '-'}<br>
                <strong>Flugnummer:</strong> ${flight.Flugnummer || '-'}<br>
                <strong>Call Sign:</strong> ${flight['Call Sign'] || '-'}<br>
                <strong>Tonnage:</strong> ${parseFloat(String(flight.Tonnage).replace(',', '.') || "0").toLocaleString('de-DE')} kg<br>
                <strong>Abflugzeit:</strong> ${flight['Abflugzeit'] || '-'}<br>
                <strong>Confirmed:</strong> ${String(flight['Final Confirmation Sent']).toLowerCase() === 'ja' ? 'Yes' : 'No'}
            `;
            ul.appendChild(li);

            const link = li.querySelector('.open-modal-link');
            if (link) {
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    const indexToOpen = parseInt(event.target.dataset.index);
                    if (indexToOpen !== -1 && !isNaN(indexToOpen)) {
                        openModal(indexToOpen);
                        closeDayOverviewModal();
                    } else {
                        console.error("Invalid index for openModal from day overview:", indexToOpen);
                        showSaveFeedback("Error: Could not load details for this flight.", false);
                    }
                });
            }
        });
        dayOverviewBody.appendChild(ul);
    }
    dayOverviewModal.style.display = 'flex';
}


function showHistory(ref) {
    const historyModal = document.getElementById('historyModal');
    const historyRefSpan = document.getElementById('historyRef');
    const historyBody = document.getElementById('historyBody');

    historyRefSpan.textContent = ref;
    historyBody.innerHTML = 'Loading history...';

    fetch(`${API_URL}?mode=history&ref=${encodeURIComponent(ref)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            historyBody.innerHTML = ''; // Clear old content
            if (data.history && data.history.length > 0) {
                const ul = document.createElement('ul');
                data.history.reverse().forEach(entry => { // Newest first
                    const li = document.createElement('li');
                    const timestamp = new Date(entry.timestamp).toLocaleString('de-DE');
                    const user = entry.user || 'System';
                    let changes = '';
                    try {
                        const parsedChanges = JSON.parse(entry.changes);
                        changes = Object.entries(parsedChanges).map(([key, value]) => {
                            if (typeof value === 'object' && value !== null && 'old' in value && 'new' in value) {
                                return `<li><strong>${key}:</strong> from "${value.old}" to "${value.new}"</li>`;
                            }
                            return `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`; // Fallback for other formats
                        }).join('');
                        changes = `<ul>${changes}</ul>`;
                    } catch (e) {
                        changes = `<pre>${entry.changes}</pre>`; // Raw text if JSON parsing fails
                    }
                    li.innerHTML = `<strong>${timestamp}</strong> by <i>${user}</i>:<br>${changes}`;
                    ul.appendChild(li);
                });
                historyBody.appendChild(ul);
            } else {
                historyBody.innerHTML = '<p>No history found for this reference.</p>';
            }
            historyModal.style.display = 'flex';
        })
        .catch(error => {
            console.error('Error loading history:', error);
            historyBody.innerHTML = `<p style="color: red;">Error loading history: ${error.message}</p>`;
            historyModal.style.display = 'flex';
        });
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}


// === STATISTICS FUNCTIONS ===
function openStatisticsModal() {
    console.log("openStatisticsModal called. Opening statistics modal."); // Debug: Check if function is called
    document.getElementById('statisticsModal').style.display = 'flex';
    // Set default dates if not already set
    const statFromDateInput = document.getElementById('statFromDate');
    const statToDateInput = document.getElementById('statToDate');
    if (!statFromDateInput.value || !statToDateInput.value) {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        statFromDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
        statToDateInput.value = today.toISOString().split('T')[0];
    }
    generateStatistics(); // Generate statistics when the modal is opened
}

function closeStatisticsModal() {
    document.getElementById('statisticsModal').style.display = 'none';
    // Destroy charts to prevent memory leaks and re-render them when opened again
    if (tonnagePerMonthChartInstance) {
        tonnagePerMonthChartInstance.destroy();
        tonnagePerMonthChartInstance = null;
    }
    if (tonnagePerCustomerChartInstance) {
        tonnagePerCustomerChartInstance.destroy();
        tonnagePerCustomerChartInstance = null;
    }
}

function generateStatistics() {
    const statFromDateInput = document.getElementById('statFromDate').value;
    const statToDateInput = document.getElementById('statToDate').value;
    const statisticsBody = document.getElementById('statisticsBody');

    // Clear previous non-chart statistics (re-add them below)
    const oldStatsSections = statisticsBody.querySelectorAll('.statistics-section, h4:not(.chart-container h4), p:not(.chart-container p), ul:not(.chart-container ul), table:not(.chart-container table)');
    oldStatsSections.forEach(el => {
        if (!el.closest('.chart-container')) { // Only remove if not inside a chart container
            el.remove();
        }
    });

    if (!statFromDateInput || !statToDateInput) {
        statisticsBody.insertAdjacentHTML('beforeend', '<p style="text-align: center; color: red;">Please select a start and end date for the statistics.</p>');
        return;
    }

    const fromDate = new Date(statFromDateInput);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(statToDateInput);
    toDate.setHours(23, 59, 59, 999); // Set to end of day for inclusive range

    const filteredData = requestData.filter(r => {
        let flightDateFromData = r['Flight Date'];
        let flightDateObj;

        if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = flightDateFromData.split('-');
            flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else if (flightDateFromData instanceof Date) {
            flightDateObj = new Date(flightDateFromData.getFullYear(), flightDateFromData.getMonth(), flightDateFromData.getDate());
        } else {
            flightDateObj = new Date('Invalid Date');
        }
        flightDateObj.setHours(0, 0, 0, 0); // Normalize for comparison

        return flightDateObj >= fromDate && flightDateObj <= toDate;
    });

    console.log("Filtered Data for Statistics:", filteredData); // Debugging: Check filtered data

    // Initialize statistics
    let totalFlights = filteredData.length;
    let totalTonnage = 0;
    const dangerousGoodsCount = { "Ja": 0, "Nein": 0, "N/A": 0 };
    const VorfeldbegleitungCount = { "Ja": 0, "Nein": 0, "N/A": 0 };
    const airlineStats = {}; // { AirlineName: { totalTonnage: X, totalFlights: Y } }
    const tonnagePerMonth = {}; // { "YYYY-MM": totalTonnage }
    const tonnagePerCustomer = {}; // { CustomerName: totalTonnage }


    filteredData.forEach(item => {
        const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
        
        totalTonnage += tonnage;

        // Dangerous Goods Statistics
        const dgStatus = String(item['Dangerous Goods'] || '').toLowerCase() === 'ja' ? 'Ja' : (String(item['Dangerous Goods'] || '').toLowerCase() === 'nein' ? 'Nein' : 'N/A');
        dangerousGoodsCount[dgStatus]++;

        // Vorfeldbegleitung Statistics
        const vbStatus = String(item['Vorfeldbegleitung'] || '').toLowerCase() === 'ja' ? 'Ja' : (String(item['Vorfeldbegleitung'] || '').toLowerCase() === 'nein' ? 'Nein' : 'N/A');
        VorfeldbegleitungCount[vbStatus]++;

        // Airline-specific statistics
        const airlineName = item.Airline || 'Unknown';
        if (!airlineStats[airlineName]) {
            airlineStats[airlineName] = { totalTonnage: 0, totalFlights: 0 };
        }
        airlineStats[airlineName].totalTonnage += tonnage;
        airlineStats[airlineName].totalFlights++;

        // Tonnage per Month Statistics
        const flightDate = item['Flight Date'];
        if (flightDate && typeof flightDate === 'string' && flightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const yearMonth = flightDate.substring(0, 7); // "YYYY-MM"
            const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
            tonnagePerMonth[yearMonth] = (tonnagePerMonth[yearMonth] || 0) + tonnage;
        }

        // Tonnage per Customer Statistics (uses 'Billing Company' as customer)
        const customerName = item['Billing Company'] || 'Unknown';
        tonnagePerCustomer[customerName] = (tonnagePerCustomer[customerName] || 0) + tonnage;
    });

    console.log("Tonnage per Month:", tonnagePerMonth); // Debugging: Check aggregated data
    console.log("Tonnage per Customer:", tonnagePerCustomer); // Debugging: Check aggregated data


    // --- RENDER TEXT-BASED STATISTICS ---
    let statsHTML = '<div class="statistics-section"><h4>Overall Summary</h4>';
    statsHTML += `<p>Total Flights: <strong>${totalFlights}</strong></p>`;
    statsHTML += `<p>Total Tonnage: <strong>${totalTonnage.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg</strong></p></div>`;


    statsHTML += '<div class="statistics-section"><h4>Dangerous Goods Statistics</h4>';
    statsHTML += `<ul>`;
    statsHTML += `<li>Yes: ${dangerousGoodsCount["Ja"]} (${(dangerousGoodsCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    statsHTML += `<li>No: ${dangerousGoodsCount["Nein"]} (${(dangerousGoodsCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    if (dangerousGoodsCount["N/A"] > 0) {
        statsHTML += `<li>Not specified: ${dangerousGoodsCount["N/A"]} (${(dangerousGoodsCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    }
    statsHTML += `</ul></div>`;

    statsHTML += '<div class="statistics-section"><h4>Vorfeldbegleitung Statistics</h4>';
    statsHTML += `<ul>`;
    statsHTML += `<li>Yes: ${VorfeldbegleitungCount["Ja"]} (${(VorfeldbegleitungCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    statsHTML += `<li>No: ${VorfeldbegleitungCount["Nein"]} (${(VorfeldbegleitungCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    if (VorfeldbegleitungCount["N/A"] > 0) {
        statsHTML += `<li>Not specified: ${VorfeldbegleitungCount["N/A"]} (${(VorfeldbegleitungCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    }
    statsHTML += `</ul></div>`;


    statsHTML += '<div class="statistics-section"><h4>Statistics by Airline</h4>';
    if (Object.keys(airlineStats).length > 0) {
        statsHTML += `<table id="airlineStatisticsTable"><thead><tr><th>Airline</th><th>Flights</th><th>Tonnage (kg)</th>`;
        statsHTML += `</tr></thead><tbody>`;

        // Sort airlines by total flights descending
        const sortedAirlines = Object.entries(airlineStats).sort(([, a], [, b]) => b.totalFlights - a.totalFlights);

        sortedAirlines.forEach(([airlineName, stats]) => {
            statsHTML += `<tr>`;
            statsHTML += `<td>${airlineName}</td>`;
            statsHTML += `<td>${stats.totalFlights}</td>`;
            statsHTML += `<td>${stats.totalTonnage.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</td>`;
            statsHTML += `</tr>`;
        });
        statsHTML += `</tbody></table>`;
    } else {
        statsHTML += '<p>No flights found for the selected dates.</p>';
    }
    statsHTML += '</div>'; // Close statistics-section for airline stats

    // Insert the new statistics HTML before the chart containers
    const chartContainers = statisticsBody.querySelectorAll('.chart-container');
    if (chartContainers.length > 0) {
        chartContainers[0].insertAdjacentHTML('beforebegin', statsHTML);
    } else {
        statisticsBody.insertAdjacentHTML('beforeend', statsHTML);
    }

    // --- RENDER CHARTS ---
    renderTonnagePerMonthChart(tonnagePerMonth);
    renderTonnagePerCustomerChart(tonnagePerCustomer);
}


function renderTonnagePerMonthChart(data) {
    const ctx = document.getElementById('tonnagePerMonthChart');
    if (!ctx) {
        console.error("Canvas element 'tonnagePerMonthChart' not found.");
        return;
    }
    const chartCtx = ctx.getContext('2d');

    // Destroy previous chart instance, if any
    if (tonnagePerMonthChartInstance) {
        tonnagePerMonthChartInstance.destroy();
    }

    const labels = Object.keys(data).sort(); // Sort by month (YYYY-MM)
    const tonnageValues = labels.map(label => data[label]);

    tonnagePerMonthChartInstance = new Chart(chartCtx, {
        type: 'bar', // Bar chart
        data: {
            labels: labels,
            datasets: [{
                label: 'Tonnage (kg)',
                data: tonnageValues,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Important for fixed canvas height
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Tonnage (kg)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // Hide legend for single dataset
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString('de-DE') + ' kg';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderTonnagePerCustomerChart(data) {
    const ctx = document.getElementById('tonnagePerCustomerChart');
    if (!ctx) {
        console.error("Canvas element 'tonnagePerCustomerChart' not found.");
        return;
    }
    const chartCtx = ctx.getContext('2d');

    // Destroy previous chart instance, if any
    if (tonnagePerCustomerChartInstance) {
        tonnagePerCustomerChartInstance.destroy();
    }

    // Sort customers by tonnage (descending) and show only the Top X (e.g., Top 10)
    const sortedCustomers = Object.entries(data).sort(([, tonnageA], [, tonnageB]) => tonnageB - tonnageA);
    const topCustomers = sortedCustomers.slice(0, 10); // Show only the Top 10 customers

    const labels = topCustomers.map(([customer]) => customer);
    const tonnageValues = topCustomers.map(([, tonnage]) => tonnage);

    // Generate colors for the bars
    const backgroundColors = [
        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
        'rgba(199, 199, 199, 0.6)', 'rgba(83, 102, 255, 0.6)', 'rgba(40, 159, 64, 0.6)',
        'rgba(210, 50, 50, 0.6)'
    ];
    const borderColors = backgroundColors.map(color => color.replace('0.6', '1')); // Solid borders

    tonnagePerCustomerChartInstance = new Chart(chartCtx, {
        type: 'bar', // Bar chart
        data: {
            labels: labels,
            datasets: [{
                label: 'Tonnage (kg)',
                data: tonnageValues,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderColor: borderColors.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Tonnage (kg)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Customer'
                    },
                    // Optional: Rotate labels if they are too long
                    ticks: {
                        autoSkip: false,
                        maxRotation: 90,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function downloadStatisticsToCSV() {
    const statFromDateInput = document.getElementById('statFromDate').value;
    const statToDateInput = document.getElementById('statToDate').value;

    if (!statFromDateInput || !statToDateInput) {
        showSaveFeedback("Please select a start and end date for the download.", false);
        return;
    }

    const fromDate = new Date(statFromDateInput);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(statToDateInput);
    toDate.setHours(23, 59, 59, 999);

    const filteredData = requestData.filter(r => {
        let flightDateFromData = r['Flight Date'];
        let flightDateObj;

        if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = flightDateFromData.split('-');
            flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else if (flightDateFromData instanceof Date) {
            flightDateObj = new Date(flightDateFromData.getFullYear(), flightDateFromData.getMonth(), flightDateFromData.getDate());
        } else {
            flightDateObj = new Date('Invalid Date');
        }
        flightDateObj.setHours(0, 0, 0, 0);

        return flightDateObj >= fromDate && flightDateObj <= toDate;
    });

    let csvContent = "";

    // --- Overall Summary Statistics ---
    let totalFlights = filteredData.length;
    let totalTonnage = 0;

    filteredData.forEach(item => {
        const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
        totalTonnage += tonnage;
    });

    csvContent += "Overall Summary\n";
    csvContent += "Total Flights," + totalFlights + "\n";
    csvContent += "Total Tonnage (kg)," + totalTonnage.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 }) + "\n"; // Use en-US for CSV consistency
    csvContent += "\n"; // Empty line for separation

    // --- Dangerous Goods Statistics ---
    const dangerousGoodsCount = { "Ja": 0, "Nein": 0, "N/A": 0 };
    filteredData.forEach(item => {
        // Ensure item['Dangerous Goods'] is always a string
        const dgStatus = String(item['Dangerous Goods'] || '').toLowerCase() === 'ja' ? 'Ja' : (String(item['Dangerous Goods'] || '').toLowerCase() === 'nein' ? 'Nein' : 'N/A');
        dangerousGoodsCount[dgStatus]++;
    });
    csvContent += "Dangerous Goods Statistics\n";
    csvContent += "Status,Count,Percentage\n";
    csvContent += `Yes,${dangerousGoodsCount["Ja"]},${(dangerousGoodsCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    csvContent += `No,${dangerousGoodsCount["Nein"]},${(dangerousGoodsCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    if (dangerousGoodsCount["N/A"] > 0) {
        csvContent += `Not specified,${dangerousGoodsCount["N/A"]},${(dangerousGoodsCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    }
    csvContent += "\n";

    // --- Vorfeldbegleitung Statistics ---
    const VorfeldbegleitungCount = { "Ja": 0, "Nein": 0, "N/A": 0 };
    filteredData.forEach(item => {
        const vbStatus = String(item['Vorfeldbegleitung'] || '').toLowerCase() === 'ja' ? 'Ja' : (String(item['Vorfeldbegleitung'] || '').toLowerCase() === 'nein' ? 'Nein' : 'N/A');
        VorfeldbegleitungCount[vbStatus]++;
    });
    csvContent += "Vorfeldbegleitung Statistics\n";
    csvContent += "Status,Count,Percentage\n";
    csvContent += `Yes,${VorfeldbegleitungCount["Ja"]},${(VorfeldbegleitungCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    csvContent += `No,${VorfeldbegleitungCount["Nein"]},${(VorfeldbegleitungCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    if (VorfeldbegleitungCount["N/A"] > 0) {
        csvContent += `Not specified,${VorfeldbegleitungCount["N/A"]},${(VorfeldbegleitungCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    }
    csvContent += "\n";

    // --- Tonnage per Month Statistics ---
    const tonnagePerMonth = {};
    filteredData.forEach(item => {
        const flightDate = item['Flight Date'];
        if (flightDate && typeof flightDate === 'string' && flightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const yearMonth = flightDate.substring(0, 7); // "YYYY-MM"
            const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
            tonnagePerMonth[yearMonth] = (tonnagePerMonth[yearMonth] || 0) + tonnage;
        }
    });
    csvContent += "Tonnage per Month\n";
    csvContent += "Month,Tonnage (kg)\n";
    Object.keys(tonnagePerMonth).sort().forEach(month => {
        csvContent += `${month},${tonnagePerMonth[month].toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })}\n`;
    });
    csvContent += "\n";

    // --- Tonnage per Customer Statistics ---
    const tonnagePerCustomer = {};
    filteredData.forEach(item => {
        const customerName = item['Billing Company'] || 'Unknown';
        const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
        tonnagePerCustomer[customerName] = (tonnagePerCustomer[customerName] || 0) + tonnage;
    });
    csvContent += "Tonnage per Customer\n";
    csvContent += "Customer,Tonnage (kg)\n";
    // Sort customers by tonnage descending for better readability
    Object.entries(tonnagePerCustomer).sort(([, a], [, b]) => b - a).forEach(([customer, tonnage]) => {
        csvContent += `"${customer}",${tonnage.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })}\n`; // Enclose customer name in quotes to handle commas
    });
    csvContent += "\n";

    // --- Airline Statistics ---
    const airlineStats = {};
    filteredData.forEach(item => {
        const airlineName = item.Airline || 'Unknown';
        const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;

        if (!airlineStats[airlineName]) {
            airlineStats[airlineName] = { totalTonnage: 0, totalFlights: 0 };
        }
        airlineStats[airlineName].totalTonnage += tonnage;
        airlineStats[airlineName].totalFlights++;
    });

    csvContent += "Statistics by Airline\n";
    let airlineHeader = "Airline,Flights,Tonnage (kg)";
    csvContent += airlineHeader + "\n";

    Object.entries(airlineStats).sort(([, a], [, b]) => b.totalFlights - a.totalFlights).forEach(([airlineName, stats]) => {
        let row = `"${airlineName}",${stats.totalFlights},${stats.totalTonnage.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })}`;
        csvContent += row + "\n";
    });

    // Create a Blob and download it
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature detection for HTML5 download attribute
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Charter_Dashboard_Statistics_${statFromDateInput}_to_${statToDateInput}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showSaveFeedback("Statistics downloaded successfully!", true);
    } else {
        // Fallback for browsers that do not support the download attribute (less likely today)
        showSaveFeedback("Your browser does not support direct download. Please copy the text manually.", false);
        console.warn("Download attribute not supported. Fallback required.");
    }
}


// === EMAIL CONFIRMATION MODAL FUNCTIONS ===
function openEmailConfirmationModal(data) {
    currentModalData = data; // Set the current data for the modal
    const confirmRefSpan = document.getElementById('confirmRef');
    const confirmEmailSpan = document.getElementById('confirmEmail');
    const additionalEmailInput = document.getElementById('additionalEmail');
    const sendEmailConfirmBtn = document.getElementById('sendEmailConfirmBtn');

    confirmRefSpan.textContent = data.Ref;
    confirmEmailSpan.textContent = data['Contact E-Mail Invoicing'] || 'N/A';
    additionalEmailInput.value = ''; // Clear additional email field

    // Reassign event listener to ensure it captures the current `data`
    sendEmailConfirmBtn.onclick = () => sendFinalConfirmationEmail(data); // Calls the send function directly

    document.getElementById('emailConfirmationModal').style.display = 'flex';
}

function closeEmailConfirmationModal() {
    document.getElementById('emailConfirmationModal').style.display = 'none';
    document.getElementById('additionalEmail').value = ''; // Clear input field
    document.getElementById('emailConfirmationMessage').textContent = ''; // Clear message
}

// NEW: Function to send email directly
async function sendFinalConfirmationEmail(data) {
    const additionalEmail = document.getElementById('additionalEmail').value.trim();
    const recipientEmail = additionalEmail || data['Contact E-Mail Invoicing'];
    const emailMessageElem = document.getElementById('emailConfirmationMessage');

    if (!recipientEmail) {
        emailMessageElem.textContent = "No email address found for the recipient. Please enter an additional email.";
        emailMessageElem.style.color = 'red';
        return;
    }

    emailMessageElem.textContent = "Sending email...";
    emailMessageElem.style.color = 'blue';

    const payload = {
        mode: 'markAsSent', // This will send the email and update the status
        ref: data.Ref,
        user: currentUser ? currentUser.name : "Unknown",
        sendEmail: true, // Explicitly to send the email
        recipient: recipientEmail
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload).toString(),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            emailMessageElem.textContent = "Email sent successfully and marked as 'Final Confirmation Sent'!";
            emailMessageElem.style.color = 'green';
            setTimeout(() => {
                closeEmailConfirmationModal();
                closeModal(); // Close detail view as confirmation is complete
                fetchData(); // Reload data to show status update
            }, 1500);
        } else {
            emailMessageElem.textContent = result.message || "Error sending email.";
            emailMessageElem.style.color = 'red';
        }
    } catch (error) {
        console.error('Error sending email:', error);
        emailMessageElem.textContent = 'An error occurred while sending the email. Please try again later.';
        emailMessageElem.style.color = 'red';
    }
}


async function generateEmailPreview() {
    closeEmailConfirmationModal(); // Close confirmation modal

    const previewRefSpan = document.getElementById('previewRef');
    const emailPreviewContentDiv = document.getElementById('emailPreviewContent');
    const markAsSentBtn = document.getElementById('markAsSentBtn');

    previewRefSpan.textContent = currentModalData.Ref;
    emailPreviewContentDiv.innerHTML = 'Loading email preview...';

    const additionalEmail = document.getElementById('additionalEmail').value.trim();
    const recipientEmail = additionalEmail || currentModalData['Contact E-Mail Invoicing'];

    if (!recipientEmail) {
        showSaveFeedback("No email address found for the recipient. Please enter an additional email.", false);
        return;
    }

    const payload = {
        mode: 'generateEmailPreview', // This action must be implemented in your Google Apps Script backend!
        ref: currentModalData.Ref,
        recipient: recipientEmail // Recipient for the preview
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload).toString(),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success' && result.htmlContent) {
            emailPreviewContentDiv.innerHTML = result.htmlContent;
            // The button in the preview modal should MANUALLY mark the request as sent, without sending another email
            markAsSentBtn.textContent = "Manually send request"; // Text change here
            markAsSentBtn.onclick = () => markAsSentManually(currentModalData.Ref, false); // Set sendEmail to false
            document.getElementById('emailPreviewModal').style.display = 'flex';
        } else {
            emailPreviewContentDiv.innerHTML = `<p style="color: red;">Error loading email preview: ${result.message || 'Unknown error'}<br>
            <strong>Please ensure your Google Apps Script backend correctly handles the 'generateEmailPreview' action.</strong></p>`;
            markAsSentBtn.textContent = "Manually send request"; // Text change even on error
            markAsSentBtn.onclick = () => markAsSentManually(currentModalData.Ref, false); // Only mark if preview fails
            document.getElementById('emailPreviewModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Error retrieving email preview:', error);
        emailPreviewContentDiv.innerHTML = `<p style="color: red;">A network error occurred: ${error.message}<br>
        <strong>Please ensure your Google Apps Script backend correctly handles the 'generateEmailPreview' action.</strong></p>`;
        markAsSentBtn.textContent = "Manually send request"; // Text change even on error
        markAsSentBtn.onclick = () => markAsSentManually(currentModalData.Ref, false); // Only mark if preview fails
        document.getElementById('emailPreviewModal').style.display = 'flex';
    }
}

function closeEmailPreviewModal() {
    document.getElementById('emailPreviewModal').style.display = 'none';
}

// Function to manually mark as sent (or actually send)
async function markAsSentManually(ref, sendEmail = false) {
    let payload = {
        mode: 'markAsSent',
        ref: ref,
        user: currentUser ? currentUser.name : "Unknown",
        sendEmail: sendEmail // Controls whether the email should actually be sent
    };

    // If the email is to be sent, add the recipients
    if (sendEmail) {
        // Here, the email address should come from currentModalData or an additional field
        // Since this is called from the Preview modal, we take the email from currentModalData
        const recipientEmail = currentModalData['Contact E-Mail Invoicing'];
        if (!recipientEmail) {
            showSaveFeedback("No email address found for the recipient. Email cannot be sent.", false);
            return;
        }
        payload.recipient = recipientEmail;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload).toString(),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            showSaveFeedback(`Entry marked as 'Final Confirmation Sent'. ${sendEmail ? 'Email sent.' : ''}`, true);
            closeEmailPreviewModal();
            closeEmailConfirmationModal(); // Also close the confirmation modal
            closeModal(); // And the detail modal, as confirmation is now complete
            fetchData(); // Reload data to show status update
        } else {
            showSaveFeedback(result.message || `Error marking as sent. ${sendEmail ? 'Email was not sent.' : ''}`, false);
        }
    } catch (error) {
        console.error('Error marking/sending:', error);
        showSaveFeedback('An error occurred while marking or sending. Please try again later.', false);
    }
}


// === Initialization ===
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  updateClock();
  setInterval(updateClock, 1000); // Updates the clock every second
  renderCalendars(); // Initialize the calendar after data loading

  // Event Listener for "Create Charter Request" and "Show Statistics" buttons
  const createNewRequestBtn = document.getElementById('createNewRequestBtn');
  if (createNewRequestBtn) {
      createNewRequestBtn.addEventListener('click', createNewRequest);
  }

  const openStatisticsBtn = document.getElementById('openStatisticsBtn');
  if (openStatisticsBtn) {
      openStatisticsBtn.addEventListener('click', openStatisticsModal);
  }

  // Set initial dates for statistics
  const statFromDateInput = document.getElementById('statFromDate');
  const statToDateInput = document.getElementById('statToDate');
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  statFromDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
  statToDateInput.value = today.toISOString().split('T')[0];

  // Event Listener for the preview button in the email confirmation modal
  // This button has now been moved to the detail view and handled directly there.
  // const previewEmailBtn = document.getElementById('previewEmailBtn');
  // if (previewEmailBtn) {
  //     previewEmailBtn.addEventListener('click', generateEmailPreview);
  // }

  // Event Listener for the "Send Email" button in the email preview modal
  const markAsSentBtn = document.getElementById('markAsSentBtn');
  if (markAsSentBtn) {
      // The logic for this button is now set in generateEmailPreview,
      // to ensure currentModalData is correct.
      // markAsSentBtn.addEventListener('click', () => markAsSentManually(currentModalData.Ref, true));
  }
});


// === Helper Functions ===
function updateClock() {
  const now = new Date();
  document.getElementById("currentDate").textContent = `Datum: ${now.toLocaleDateString('de-DE')}`;
  document.getElementById("clock").textContent = `Uhrzeit: ${now.toLocaleTimeString('de-DE')}`;
}

// Function to create a new charter request
function createNewRequest() {
    console.log("createNewRequest called."); // Debugging output
    openModal(-1); // Open the modal with empty fields for a new request
}

// --- IMPORTANT CORRECTION: Make functions globally accessible ---
// If script.js is loaded as type="module", functions are
// not by default available in the global "window" scope,
// unless explicitly exported or assigned.
// For HTML onclick attributes, assignment to "window" is required.
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.changePassword = changePassword;
window.logoutUser = logoutUser;
window.fetchData = fetchData;
window.renderTables = renderTables; // Retained for shared view
window.filterTable = filterTable;
window.openModal = openModal;
window.deleteRowFromModal = deleteRowFromModal;
window.closeModal = closeModal;
window.saveDetails = saveDetails;
window.deleteRow = deleteRow;
window.shiftCalendar = shiftCalendar;
window.renderCalendars = renderCalendars;
window.openDayOverview = openDayOverview;
window.closeDayOverviewModal = closeDayOverviewModal; // NEW: Global for the new modal
window.createMonthCalendar = createMonthCalendar; // Must also be global, as it is called by renderCalendars
window.generateReference = generateReference;
window.createNewRequest = createNewRequest; // Button "Create Charter Request"
window.showSaveFeedback = showSaveFeedback;
window.showHistory = showHistory;
window.closeHistoryModal = closeHistoryModal;
window.openStatisticsModal = openStatisticsModal;
window.closeStatisticsModal = closeStatisticsModal;
window.generateStatistics = generateStatistics;
window.renderTonnagePerMonthChart = renderTonnagePerMonthChart;
window.renderTonnagePerCustomerChart = renderTonnagePerCustomerChart;
window.downloadStatisticsToCSV = downloadStatisticsToCSV;
window.openEmailConfirmationModal = openEmailConfirmationModal;
window.closeEmailConfirmationModal = closeEmailConfirmationModal;
window.sendFinalConfirmationEmail = sendFinalConfirmationEmail; // NEW: Direct send function
window.toggleOriginDestinationFields = toggleOriginDestinationFields;
window.generateEmailPreview = generateEmailPreview;
window.closeEmailPreviewModal = closeEmailPreviewModal;
window.markAsSentManually = markAsSentManually;
window.searchFlightRadar24 = searchFlightRadar24; // NEW: FlightRadar24 Search
