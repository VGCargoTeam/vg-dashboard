// Charter Dashboard Script – 3-column structured detail view
const API_URL = 'https://script.google.com/macros/s/AKfycbzo-FgxA6TMJYK4xwLbrsRnNTAU_AN-FEJJoZH6w7aJ3BlcsaB751LjdUJ9nieGtu1P/exec'; // <<< UPDATED: NEW LINK FROM USER

let currentUser = null; // Stores the currently logged-in user
let requestData = []; // Stores all retrieved charter data
let baseMonth = new Date().getMonth(); // Current month (0-indexed)
let baseYear = new Date().getFullYear(); // Current year

const today = new Date();
today.setHours(0, 0, 0, 0); // Sets the time to midnight for comparison

// Global variables for Chart instances, to destroy them if needed
let tonnagePerMonthChartInstance = null;
let tonnagePerCustomerChartInstance = null;

// Variable to store the data currently displayed in the modal
let currentModalData = null;


// === AUTHENTICATION AND USER MANAGEMENT ===
function checkAuthStatus() {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    // Since user data now comes from Google Sheets, we no longer need a users file check here.
    // We trust that the currentUser object is valid if it's in localStorage.
    updateUIBasedOnUserRole();
    fetchData(); // Load data if logged in
  } else {
    // If not logged in, redirect to login page
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
    messageElem.textContent = 'Please fill in both password fields.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass !== confirmPass) {
    messageElem.textContent = 'New passwords do not match.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass.length < 6) { // Example: Minimum length
      messageElem.textContent = 'Password must be at least 6 characters long.';
      messageElem.style.color = 'red';
      return;
  }
  if (currentUser.username === undefined) {
      messageElem.textContent = 'Username for password change not available.';
      messageElem.style.color = 'red';
      return;
  }

  const payload = {
      mode: 'updatePassword',
      username: currentUser.username, // The user whose password is to be changed
      oldPassword: oldPass, // Current password for verification
      newPassword: newPass, // New password
      user: currentUser.name // For Audit Log
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
          messageElem.textContent = 'Password successfully changed! Please log in again.';
          messageElem.style.color = 'green';
          // Clear fields after successful change
          const newPassInput = document.getElementById('newPasswordInput');
          const confirmPassInput = document.getElementById('confirmPasswordInput');
          if (newPassInput) newPassInput.value = '';
          if (confirmPassInput) confirmPassInput.value = '';

          // Optional: Automatic logout after successful password change
          setTimeout(() => {
              logoutUser();
          }, 2000);

      } else {
          messageElem.textContent = result.message || 'Error changing password.';
          messageElem.style.color = 'red';
      }
  } catch (error) {
      console.error('Password change error:', error);
      messageElem.textContent = 'An error occurred while changing the password. Please try again later.';
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
      requestData = d.data; // Stores the array of data
      console.log("Raw data from API:", JSON.parse(JSON.stringify(d.data))); // For debugging
      filterTable(); // Calls filterTable to update both table and calendar
    })
    .catch((error) => {
      console.error("Error loading data:", error);
      showSaveFeedback("Error loading data!", false);
    });
}

// Modified renderTable to accept tableId
function renderTable(dataToRender, tableId) {
  const tableBody = document.getElementById(tableId).getElementsByTagName('tbody')[0];
  if (!tableBody) {
      console.error(`Error: tbody for table with ID '${tableId}' not found.`);
      return;
  }
  tableBody.innerHTML = ""; // Clear the table before rendering

  dataToRender.forEach((r) => {
    const row = document.createElement("tr");
    const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;

    const originalIndex = requestData.findIndex(item => item.Ref === r.Ref);

    // Format date correctly for display (DD.MM.YYYY)
    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
        try {
            // Robust parsing of the date to avoid timezone issues
            let dateObj;
            if (typeof displayFlightDate === 'string' && displayFlightDate.match(/^\d{4}-\d{2}-\d{2}$/)) { // Expects YYYY-MM-DD from backend
                const parts = displayFlightDate.split('-');
                dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (displayFlightDate instanceof Date) { // If it's already a Date object (rare, but for safety)
                dateObj = new Date(displayFlightDate.getFullYear(), displayFlightDate.getMonth(), displayFlightDate.getDate());
            } else {
                dateObj = new Date('Invalid Date'); // Invalid date
            }

            // Ensure time is set to midnight for consistency
            dateObj.setHours(0, 0, 0, 0);

            if (!isNaN(dateObj.getTime())) {
                displayFlightDate = dateObj.toLocaleDateString('de-DE');
            }
        } catch (e) {
             console.error("Error converting date for display in table:", displayFlightDate, e);
        }
    }

    const deleteButtonHTML = (currentUser && currentUser.role === 'admin') ? `<button class="btn-action btn-delete admin-only" onclick="deleteRow(this)">Delete</button>` : '';

    // NEW: Check final confirmation status and add icon
    const isConfirmed = String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja';
    const confirmationIcon = isConfirmed ? '<span class="text-green-500 ml-1">&#10004;</span>' : ''; // Green checkmark

    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})">${r.Ref}</a>${confirmationIcon}</td>
      <td>${displayFlightDate}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toLocaleString('de-DE')}</td>
      <td>
        <button class="btn-action btn-view" onclick="openModal(${originalIndex})">View</button>
        ${deleteButtonHTML}
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function filterTable() {
  const refSearch = document.getElementById("refSearch").value.toLowerCase();
  const airlineSearch = document.getElementById("airlineSearch").value.toLowerCase();
  const flightNumberSearchInput = document.getElementById("flightNumberSearch");
  const flightNumberSearch = flightNumberSearchInput ? flightNumberSearchInput.value.toLowerCase() : '';
  const fromDateInput = document.getElementById("fromDate").value;
  const toDateInput = document.getElementById("toDate").value;
  const showArchive = document.getElementById("archiveCheckbox") ? document.getElementById("archiveCheckbox").checked : false;

  const unconfirmedFlights = [];
  const confirmedFlights = [];

  let totalFlights = 0;
  let totalTonnage = 0;
  let totalConfirmedFlights = 0;
  let totalUnconfirmedFlights = 0;


  requestData.forEach(row => {
    const matchesRef = (row.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (row.Airline || '').toLowerCase().includes(airlineSearch);
    const matchesFlightNumber = (row.Flugnummer || '').toLowerCase().includes(flightNumberSearch);

    let matchesDateRange = true;
    let isPastOrTodayAndGoneFlight = false;

    let flightDateFromData = row['Flight Date'];
    let flightDateObj;

    // Robust parsing of the date to avoid timezone issues
    if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) { // Expects YYYY-MM-DD from backend
        const parts = flightDateFromData.split('-');
        flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (flightDateFromData instanceof Date) { // If it's already a Date object
        flightDateObj = new Date(flightDateFromData.getFullYear(), flightDateFromData.getMonth(), flightDateFromData.getDate());
    } else {
        flightDateObj = new Date('Invalid Date');
    }
    flightDateObj.setHours(0, 0, 0, 0); // Ensure time is set to midnight

    if (flightDateObj && !isNaN(flightDateObj.getTime())) {
      if (flightDateObj < today) {
          isPastOrTodayAndGoneFlight = true;
      } else if (flightDateObj.getTime() === today.getTime()) {
          const abflugzeit = row['Abflugzeit'];
          if (abflugzeit) {
              let flightTimeAsDate = new Date();
              if (typeof abflugzeit === 'string' && abflugzeit.match(/^\d{2}:\d{2}$/)) { // Expects HH:MM from backend
                  const [hours, minutes] = abflugzeit.split(':').map(Number);
                  flightTimeAsDate.setHours(hours, minutes, 0, 0);
              } else if (abflugzeit instanceof Date) {
                  flightTimeAsDate = abflugzeit;
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

    if (matchesRef && matchesAirline && matchesFlightNumber && matchesDateRange && passesPastFlightFilter) {
        totalFlights++;
        totalTonnage += parseFloat(row.Tonnage || 0);

        if (String(row['Final Confirmation Sent'] || '').toLowerCase() === 'ja') {
            confirmedFlights.push(row);
            totalConfirmedFlights++;
        } else {
            unconfirmedFlights.push(row);
            totalUnconfirmedFlights++;
        }
    }
  });

  // Render the tables separately
  renderTable(unconfirmedFlights, 'dataTableUnconfirmed');
  renderTable(confirmedFlights, 'dataTableConfirmed');

  // Update summaries
  document.getElementById('summaryInfo').textContent = `Total Flights: ${totalFlights} | Total Tonnage: ${totalTonnage.toLocaleString('de-DE')} kg`;
  document.getElementById('summaryInfoUnconfirmed').textContent = `Unconfirmed Flights: ${totalUnconfirmedFlights}`;
  document.getElementById('summaryInfoConfirmed').textContent = `Confirmed Flights: ${totalConfirmedFlights}`;

  renderCalendars(); // Also re-render calendars after filtering
}

// === MODAL FUNCTIONS ===
function openModal(originalIndex) {
  if (!currentUser) {
      console.error("Attempt to open modal without logged-in user. Redirecting to login.");
      showSaveFeedback("Please log in to use this function.", false);
      setTimeout(() => { window.location.href = 'login.html'; }, 1500); // Redirect after message
      return;
  }

  const r = originalIndex === -1 ? {
    Ref: generateReference(),
    'Created At': new Date().toLocaleString('de-DE'),
    'Billing Company': "", 'Billing Address': "", 'Tax Number': "",
    'Contact Name Invoicing': "", 'Contact E-Mail Invoicing': "",
    'Airline': "", 'Aircraft Type': "", 'Flugnummer': "",
    'Call Sign': "", // NEW: Call Sign field
    'Flight Date': "", 'Abflugzeit': "", 'Tonnage': "",
    'Rate': "", 'Security charges': "", "Dangerous Goods": "Nein",
    '10ft consumables': "", '20ft consumables': "",
    'Zusatzkosten': "", 'Email Request': "",
    'AGB Accepted': "Ja",
    'Service Description Accepted': "Ja",
    'Accepted By Name': "",
    'Acceptance Timestamp': "",
    'Final Confirmation Sent': "Nein",
    'Flight Type Import': "Nein",
    'Flight Type Export': "Nein",
    'Origin': '',
    'Destination': ''
  } : requestData[originalIndex];

  // Store current data in modal for later use with email
  currentModalData = r;

  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "";

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
      // These fields should be completely invisible for viewers.
      const isPriceRelatedOrZusatzkostenField = [
        'Rate', 'Security charges', 'Dangerous Goods',
        '10ft consumables', '20ft consumables', 'Zusatzkosten'
      ].includes(key);

      // If the user is a viewer and it's a price-specific field, skip it.
      if (isPriceRelatedOrZusatzkostenField && currentUser.role === 'viewer') {
          return ''; // Empty string to completely skip the field
      }
      // For admins, these fields are editable unless they are in isAlwaysReadOnlyField.


      if (key === "Flight Date") {
        let dateValue = "";
        if (value) {
            try {
                // Parse date to display correctly in input (YYYY-MM-DD format)
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
          // Always display a green checkmark, as the customer MUST accept the GTC to send a request.
          const icon = '&#10004;'; // Green checkmark
          const color = 'green';
          return `<label>${label}: <span style="color: ${color}; font-size: 1.2em; font-weight: bold;">${icon}</span></label>`;
      } else if (key === "Vorfeldbegleitung" && type === "checkbox") {
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}"> ${label}</label>`;
      } else if (['Tonnage'].includes(key)) { // Tonnage can be seen and edited by viewers
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
          const statusText = String(value).toLowerCase() === 'ja' ? 'Yes (Sent)' : 'No (Not sent)';
          const statusColor = String(value).toLowerCase() === 'ja' ? 'green' : 'red';
          return `<label>${label}: <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></label>`;
      }
      return `<label>${label}:</label><input type="text" name="${key}" value="${value}" ${readOnlyAttr} style="${styleAttr}" />`;
    }).join("");
  };

  // NEW: FlightRadar24 Search Link
  const callSign = r['Call Sign'];
  if (callSign) {
      const flightRadarLinkDiv = document.createElement("div");
      flightRadarLinkDiv.style.width = "100%";
      flightRadarLinkDiv.style.marginBottom = "20px";
      flightRadarLinkDiv.innerHTML = `
          <p style="text-align: center; font-weight: bold;">
              <a href="https://www.flightradar24.com/${callSign}" target="_blank" style="color: #007bff; text-decoration: underline;">
                  Search Call Sign on FlightRadar24: ${callSign}
              </a>
          </p>
      `;
      modalBody.appendChild(flightRadarLinkDiv);
  }


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
    { label: "Final Confirmation Sent", key: "Final Confirmation Sent" }
  ];

  const flightFields = [
    { label: "Airline", key: "Airline" },
    { label: "Aircraft Type", key: "Aircraft Type" },
    { label: "Flugnummer", key: "Flugnummer" },
    { label: "Call Sign", key: "Call Sign" }, // NEW: Call Sign field
    { label: "Flight Date", key: "Flight Date" },
    { label: "Abflugzeit", key: "Abflugzeit" },
    { label: "Tonnage", key: "Tonnage" },
    { label: "Vorfeldbegleitung", key: "Vorfeldbegleitung", type: "checkbox" },
    { label: "Flight Type Import", key: "Flight Type Import", type: "checkbox" },
    { label: "Flight Type Export", key: "Flight Type Export", type: "checkbox" },
    { label: "E-Mail Request", key: "Email Request" }
  ];

  // Price-related fields, visible only for Admins
  const priceFields = [
    { label: "Rate", key: "Rate" },
    { label: "Security charges (X-Ray, ETD, EDD)", key: "Security charges" },
    { label: "Dangerous Goods", key: "Dangerous Goods" },
    { label: "10ft consumables", key: "10ft consumables" },
    { label: "20ft consumables", key: "20ft consumables" },
    { label: "Zusatzkosten", key: "Zusatzkosten", type: "textarea" }
  ];

  // Add sections with specific background colors
  modalBody.appendChild(section("Customer Details", renderFields(customerFields), 'bg-blue-50'));
  modalBody.appendChild(section("Flight Details", renderFields(flightFields), 'bg-green-50'));

  // Display price details only for Admins
  if (currentUser && currentUser.role === 'admin') {
    let priceDetailsHTML = priceFields.map(({ label, key, type }) => {
        let value = r[key] || "";
        if (key === "Zusatzkosten") {
            return `<label>${label}:</label><textarea name="${key}" placeholder="Labeling, Photos" style="height:80px">${value}</textarea>`;
        } else if (key === "Dangerous Goods") {
            const options = ["Ja", "Nein", "N/A"];
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

  const buttonContainer = document.createElement("div");
  buttonContainer.style.width = "100%";
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "center";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.marginTop = "20px";

  // Save button is available for all logged-in users
  if (currentUser) {
    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.onclick = saveDetails;
    saveButton.style.padding = "10px 20px";
    saveButton.style.fontWeight = "bold";
    saveButton.style.backgroundColor = "#28a745";
    saveButton.style.color = "white";
    saveButton.style.border = "none";
    saveButton.style.borderRadius = "6px";
    saveButton.style.cursor = "pointer";
    buttonContainer.appendChild(saveButton);
  }

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

  if (currentUser && originalIndex !== -1) { // Button for all roles, if an entry is open
      const sendConfirmationButton = document.createElement("button");
      sendConfirmationButton.textContent = "Send Final Charter Confirmation";
      sendConfirmationButton.style.padding = "10px 20px";
      sendConfirmationButton.style.fontWeight = "bold";
      sendConfirmationButton.style.backgroundColor = "#007BFF"; // Blue for Send
      sendConfirmationButton.style.color = "white";
      sendConfirmationButton.style.border = "none";
      sendConfirmationButton.style.borderRadius = "6px";
      sendConfirmationButton.style.cursor = "pointer";
      sendConfirmationButton.onclick = () => openEmailConfirmationModal(r); // Pass current data
      buttonContainer.appendChild(sendConfirmationButton);
  }

  if (currentUser && currentUser.role === 'admin' && originalIndex !== -1) {
    const deleteButtonModal = document.createElement("button");
    deleteButtonModal.textContent = "Delete Entry";
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

// NEW: Function to toggle Origin/Destination fields based on checkbox
function toggleOriginDestinationFields(checkbox, fieldType) {
    const parentLabel = checkbox.closest('label');
    let inputElement = parentLabel.nextElementSibling; // Try to find the next sibling element

    // If it's not an input element or not the right one, search for it
    if (!inputElement || (inputElement.tagName !== 'INPUT' && inputElement.tagName !== 'LABEL')) {
        // Search within the same modal-section div
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

            parentLabel.parentNode.insertBefore(newLabel, parentLabel.nextSibling);
            newLabel.parentNode.insertBefore(newInput, newLabel.nextSibling);
        } else {
            // If the field already exists, make sure it's visible
            inputElement.style.display = '';
            inputElement.previousElementSibling.style.display = ''; // Also show label
        }
    } else {
        // If the checkbox is unchecked, hide the field
        if (inputElement && inputElement.name === fieldType) {
            inputElement.style.display = 'none';
            inputElement.previousElementSibling.style.display = 'none'; // Also hide label
        }
        // Optional: Clear the field's value when hidden
        if (currentModalData) {
            currentModalData[fieldType] = '';
        }
    }
}


// New function that starts the deletion process from the modal and then closes the modal
async function deleteRowFromModal(ref) {
  // Use a custom confirmation instead of alert() as alert() doesn't work well in iframes
  const isConfirmed = confirm(`Do you really want to delete the entry with reference "${ref}"? This action cannot be undone.`);
  if (!isConfirmed) {
    return;
  }

  const data = {
    Ref: ref,
    mode: "delete",
    user: currentUser.name
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const responseData = await response.json();

    if (responseData && responseData.status === "success") {
      showSaveFeedback("Entry deleted!", true);
    } else {
      showSaveFeedback(`Error deleting entry! ${responseData.message || ''}`, false);
      console.error("Deletion failed:", responseData);
    }
    closeModal();
    fetchData();
  } catch (err) {
    showSaveFeedback("Error deleting!", false);
    console.error(err);
  }
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeHistoryModal();
    closeProfileModal();
    closeStatisticsModal(); // NEW: Close statistics modal
    closeEmailConfirmationModal(); // NEW: Close email confirmation modal
    closeEmailPreviewModal(); // NEW: Close email preview modal
  }
});

async function saveDetails() {
  // Use a custom confirmation instead of alert()
  const isConfirmed = confirm('Are you sure you want to save these changes?');
  if (!isConfirmed) {
    return;
  }

  const inputs = document.querySelectorAll("#modalBody input[name]:not([disabled]), #modalBody textarea[name]:not([disabled]), #modalBody select[name]:not([disabled])");
  const data = {};
  inputs.forEach(i => {
    if (i.name === "Flight Date") {
        data[i.name] = i.value;
    } else if (['Tonnage', 'Rate', 'Security charges', '10ft consumables', '20ft consumables'].includes(i.name)) {
        // Tonnage and price fields: Replace commas with dots and remove Euro symbol and spaces
        data[i.name] = i.value.replace(/,/g, '.').replace('€', '').trim() || "";
    } else { // Important: For 'Zusatzkosten' (textarea) the value simply comes as a string.
        if (i.type === "checkbox") {
            data[i.name] = i.checked ? "Ja" : "Nein";
        } else {
            data[i.name] = i.value;
        }
    }
  });

  const refValue = document.querySelector("#modalBody input[name='Ref']").value;
  data.mode = "write";
  data.user = currentUser.name;

  console.log('Payload for saving:', data);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const responseData = await response.json();

    if (responseData && responseData.status === "success") {
      showSaveFeedback("Saved!", true);
    } else {
      showSaveFeedback(`Error saving! ${responseData.message || ''}`, false);
      console.error("Save failed:", responseData);
    }
    closeModal();
    fetchData();
  } catch (err) {
    showSaveFeedback("Error saving!", false);
    console.error(err);
  }
}

async function deleteRow(btn) {
  const ref = btn.closest("tr").querySelector("a").textContent;

  // Use a custom confirmation instead of alert()
  const isConfirmed = confirm(`Do you really want to delete the entry with reference "${ref}"? This action cannot be undone.`);
  if (!isConfirmed) {
    return;
  }

  const data = {
    Ref: ref,
    mode: "delete",
    user: currentUser.name
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const responseData = await response.json();

    if (responseData && responseData.status === "success") {
      showSaveFeedback("Entry deleted!", true);
    } else {
      showSaveFeedback(`Error deleting entry! ${responseData.message || ''}`, false);
      console.error("Deletion failed:", responseData);
    }
    fetchData();
  } catch (err) {
    showSaveFeedback("Error deleting!", false);
    console.error(err);
  }
}

// === CALENDAR FUNCTIONS ===
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

function openCalendarDayFlights(year, month, day) {
  console.log(`Clicked on calendar day: Year ${year}, Month ${month + 1}, Day ${day}`);

  // Create the comparison date as a string (YYYY-MM-DD)
  const clickedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const flightsOnThisDay = requestData.filter(r => {
    let flightDateFromData = r['Flight Date']; // This is already YYYY-MM-DD from the backend

    // Simple string comparison
    const isMatch = flightDateFromData === clickedDateStr;
    console.log(`  Comparison: Flight Date "${flightDateFromData}" vs. Clicked Date "${clickedDateStr}" -> Match: ${isMatch}`);
    return isMatch;
  });

  console.log(`Flights found for this day (${clickedDateStr}):`, flightsOnThisDay);

  if (flightsOnThisDay.length > 0) {
    // If multiple flights on the same day, open the first one found.
    // Ideally, a list or selection would be better, but for now we open the first.
    const firstFlight = flightsOnThisDay[0];
    const originalIndex = requestData.findIndex(item => item.Ref === firstFlight.Ref);
    console.log(`First Flight Ref: ${firstFlight.Ref}, Original Index: ${originalIndex}`);

    if (originalIndex !== -1) {
      openModal(originalIndex);
    } else {
      console.warn("Could not find original index of flight:", firstFlight);
    }
  } else {
      console.log("No flights found for this day.");
  }
}

function generateCalendarHTML(year, month) {
  const firstDayOfMonthWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('de-DE', { month: 'long' });
  let html = `<div class="calendar-block"><h3>${monthName} ${year}</h3><table><thead><tr><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th></tr></thead><tbody>`;
  let day = 1;

  const today = new Date(); // Get today's date
  today.setHours(0, 0, 0, 0); // Reset time for accurate date comparison

  const flightsByDay = new Map();
  requestData.forEach((r) => {
    let flightDate = r['Flight Date'];
    if (typeof flightDate === 'string' && flightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [fYear, fMonth, fDay] = flightDate.split('-').map(Number);
        if (fYear === year && (fMonth - 1) === month) {
            if (!flightsByDay.has(fDay)) {
              flightsByDay.set(fDay, []);
            }
            flightsByDay.get(fDay).push(r);
        }
    }
  });

  for (let i = 0; i < 6; i++) {
    html += "<tr>";
    for (let j = 0; j < 7; j++) {
      if ((i === 0 && j < firstDayOfMonthWeekday) || day > daysInMonth) {
        html += "<td class='empty'></td>";
      } else {
        const currentCalendarDayForCell = new Date(year, month, day);
        currentCalendarDayForCell.setHours(0,0,0,0);

        const flightsForDay = flightsByDay.get(day) || [];
        let cellClasses = ['calendar-day'];
        let tooltipContentArray = [];
        let simpleTitleContent = '';
        let dayHasVorfeldbegleitung = false;

        // NEW: Import/Export Status for the day
        let hasImport = false;
        let hasExport = false;


        // Check if current day is today and add 'today' class
        if (currentCalendarDayForCell.getTime() === today.getTime()) {
            cellClasses.push('today');
        }

        if (flightsForDay.length > 0) {
          flightsForDay.forEach(f => {
            const tonnageValue = parseFloat(String(f.Tonnage).replace(',', '.') || "0") || 0;

            let formattedAbflugzeit = f['Abflugzeit'] || '-';
            if (typeof formattedAbflugzeit === 'string' && formattedAbflugzeit.match(/^\d{2}:\d{2}$/)) {
            } else if (formattedAbflugzeit instanceof Date) {
                formattedAbflugzeit = formattedAbflugzeit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            } else if (typeof formattedAbflugzeit === 'string' && formattedAbflugzeit.includes('T')) {
                try {
                    const timeObj = new Date(formattedAbflugzeit);
                    if (!isNaN(timeObj.getTime())) {
                        formattedAbflugzeit = timeObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    }
                } catch (e) {
                    console.error("Error formatting departure time for tooltip:", formattedAbflugzeit, e);
                }
            }


            tooltipContentArray.push(
              `Ref: ${f.Ref || '-'}` +
              `\nAirline: ${f.Airline || '-'}` +
              `\nFlight Number: ${f.Flugnummer || '-'}` +
              `\nCall Sign: ${f['Call Sign'] || '-'}` + // NEW: Call Sign in tooltip
              `\nDeparture Time: ${formattedAbflugzeit}` +
              `\nTonnage: ${tonnageValue.toLocaleString('de-DE')} kg`
            );
            if (f.Origin) { // NEW: Add Origin to tooltip
                tooltipContentArray[tooltipContentArray.length - 1] += `\nOrigin: ${f.Origin}`;
            }
            if (f.Destination) { // NEW: Add Destination to tooltip
                tooltipContentArray[tooltipContentArray.length - 1] += `\nDestination: ${f.Destination}`;
            }

            if (f['Vorfeldbegleitung'] && String(f['Vorfeldbegleitung']).toLowerCase() === 'ja') {
              dayHasVorfeldbegleitung = true;
            }
            // NEW: Check Import/Export status
            if (String(f['Flight Type Import'] || '').toLowerCase() === 'ja') {
                hasImport = true;
            }
            if (String(f['Flight Type Export'] || '').toLowerCase() === 'ja') {
                hasExport = true;
            }
          });
          simpleTitleContent = `Flights: ${flightsForDay.length}`;
        }

        // NEW: Add classes for calendar colors
        if (hasImport && hasExport) {
            cellClasses.push('import-export');
        } else if (hasImport) {
            cellClasses.push('import-only');
        } else if (hasExport) {
            cellClasses.push('export-only');
        } else if (flightsForDay.length > 0) {
            // If flights exist but neither import nor export is marked, default color for flights
            cellClasses.push('has-flights');
        }


        const dataTooltipContent = tooltipContentArray.join('\n\n').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
        const flightIcon = dayHasVorfeldbegleitung ? ' <span class="flight-icon">&#9992;</span>' : '';

        // Added styling for 'today' class here
        let dayNumberClass = '';
        if (currentCalendarDayForCell.getTime() === today.getTime()) {
            dayNumberClass = 'font-bold text-lg today-red-text'; // NEW: Class for red color
        } else {
            dayNumberClass = 'font-bold text-lg'; // Default class for the number
        }


        html += `<td class='${cellClasses.join(' ')}' title='${simpleTitleContent}' data-tooltip='${dataTooltipContent}' onclick="openCalendarDayFlights(${year}, ${month}, ${day})"><div class="${dayNumberClass}">${day}</div>${flightIcon}</td>`;
        day++;
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break;
  }
  html += "</tbody></table></div>";
  return html;
}

// === TIME AND DATE ===
document.addEventListener("DOMContentLoaded", () => {
  checkAuthStatus();
  updateClock();
  setInterval(updateClock, 1000);

  // The event listener for archiveCheckbox must remain here as it is not a global function.
  const archiveCheckbox = document.getElementById("archiveCheckbox");
  if (archiveCheckbox) {
      archiveCheckbox.addEventListener('change', filterTable);
  }
});

function updateClock() {
  const now = new Date();
  document.getElementById('currentDate').textContent = "Date: " + now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  document.getElementById('clock').textContent = "Time: " + now.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
}

// === CREATE NEW REQUEST ===
function generateReference() {
  const now = new Date();
  const timestamp = now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\./g, '').replace(/\//g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CC-${timestamp}-${random}`;
}

function createNewRequest() {
  openModal(-1);
}

// === DISPLAY FEEDBACK ===
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

// NEW FUNCTIONS FOR HISTORY MODAL
async function showHistory(ref) {
  const historyModal = document.getElementById("historyModal");
  const historyBody = document.getElementById("historyBody");
  const historyRefSpan = document.getElementById("historyRef");

  historyRefSpan.textContent = ref;
  historyBody.innerHTML = '<p style="text-align: center;">Loading history...</p>';
  historyModal.style.display = "flex";

  try {
    const response = await fetch(API_URL + "?mode=readAuditLog");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const auditResult = await response.json();

    const filteredLogs = auditResult.data.filter(log => log.Reference === ref);

    if (filteredLogs.length === 0) {
      historyBody.innerHTML = '<p style="text-align: center;">No history found for this reference.</p>';
      return;
    }

    let historyHTML = '<ul style="list-style-type: none; padding: 0;">';
    filteredLogs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)).forEach(log => {
      let detailsContent = log.Details || '-';

      // Only redact sensitive information for viewer role (this part remains as it concerns history)
      if (currentUser && currentUser.role === 'viewer' && typeof detailsContent === 'string') {
        const sensitiveFieldPrefixes = [
          'Rate:',
          'Security charges:',
          'Dangerous Goods:',
          '10ft consumables:',
          '20ft consumables:',
          'Zusatzkosten:'
        ];

        let processedDetailsParts = [];
        const detailParts = detailsContent.split(';').map(part => part.trim()).filter(part => part !== '');

        detailParts.forEach(part => {
            let redactedPart = part;
            for (const prefix of sensitiveFieldPrefixes) {
                if (part.startsWith(prefix)) {
                    redactedPart = `${prefix} [REDACTED]`;
                    break;
                }
            }
            processedDetailsParts.push(redactedPart);
        });
        detailsContent = processedDetailsParts.join('; ');
      }

      try {
          const parsedDetails = JSON.parse(detailsContent);
          if (typeof parsedDetails === 'object' && parsedDetails !== null) {
              detailsContent = 'Deleted data: <pre>' + JSON.stringify(parsedDetails, null, 2) + '</pre>';
          }
      } catch (e) {
          // Non-JSON strings are displayed directly as details
      }


      historyHTML += `
        <li style="background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; padding: 15px;">
          <strong style="color: #007BFF;">Timestamp:</strong> ${log.Timestamp || '-'} <br>
          <strong style="color: #007BFF;">User:</strong> ${log.User || '-'} <br>
          <strong style="color: #007BFF;">Action:</strong> ${log.Action || '-'} <br>
          <strong style="color: #007BFF;">Details:</strong> ${detailsContent}
        </li>
      `;
    });
    historyHTML += '</ul>';
    historyBody.innerHTML = historyHTML;

  } catch (error) {
    console.error("Error retrieving audit log:", error);
    historyBody.innerHTML = '<p style="color: red; text-align: center;">Error loading history: ' + error.message + '</p>';
  }
}

function closeHistoryModal() {
  document.getElementById("historyModal").style.display = "none";
}

// === NEW STATISTICS FUNCTIONS ===
function openStatisticsModal() {
    const statisticsModal = document.getElementById('statisticsModal');
    if (statisticsModal) {
        statisticsModal.style.display = 'flex';
        // Set default date range to current month if not already set
        const statFromDateInput = document.getElementById('statFromDate');
        const statToDateInput = document.getElementById('statToDate');
        if (!statFromDateInput.value || !statToDateInput.value) {
            const now = new Date();
            // First day of current month
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            // Last day of current month (goes to next month and then to 0th day)
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

            statFromDateInput.value = firstDayOfMonth;
            statToDateInput.value = lastDayOfMonth;
        }

        generateStatistics(); // Generate statistics on open
    } else {
        console.warn("Statistics modal (id='statisticsModal') not found.");
    }
}

function closeStatisticsModal() {
    document.getElementById("statisticsModal").style.display = "none";
    // Optional: Destroy charts on modal close to free up memory
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

    // Remove old non-chart content to make space for new statistics
    // NOTE: Only dynamically added elements are removed here.
    // Static chart containers remain.
    const elementsToRemove = statisticsBody.querySelectorAll('h4, p, ul, table');
    elementsToRemove.forEach(el => {
        // Ensure only elements added by generateStatistics are removed
        // and not the static chart containers
        if (!el.classList.contains('chart-container') && el.tagName !== 'CANVAS') {
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
        // Ensure item['Dangerous Goods'] is always a string before calling toLowerCase
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

    // --- RENDER TEXT-BASED STATISTICS ---
    let statsHTML = '<h4>Overall Summary</h4>';
    statsHTML += `<p>Total Flights: <strong>${totalFlights}</strong></p>`;
    statsHTML += `<p>Total Tonnage: <strong>${totalTonnage.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg</strong></p>`;


    statsHTML += '<h4>Dangerous Goods Statistics</h4>';
    statsHTML += `<ul>`;
    statsHTML += `<li>Yes: ${dangerousGoodsCount["Ja"]} (${(dangerousGoodsCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    statsHTML += `<li>No: ${dangerousGoodsCount["Nein"]} (${(dangerousGoodsCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    if (dangerousGoodsCount["N/A"] > 0) {
        statsHTML += `<li>Not specified: ${dangerousGoodsCount["N/A"]} (${(dangerousGoodsCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    }
    statsHTML += `</ul>`;

    statsHTML += '<h4>Vorfeldbegleitung Statistics</h4>';
    statsHTML += `<ul>`;
    statsHTML += `<li>Yes: ${VorfeldbegleitungCount["Ja"]} (${(VorfeldbegleitungCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    statsHTML += `<li>No: ${VorfeldbegleitungCount["Nein"]} (${(VorfeldbegleitungCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    if (VorfeldbegleitungCount["N/A"] > 0) {
        statsHTML += `<li>Not specified: ${VorfeldbegleitungCount["N/A"]} (${(VorfeldbegleitungCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    }
    statsHTML += `</ul>`;


    statsHTML += '<h4>Statistics by Airline</h4>';
    if (Object.keys(airlineStats).length > 0) {
        statsHTML += `<table><thead><tr><th>Airline</th><th>Flights</th><th>Tonnage (kg)</th>`;
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

    // Insert text-based statistics before the charts
    const firstChartContainer = statisticsBody.querySelector('.chart-container');
    if (firstChartContainer) {
        firstChartContainer.insertAdjacentHTML('beforebegin', statsHTML);
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

    // Destroy previous chart instance if it exists
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

    // Destroy previous chart instance if it exists
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
            },
            plugins: {
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
        showSaveFeedback("Statistics successfully downloaded!", true);
    } else {
        // Fallback for browsers that do not support the download attribute (less likely today)
        showSaveFeedback("Your browser does not support direct download. Please copy the text manually.", false);
        console.warn("Download attribute not supported. Fallback required.");
    }
}

// === NEW EMAIL CONFIRMATION FUNCTIONS ===
function openEmailConfirmationModal(data) {
    // Set the current data object for the email function
    currentModalData = data;
    const emailConfirmationModal = document.getElementById('emailConfirmationModal');
    const recipientEmailInput = document.getElementById('recipientEmailInput');
    const emailConfirmationMessage = document.getElementById('emailConfirmationMessage');

    // Try to pre-fill the customer's email address
    if (currentModalData && currentModalData['Contact E-Mail Invoicing']) {
        recipientEmailInput.value = currentModalData['Contact E-Mail Invoicing'];
    } else {
        recipientEmailInput.value = '';
    }
    emailConfirmationMessage.textContent = ''; // Clear old messages
    emailConfirmationModal.style.display = 'flex';
}

function closeEmailConfirmationModal() {
    document.getElementById('emailConfirmationModal').style.display = 'none';
    document.getElementById('recipientEmailInput').value = ''; // Clear input field
    document.getElementById('emailConfirmationMessage').textContent = ''; // Clear message
}

document.getElementById('sendEmailConfirmBtn').addEventListener('click', async () => {
    const recipientEmailInput = document.getElementById('recipientEmailInput');
    const emailConfirmationMessage = document.getElementById('emailConfirmationMessage');
    const recipientEmail = recipientEmailInput.value.trim();

    if (!recipientEmail) {
        emailConfirmationMessage.textContent = 'Please enter a recipient email address.';
        emailConfirmationMessage.style.color = 'red';
        return;
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
        emailConfirmationMessage.textContent = 'Please enter a valid email address.';
        emailConfirmationMessage.style.color = 'red';
        return;
    }

    // Disable the button while sending
    const sendButton = document.getElementById('sendEmailConfirmBtn');
    sendButton.disabled = true;
    sendButton.textContent = 'Sending...';
    emailConfirmationMessage.textContent = 'Sending email...';
    emailConfirmationMessage.style.color = 'blue';

    try {
        const emailSubject = `Charter Confirmation for Reference: ${currentModalData.Ref || 'N/A'}`;
        
        // Create the payload and add ALL data from currentModalData
        const payload = {
            mode: 'sendConfirmationEmail',
            to: recipientEmail,
            from: 'sales@vgcargo.de', // Fixed sender address
            bcc: 'sales@vgcargo.de, import@vgcargo.de, export@vgcargo.de', // Fixed BCC addresses
            subject: emailSubject,
            ref: currentModalData.Ref, // Reference for audit log
            user: currentUser.name // Current user for audit log
        };

        // Add all properties of currentModalData to the payload
        for (const key in currentModalData) {
            // Ensure we don't overwrite existing payload properties
            // and that Date objects are sent correctly as strings
            if (!payload.hasOwnProperty(key)) {
                if (currentModalData[key] instanceof Date) {
                    // For Flight Date and Acceptance Timestamp: YYYY-MM-DD or full string
                    if (key === 'Flight Date') {
                        payload[key] = currentModalData[key].toISOString().split('T')[0];
                    } else {
                        payload[key] = currentModalData[key].toLocaleString('de-DE'); // Or another suitable format
                    }
                } else {
                    payload[key] = currentModalData[key];
                }
            }
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload).toString(),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            emailConfirmationMessage.textContent = 'Charter Confirmation successfully sent!';
            emailConfirmationMessage.style.color = 'green';
            showSaveFeedback("Charter Confirmation sent!", true);
            // Mark the entry as "Final Confirmation Sent" = "Ja"
            const index = requestData.findIndex(item => item.Ref === currentModalData.Ref);
            if (index !== -1) {
                requestData[index]['Final Confirmation Sent'] = 'Ja';
                filterTable(); // Re-render table to show checkmark
            }
            // Close modal after a short delay
            setTimeout(() => {
                closeEmailConfirmationModal();
                closeModal(); // Also close the detail modal
                fetchData(); // Reload data to update history
            }, 1500);
        } else {
            emailConfirmationMessage.textContent = result.message || 'Error sending email.';
            emailConfirmationMessage.style.color = 'red';
            showSaveFeedback("Error sending confirmation!", false);
        }
    } catch (error) {
        console.error('Error sending email:', error);
        emailConfirmationMessage.textContent = 'An unexpected error occurred. Please try again later.';
        emailConfirmationMessage.style.color = 'red';
        showSaveFeedback("Error sending confirmation!", false);
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = 'Send';
    }
});

// NEW: Function to generate email body for preview
async function generateEmailPreview() {
    if (!currentModalData) {
        showSaveFeedback("No data available for email preview.", false);
        return;
    }

    const emailPreviewModal = document.getElementById('emailPreviewModal');
    const previewRefSpan = document.getElementById('previewRef');
    const emailPreviewContent = document.getElementById('emailPreviewContent');

    previewRefSpan.textContent = currentModalData.Ref || 'N/A';
    emailPreviewContent.innerHTML = '<p style="text-align: center;">Loading preview...</p>'; // Loading indicator
    emailPreviewModal.style.display = 'flex';

    try {
        // Call the server to generate the email body
        const payload = {
            mode: 'generateEmailBody',
            data: JSON.stringify(currentModalData), // Send data as JSON string
            userRole: currentUser.role // Send user's role
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload).toString(),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success' && result.emailBody) {
            emailPreviewContent.innerHTML = result.emailBody; // Render HTML directly
        } else {
            emailPreviewContent.innerHTML = `<p style="color: red; text-align: center;">${result.message || 'Error generating email preview.'}</p>`;
        }
    } catch (error) {
        console.error('Error generating email preview:', error);
        emailPreviewContent.innerHTML = '<p style="color: red; text-align: center;">An unexpected error occurred while generating the preview.</p>';
    }
}

function closeEmailPreviewModal() {
    document.getElementById('emailPreviewModal').style.display = 'none';
    document.getElementById('emailPreviewContent').innerHTML = ''; // Clear content
}

// Event Listener for the preview button
document.getElementById('previewEmailBtn').addEventListener('click', generateEmailPreview);

// NEW: Function to manually mark as "Final Confirmation Sent"
async function markAsSentManually() {
    if (!currentModalData || !currentModalData.Ref) {
        showSaveFeedback("No reference data available to mark.", false);
        return;
    }

    const refToMark = currentModalData.Ref;
    const user = currentUser.name;

    // Confirmation dialog
    const isConfirmed = confirm(`Do you really want to manually mark the Charter Confirmation for reference "${refToMark}" as 'sent'?`);
    if (!isConfirmed) {
        return;
    }

    try {
        const payload = {
            mode: 'markAsConfirmed', // New mode for Google Apps Script
            ref: refToMark,
            user: user
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload).toString(),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            showSaveFeedback(`Reference ${refToMark} marked as 'sent'!`, true);
            // Update local data status and re-render table
            const index = requestData.findIndex(item => item.Ref === refToMark);
            if (index !== -1) {
                requestData[index]['Final Confirmation Sent'] = 'Ja';
                filterTable(); // Re-render table to show checkmark
            }
            closeEmailPreviewModal(); // Close preview modal
            closeModal(); // Close detail modal
            fetchData(); // Reload data to ensure everything is in sync
        } else {
            showSaveFeedback(result.message || 'Error marking as sent.', false);
        }
    } catch (error) {
        console.error('Error manually marking as sent:', error);
        showSaveFeedback('An error occurred while marking as sent.', false);
    }
}

// Event Listener for the new "Charter Confirmation sent" button
document.getElementById('markAsSentBtn').addEventListener('click', markAsSentManually);


// --- IMPORTANT CORRECTION: Make functions globally accessible ---
// If script.js is loaded as type="module", functions are
// by default not available in the global "window" scope,
// unless explicitly exported or assigned.
// For HTML onclick attributes, assignment to "window" is required.
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.changePassword = changePassword;
window.logoutUser = logoutUser;
window.fetchData = fetchData;
window.renderTable = renderTable;
window.filterTable = filterTable;
window.openModal = openModal;
window.deleteRowFromModal = deleteRowFromModal;
window.closeModal = closeModal;
window.saveDetails = saveDetails;
window.deleteRow = deleteRow;
window.shiftCalendar = shiftCalendar;
window.renderCalendars = renderCalendars;
window.openCalendarDayFlights = openCalendarDayFlights;
window.generateCalendarHTML = generateCalendarHTML;
window.createNewRequest = createNewRequest;
window.showSaveFeedback = showSaveFeedback;
window.showHistory = showHistory;
window.closeHistoryModal = closeHistoryModal;
window.openStatisticsModal = openStatisticsModal; // Make new function globally accessible
window.closeStatisticsModal = closeStatisticsModal; // Make new function globally accessible
window.generateStatistics = generateStatistics; // Make new function globally accessible
window.renderTonnagePerMonthChart = renderTonnagePerMonthChart; // Make new function globally accessible
window.renderTonnagePerCustomerChart = renderTonnagePerCustomerChart; // Make new function globally accessible
window.downloadStatisticsToCSV = downloadStatisticsToCSV; // Make new download function globally accessible
window.openEmailConfirmationModal = openEmailConfirmationModal; // NEW: Open email confirmation modal
window.closeEmailConfirmationModal = closeEmailConfirmationModal; // NEW: Close email confirmation modal
window.toggleOriginDestinationFields = toggleOriginDestinationFields; // NEW: Make function globally accessible
window.generateEmailPreview = generateEmailPreview; // NEW: Function for email preview
window.closeEmailPreviewModal = closeEmailPreviewModal; // NEW: Function to close email preview
window.markAsSentManually = markAsSentManually; // NEW: Function to manually mark as sent
// Initialize Auth status once DOM is loaded.
// This is executed after the window.onload event, but before polling.
checkAuthStatus();
