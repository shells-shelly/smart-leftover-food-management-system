"use strict";

/*
 FoodBridge frontend prototype.
 Data is saved in this browser's localStorage.
 Connect to Flask + SQLite for real multi-user operation.
*/

const KEYS = {
  users: "foodbridge_users",
  foods: "foodbridge_foods",
  session: "foodbridge_session"
};

const $ = (id) => document.getElementById(id);

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let users = read(KEYS.users, []);
let foods = read(KEYS.foods, []);
let session = read(KEYS.session, null);
let authMode = "login";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function currentUser() {
  return session ? users.find(u => u.id === session.userId) || null : null;
}

function persistUsers() { save(KEYS.users, users); }
function persistFoods() { save(KEYS.foods, foods); }

function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add("hidden"), 3200);
}

function openModal(id) {
  $(id).classList.remove("hidden");
}

function closeModal(id) {
  $(id).classList.add("hidden");
}

function showError(id, message) {
  $(id).textContent = message;
  $(id).classList.remove("hidden");
}

function clearError(id) {
  $(id).textContent = "";
  $(id).classList.add("hidden");
}

function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short",
    year: "numeric", hour: "numeric", minute: "2-digit"
  });
}

function isExpired(food) {
  return food.status === "Available" &&
    food.pickupTime && new Date(food.pickupTime).getTime() < Date.now();
}

function effectiveStatus(food) {
  if (isExpired(food)) return "Expired";
  return food.status;
}

function badge(status) {
  const className = status.toLowerCase();
  return `<span class="status ${esc(className)}">${esc(status)}</span>`;
}

function donorName(food) {
  const donor = users.find(u => u.id === food.donorId);
  return donor ? donor.orgName : "Registered donor";
}

function foodEmoji(name) {
  const n = name.toLowerCase();
  if (n.includes("rice") || n.includes("pulao") || n.includes("khichuri")) return "🍚";
  if (n.includes("roti") || n.includes("chapati") || n.includes("luchi")) return "🫓";
  if (n.includes("dal") || n.includes("lentil")) return "🥣";
  if (n.includes("chicken") || n.includes("meat")) return "🍗";
  if (n.includes("fish")) return "🐟";
  if (n.includes("egg")) return "🥚";
  if (n.includes("fruit")) return "🍎";
  if (n.includes("vegetable") || n.includes("sabzi")) return "🥗";
  return "🍲";
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  clearError("authError");
  $("authForm").reset();
  $("userRole").value = "Donor";
  updateDonorTypeVisibility();
  openModal("authModal");
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  $("authTitle").textContent = registering ? "Create your account" : "Welcome back";
  $("authDescription").textContent = registering
    ? "Join the FoodBridge community."
    : "Login to continue to your dashboard.";
  $("authSubmit").textContent = registering ? "Create account" : "Login";
  $("registerFields").classList.toggle("hidden", !registering);
  document.querySelectorAll("[data-auth-tab]").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.authTab === mode);
  });
  $("password").autocomplete = registering ? "new-password" : "current-password";
}

function updateDonorTypeVisibility() {
  const isDonor = $("userRole").value === "Donor";
  $("donorTypeGroup").classList.toggle("hidden", !isDonor);
}

function handleRegister() {
  const orgName = $("orgName").value.trim();
  const role = $("userRole").value;
  const donorType = $("donorType").value;
  const phone = $("phone").value.trim();
  const address = $("address").value.trim();
  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;

  if (!orgName || !phone || !address) {
    return showError("authError", "Please fill in all organization details.");
  }
  if (!/^[0-9+()\-\s]{7,15}$/.test(phone)) {
    return showError("authError", "Please enter a valid phone number.");
  }
  if (users.some(u => u.email === email)) {
    return showError("authError", "An account with this email already exists.");
  }

  const user = {
    id: uid(), orgName, role,
    donorType: role === "Donor" ? donorType : "",
    phone, address, email,
    password,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  persistUsers();
  session = { userId: user.id };
  save(KEYS.session, session);
  closeModal("authModal");
  updateApp();
  toast("Account created successfully.");
}

function handleLogin() {
  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;

  // Local demo admin account. This is NOT secure authentication.
  if (email === "admin@foodbridge.local" && password === "Admin123!") {
    session = { userId: "demo-admin" };
    save(KEYS.session, session);
    closeModal("authModal");
    updateApp();
    toast("Admin demo login successful.");
    return;
  }

  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return showError("authError", "Invalid email or password.");
  }

  session = { userId: user.id };
  save(KEYS.session, session);
  closeModal("authModal");
  updateApp();
  toast("Login successful.");
}

function isAdmin() {
  return session?.userId === "demo-admin";
}

function updateApp() {
  const user = currentUser();
  const loggedIn = Boolean(user || isAdmin());

  $("authBanner").classList.toggle("hidden", loggedIn);
  $("dashboard").classList.toggle("hidden", !loggedIn);
  $("navActions").innerHTML = loggedIn
    ? `<span class="role-pill">${isAdmin() ? "Admin" : esc(user.role)}</span>
       <button class="btn btn-outline" id="navDashboard">Dashboard</button>`
    : `<button class="btn btn-outline" id="loginNav">Login</button>
       <button class="btn btn-primary" id="registerNav">Get Started</button>`;

  $("statTotal").textContent = foods.length;
  $("statAvailable").textContent = foods.filter(f => effectiveStatus(f) === "Available").length;
  $("statClaimed").textContent = foods.filter(f => effectiveStatus(f) === "Claimed").length;
  $("statDonors").textContent = users.filter(u => u.role === "Donor").length;

  if (loggedIn) renderDashboard();
  renderFoods();
}

function renderDashboard() {
  const user = currentUser();
  const admin = isAdmin();

  $("dashboardTitle").textContent = admin ? "Admin dashboard" : `${user.role} dashboard`;
  $("welcomeText").textContent = admin
    ? "Manage registered organizations and review donation activity."
    : `Welcome, ${user.orgName}. Manage your FoodBridge activity here.`;

  if (admin) return renderAdminDashboard();

  if (user.role === "Donor") return renderDonorDashboard(user);
  if (user.role === "NGO") return renderNgoDashboard(user);

  $("dashboardContent").innerHTML = `<p>Account role not recognized.</p>`;
}

function miniStat(label, value) {
  return `<div class="mini-stat"><span>${esc(label)}</span><strong>${value}</strong></div>`;
}

function renderDonorDashboard(user) {
  const mine = foods.filter(f => f.donorId === user.id);
  const available = mine.filter(f => effectiveStatus(f) === "Available").length;
  const claimed = mine.filter(f => effectiveStatus(f) === "Claimed").length;

  $("dashboardContent").innerHTML = `
    <div class="dashboard-cards">
      ${miniStat("My donations", mine.length)}
      ${miniStat("Available", available)}
      ${miniStat("Claimed", claimed)}
    </div>
    <div class="dashboard-subhead">
      <h3>My food donations</h3>
      <button class="btn btn-primary" id="addDonationBtn">+ Add donation</button>
    </div>
    <div id="donorTable"></div>
  `;

  $("addDonationBtn").addEventListener("click", openDonation);
  renderDonationTable(mine, "donorTable", true);
}

function renderNgoDashboard(user) {
  const claimed = foods.filter(f => f.claimedBy === user.id);
  const available = foods.filter(f => effectiveStatus(f) === "Available");

  $("dashboardContent").innerHTML = `
    <div class="dashboard-cards">
      ${miniStat("Available listings", available.length)}
      ${miniStat("My claims", claimed.length)}
      ${miniStat("Collected", claimed.filter(f => f.status === "Collected").length)}
    </div>
    <div class="dashboard-subhead"><h3>My claimed food</h3></div>
    <div id="ngoTable"></div>
    <div class="dashboard-subhead"><h3>Find food to collect</h3></div>
    <p class="food-donor" style="margin:0 0 12px">Browse available food below and select Claim food.</p>
  `;

  renderDonationTable(claimed, "ngoTable", false);
}

function renderAdminDashboard() {
  $("dashboardContent").innerHTML = `
    <div class="dashboard-cards">
      ${miniStat("Registered donors", users.filter(u => u.role === "Donor").length)}
      ${miniStat("Registered NGOs", users.filter(u => u.role === "NGO").length)}
      ${miniStat("All donations", foods.length)}
    </div>
    <div class="dashboard-subhead"><h3>Registered donors</h3></div>
    <div id="adminDonors"></div>
    <div class="dashboard-subhead"><h3>Registered NGOs</h3></div>
    <div id="adminNgos"></div>
    <div class="dashboard-subhead"><h3>All food donations</h3></div>
    <div id="adminFoods"></div>
    <p class="form-footnote">Admin view is a local prototype, not a secure access-controlled service.</p>
  `;

  renderUsersTable(users.filter(u => u.role === "Donor"), "adminDonors");
  renderUsersTable(users.filter(u => u.role === "NGO"), "adminNgos");
  renderDonationTable(foods, "adminFoods", false);
}

function renderUsersTable(list, targetId) {
  if (!list.length) {
    $(targetId).innerHTML = `<div class="empty-inline">No registered organizations yet.</div>`;
    return;
  }

  $(targetId).innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Organization</th><th>Type</th><th>Email</th><th>Phone</th><th>Address</th></tr></thead>
      <tbody>${list.map(u => `
        <tr>
          <td>${esc(u.orgName)}</td>
          <td>${esc(u.donorType || u.role)}</td>
          <td>${esc(u.email)}</td>
          <td>${esc(u.phone)}</td>
          <td>${esc(u.address)}</td>
        </tr>`).join("")}
      </tbody>
    </table></div>`;
}

function renderDonationTable(list, targetId, donorView) {
  if (!list.length) {
    $(targetId).innerHTML = `<div class="empty-inline">No records to display yet.</div>`;
    return;
  }

  $(targetId).innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Food</th><th>Donor</th><th>Quantity</th><th>Pickup deadline</th><th>Status</th><th>Action</th>
      </tr></thead>
      <tbody>${list.map(f => {
        const status = effectiveStatus(f);
        const claimedUser = users.find(u => u.id === f.claimedBy);
        let action = "—";

        if (donorView && status === "Available") {
          action = `<button class="btn btn-outline" data-remove="${esc(f.id)}">Remove</button>`;
        } else if (!donorView && !isAdmin() && currentUser()?.role === "NGO" && status === "Claimed" && f.claimedBy === currentUser().id) {
          action = `<button class="btn btn-primary" data-collected="${esc(f.id)}">Mark collected</button>`;
        }

        return `<tr>
          <td>${esc(f.foodName)}</td>
          <td>${esc(donorName(f))}</td>
          <td>${esc(f.quantity)} ${esc(f.unit)}</td>
          <td>${esc(formatDate(f.pickupTime))}</td>
          <td>${badge(status)}${claimedUser && isAdmin() ? `<br><small>${esc(claimedUser.orgName)}</small>` : ""}</td>
          <td>${action}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;

  $(targetId).querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => removeDonation(btn.dataset.remove));
  });
  $(targetId).querySelectorAll("[data-collected]").forEach(btn => {
    btn.addEventListener("click", () => markCollected(btn.dataset.collected));
  });
}

function openDonation() {
  $("donationForm").reset();
  clearError("donationError");

  const minTime = new Date(Date.now() + 5 * 60 * 1000);
  minTime.setMinutes(minTime.getMinutes() - minTime.getTimezoneOffset());
  $("pickupTime").min = minTime.toISOString().slice(0, 16);

  openModal("donationModal");
}

function handleAddDonation(event) {
  event.preventDefault();
  const user = currentUser();
  if (!user || user.role !== "Donor") {
    return showError("donationError", "Only registered donors can add food.");
  }

  const foodName = $("foodName").value.trim();
  const quantity = Number($("quantity").value);
  const unit = $("quantityUnit").value;
  const pickupTime = new Date($("pickupTime").value);
  const notes = $("foodNotes").value.trim();

  if (!foodName || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    return showError("donationError", "Enter a food name and a valid whole-number quantity.");
  }
  if (!Number.isFinite(pickupTime.getTime()) || pickupTime.getTime() <= Date.now()) {
    return showError("donationError", "Pickup deadline must be in the future.");
  }

  foods.unshift({
    id: uid(), donorId: user.id, foodName, quantity, unit,
    pickupTime: pickupTime.toISOString(), notes,
    status: "Available", claimedBy: null, createdAt: new Date().toISOString()
  });

  persistFoods();
  closeModal("donationModal");
  updateApp();
  toast("Donation published successfully.");
}

function claimFood(id) {
  const user = currentUser();
  if (!user || user.role !== "NGO") {
    toast("Please login with an NGO account to claim food.");
    if (!user) openAuth("login");
    return;
  }

  const food = foods.find(f => f.id === id);
  if (!food || effectiveStatus(food) !== "Available") {
    toast("This food is no longer available.");
    updateApp();
    return;
  }

  food.status = "Claimed";
  food.claimedBy = user.id;
  food.claimedAt = new Date().toISOString();
  persistFoods();
  updateApp();
  toast("Food claimed. Contact the donor to arrange pickup.");
}

function markCollected(id) {
  const user = currentUser();
  const food = foods.find(f => f.id === id);
  if (!user || user.role !== "NGO" || !food || food.claimedBy !== user.id || food.status !== "Claimed") {
    toast("Unable to update this donation.");
    return;
  }

  food.status = "Collected";
  food.collectedAt = new Date().toISOString();
  persistFoods();
  updateApp();
  toast("Food marked as collected.");
}

function removeDonation(id) {
  const user = currentUser();
  const food = foods.find(f => f.id === id);
  if (!user || !food || food.donorId !== user.id || food.status !== "Available") {
    toast("Only your available donations can be removed.");
    return;
  }

  if (!confirm("Remove this food donation?")) return;
  foods = foods.filter(f => f.id !== id);
  persistFoods();
  updateApp();
  toast("Donation removed.");
}

function renderFoods() {
  const query = $("searchFood").value.trim().toLowerCase();
  const filter = $("statusFilter").value;
  const user = currentUser();

  const list = foods.filter(food => {
    const status = effectiveStatus(food);
    const donor = donorName(food).toLowerCase();
    const matchesText = food.foodName.toLowerCase().includes(query) ||
      donor.includes(query) || (food.notes || "").toLowerCase().includes(query);
    const matchesStatus = filter === "all" || status === filter;
    return matchesText && matchesStatus;
  });

  $("foodGrid").innerHTML = list.map(food => {
    const status = effectiveStatus(food);
    const ownDonation = user && user.role === "Donor" && user.id === food.donorId;
    const ownClaim = user && user.role === "NGO" && user.id === food.claimedBy;

    let action = "";
    if (status === "Available" && user?.role === "NGO") {
      action = `<button class="btn btn-primary" data-claim="${esc(food.id)}">Claim food</button>`;
    } else if (status === "Available" && !user) {
      action = `<button class="btn btn-primary" data-login-claim>Login to claim</button>`;
    } else if (ownDonation) {
      action = `<span class="role-pill">Your donation</span>`;
    } else if (ownClaim) {
      action = `<span class="role-pill">Claimed by you</span>`;
    }

    const addressUser = users.find(u => u.id === food.donorId);
    const showAddress = user && (user.role === "NGO" || isAdmin());

    return `<article class="food-card">
      <div class="food-card-top">
        <div class="food-symbol">${foodEmoji(food.foodName)}</div>
        ${badge(status)}
      </div>
      <h3>${esc(food.foodName)}</h3>
      <p class="food-donor">${esc(donorName(food))}${addressUser?.donorType ? " · " + esc(addressUser.donorType) : ""}</p>
      <div class="food-details">
        <div class="food-detail"><span>📦</span><span><strong>Quantity:</strong> ${esc(food.quantity)} ${esc(food.unit)}</span></div>
        <div class="food-detail"><span>🕒</span><span><strong>Pickup deadline:</strong> ${esc(formatDate(food.pickupTime))}</span></div>
        ${showAddress && addressUser ? `<div class="food-detail"><span>📍</span><span><strong>Address:</strong> ${esc(addressUser.address)}<br><strong>Phone:</strong> ${esc(addressUser.phone)}</span></div>` : ""}
      </div>
      ${food.notes ? `<div class="food-notes">${esc(food.notes)}</div>` : ""}
      <div class="food-card-actions">${action || `<span class="food-donor">Status: ${esc(status)}</span>`}</div>
    </article>`;
  }).join("");

  $("emptyState").classList.toggle("hidden", list.length > 0);
  $("foodGrid").classList.toggle("hidden", list.length === 0);

  $("foodGrid").querySelectorAll("[data-claim]").forEach(btn => {
    btn.addEventListener("click", () => claimFood(btn.dataset.claim));
  });
  $("foodGrid").querySelectorAll("[data-login-claim]").forEach(btn => {
    btn.addEventListener("click", () => openAuth("login"));
  });
}

function logout() {
  session = null;
  localStorage.removeItem(KEYS.session);
  updateApp();
  toast("You have logged out.");
}

// Navigation and forms
document.addEventListener("click", event => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.id === "loginNav" || target.id === "bannerLogin") openAuth("login");
  if (target.id === "registerNav" || target.id === "heroRegister") openAuth("register");
  if (target.id === "heroExplore") $("availableSection").scrollIntoView({ behavior: "smooth" });
  if (target.id === "logoutBtn") logout();
  if (target.id === "navDashboard") $("dashboard").scrollIntoView({ behavior: "smooth" });

  if (target.dataset.close) closeModal(target.dataset.close);
  if (target.dataset.authTab) {
    clearError("authError");
    setAuthMode(target.dataset.authTab);
  }
});

$("authForm").addEventListener("submit", event => {
  event.preventDefault();
  clearError("authError");
  if (authMode === "register") handleRegister();
  else handleLogin();
});

$("userRole").addEventListener("change", updateDonorTypeVisibility);
$("donationForm").addEventListener("submit", handleAddDonation);
$("searchFood").addEventListener("input", renderFoods);
$("statusFilter").addEventListener("change", renderFoods);

$("clearFilters").addEventListener("click", () => {
  $("searchFood").value = "";
  $("statusFilter").value = "Available";
  renderFoods();
});

$("homeLink").addEventListener("click", event => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal(modal.id);
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal("authModal");
    closeModal("donationModal");
  }
});

// Create a demo admin account in local browser data if absent.
// The demo password is visible in source and must never be used in production.
updateDonorTypeVisibility();
updateApp();