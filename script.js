const STORE_KEY = 'washly_students_v1';
const SESSION_KEY = 'washly_session_v1';
const PRICE_STORE_KEY = 'washmate_clothing_prices_v1';
const ITEMS = ['Shirt', 'T-Shirt', 'Formal Pant', 'Jeans', 'Shorts', 'Trouser', 'Kurta', 'Hoodie', 'Sweater', 'Jacket', 'Innerwear', 'Socks (per pair)', 'Towel', 'Bedsheet', 'Pillow Cover', 'Blanket', 'Track Pant', 'School/College Uniform', 'Dress', 'Skirt'];
const ITEM_WEIGHTS = [.25, .2, .5, .55, .25, .5, .35, .6, .6, .8, .1, .08, .5, 1, .2, 1.5, .5, .5, .5, .35];
const ITEM_PRICES = [10, 8, 12, 15, 8, 12, 12, 20, 20, 25, 5, 4, 10, 20, 8, 30, 12, 15, 15, 12];
const TIME_SLOTS = ['7:00 AM – 9:00 AM', '9:00 AM – 11:00 AM', '11:00 AM – 1:00 PM', '1:00 PM – 3:00 PM', '3:00 PM – 5:00 PM', '5:00 PM – 7:00 PM', '7:00 PM – 9:00 PM'];
const ORDER_STAGES = ['Booked', 'Received', 'Washing', 'Drying', 'Ready for Pickup', 'Collected'];
const app = document.getElementById('app');
let users = readStore();
let currentEmail = readSession();
let page = 'dashboard';
let authMode = 'signin';
let toastTimer;
let bookingPrefill = null;
const loadingStartedAt = Date.now();
const minimumLoadingTime = 1500;

function readStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch { return {}; }
}
function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(users));
    return true;
  } catch {
    toast('Could not save data in this browser. Check your storage settings.');
    return false;
  }
}
function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function slotIsPast(date, slot, now = new Date()) {
  const day = String(date || '');
  const parsedDate = new Date(`${day}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsedDate.getTime()) || localDateString(parsedDate) !== day || !TIME_SLOTS.includes(slot)) return true;
  if (day < localDateString(now)) return true;
  if (day > localDateString(now)) return false;
  const startLabel = slot.split(' – ')[0];
  const [time, period] = startLabel.split(' ');
  const hour = Number(time.split(':')[0]) % 12 + (period === 'PM' ? 12 : 0);
  const start = new Date(now);
  start.setHours(hour, 0, 0, 0);
  return start <= now;
}
function defaultBookingDate(now = new Date()) {
  const today = localDateString(now);
  return TIME_SLOTS.some(slot => !slotIsPast(today, slot, now))
    ? today
    : localDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
}
function currentItemPrices() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRICE_STORE_KEY) || 'null');
    return ITEMS.map((_, index) => Number.isFinite(Number(saved?.[index])) && Number(saved[index]) >= 0 ? Number(saved[index]) : ITEM_PRICES[index]);
  } catch { return ITEM_PRICES.slice(); }
}
function writeItemPrices(prices) {
  try { localStorage.setItem(PRICE_STORE_KEY, JSON.stringify(prices)); return true; }
  catch { toast('Could not save washing charges in this browser.'); return false; }
}
function readSession() { try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; } }
function writeSession(email) { try { localStorage.setItem(SESSION_KEY, email); } catch { toast('Your session cannot be saved in this browser.'); } }
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }
function esc(value = '') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safePhoto(value = '') {
  const photo = String(value);
  return photo.length <= 700000 && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(photo) ? photo : '';
}
function user() { return users[currentEmail]; }
function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function initials(name = '') { return name.trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase() || 'S'; }
function go(next) { page = next; document.querySelector('.sidebar')?.classList.remove('open'); render(); }
function recordLogin() {
  const account=user(); if(!account)return;
  account.loginActivity=account.loginActivity||[];
  account.sessions=account.sessions||[];
  account.sessions.forEach(session=>session.active=false);
  const session={id:makeLocalId('SES'),signedInAt:Date.now(),lastSeenAt:Date.now(),label:'This browser',active:true};
  account.sessions.push(session);account.sessions=account.sessions.slice(-10);
  account.loginActivity.unshift({at:Date.now(),label:'Sign-in on this browser'});account.loginActivity=account.loginActivity.slice(0,20);
}
function signOut() { if(user()?.sessions) user().sessions.forEach(session=>session.active=false); saveStore(); clearSession(); currentEmail = ''; authMode = 'signin'; renderAuth(); }

function renderAuth() {
  app.innerHTML = `<main class="auth-shell"><section class="auth-visual"><div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false"><path d="M8 12.5c3.2-4.2 8.4-6.5 13.7-5.8 5.7.7 10.3 4.8 11.5 10.3M32 27.5c-3.2 4.2-8.4 6.5-13.7 5.8C12.6 32.6 8 28.5 6.8 23"/><path d="M12 20h16M15 25h10M17 15h6"/></svg></span> Wash Mate</div><div class="visual-copy"><div class="visual-message"><p class="visual-eyebrow">CAMPUS LAUNDRY, MADE EASY</p><h1>Laundry day,<br>on your schedule.</h1><p>Book a convenient laundry slot between classes, choose the care your clothes need, and follow every order from drop-off to pickup.</p><div class="visual-points"><span>Student-friendly booking</span><span>Clear order updates</span></div></div><div class="laundry-illustration" aria-hidden="true"><svg viewBox="0 0 420 330" role="presentation"><defs><linearGradient id="washerBody" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#e9ddeb"/></linearGradient><linearGradient id="washerDoor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#bda7c3"/><stop offset="1" stop-color="#735c81"/></linearGradient><linearGradient id="basketFill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d6c5d2"/><stop offset="1" stop-color="#b99a86"/></linearGradient></defs><circle cx="220" cy="164" r="144" fill="#fff" opacity=".10"/><circle cx="58" cy="75" r="8" fill="#fff" opacity=".75"/><circle cx="355" cy="82" r="5" fill="#e8d9ec"/><circle cx="350" cy="245" r="10" fill="#fff" opacity=".55"/><g transform="translate(44 37) rotate(-4 115 130)"><rect x="9" y="8" width="205" height="251" rx="29" fill="#49345f" opacity=".18"/><rect x="0" y="0" width="205" height="251" rx="29" fill="url(#washerBody)"/><rect x="18" y="19" width="169" height="46" rx="13" fill="#f2eaf3"/><circle cx="42" cy="42" r="7" fill="#967d9c"/><rect x="62" y="36" width="49" height="11" rx="5.5" fill="#d6c5d2"/><circle cx="164" cy="42" r="11" fill="#795f82"/><circle cx="164" cy="42" r="4" fill="#eee4f4"/><circle cx="102" cy="155" r="72" fill="#d6c5d2"/><circle cx="102" cy="155" r="60" fill="url(#washerDoor)"/><circle cx="102" cy="155" r="46" fill="#d9c9df"/><path d="M67 160c18-22 51-19 70 0-12 18-48 27-70 0Z" fill="#fff" opacity=".9"/><path d="M88 137c12-16 30-11 39 1-9 14-26 16-39-1Z" fill="#b99a86"/><path d="M110 179c10-13 23-12 31-3-8 13-20 16-31 3Z" fill="#967d9c"/><rect x="18" y="232" width="169" height="7" rx="3.5" fill="#d6c5d2" opacity=".8"/></g><g transform="translate(245 185) rotate(5 66 57)"><path d="M5 28h130l-13 83H18L5 28Z" fill="url(#basketFill)"/><path d="M0 27c0-7 6-12 13-12h114c7 0 13 5 13 12v9H0v-9Z" fill="#e8d9ec"/><path d="M30 47v47M56 44v53M83 44v53M110 47v47" stroke="#9b7c9f" stroke-width="5" stroke-linecap="round" opacity=".65"/><path d="M19 19 31 0l31 16 17-19 39 21" fill="none" stroke="#fff" stroke-width="17" stroke-linecap="round" stroke-linejoin="round"/><path d="m30 2 31 16M80 0l38 21" stroke="#d6c5d2" stroke-width="5" stroke-linecap="round"/></g><path d="m329 114 6 13 13 6-13 6-6 13-6-13-13-6 13-6 6-13Z" fill="#fff" opacity=".8"/><path d="m270 65 4 8 8 4-8 4-4 8-4-8-8-4 8-4 4-8Z" fill="#e8d9ec"/></svg></div></div></section><section class="auth-panel"><div class="auth-box"><div class="brand" style="margin-bottom:35px;color:var(--ink)"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false"><path d="M8 12.5c3.2-4.2 8.4-6.5 13.7-5.8 5.7.7 10.3 4.8 11.5 10.3M32 27.5c-3.2 4.2-8.4 6.5-13.7 5.8C12.6 32.6 8 28.5 6.8 23"/><path d="M12 20h16M15 25h10M17 15h6"/></svg></span> Wash Mate</div><h2>${authMode === 'signup' ? 'Create your account' : authMode === 'reset' ? 'Reset your password' : 'Welcome back'}</h2><p class="subtle">${authMode === 'signup' ? 'Sign up with your student email to get started.' : authMode === 'reset' ? 'Choose a new password for your local demo account.' : 'Sign in to manage your campus laundry.'}</p>${authMode !== 'reset' ? `<div class="auth-tabs"><button class="${authMode === 'signin' ? 'active' : ''}" data-auth-mode="signin">Sign in</button><button class="${authMode === 'signup' ? 'active' : ''}" data-auth-mode="signup">Sign up</button></div>` : ''}<form id="auth-form">${authMode === 'signup' ? `<div class="field"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" placeholder="e.g. Alex Student" required maxlength="80"></div>` : ''}<div class="field"><label for="auth-email">Student email</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="e.g. student@example.edu" required></div>${authMode !== 'reset' ? `<div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${authMode === 'signup' ? 'new-password' : 'current-password'}" placeholder="At least 6 characters" required minlength="6"></div>` : `<div class="field"><label for="auth-password">New password</label><input id="auth-password" name="password" type="password" autocomplete="new-password" placeholder="At least 6 characters" required minlength="6"></div><div class="field"><label for="auth-confirm-password">Confirm new password</label><input id="auth-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" placeholder="Re-enter your new password" required minlength="6"></div>`}<button class="primary full" type="submit">${authMode === 'signup' ? 'Create account →' : authMode === 'reset' ? 'Save new password →' : 'Sign in →'}</button></form>${authMode === 'signup' ? `<p class="fine-print">Example name: Alex Student · example email: student@example.edu. Use made-up details and a demo password; this app saves them only in this browser.</p>` : authMode === 'signin' ? `<button class="text-button auth-forgot" type="button" data-auth-mode="reset">Forgot password?</button>` : authMode === 'reset' ? `<button class="text-button auth-forgot" type="button" data-auth-mode="signin">← Back to sign in</button><p class="fine-print auth-reset-note">This browser demo cannot verify your identity or send reset emails. The password change is stored only on this device.</p>` : ''}</div></section></main>`;
}

const NAV = [
  {label:'OVERVIEW',items:[['dashboard','▦','Dashboard'],['machines','◉','Machine availability'],['book','◉','Book a laundry slot']]},
  {label:'MY LAUNDRY',items:[['tracking','◷','Laundry tracking'],['history','▤','Booking history'],['notifications','♧','Notifications'],['analytics','▥','Laundry analytics']]},
  {label:'SUPPORT',items:[['feedback','☆','Feedback'],['help','?','Help & support']]},
  {label:'ACCOUNT',items:[['profile','♙','My profile']]}
];
const TITLES = {dashboard:'Dashboard',machines:'Machine availability',book:'Book a laundry slot',tracking:'Laundry tracking',history:'Booking history',notifications:'Notification center',analytics:'Laundry analytics',feedback:'Feedback',complaint:'Support tickets','lost-found':'Lost & found',help:'Help & support',profile:'Student profile',settings:'Settings',prices:'Manage washing prices'};
function navMarkup() {
  const allowed = user()?.profile ? NAV : [{label:'ACCOUNT SETUP',items:[['profile','♙','Complete profile']]}];
  return allowed.map(group => `<div class="nav-label">${group.label}</div><div class="nav-list">${group.items.map(([key,icon,label]) => `<button class="nav-item ${page === key ? 'active' : ''}" data-page="${key}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}</div>`).join('');
}
function render() {
  if (!currentEmail || !user()) { renderAuth(); return; }
  trackMachineChanges();
  trackBookingAndPaymentChanges();
  const profile = user().profile || {};
  const unreadCount = notifications().filter(item=>!item.read).length;
  const title = TITLES[page] || 'Dashboard';
  app.innerHTML = `<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" focusable="false"><path d="M8 12.5c3.2-4.2 8.4-6.5 13.7-5.8 5.7.7 10.3 4.8 11.5 10.3M32 27.5c-3.2 4.2-8.4 6.5-13.7 5.8C12.6 32.6 8 28.5 6.8 23"/><path d="M12 20h16M15 25h10M17 15h6"/></svg></span> Wash Mate</div>${navMarkup()}<div class="sidebar-bottom"><button class="nav-item" data-action="logout"><span class="nav-icon">↪</span>Log out</button><div class="profile-mini"><div class="avatar">${safePhoto(profile.photo) ? `<img src="${esc(safePhoto(profile.photo))}" alt="">` : esc(initials(profile.fullName || user().name))}</div><div><div class="mini-name">${esc(profile.fullName || user().name)}</div><div class="mini-email">${esc(user().email)}</div></div></div></div></aside><main class="main-area"><header class="topbar"><div class="top-left"><button class="icon-button mobile-menu" data-action="menu" aria-label="Open menu">☰</button><h2>${title}</h2></div><div class="top-actions"><span class="top-date">${new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span><button class="icon-button" data-page="notifications" aria-label="Notifications${unreadCount?`, ${unreadCount} unread`:''}">♧${unreadCount?'<span class="notification-dot"></span>':''}</button><button class="icon-button" data-page="profile" aria-label="Profile">${esc(initials(profile.fullName || user().name))}</button></div></header><section class="content">${renderPage()}</section></main></div>`;
  if (page === 'settings') document.getElementById('language')?.closest('.card')?.remove();
  if (page === 'book') { refreshMachineOptions(); updateTotals(); }
}
function heading(title, subtitle) { return `<div class="page-heading"><h1>${title}</h1><p>${subtitle}</p></div>`; }
function bookings() {
  if (!Array.isArray(user().bookings)) user().bookings = [];
  return user().bookings;
}
function transactions() {
  if (!Array.isArray(user().transactions)) user().transactions = [];
  user().transactions = user().transactions.filter(tx => !String(tx.id || '').startsWith('LPU-TX-') && !String(tx.id || '').startsWith('LPU-RF-'));
  return user().transactions;
}
function notifications() {
  if (!Array.isArray(user().notifications)) user().notifications = [];
  user().notifications = user().notifications.filter(item => !String(item.id || '').startsWith('LPU-NTF-'));
  return user().notifications;
}
function monthKey(value) { const date=new Date(value); return Number.isNaN(date.getTime())?'':`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
function makeLocalId(prefix) { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`; }
function addNotification(category, title, message, reference = '') {
  const list = Array.isArray(user().notifications) ? user().notifications : (user().notifications = []);
  list.unshift({id:makeLocalId('NTF'),category,title,message,reference,createdAt:Date.now(),read:false});
  user().notifications = list.slice(0,100);
}
function trackMachineChanges() {
  const snapshot = Object.fromEntries(machines().map(machine=>[machine.id,machine.state]));
  const previous = user().machineSnapshot;
  let changed = false;
  if (previous && typeof previous === 'object') {
    machines().forEach(machine=>{
      if (previous[machine.id] && previous[machine.id] !== machine.state && machine.state === 'Available') {
        addNotification('Machine availability',`${machine.name} is available`,`${machine.id} is now ready to use.`,machine.id);
        changed = true;
      }
    });
  }
  if (!previous || JSON.stringify(previous) !== JSON.stringify(snapshot)) changed = true;
  user().machineSnapshot = snapshot;
  if (changed) saveStore();
}
function trackBookingAndPaymentChanges() {
  let changed=false;
  const statuses=Object.fromEntries(bookings().map(booking=>[booking.id,booking.status]));
  const priorStatuses=user().bookingStatusSnapshot;
  if (priorStatuses) bookings().forEach(booking=>{
    if(priorStatuses[booking.id]&&priorStatuses[booking.id]!==booking.status){
      const pickup=['Ready for Pickup','Ready for collection'].includes(booking.status);
      addNotification(pickup?'Pickup reminder':'Order update',pickup?'Laundry ready for pickup':`Order status: ${booking.status}`,pickup?`Booking ${booking.id} is ready. Please arrange collection.`:`Booking ${booking.id} status is now ${booking.status}.`,booking.id);
      changed=true;
    }
  });
  if(!priorStatuses||JSON.stringify(priorStatuses)!==JSON.stringify(statuses)){user().bookingStatusSnapshot=statuses;changed=true;}
  const txIds=transactions().map(tx=>tx.id).filter(Boolean);
  const previousTxIds=user().transactionNotificationSnapshot;
  if(previousTxIds){transactions().filter(tx=>tx.id&&!previousTxIds.includes(tx.id)).forEach(tx=>{addNotification('Payment',`${String(tx.type).toLowerCase()==='refund'?'Refund':'Payment'} update`,`${tx.type||'Transaction'} record for ₹${Number(tx.amount||0).toFixed(2)} was added.`,tx.bookingId||tx.id);changed=true;});}
  if(!previousTxIds||JSON.stringify(previousTxIds)!==JSON.stringify(txIds)){user().transactionNotificationSnapshot=txIds;changed=true;}
  if(changed)saveStore();
}
function createBookingId() { const existing=Object.values(users||{}).flatMap(account=>Array.isArray(account.bookings)?account.bookings:[]); let id; do { id=`WL${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,7).toUpperCase()}`; } while (existing.some(booking=>booking.id===id)); return id; }
function machineCatalog() {
  const base = [
    {id:'W01',name:'Washer 01',type:'Front load · 8 kg',state:'Available',eta:''},
    {id:'W02',name:'Washer 02',type:'Front load · 8 kg',state:'Available',eta:''},
    {id:'W03',name:'Washer 03',type:'Top load · 7 kg',state:'Available',eta:''},
    {id:'D01',name:'Dryer 01',type:'Tumble dryer · 8 kg',state:'Available',eta:''},
    {id:'D02',name:'Dryer 02',type:'Tumble dryer · 8 kg',state:'Available',eta:''},
    {id:'W04',name:'Washer 04',type:'Front load · 10 kg',state:'Maintenance',eta:'Service in progress'}
  ];
  let saved = {};
  try {
    const parsed = JSON.parse(localStorage.getItem('washmate_machine_states_v1') || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed;
  } catch {}
  const validStates = ['Available', 'Running', 'Reserved', 'Maintenance'];
  return base.map(machine => validStates.includes(saved[machine.id])
    ? {...machine, state:saved[machine.id], eta:saved[machine.id] === 'Available' ? '' : machine.eta}
    : machine);
}
function allBookings() {
  return Object.values(users || {}).flatMap(account =>
    Array.isArray(account?.bookings) ? account.bookings : []
  );
}
function machines() {
  const activeBookings = allBookings().filter(booking =>
    !['Cancelled', 'Collected', 'Completed'].includes(booking.status)
  );
  return machineCatalog().map(machine => {
    const assigned = activeBookings.filter(booking =>
      booking.machineId === machine.id || (!booking.machineId && booking.machineName === machine.name)
    );
    const inProgress = assigned.find(booking => ['Received', 'Washing', 'Drying'].includes(booking.status));
    const reserved = assigned.find(booking => ['Booked', 'Confirmed'].includes(booking.status));
    if (inProgress) return {...machine, state:'Running', eta:`Order ${inProgress.id} · ${inProgress.status}`};
    if (reserved) return {...machine, state:'Reserved', eta:`Reserved for ${reserved.date} · ${reserved.slot}`};
    return machine;
  });
}
function machineRows(showBookingAction = false) {
  const rows = machines().map(machine => {
    const type = machine.name.startsWith('Dryer') ? 'dryer' : 'washer';
    const statusClass = machine.state === 'Available' ? 'available' : machine.state === 'Running' ? 'busy' : machine.state === 'Reserved' ? 'reserved' : 'maintenance';
    return `<article class="machine-row" data-machine-row data-machine-search="${esc(`${machine.name} ${machine.id}`.toLowerCase())}" data-machine-type="${type}" data-machine-state="${esc(machine.state.toLowerCase())}"><div class="machine-symbol" aria-hidden="true">${type === 'dryer' ? '♨' : '◉'}</div><div class="machine-row-info"><div class="machine-name">${esc(machine.name)} <span class="machine-id">${esc(machine.id)}</span></div><div class="machine-meta">${esc(machine.type)}${machine.eta ? ` · ${esc(machine.eta)}` : ''}</div></div><span class="status-pill ${statusClass}"><span class="status-dot"></span>${esc(machine.state)}</span>${showBookingAction && machine.state === 'Available' ? '<button class="machine-book-link" type="button" data-page="book">See time slots <span aria-hidden="true">→</span></button>' : ''}</article>`;
  });
  return rows;
}
function slotAvailabilityRows(date, selectedSlot = '') {
  return TIME_SLOTS.map(slot => {
    const past = slotIsPast(date, slot);
    const available = past ? [] : selectableMachines(date, slot);
    const selected = slot === selectedSlot && !past && available.length > 0;
    const status = past ? 'Time passed' : available.length ? `${available.length} machine${available.length===1?'':'s'} available` : 'Fully booked';
    return `<article class="slot-availability-row ${selected?'is-selected':''}"><div class="slot-availability-head"><strong>${esc(slot)}</strong><span class="badge ${available.length?'completed':'cancelled'}">${esc(status)}</span></div><p>${available.length ? `Available: ${available.map(machine=>esc(machine.name)).join(', ')}` : past ? 'Choose a future time or date.' : 'No machines are free for this time.'}</p><button class="${selected?'primary':'secondary'}" type="button" data-action="choose-slot" data-date="${esc(date)}" data-slot="${esc(slot)}" aria-pressed="${selected}" ${available.length?'':'disabled'}>${selected?'Selected time ✓':'Choose this time'}</button></article>`;
  }).join('');
}
function refreshDateAvailabilitySummary(date) {
  const summary = document.getElementById('date-availability-summary');
  if (!summary) return;
  const openSlots = TIME_SLOTS.filter(slot => !slotIsPast(date, slot) && selectableMachines(date, slot).length > 0).length;
  summary.textContent = `${openSlots} of ${TIME_SLOTS.length} time slots available`;
  summary.classList.toggle('has-no-slots', openSlots === 0);
}
function refreshSlotAvailability() {
  const date = document.getElementById('availability-date')?.value;
  const list = document.getElementById('slot-availability-list');
  if (date && list) {
    list.innerHTML = slotAvailabilityRows(date, document.getElementById('booking-slot')?.value || '');
    refreshDateAvailabilitySummary(date);
  }
}
function handleAvailabilityDateChange(date) {
  const bookingDate = document.getElementById('booking-date');
  const bookingSlot = document.getElementById('booking-slot');
  if (bookingDate) bookingDate.value = date;
  if (bookingSlot) bookingSlot.value = '';
  refreshSlotAvailability();
  refreshMachineOptions();
}
function openBookingForSlot(date, slot) {
  bookingPrefill = {date, slot};
  page = 'book';
  render();
  bookingPrefill = null;
  document.getElementById('booking-form')?.scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('booking-machine')?.focus({preventScroll:true});
}
function dashboardOverview() {
  const profile = user().profile || {};
  return `<div class="dashboard-overview"><article class="card student-summary"><div class="summary-art" aria-hidden="true"><span class="summary-sparkle">✦</span><span class="summary-basket">🧺</span><span class="summary-bubble bubble-one"></span><span class="summary-bubble bubble-two"></span></div><div class="summary-copy"><span class="eyebrow">YOUR STUDENT PROFILE</span><h3>${esc(profile.fullName || user().name)}</h3><p>${esc(user().email)}</p><div class="residence-chips">${profile.block ? `<span>Block ${esc(profile.block)}</span>` : ''}${profile.building ? `<span>Building ${esc(profile.building)}</span>` : ''}${profile.room ? `<span>Room ${esc(profile.room)}</span>` : ''}</div><button class="text-button" data-page="profile">View profile →</button></div></article><article class="card quick-actions-card"><div class="section-title"><div><h3>Quick actions</h3><p>Pick up where you left off.</p></div><span class="quick-action-mark" aria-hidden="true">✧</span></div><button class="quick-action" data-page="book"><span class="quick-action-icon">＋</span><span><strong>Book a laundry slot</strong><small>Choose a time that works for you</small></span><span class="quick-arrow">→</span></button><button class="quick-action" data-page="tracking"><span class="quick-action-icon">◷</span><span><strong>Track your laundry</strong><small>Check the latest order status</small></span><span class="quick-arrow">→</span></button><button class="quick-action" data-page="help"><span class="quick-action-icon">?</span><span><strong>Get help</strong><small>Find answers and support details</small></span><span class="quick-arrow">→</span></button></article></div>`;
}
function renderDashboard() {
  const active = bookings().filter(b => !['Completed','Cancelled','Collected'].includes(b.status));
  const last = active[0];
  const available = machines().filter(m => m.state === 'Available').length;
  const washing = bookings().filter(b => ['Received','Washing','Drying'].includes(b.status)).length;
  const ready = bookings().filter(b => ['Ready for Pickup','Ready for collection'].includes(b.status)).length;
  const currentMonth = monthKey(Date.now());
  const itemsThisMonth = bookings()
    .filter(b => String(b.date || '').slice(0, 7) === currentMonth && ['Completed', 'Collected'].includes(b.status))
    .reduce((total, booking) => total + Number(booking.total || 0), 0);
  const machineTotal = machines().length;
  const machinePreview = machineRows().slice(0, 4).join('');
  return `<div class="welcome"><div><div class="eyebrow">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div><h1>Hi, ${esc((user().profile?.fullName || user().name).split(' ')[0])} 👋</h1><p>Here's your laundry at a glance.</p></div><div class="welcome-actions"><button class="primary" data-page="book">＋ Book a slot</button><button class="danger-btn" data-action="logout">Log out</button></div></div>${dashboardOverview()}<div class="grid stats-grid"><div class="card stat-card"><div><div class="stat-label">Available machines</div><div class="stat-value">${available}<span style="font-size:14px;color:var(--muted);font-weight:600"> / ${machineTotal}</span></div><div class="stat-note">Ready to use now</div></div><div class="stat-icon">◉</div></div><div class="card stat-card"><div><div class="stat-label">Active bookings</div><div class="stat-value">${active.length}</div><div class="stat-note">Upcoming laundry slots</div></div><div class="stat-icon">◷</div></div><div class="card stat-card"><div><div class="stat-label">Items this month</div><div class="stat-value">${itemsThisMonth}</div><div class="stat-note">Items processed</div></div><div class="stat-icon">♧</div></div><div class="card stat-card"><div><div class="stat-label">Active laundry orders</div><div class="stat-value">${washing}</div><div class="stat-note">Received or washing</div></div><div class="stat-icon">♨</div></div><div class="card stat-card"><div><div class="stat-label">Ready for collection</div><div class="stat-value">${ready}</div><div class="stat-note">Waiting for pickup</div></div><div class="stat-icon">✓</div></div></div><div class="grid dashboard-grid"><div class="card"><div class="section-title"><div><h3>Machine availability</h3><p>Sample machine status and estimated cycle times · not live</p></div><button class="text-button" data-page="machines">View all →</button></div><div class="machine-list">${machinePreview}</div></div><div class="card slot-card">${last ? `<div class="section-title"><div><h3>Your next slot</h3><p>Booking ${esc(last.id)}</p></div><span class="badge in-progress">${esc(last.status)}</span></div><div style="font:800 21px Manrope;margin:18px 0 5px">${esc(last.date)}</div><div style="color:var(--muted);font-size:13px">${esc(last.slot)} · ${esc(last.total)} items</div><div class="notice">Remember to bring your booking code for laundry handover.</div><div class="welcome-actions"><button class="secondary" data-page="tracking">Track booking →</button>${canCancelBooking(last)?`<button class="danger-btn" type="button" data-action="cancel-slot" data-id="${esc(last.id)}">Cancel slot</button>`:''}</div>`:`<div class="empty-icon">🧺</div><h3>Ready for a fresh start?</h3><p>Choose a time that works for you and book your first laundry slot.</p><button class="primary" data-page="book">Book a laundry slot →</button>`}</div></div><div class="card" style="margin-top:18px"><div class="section-title"><div><h3>Recent bookings</h3><p>Your latest laundry activity</p></div><button class="text-button" data-page="history">See history →</button></div>${renderRecent(3)}</div>`;
}
function renderRecent(limit=30) {
  const list = bookings().slice().reverse().slice(0,limit);
  if (!list.length) return `<div class="empty-state"><div class="empty-icon">🧺</div><h3>No bookings yet</h3><p>Your laundry bookings will appear here.</p><button class="primary" data-page="book">Book your first slot</button></div>`;
  const search = limit >= 30 ? `<div class="field booking-search"><label for="booking-search">Search bookings</label><input id="booking-search" type="search" placeholder="Search by booking ID, date, time, or status" autocomplete="off"></div>` : '';
  return `${search}<div class="table-wrap"><table class="data-table"><thead><tr><th>Booking</th><th>Date & time</th><th>Items</th><th>Laundry total</th><th>Status</th><th>Action</th></tr></thead><tbody>${list.map(b=>`<tr data-booking-search="${esc(`${b.id} ${b.date} ${b.slot} ${b.status}`.toLowerCase())}"><td><strong>${esc(b.id)}</strong></td><td>${esc(b.date)}<br><span style="color:var(--muted)">${esc(b.slot)}</span></td><td>${esc(b.total)} items</td><td><strong>₹${Number(b.washCost ?? (b.items||[]).reduce((sum,quantity,index)=>sum+Number(quantity||0)*Number((b.itemPrices||ITEM_PRICES)[index]||0),0)).toFixed(2)}</strong></td><td><span class="badge ${badgeClass(b.status)}">${esc(b.status)}</span></td><td><button class="text-button" data-action="receipt" data-id="${esc(b.id)}">Receipt</button>${canRescheduleBooking(b)?` <button class="text-button" data-action="reschedule" data-id="${esc(b.id)}">Reschedule</button>${canCancelBooking(b)?` <button class="text-button" style="color:var(--red)" type="button" data-action="cancel-slot" data-id="${esc(b.id)}">Cancel slot</button>`:''}`:''}</td></tr>`).join('')}</tbody></table></div><p class="subtle booking-no-results" hidden>No bookings match your search.</p>`;
}
function badgeClass(status) { return ['Completed','Collected'].includes(status) ? 'completed' : status === 'Cancelled' ? 'cancelled' : 'in-progress'; }
function canCancelBooking(booking) {
  return ['Booked','Confirmed'].includes(booking.status) && booking.date >= localDateString() && !slotIsPast(booking.date, booking.slot);
}
function canRescheduleBooking(booking) {
  return ['Booked','Confirmed'].includes(booking.status);
}
function cancelBookingSlot(id) {
  const booking = findBooking(id);
  if (!booking || !canCancelBooking(booking)) {
    toast('This booking can no longer be cancelled.');
    return;
  }
  if (!window.confirm(`Cancel laundry slot ${booking.date} · ${booking.slot}?`)) return;
  booking.status = 'Cancelled';
  booking.cancelledAt = Date.now();
  addNotification('Booking','Laundry slot cancelled',`Your slot on ${booking.date} at ${booking.slot} has been cancelled.`,booking.id);
  user().bookingStatusSnapshot = Object.fromEntries(bookings().map(item=>[item.id,item.status]));
  saveStore();
  render();
  toast('Slot cancelled. The machine is available again.');
}
function slotEndTime(date, slot) {
  if (!date || !TIME_SLOTS.includes(slot)) return null;
  const endLabel = slot.split(' – ')[1];
  const [time, period] = endLabel.split(' ');
  const [rawHour, minute] = time.split(':').map(Number);
  const hour = rawHour % 12 + (period === 'PM' ? 12 : 0);
  const end = new Date(`${date}T00:00:00`);
  end.setHours(hour, minute, 0, 0);
  return Number.isNaN(end.getTime()) ? null : end;
}
function machineAvailabilityStats(now = new Date()) {
  const list = machines();
  const reservations = allBookings().filter(booking =>
    ['Booked', 'Confirmed'].includes(booking.status) && booking.date >= localDateString(now) &&
    !slotIsPast(booking.date, booking.slot, now)
  );
  const maintenance = list.filter(machine => machine.state === 'Maintenance');
  const available = list.filter(machine => machine.state === 'Available');
  const running = list.filter(machine => machine.state === 'Running');
  const reserved = list.filter(machine => machine.state === 'Reserved');
  let nextAvailableAt = null;
  if (!available.length) {
    const candidates = [];
    running.forEach(machine => {
      const booking = allBookings().find(item =>
        (item.machineId === machine.id || (!item.machineId && item.machineName === machine.name)) &&
        ['Received', 'Washing', 'Drying'].includes(item.status)
      );
      const minutes = booking ? ({Received:60, Washing:45, Drying:30}[booking.status] || 45) : 45;
      candidates.push(new Date(now.getTime() + minutes * 60000));
    });
    reserved.forEach(machine => {
      const endTimes = reservations
        .filter(item => item.machineId === machine.id || (!item.machineId && item.machineName === machine.name))
        .map(item => slotEndTime(item.date, item.slot))
        .filter(end => end && end > now);
      if (endTimes.length) candidates.push(new Date(Math.min(...endTimes.map(end => end.getTime()))));
    });
    if (candidates.length) nextAvailableAt = new Date(Math.min(...candidates.map(date => date.getTime())));
  }
  return {
    machines:list, total:list.length, available, running, reserved, maintenance,
    availableWashers:available.filter(machine => machine.name.startsWith('Washer')).length,
    availableDryers:available.filter(machine => machine.name.startsWith('Dryer')).length,
    nextAvailableAt
  };
}
function renderMachines() {
  const stats = machineAvailabilityStats();
  const nextAvailability = stats.available.length
    ? 'Available now'
    : stats.nextAvailableAt
      ? stats.nextAvailableAt.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'})
      : stats.maintenance.length === stats.total ? 'After maintenance' : 'No estimate';
  const nextNote = stats.available.length
    ? 'At least one machine is ready'
    : stats.nextAvailableAt
      ? `Estimated · ${stats.nextAvailableAt.toLocaleDateString(undefined, {month:'short', day:'numeric'})}`
      : 'No running cycle is scheduled';
  return `${heading('Machine availability','Simulated campus equipment status based on local bookings. This is not live hardware data.')}
    <section class="card machine-availability-overview" aria-label="Availability overview">
      <div class="machine-availability-main">
        <div class="machine-availability-copy"><span class="eyebrow">READY RIGHT NOW</span><strong><span>${stats.available.length}</span> <small>of ${stats.total} machines</small></strong><p>${stats.available.length ? 'Choose an available machine and check its time slots.' : esc(nextAvailability === 'No estimate' || nextAvailability === 'After maintenance' ? nextAvailability : `Next estimated availability · ${nextAvailability}`)}</p></div>
        <div class="machine-availability-ring" style="--availability:${stats.total ? stats.available.length / stats.total * 100 : 0}%" role="img" aria-label="${stats.available.length} of ${stats.total} machines available"><span>${stats.total ? Math.round(stats.available.length / stats.total * 100) : 0}%<small>available</small></span></div>
      </div>
      <div class="machine-availability-bar" role="progressbar" aria-label="Available machines" aria-valuemin="0" aria-valuemax="${stats.total}" aria-valuenow="${stats.available.length}"><span style="width:${stats.total ? stats.available.length / stats.total * 100 : 0}%"></span></div>
      <div class="machine-availability-breakdown"><span><i class="availability-dot washer-dot"></i><strong>${stats.availableWashers}</strong> washers</span><span><i class="availability-dot dryer-dot"></i><strong>${stats.availableDryers}</strong> dryers</span><span><i class="availability-dot busy-dot"></i><strong>${stats.running.length + stats.reserved.length}</strong> in use or reserved</span><span><i class="availability-dot maintenance-dot"></i><strong>${stats.maintenance.length}</strong> maintenance</span></div>
    </section>
    <article class="card machine-directory-card"><div class="section-title"><div><h3>Find a machine</h3><p>Filter the equipment list by type or current status.</p></div><span class="machine-result-count" id="machine-result-count" aria-live="polite">${stats.total} machines</span></div><div class="machine-filters"><label class="machine-search-field" for="machine-search"><span aria-hidden="true">⌕</span><input id="machine-search" type="search" placeholder="Search machine name or ID" autocomplete="off"></label><label class="machine-filter-field"><span>Type</span><select id="machine-type-filter"><option value="all">All machines</option><option value="washer">Washers</option><option value="dryer">Dryers</option></select></label><label class="machine-filter-field"><span>Status</span><select id="machine-status-filter"><option value="all">All statuses</option><option value="available">Available</option><option value="running">Running</option><option value="reserved">Reserved</option><option value="maintenance">Maintenance</option></select></label></div><div class="machine-list machine-directory-list">${machineRows(true).join('')}</div><p class="machine-filter-empty" id="machine-filter-empty" hidden>No machines match these filters. Try changing your search or filters.</p><p class="machine-data-note">Availability is a local demo estimate and may not match the laundry room.</p></article>`;
}
function filterMachineRows() {
  const query = document.getElementById('machine-search')?.value.trim().toLowerCase() || '';
  const selectedType = document.getElementById('machine-type-filter')?.value || 'all';
  const selectedStatus = document.getElementById('machine-status-filter')?.value || 'all';
  const rows = [...document.querySelectorAll('[data-machine-row]')];
  let visible = 0;
  rows.forEach(row => {
    const matches = row.dataset.machineSearch.includes(query) &&
      (selectedType === 'all' || row.dataset.machineType === selectedType) &&
      (selectedStatus === 'all' || row.dataset.machineState === selectedStatus);
    row.hidden = !matches;
    if (matches) visible++;
  });
  const count = document.getElementById('machine-result-count');
  if (count) count.textContent = `${visible} of ${rows.length} machines`;
  const empty = document.getElementById('machine-filter-empty');
  if (empty) empty.hidden = visible > 0;
}
function itemControls() { const prices=currentItemPrices(); return `<div class="item-grid">${ITEMS.map((item,i)=>`<div class="item-control"><div class="item-top"><span>${esc(item)}</span><span class="item-rate">₹${prices[i].toFixed(2)} each</span></div><div class="qty-control"><button type="button" data-qty="${i}" data-delta="-1" aria-label="Decrease ${esc(item)}">−</button><input name="item_${i}" id="item_${i}" value="${i===0?1:0}" type="number" min="0" max="20" readonly aria-label="${esc(item)} quantity"><button type="button" data-qty="${i}" data-delta="1" aria-label="Increase ${esc(item)}">+</button><span id="item-cost-${i}" class="item-line-cost">₹0.00</span></div></div>`).join('')}</div>`; }
function billingSummary(items, prices) {
  const rows=ITEMS.map((name,index)=>({name,quantity:Number(items?.[index]||0),price:Number(prices?.[index]??ITEM_PRICES[index])})).filter(item=>item.quantity>0);
  if(!rows.length) return '<p class="billing-empty">Select clothing items to see your cost breakdown.</p>';
  return `<div class="table-wrap billing-table-wrap"><table class="data-table billing-table"><thead><tr><th>Clothing item</th><th>Unit price</th><th>Quantity</th><th>Item total</th></tr></thead><tbody>${rows.map(item=>`<tr><td>${esc(item.name)}</td><td>₹${item.price.toFixed(2)}</td><td>${item.quantity}</td><td>₹${(item.price*item.quantity).toFixed(2)}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="3">Grand total</th><th>₹${rows.reduce((sum,item)=>sum+item.price*item.quantity,0).toFixed(2)}</th></tr></tfoot></table></div>`;
}
function selectableMachines(date, slot, excludeId = '') {
  if (!date || !slot || slotIsPast(date, slot)) return [];
  try {
    const latest = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    if (latest && typeof latest === 'object' && !Array.isArray(latest)) users = latest;
  } catch {}
  const activeBookings = allBookings().filter(booking =>
    booking.id !== excludeId && !['Cancelled', 'Collected', 'Completed'].includes(booking.status)
  );
  return machineCatalog().filter(machine => machine.state === 'Available' && !activeBookings.some(booking => {
    const assignedToMachine = booking.machineId === machine.id ||
      (!booking.machineId && booking.machineName === machine.name);
    if (!assignedToMachine) return false;
    if (['Received', 'Washing', 'Drying'].includes(booking.status)) return true;
    return booking.date === date && booking.slot === slot;
  }));
}
function refreshMachineOptions() {
  const date = document.getElementById('booking-date')?.value;
  const slotInput = document.getElementById('booking-slot');
  const machineSelect = document.getElementById('booking-machine');
  if (!slotInput || !machineSelect) return;
  if (!date) {
    slotInput.value = '';
    machineSelect.innerHTML = '<option value="">Choose a date first</option>';
    return;
  }

  const availabilityDate = document.getElementById('availability-date');
  if (availabilityDate && availabilityDate.value !== date) {
    availabilityDate.value = date;
    refreshSlotAvailability();
  }

  if (slotInput.value && slotIsPast(date, slotInput.value)) slotInput.value = '';
  const slot = slotInput.value;
  if (!slot) {
    machineSelect.innerHTML = '<option value="">Choose an available time first</option>';
    return;
  }

  const previous = machineSelect.value;
  const options = selectableMachines(date, slot);
  const emptyLabel = options.length ? 'Choose an available machine' : 'No machines available for this slot';
  machineSelect.innerHTML = `<option value="">${emptyLabel}</option>${options.map(machine=>`<option value="${esc(machine.id)}">${esc(machine.name)} · ${esc(machine.type)}</option>`).join('')}`;
  if (options.some(machine=>machine.id===previous)) machineSelect.value = previous;
}
function machineAvailabilityPanel(date = localDateString()) {
  const min = localDateString();
  const openSlots = TIME_SLOTS.filter(slot => !slotIsPast(date, slot) && selectableMachines(date, slot).length > 0).length;
  return `<section class="card slot-availability combined-availability"><div class="section-title"><div><span class="eyebrow">STEP 1 · AVAILABILITY</span><h3>Choose a date and time</h3><p>Available machines are checked against your selected date and each time slot.</p></div><span class="date-availability-summary ${openSlots?'':'has-no-slots'}" id="date-availability-summary" aria-live="polite">${openSlots} of ${TIME_SLOTS.length} time slots available</span></div><div class="field"><label for="availability-date">Laundry date</label><input type="date" id="availability-date" min="${min}" value="${esc(date)}" onchange="handleAvailabilityDateChange(this.value)"></div><div id="slot-availability-list" class="slot-availability-list">${slotAvailabilityRows(date, bookingPrefill?.slot || '')}</div></section>`;
}
function renderBook() {
 const initialDate = bookingPrefill?.date || defaultBookingDate();
 const initialSlot = bookingPrefill?.slot || '';
 return `${heading('Book your laundry','Choose a date and available time first, then select a machine and add your laundry items.') }${machineAvailabilityPanel(initialDate)}<form id="booking-form" class="card form-card"><div class="form-section-title">STEP 2 · SELECT A MACHINE</div><input type="hidden" id="booking-date" name="date" value="${esc(initialDate)}"><input type="hidden" id="booking-slot" name="slot" value="${esc(initialSlot)}"><div class="field"><label for="booking-machine">Available machines for your selected time</label><select id="booking-machine" name="machineId" required><option value="">Choose a date and time first</option></select><small class="machine-data-note">Only machines available for the selected date and time are listed. Availability is a local demo estimate.</small></div><div class="notice">Choose clothing items and review the estimated weight and cost before confirming your slot.</div><div class="form-section-title" style="margin-top:24px">STEP 3 · ADD LAUNDRY ITEMS</div>${itemControls()}<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 0;color:var(--muted);font-size:13px"><span>Total items: <strong id="item-total" style="color:var(--ink)">0</strong></span><span>Estimated weight: <strong id="weight-total" style="color:var(--ink)">0.0 kg</strong></span><span>Laundry total: <strong id="price-total" style="color:var(--ink)">₹0.00</strong></span></div><section class="billing-summary" aria-live="polite"><h3>Cost breakdown</h3><div id="booking-billing-summary">${billingSummary([],currentItemPrices())}</div></section><div class="two-col"><div class="field"><span class="group-label">Wash type</span><div class="radio-row"><label class="radio-choice"><input type="radio" name="washType" value="Regular" checked><span>Regular</span></label><label class="radio-choice"><input type="radio" name="washType" value="Delicate"><span>Delicate</span></label></div></div><div class="field"><label for="instructions">Special washing instructions (optional)</label><input id="instructions" name="instructions" maxlength="240" placeholder="e.g. cold water, gentle cycle"></div></div><div class="form-actions"><button type="button" class="secondary" data-page="dashboard">Cancel</button><button class="primary" type="submit">Confirm booking →</button></div></form>`;
}
function renderTracking() { const list=bookings().filter(b=>!['Completed','Cancelled','Collected'].includes(b.status)); const completed=bookings().filter(b=>['Completed','Collected'].includes(b.status)); const display=[...list,...completed.slice(-3).reverse()]; return `${heading('Laundry order progress','See each order move from booking through pickup.') }<div class="card">${display.length?`<div class="order-timeline-list">${display.map(b=>{const stage=b.status==='Confirmed'?'Booked':b.status==='Ready for collection'?'Ready for Pickup':b.status==='Completed'?'Collected':b.status;const current=Math.max(0,ORDER_STAGES.indexOf(stage));return `<article class="order-track"><div class="order-track-head"><div><div class="history-title">${esc(b.id)} · ${esc(b.date)}</div><div class="history-detail">${esc(b.machineName||'Machine not assigned')} · ${esc(b.slot)} · ${esc(b.total)} items</div></div><span class="badge ${badgeClass(b.status)}">${esc(stage)}</span></div><ol class="progress-timeline" aria-label="Order progress">${ORDER_STAGES.map((label,index)=>`<li class="${index<current?'done':index===current?'current':''}"><span class="timeline-node">${index<current?'✓':index+1}</span><span>${label}</span></li>`).join('')}</ol><div class="order-actions"><button class="secondary" data-action="qr" data-id="${esc(b.id)}">Booking ID</button>${!['Completed','Collected','Cancelled'].includes(b.status)?`<button class="text-button" data-action="progress" data-id="${esc(b.id)}">Advance demo status →</button>`:''}${canCancelBooking(b)?`<button class="text-button" style="color:var(--red)" type="button" data-action="cancel-slot" data-id="${esc(b.id)}">Cancel slot</button>`:''}</div></article>`;}).join('')}</div><div class="notice">Progress shown here is stored locally for this demo. Automatic updates require a connected order-management backend.</div>`:`<div class="empty-state"><div class="empty-icon">◷</div><h3>Nothing to track</h3><p>Your laundry orders and their progress will appear here.</p><button class="primary" data-page="book">Book a slot</button></div>`}</div>`; }
function renderHistory() { return `${heading('Booking history','All your current and past laundry bookings.') }<div class="card">${renderRecent()}</div>`; }
function relativeTime(value) { const date=new Date(value); if(!Number.isFinite(date.getTime())) return 'Date unavailable'; return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date); }
function safeIsoDate(value) { const date=new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : ''; }
function renderNotifications() {
  const list=notifications();
  return `${heading('Notification center','Booking, order, machine, payment, and pickup updates in one place.') }<div class="card"><div class="section-title"><div><h3>Your updates</h3><p>${list.filter(n=>!n.read).length} unread</p></div><button class="secondary" data-action="mark-all-read" ${list.some(n=>!n.read)?'':'disabled'}>Mark all as read</button></div><div class="field"><label for="notification-filter">Category</label><select id="notification-filter"><option value="all">All categories</option><option>Booking</option><option>Order update</option><option>Machine availability</option><option>Payment</option><option>Pickup reminder</option></select></div><div class="notification-list">${list.length?list.map(n=>`<article class="notification-item ${n.read?'is-read':'is-unread'}" data-notification-category="${esc(n.category)}"><div class="stat-icon">${n.category==='Payment'?'₹':n.category==='Machine availability'?'◉':n.category==='Pickup reminder'?'✓':'◷'}</div><div class="notification-copy"><p><strong>${esc(n.title)}</strong>${n.reference?` · ${esc(n.reference)}`:''}</p><small>${esc(n.message)}</small><time datetime="${safeIsoDate(n.createdAt)}">${relativeTime(n.createdAt)}</time></div>${n.read?'<span class="read-label">Read</span>':`<button class="text-button" data-action="mark-read" data-id="${esc(n.id)}">Mark as read</button>`}</article>`).join(''):`<div class="empty-state"><div class="empty-icon">♧</div><h3>No notifications yet</h3><p>Recent booking, order, machine, payment, and pickup updates will appear here.</p></div>`}</div></div></div>`;
}
function downloadTransactionReceipt(id) {
  const tx=transactions().find(item=>item.id===id); if(!tx) return;
  const receiptText=`LAUNDRY PAYMENT RECEIPT\nTransaction: ${tx.id}\nType: ${tx.type}\nAmount: ₹${Number(tx.amount||0).toFixed(2)}\nBooking: ${tx.bookingId||'Not linked'}\nDate: ${relativeTime(tx.createdAt)}\nStatus: ${tx.status||'Recorded locally'}\n\nLocal demo record — not proof of a processed payment.`;
  const url=URL.createObjectURL(new Blob([receiptText],{type:'text/plain'})); const link=document.createElement('a'); link.href=url; link.download=`laundry-payment-${tx.id}.txt`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderWallet() {
  const list=transactions().slice().sort((a,b)=>Number(b.createdAt)-Number(a.createdAt));
  const charges=list.filter(t=>String(t.type).toLowerCase()==='charge').reduce((sum,t)=>sum+Number(t.amount||0),0);
  const refunds=list.filter(t=>String(t.type).toLowerCase()==='refund').reduce((sum,t)=>sum+Number(t.amount||0),0);
  return `${heading('Wallet & receipts','Review locally recorded transactions and payment receipts.') }<div class="grid stats-grid wallet-summary"><article class="card stat-card"><div><div class="stat-label">Demo wallet balance</div><div class="stat-value">₹${Number(user().balance ?? 0).toFixed(2)}</div><div class="stat-note">Sample only · no payment processing</div></div><div class="stat-icon">₹</div></article><article class="card stat-card"><div><div class="stat-label">Recorded charges</div><div class="stat-value">₹${charges.toFixed(2)}</div><div class="stat-note">Recorded in your account</div></div><div class="stat-icon">−</div></article><article class="card stat-card"><div><div class="stat-label">Recorded refunds</div><div class="stat-value">₹${refunds.toFixed(2)}</div><div class="stat-note">Recorded in your account</div></div><div class="stat-icon">↩</div></article></div><div class="card"><div class="section-title"><div><h3>Transaction history</h3><p>Recent charges and refunds</p></div></div>${list.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Transaction</th><th>Type</th><th>Booking</th><th>Date</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>${list.map(t=>`<tr><td><strong>${esc(t.id)}</strong></td><td>${esc(t.type||'Transaction')}</td><td>${esc(t.bookingId||'—')}</td><td>${esc(relativeTime(t.createdAt))}</td><td>₹${Number(t.amount||0).toFixed(2)}</td><td>${esc(t.status||'Recorded locally')}</td><td><button class="text-button" data-action="transaction-receipt" data-id="${esc(t.id)}">Download</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><div class="empty-icon">₹</div><h3>No transactions recorded</h3><p>No payment or refund records are available in this browser account.</p></div>`}</div>`;
}
function chartCard(title, subtitle, labels, values, suffix='') {
  const max=Math.max(1,...values);
  return `<article class="card analytics-card"><div class="section-title"><div><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div></div>${values.some(value=>value>0)?`<div class="bar-chart" role="img" aria-label="${esc(title)} chart">${values.map((value,index)=>`<div class="bar-column"><strong>${esc(`${value}${suffix}`)}</strong><div class="bar-track"><span style="height:${Math.max(value?7:0,Math.round(value/max*100))}%"></span></div><small title="${esc(labels[index])}">${esc(labels[index])}</small></div>`).join('')}</div>`:`<div class="chart-empty">No records available yet.</div>`}</article>`;
}
function renderMachineUtilization() {
  const assigned = machines().map(machine => ({
    machine,
    count: bookings().filter(booking => booking.status !== 'Cancelled' &&
      (booking.machineId === machine.id || (!booking.machineId && booking.machineName === machine.name))).length
  }));
  const max = Math.max(1, ...assigned.map(item => item.count));
  const total = assigned.reduce((sum, item) => sum + item.count, 0);
  return `<article class="card analytics-card machine-utilization"><div class="section-title"><div><h3>Machine utilization</h3><p>Bookings assigned per machine · ${total} active or completed assignments</p></div><span class="quick-action-mark" aria-hidden="true">◉</span></div>${total ? `<div class="utilization-list">${assigned.map(({machine,count}) => `<div class="utilization-row"><div class="utilization-label"><strong>${esc(machine.name)}</strong><span class="machine-id">${esc(machine.id)}</span><span class="utilization-count">${count} booking${count===1?'':'s'}</span></div><div class="utilization-track" role="progressbar" aria-label="${esc(machine.name)} assigned bookings" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${count}"><span style="width:${Math.round(count/max*100)}%"></span></div><span class="status-pill ${machine.state==='Available'?'available':machine.state==='Running'?'busy':machine.state==='Reserved'?'reserved':'maintenance'}"><span class="status-dot"></span>${esc(machine.state)}</span></div>`).join('')}</div>` : `<div class="utilization-empty"><div class="empty-icon">◉</div><strong>No booking records available yet</strong><p>Machine assignment totals will appear here after you book a slot.</p><button class="secondary" data-page="book">Book a slot →</button><div class="utilization-list utilization-zero-list">${assigned.map(({machine})=>`<div class="utilization-row"><div class="utilization-label"><strong>${esc(machine.name)}</strong><span class="machine-id">${esc(machine.id)}</span></div><div class="utilization-track" aria-hidden="true"><span></span></div><span class="utilization-count">0 bookings</span></div>`).join('')}</div></div>`}</article>`;
}
function renderAnalytics() {
  const all=bookings();
  const buckets=Array.from({length:6},(_,index)=>{const date=new Date();date.setDate(1);date.setMonth(date.getMonth()-(5-index));return {key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`,label:date.toLocaleDateString(undefined,{month:'short'})};});
  const recordedMonthBookings=buckets.map(bucket=>all.filter(b=>String(b.date||'').slice(0,7)===bucket.key).length);
  const monthBookings=recordedMonthBookings;
  const recordedMonthSpend=buckets.map(bucket=>transactions().filter(t=>monthKey(t.createdAt)===bucket.key).reduce((sum,t)=>sum+(String(t.type).toLowerCase()==='refund'?-1:1)*Number(t.amount||0),0));
  const monthSpend=recordedMonthSpend;
  const recordedItemCounts=ITEMS.map((name,index)=>({name,count:all.reduce((sum,b)=>sum+Number((b.items||[])[index]||0),0)})).filter(item=>item.count).sort((a,b)=>b.count-a.count).slice(0,6);
  const itemCounts=recordedItemCounts;
  const completed=all.filter(b=>['Completed','Collected'].includes(b.status));
  const pending=all.filter(b=>!['Completed','Collected','Cancelled'].includes(b.status));
  const totalSpend=transactions().reduce((sum,t)=>sum+(String(t.type).toLowerCase()==='refund'?-1:1)*Number(t.amount||0),0);
  return `${heading('Laundry analytics','A snapshot of laundry activity, item usage, and spending trends.') }<div class="grid stats-grid analytics-stats"><article class="card stat-card"><div><div class="stat-label">Total bookings</div><div class="stat-value">${all.length}</div><div class="stat-note">Saved booking records</div></div><div class="stat-icon">▤</div></article><article class="card stat-card"><div><div class="stat-label">Completed orders</div><div class="stat-value">${completed.length}</div><div class="stat-note">Collected or completed</div></div><div class="stat-icon">✓</div></article><article class="card stat-card"><div><div class="stat-label">Pending orders</div><div class="stat-value">${pending.length}</div><div class="stat-note">Not yet collected</div></div><div class="stat-icon">◷</div></article><article class="card stat-card"><div><div class="stat-label">Recorded spend</div><div class="stat-value">₹${totalSpend.toFixed(2)}</div><div class="stat-note">Laundry charges after refunds</div></div><div class="stat-icon">₹</div></article></div><div class="grid analytics-grid">${chartCard('Monthly bookings','Bookings by date · last six months',buckets.map(b=>b.label),monthBookings)}${chartCard('Laundry item usage','Garment quantities processed',itemCounts.map(item=>item.name),itemCounts.map(item=>item.count),' items')}${chartCard('Spending trend','Net recorded charges less refunds',buckets.map(b=>b.label),monthSpend.map(value=>Number(Math.max(0,value).toFixed(2))),' ₹')}${chartCard('Completed orders','Completed or collected booking records',buckets.map(bucket=>bucket.label),buckets.map(bucket=>all.filter(b=>String(b.date||'').slice(0,7)===bucket.key&&['Completed','Collected'].includes(b.status)).length))}${renderMachineUtilization()}</div>`;
}
function renderFeedback() { return `${heading('Share your feedback','Help us make campus laundry better for everyone.') }<form id="feedback-form" class="card form-card"><div class="field"><label for="rating">How was your laundry experience?</label><select id="rating" name="rating" required><option value="">Choose a rating</option><option value="5">★★★★★ — Excellent</option><option value="4">★★★★ — Good</option><option value="3">★★★ — Okay</option><option value="2">★★ — Needs improvement</option><option value="1">★ — Poor</option></select></div><div class="field"><label for="feedback-message">Tell us more</label><textarea id="feedback-message" name="message" maxlength="1000" placeholder="What went well? What could be improved?" required></textarea></div><button class="primary" type="submit">Send feedback →</button></form>`; }
function renderComplaint() {
  const legacy=(Array.isArray(user().complaints)?user().complaints:[]).map((ticket,index)=>({id:`LEGACY-${index+1}`,category:ticket.type||'Other',description:ticket.message||'',bookingId:ticket.booking||'',priority:'Normal',createdAt:ticket.createdAt,status:'Submitted'}));
  const tickets=[...legacy,...(Array.isArray(user().tickets)?user().tickets:[])].sort((a,b)=>Number(b.createdAt)-Number(a.createdAt));
  return `${heading('Support tickets','Send an issue to the support team and follow its status.') }<div class="grid dashboard-grid"><form id="support-ticket-form" class="card form-card"><div class="form-section-title">Create a ticket</div><div class="field"><label for="ticket-category">Issue category</label><select id="ticket-category" name="category" required><option value="">Choose a category</option><option>Machine</option><option>Payment</option><option>Booking</option><option>Missing item</option><option>Other</option></select></div><div class="field"><label for="ticket-booking">Related booking (optional)</label><select id="ticket-booking" name="booking"><option value="">Select a booking</option>${bookings().map(b=>`<option value="${esc(b.id)}">${esc(b.id)} · ${esc(b.date)}</option>`).join('')}</select></div><div class="field"><label for="ticket-priority">Priority</label><select id="ticket-priority" name="priority" required><option>Normal</option><option>High</option><option>Urgent</option></select></div><div class="field"><label for="ticket-description">Description</label><textarea id="ticket-description" name="description" maxlength="1000" required placeholder="Describe what happened and what help you need."></textarea></div><button class="primary" type="submit">Submit support ticket →</button><p class="fine-print">Tickets are saved in this browser account only and are not sent to campus staff.</p></form><div class="card"><div class="section-title"><div><h3>My tickets</h3><p>${tickets.length} locally saved</p></div></div>${tickets.length?`<div class="history-list">${tickets.map(t=>`<article class="history-row ticket-row"><div><div class="history-title">${esc(t.id)} · ${esc(t.category)}</div><div class="history-detail">${esc(t.description)}${t.bookingId?` · Booking ${esc(t.bookingId)}`:''}</div><div class="history-detail">Submitted ${esc(relativeTime(t.createdAt))} · Priority: ${esc(t.priority)}</div></div><span class="badge ${t.status==='Resolved'?'completed':'in-progress'}">${esc(t.status||'Submitted')}</span></article>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">⚑</div><h3>No support tickets yet</h3><p>Your submitted issue reports will appear here.</p></div>`}<div class="notice">Ticket IDs and statuses are local demo records. Shared staff responses and status updates require a backend.</div></div></div>`;
}
function renderLostFound() { const reports=(user().lostFound||[]).slice().reverse(); return `${heading('Lost & found','Report an item or check your saved reports.') }<div class="grid dashboard-grid"><form id="lost-found-form" class="card form-card"><div class="form-section-title">Create a report</div><div class="field"><label for="lost-kind">I am reporting</label><select id="lost-kind" name="kind" required><option value="Lost">I lost an item</option><option value="Found">I found an item</option></select></div><div class="field"><label for="lost-item">Item</label><input id="lost-item" name="item" maxlength="80" required placeholder="e.g. navy hoodie"></div><div class="field"><label for="lost-location">Last seen / found location</label><input id="lost-location" name="location" maxlength="100" required placeholder="Building, room, or laundry area"></div><div class="field"><label for="lost-details">Details</label><textarea id="lost-details" name="details" maxlength="500" placeholder="Color, brand, or other identifying details"></textarea></div><button class="primary" type="submit">Save report</button><p class="fine-print">Reports are stored only in this browser account. They are not shared with campus staff or other students.</p></form><div class="card"><div class="section-title"><div><h3>My reports</h3><p>Your lost and found reports on this device</p></div><select id="lost-filter" aria-label="Filter reports"><option value="all">All reports</option><option value="Lost">Lost</option><option value="Found">Found</option></select></div>${reports.length?`<div class="history-list">${reports.map(r=>`<div class="history-row" data-lost-kind="${esc(r.kind)}"><div class="history-main"><div class="machine-symbol">${r.kind==='Lost'?'⌕':'✓'}</div><div><div class="history-title">${esc(r.kind)} · ${esc(r.item)}</div><div class="history-detail">${esc(r.location)}${r.details?` · ${esc(r.details)}`:''}</div><div class="history-detail">${new Date(r.createdAt).toLocaleDateString()}</div></div></div><span class="badge ${r.kind==='Found'?'completed':'in-progress'}">${esc(r.kind)}</span></div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-icon">⌕</div><h3>No reports yet</h3><p>Your saved lost and found reports will appear here.</p></div>`}</div></div>`; }
function renderHelp() { return `${heading('Help & support','Need a hand? Find answers or contact the laundry team.') }<div class="grid dashboard-grid"><div class="card"><div class="section-title"><div><h3>Frequently asked questions</h3></div></div><div class="history-list"><div><strong>How do I book a machine?</strong><p class="subtle" style="margin:6px 0">Choose Book a slot, pick a date and time, add your items, then confirm.</p></div><div><strong>Can I cancel a booking?</strong><p class="subtle" style="margin:6px 0">Eligible upcoming bookings can be cancelled from Booking history.</p></div><div><strong>What do I show at handover?</strong><p class="subtle" style="margin:6px 0">Show your booking ID to laundry staff when you drop off your laundry.</p></div></div></div><div class="card slot-card"><div class="empty-icon">✉</div><h3>Contact administration</h3><p>For urgent laundry queries, contact Lovely Professional University (LPU) campus services in Phagwara, Punjab.</p><p>Lovely Professional University, Jalandhar–Delhi G.T. Road, Phagwara, Punjab 144411.</p><a class="secondary" style="display:inline-block;text-decoration:none" href="https://www.lpu.in/" target="_blank" rel="noopener">Visit LPU website</a></div></div>`; }
function profileForm() {
  const p=user().profile||{};
  return `<form id="profile-form" class="card form-card"><div class="profile-header"><div class="avatar">${safePhoto(p.photo)?`<img src="${esc(safePhoto(p.photo))}" alt="Profile photo">`:esc(initials(p.fullName||user().name))}</div><div style="flex:1"><strong>${p.fullName?'Profile saved':'Complete your student profile'}</strong><div class="profile-progress"><span style="width:${profilePercent(p)}%"></span></div><small style="color:var(--muted)">${profilePercent(p)}% complete · Last login ${new Date(user().lastLogin||Date.now()).toLocaleDateString()}</small></div></div><div class="field"><label for="photo">Profile photo (optional)</label><input type="file" id="photo" accept="image/jpeg,image/png,image/webp"><small style="color:var(--muted)">Optional · image stays in this browser and is limited to 500 KB.</small></div><div class="form-section-title">Student information</div><p class="demo-field-note">Example values are shown in the fields to explain the format. Use made-up details only; do not enter real personal information.</p><div class="two-col"><div class="field"><label for="regno">Registration number</label><input id="regno" name="regno" required maxlength="30" value="${esc(p.regno||'')}" placeholder="e.g. 12345678"></div><div class="field"><label for="fullname">Full name</label><input id="fullname" name="fullName" required maxlength="80" value="${esc(p.fullName||user().name||'')}" placeholder="e.g. Alex Student"></div><div class="field"><label for="age">Age</label><input id="age" name="age" type="number" required min="16" max="100" value="${esc(p.age||'')}" placeholder="e.g. 20"></div><div class="field"><label>Email address</label><input type="email" value="${esc(user().email)}" disabled><small style="color:var(--muted)">Email verification is not available in this browser demo.</small></div><div class="field"><label for="mobile">Mobile number</label><input id="mobile" name="mobile" type="tel" inputmode="numeric" pattern="[0-9]{7,15}" required value="${esc(p.mobile||'')}" placeholder="e.g. 0000000000"></div><div class="field"><span class="group-label">Gender</span><div class="radio-row"><label class="radio-choice"><input type="radio" name="gender" value="Male" ${p.gender==='Male'?'checked':''} required><span>Male</span></label><label class="radio-choice"><input type="radio" name="gender" value="Female" ${p.gender==='Female'?'checked':''}><span>Female</span></label><label class="radio-choice"><input type="radio" name="gender" value="Prefer not to say" ${p.gender==='Prefer not to say'?'checked':''}><span>Prefer not to say</span></label></div><small class="field-hint">Example: choose “Prefer not to say” for a demo.</small></div><div class="field"><label for="building">Building number</label><input id="building" name="building" required maxlength="20" value="${esc(p.building||'')}" placeholder="e.g. 01"></div><div class="field"><label for="room">Room number</label><input id="room" name="room" required maxlength="20" value="${esc(p.room||'')}" placeholder="e.g. 000"></div><div class="field"><span class="group-label">Hostel block</span><div class="radio-row">${['A','B','C','D'].map(block=>`<label class="radio-choice"><input type="radio" name="block" value="${block}" ${p.block===block?'checked':''} required><span>${block}</span></label>`).join('')}</div><small class="field-hint">Example: choose block A for a demo.</small></div></div><div class="notice">Your details are stored in this browser only. Do not use real sensitive information in this demo. A secure production system needs a protected backend and verified contact details.</div><div class="form-actions"><button class="primary" type="submit">${p.fullName?'Save profile changes':'Save profile and continue'} →</button></div></form>`;
}
function profilePercent(p={}) { const keys=['regno','fullName','age','gender','mobile','building','room','block']; return Math.round(keys.filter(k=>p[k]).length/keys.length*100); }
function renderProfile() { const p=user().profile||{}; return `${heading('Student profile',p.fullName?'Review or update your saved student details.':'Complete your profile to open the student dashboard.') }${p.fullName?`<div class="card" style="max-width:900px;margin-bottom:17px"><div class="section-title"><div><h3>Account status</h3><p>Student account · ${esc(user().email)}</p></div><span class="status-pill available">Active</span></div><div class="profile-progress"><span style="width:${profilePercent(p)}%"></span></div><small style="color:var(--muted)">Profile ${profilePercent(p)}% complete · Last login ${new Date(user().lastLogin||Date.now()).toLocaleString()}</small></div>`:''}${profileForm()}${p.fullName?`<div class="card" style="max-width:900px;margin-top:17px"><div class="section-title"><div><h3>Profile history</h3><p>Saved profile revisions on this device</p></div></div>${(user().profileHistory||[]).slice().reverse().map((entry,i)=>`<div class="notification-item"><div class="stat-icon">${i?'▤':'✓'}</div><div><p><strong>${i?'Previous profile saved':'Current profile saved'}</strong></p><small>${new Date(entry.savedAt).toLocaleString()} · ${esc(entry.fullName)} · Block ${esc(entry.block)}</small></div></div>`).join('')||'<p class="subtle">No saved profile history yet.</p>'}</div>`:''}<div class="card form-card" style="margin-top:17px"><div class="section-title"><div><h3>Change password</h3><p>Update the password used for this browser demo account.</p></div></div><form id="password-form"><div class="two-col"><div class="field"><label for="old-password">Current password</label><input id="old-password" name="old-password" type="password" autocomplete="current-password" required></div><div class="field"><label for="new-password">New password</label><input id="new-password" name="new-password" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label for="confirm-new-password">Confirm new password</label><input id="confirm-new-password" name="confirm-new-password" type="password" autocomplete="new-password" minlength="8" required></div></div><button class="secondary" type="submit">Update password</button></form></div>`; }
function renderSettings() {
  const settings=user().settings||{};
  const sessions=(user().sessions||[]).slice().reverse();
  const activity=(user().loginActivity||[]).slice(0,8);
  return `${heading('Settings','Manage accessibility preferences and review local account activity.') }<div class="grid dashboard-grid"><div class="card form-card"><div class="form-section-title">Preferences</div><div class="field"><label for="language">Language</label><select id="language"><option ${settings.language==='English'?'selected':''}>English</option><option ${settings.language==='Telugu'?'selected':''}>Telugu</option></select><small style="color:var(--muted)">Language selection is saved; translations are not included in this demo.</small></div><div class="field"><label for="font-size">Text size</label><select id="font-size"><option value="15" ${settings.fontSize==='15'?'selected':''}>Standard</option><option value="17" ${settings.fontSize==='17'?'selected':''}>Large</option><option value="19" ${settings.fontSize==='19'?'selected':''}>Extra large</option></select></div><div class="field"><label><input id="high-contrast" type="checkbox" ${settings.contrast?'checked':''}> Enable higher contrast</label></div><button class="primary" data-action="save-settings">Save preferences</button><div class="form-section-title" style="margin-top:28px">Account controls</div><button class="secondary" data-page="profile">Edit student profile</button><p class="fine-print">Password changes are available on your profile page. For security, use a unique password.</p><button class="danger-btn" data-action="logout">Sign out of this device</button></div><div class="card"><div class="section-title"><div><h3>Active sessions</h3><p>Sessions recorded by this browser only</p></div></div>${sessions.length?`<div class="history-list">${sessions.map(session=>`<div class="history-row"><div><div class="history-title">${esc(session.label||'Browser session')}</div><div class="history-detail">Signed in ${esc(relativeTime(session.signedInAt))}<br>Last active ${esc(relativeTime(session.lastSeenAt))}</div></div><span class="badge ${session.active?'completed':'cancelled'}">${session.active?'Active':'Ended'}</span></div>`).join('')}</div>`:'<p class="subtle">No session activity recorded yet.</p>'}<button class="text-button" data-action="revoke-other-sessions">End previous local sessions</button><div class="form-section-title" style="margin-top:25px">Login activity</div>${activity.length?activity.map(entry=>`<div class="notification-item"><div class="stat-icon">◷</div><div><p><strong>${esc(entry.label)}</strong></p><small>${esc(relativeTime(entry.at))}</small></div></div>`).join(''):'<p class="subtle">No login activity recorded.</p>'}</div></div><div class="notice">This browser demo stores account data and passwords locally without secure server-side authentication. Session activity is device-local and cannot identify or revoke sessions on other devices. A production service needs backend authentication, validation, and secure session controls.</div>`;
}
function renderPrices() { const prices=currentItemPrices(); return `${heading('Manage washing prices','Review and update the washing charge for each clothing item.') }<form id="prices-form" class="card form-card"><div class="section-title"><div><h3>Clothing washing charges</h3><p>Changes are saved in this browser and apply to new bookings.</p></div></div><div class="price-management-list">${ITEMS.map((item,index)=>`<div class="price-management-row"><label for="washing-price-${index}">${esc(item)}</label><div class="price-input-wrap"><span>₹</span><input id="washing-price-${index}" name="price_${index}" type="number" min="0" step="0.01" value="${prices[index].toFixed(2)}" required></div></div>`).join('')}</div><div class="form-actions"><button class="primary" type="submit">Save washing prices</button></div></form>`; }
function renderPage() { if (!user().profile && page !== 'profile') page='profile'; return ({dashboard:renderDashboard,machines:renderMachines,book:renderBook,tracking:renderTracking,history:renderHistory,notifications:renderNotifications,wallet:renderWallet,analytics:renderAnalytics,feedback:renderFeedback,complaint:renderComplaint,'lost-found':renderLostFound,help:renderHelp,profile:renderProfile,settings:renderSettings,prices:renderPrices}[page]||renderDashboard)(); }

function showModal(title, body) { app.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" data-action="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h3>${title}</h3><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>${body}</div></div>`); }
function findBooking(id) { return bookings().find(b=>b.id===id); }
function saveBookingUpdate(id, updater) { const b=findBooking(id); if (!b) return; updater(b); saveStore(); }
function qrPattern(code) { let seed=0; for(const ch of code) seed=(seed*31+ch.charCodeAt(0))>>>0; let cells=''; for(let i=0;i<121;i++){seed=(seed*1664525+1013904223)>>>0; const x=i%11,y=Math.floor(i/11); const finder=(x<3&&y<3)||(x>7&&y<7)||(x<3&&y>7); const dark=finder ? ((x%8===0||y%8===0||x%8===2||y%8===2) && !(x%8===1&&y%8===1)) : seed%2===0; cells+=`<i class="qr-cell ${dark?'dark':''}"></i>`;} return cells; }
function openQR(id) { const b=findBooking(id); if(!b)return; showModal('Booking handover code',`<div class="qr-placeholder">${qrPattern(b.id)}</div><div class="verify-code">${esc(b.id)}</div><p class="subtle" style="text-align:center;margin:8px 0">${esc(b.date)} · ${esc(b.slot)}</p><div class="notice">This visual code is a demo identifier, not a standards-compliant scannable QR. Staff verification requires a connected backend.</div><button class="primary full" data-action="close-modal">Done</button>`); }
function receipt(id) { const b=findBooking(id); if(!b)return; const prices=b.itemPrices||ITEM_PRICES; const rows=ITEMS.map((name,i)=>{const quantity=Number(b.items[i]||0);return quantity?`${name}: ${quantity} × ₹${Number(prices[i]||0).toFixed(2)} = ₹${(quantity*Number(prices[i]||0)).toFixed(2)}`:''}).filter(Boolean).join('\n'); const washCost=Number(b.washCost ?? b.items.reduce((sum,quantity,i)=>sum+Number(quantity||0)*Number(prices[i]||0),0)); const text=`WASH MATE LAUNDRY RECEIPT\nBooking: ${b.id}\nStudent: ${user().profile?.fullName||user().name}\nDate: ${b.date}\nTime: ${b.slot}\nStatus: ${b.status}\nWash type: ${b.washType}\nTotal items: ${b.total}\nEstimated weight: ${b.weight} kg\n\nITEMS\n${rows}\n\nEstimated wash cost: ₹${washCost.toFixed(2)}\nSpecial instructions: ${b.instructions||'None'}\n\nDemo receipt — no payment processed.`; const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`wash-mate-${b.id}.txt`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('Receipt downloaded'); }
function openReschedule(id) { const b=findBooking(id); if(!b||!canRescheduleBooking(b)){toast('Only booked or confirmed reservations can be rescheduled.');return;} const min=localDateString(); const initialDate=b.date>=min&&!slotIsPast(b.date,b.slot)?b.date:defaultBookingDate(); showModal('Reschedule booking',`<form id="reschedule-form" data-id="${esc(id)}"><div class="field"><label for="new-date">New date</label><input type="date" id="new-date" name="date" min="${min}" value="${esc(initialDate)}" required></div><div class="field"><label for="new-slot">New time</label><select id="new-slot" name="slot" required>${TIME_SLOTS.map(s=>`<option ${b.slot===s&&initialDate===b.date?'selected':''}>${s}</option>`).join('')}</select></div><button class="primary full">Save new slot</button></form>`); }
function progressModal(id) { const b=findBooking(id); if(!b)return; const current=b.status==='Confirmed'?'Booked':b.status==='Ready for collection'?'Ready for Pickup':b.status==='Completed'?'Collected':b.status; const index=ORDER_STAGES.indexOf(current); const next=ORDER_STAGES[Math.min(Math.max(index,0)+1,ORDER_STAGES.length-1)]; showModal('Update laundry progress',`<p class="subtle">Move <strong>${esc(b.id)}</strong> to its next stage.</p><div class="notice">This advances a local demo order only. Staff and student devices will not sync without a backend.</div><button class="primary full" data-action="set-progress" data-id="${esc(id)}" data-status="${esc(next)}">Mark as ${esc(next)}</button>`); }

document.addEventListener('keydown', e=>{
 if(e.key==='Escape'){
  document.querySelector('.modal-backdrop')?.remove();
 }
});
app.addEventListener('click', e => {
 const mode=e.target.closest('[data-auth-mode]'); if(mode){authMode=mode.dataset.authMode;renderAuth();return;}
 const pageButton=e.target.closest('[data-page]'); if(pageButton){go(pageButton.dataset.page);return;}
 const action=e.target.closest('[data-action]'); if(action){const {action:task,id,status}=action.dataset;
  if(task==='logout'){signOut();return;} if(task==='menu'){document.querySelector('.sidebar')?.classList.toggle('open');return;} if(task==='close-modal'){document.querySelector('.modal-backdrop')?.remove();return;} if(task==='booking-done'){document.querySelector('.modal-backdrop')?.remove();page='tracking';render();return;} if(task==='choose-slot'){openBookingForSlot(action.dataset.date,action.dataset.slot);return;} if(task==='cancel-slot'){cancelBookingSlot(id);return;} if(task==='receipt'){receipt(id);return;} if(task==='transaction-receipt'){downloadTransactionReceipt(id);return;} if(task==='mark-read'){const notification=notifications().find(item=>item.id===id);if(notification){notification.read=true;saveStore();render();}return;} if(task==='mark-all-read'){notifications().forEach(item=>item.read=true);saveStore();render();return;} if(task==='qr'){openQR(id);return;} if(task==='progress'){progressModal(id);return;} if(task==='set-progress'){saveBookingUpdate(id,b=>{b.status=status;if(['Collected','Completed'].includes(status))b.completedAt=Date.now();});document.querySelector('.modal-backdrop')?.remove();toast(`Booking marked ${status.toLowerCase()}`);render();return;} if(task==='reschedule'){openReschedule(id);return;} if(task==='revoke-other-sessions'){const sessions=user().sessions||[];sessions.forEach((session,index)=>session.active=index===sessions.length-1);saveStore();render();toast('Previous local sessions ended');return;} if(task==='save-settings'){users[currentEmail].settings={language:document.getElementById('language').value,fontSize:document.getElementById('font-size').value,contrast:document.getElementById('high-contrast').checked};saveStore();document.documentElement.style.fontSize=`${users[currentEmail].settings.fontSize}px`;document.body.classList.toggle('high-contrast',users[currentEmail].settings.contrast);toast('Preferences saved');return;} if(task==='backdrop'&&e.target===action){action.remove();return;}}
 const qty=e.target.closest('[data-qty]');if(qty){const input=document.getElementById(`item_${qty.dataset.qty}`);input.value=Math.max(0,Math.min(20,Number(input.value)+Number(qty.dataset.delta)));updateTotals();}
});
app.addEventListener('input', e=>{if(e.target.id==='booking-search'){const query=e.target.value.trim().toLowerCase();let matches=0;document.querySelectorAll('[data-booking-search]').forEach(row=>{const visible=row.dataset.bookingSearch.includes(query);row.hidden=!visible;if(visible)matches++;});const empty=document.querySelector('.booking-no-results');if(empty)empty.hidden=matches>0;return;}});
app.addEventListener('input', e=>{if(e.target.id==='machine-search')filterMachineRows();});
app.addEventListener('change', e=>{if(['booking-date','booking-slot'].includes(e.target.id)){refreshMachineOptions();return;}if(e.target.id==='notification-filter'){const selected=e.target.value;document.querySelectorAll('[data-notification-category]').forEach(row=>{row.hidden=selected!=='all'&&row.dataset.notificationCategory!==selected;});return;}if(e.target.id==='lost-filter'){document.querySelectorAll('[data-lost-kind]').forEach(row=>{row.hidden=e.target.value!=='all'&&row.dataset.lostKind!==e.target.value;});return;}if(e.target.id==='photo'){const file=e.target.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){e.target.value='';toast('Choose a JPEG, PNG, or WebP image');return;}if(file.size>500*1024){e.target.value='';toast('Choose an image smaller than 500 KB');return;}const reader=new FileReader();reader.onload=()=>{const photo=safePhoto(reader.result);if(!photo){toast('That image could not be used.');return;}users[currentEmail].pendingPhoto=photo;const avatar=document.querySelector('.profile-header .avatar');if(avatar){const image=document.createElement('img');image.src=photo;image.alt='Profile photo';avatar.replaceChildren(image);}};reader.readAsDataURL(file);}});
app.addEventListener('change', e=>{if(['machine-type-filter','machine-status-filter'].includes(e.target.id))filterMachineRows();});
function updateTotals(){let total=0,weight=0,cost=0;const prices=currentItemPrices();const quantities=ITEMS.map((_,i)=>{const q=Number(document.getElementById(`item_${i}`)?.value||0);total+=q;weight+=q*ITEM_WEIGHTS[i];cost+=q*prices[i];const line=document.getElementById(`item-cost-${i}`);if(line)line.textContent=`₹${(q*prices[i]).toFixed(2)}`;return q;});const t=document.getElementById('item-total');if(t)t.textContent=total;const w=document.getElementById('weight-total');if(w)w.textContent=`${weight.toFixed(1)} kg`;const p=document.getElementById('price-total');if(p)p.textContent=`₹${cost.toFixed(2)}`;const summary=document.getElementById('booking-billing-summary');if(summary)summary.innerHTML=billingSummary(quantities,prices);}
app.addEventListener('submit', e=>{
 e.preventDefault();const form=e.target;const data=new FormData(form);
 if(form.id==='auth-form'){const email=String(data.get('email')).trim().toLowerCase(),password=String(data.get('password'));if(authMode==='reset'){if(!users[email]){toast('No local account was found for that email.');return;}if(password!==String(data.get('confirmPassword'))){toast('The passwords do not match.');return;}users[email].password=password;saveStore();authMode='signin';renderAuth();toast('Password updated on this device. Please sign in.');return;}if(authMode==='signup'){if(users[email]){toast('An account with this email already exists.');return;}users[email]={email,name:String(data.get('name')).trim(),password,profile:null,bookings:[],profileHistory:[],balance:1250,createdAt:Date.now(),lastLogin:Date.now(),transactions:[],notifications:[],tickets:[],sessions:[],loginActivity:[]};currentEmail=email;recordLogin();writeSession(email);saveStore();page='profile';render();toast('Account created — complete your profile');}else{if(!users[email]||users[email].password!==password){toast('Email or password is incorrect.');return;}currentEmail=email;users[email].lastLogin=Date.now();recordLogin();writeSession(email);saveStore();page=users[email].profile?'dashboard':'profile';render();toast(users[email].profile?'Welcome back!':'Please complete your profile');}return;}
 if(form.id==='profile-form'){const p={regno:String(data.get('regno')).trim(),fullName:String(data.get('fullName')).trim(),age:String(data.get('age')),gender:String(data.get('gender')),mobile:String(data.get('mobile')).trim(),building:String(data.get('building')).trim(),room:String(data.get('room')).trim(),block:String(data.get('block')),photo:users[currentEmail].pendingPhoto||users[currentEmail].profile?.photo||''};if(!/^.{3,30}$/.test(p.regno)||!/^\S+@\S+\.\S+$/.test(user().email)){toast('Check the registration number and email address.');return;}users[currentEmail].profile=p;users[currentEmail].profileHistory=[...(users[currentEmail].profileHistory||[]),{...p,savedAt:Date.now()}];users[currentEmail].name=p.fullName;delete users[currentEmail].pendingPhoto;saveStore();page='dashboard';render();toast('Student profile saved');return;}
 if(form.id==='booking-form'){const date=String(data.get('date')),slot=String(data.get('slot')),machineId=String(data.get('machineId'));const machine=machineCatalog().find(m=>m.id===machineId);if(date<localDateString()||!TIME_SLOTS.includes(slot)||slotIsPast(date,slot)||!machine||machine.state!=='Available'){toast('Choose a valid future time, date, and available machine.');return;}if(!selectableMachines(date,slot).some(availableMachine=>availableMachine.id===machineId)){toast('That machine is no longer available for this time. Choose another machine or slot.');return;}const quantities=ITEMS.map((_,i)=>Number(data.get(`item_${i}`)||0));if(quantities.some(quantity=>!Number.isInteger(quantity)||quantity<0||quantity>20)){toast('Each clothing quantity must be a whole number from 0 to 20.');return;}const total=quantities.reduce((a,b)=>a+b,0);if(!total){toast('Add at least one clothing item to continue.');return;}const sameDay=bookings().filter(b=>b.date===date&&b.status!=='Cancelled');if(sameDay.length>=2){toast('You have reached the limit of 2 bookings for this date.');return;}const weight=quantities.reduce((n,q,i)=>n+q*ITEM_WEIGHTS[i],0);const bookingPrices=currentItemPrices();const washCost=quantities.reduce((sum,q,i)=>sum+q*bookingPrices[i],0);const id=createBookingId();const booking={id,date,slot,machineId,machineName:machine.name,items:quantities,itemPrices:bookingPrices,washCost,total,weight:weight.toFixed(1),washType:String(data.get('washType')),instructions:String(data.get('instructions')||'').trim(),status:'Booked',createdAt:Date.now()};user().bookings.push(booking);addNotification('Booking','Booking confirmed',`Your laundry slot ${date} · ${slot} is booked.`,id);saveStore();showModal('Booking confirmed! 🎉',`<div style="text-align:center"><div style="font-size:42px;margin:8px">✓</div><p class="subtle">Your slot is reserved.</p><div class="verify-code">${esc(id)}</div><p>${esc(date)} · ${esc(slot)}</p><p>${esc(machine.name)} · ${esc(machine.type)}</p><p style="color:var(--muted);font-size:13px">${total} items · ${weight.toFixed(1)} kg · ${esc(booking.washType)} wash</p><h3 class="confirmation-summary-title">Laundry cost breakdown</h3>${billingSummary(quantities,bookingPrices)}<div class="notice">Keep this booking ID for handover. The demo code is not a scannable QR.</div><button class="primary full" data-action="booking-done">View my booking</button></div>`);return;}
 if(form.id==='reschedule-form'){
  const id=form.dataset.id,booking=findBooking(id),date=String(data.get('date')),slot=String(data.get('slot'));
  if(!booking||!canRescheduleBooking(booking)){toast('Only booked or confirmed reservations can be rescheduled.');return;}
  if(date<localDateString()||!TIME_SLOTS.includes(slot)||slotIsPast(date,slot)){toast('Choose a valid future date and time slot.');return;}
  if(!selectableMachines(date,slot,id).some(machine=>machine.id===booking.machineId)){toast('That machine is unavailable for the selected time. Choose another time.');return;}
  if(bookings().filter(b=>b.id!==id&&b.date===date&&!['Cancelled'].includes(b.status)).length>=2){toast('Daily booking limit reached for that date.');return;}
  saveBookingUpdate(id,b=>{b.date=date;b.slot=slot;});
  document.querySelector('.modal-backdrop')?.remove();toast('Booking rescheduled');render();return;
 }
 if(form.id==='prices-form'){const prices=ITEMS.map((_,index)=>Number(data.get(`price_${index}`)));if(prices.some(price=>!Number.isFinite(price)||price<0)){toast('Enter a valid non-negative price for every item.');return;}if(!writeItemPrices(prices))return;render();toast('Washing prices updated');return;}
 if(form.id==='support-ticket-form'){const ticket={id:makeLocalId('TKT'),category:String(data.get('category')),bookingId:String(data.get('booking')||''),priority:String(data.get('priority')),description:String(data.get('description')).trim(),createdAt:Date.now(),status:'Submitted'};if(ticket.description.length<8){toast('Please provide a little more detail for the support team.');return;}user().tickets=user().tickets||[];user().tickets.push(ticket);addNotification('Order update','Support ticket submitted',`Ticket ${ticket.id} was saved on this device.`,ticket.id);saveStore();render();toast(`Ticket ${ticket.id} saved locally`);return;}
 if(form.id==='lost-found-form'){user().lostFound=user().lostFound||[];user().lostFound.push({kind:String(data.get('kind')),item:String(data.get('item')).trim(),location:String(data.get('location')).trim(),details:String(data.get('details')||'').trim(),createdAt:Date.now()});saveStore();toast('Lost and found report saved on this device');render();return;}
 if(form.id==='feedback-form'||form.id==='complaint-form'){const key=form.id==='feedback-form'?'feedback':'complaints';users[currentEmail][key]=users[currentEmail][key]||[];users[currentEmail][key].push({rating:data.get('rating')||'',type:data.get('type')||'',booking:data.get('booking')||'',message:String(data.get('message')).trim(),createdAt:Date.now()});saveStore();toast(form.id==='feedback-form'?'Thanks for your feedback!':'Your report was saved.');form.reset();return;}
 if(form.id==='password-form'){const nextPassword=String(data.get('new-password'));if(String(data.get('old-password'))!==user().password){toast('Current password does not match.');return;}if(nextPassword.length<8||nextPassword!==String(data.get('confirm-new-password'))){toast('Use at least 8 characters and make sure the passwords match.');return;}if(nextPassword===user().password){toast('Choose a password different from your current one.');return;}user().password=nextPassword;saveStore();form.reset();toast('Password updated on this device');}
});
function applyPreferences(){const pref=user()?.settings||{};if(pref.fontSize)document.documentElement.style.fontSize=`${pref.fontSize}px`;document.body.classList.toggle('high-contrast',!!pref.contrast);}
setTimeout(() => {
  if(currentEmail&&users[currentEmail]){users[currentEmail].lastLogin=Date.now();recordLogin();saveStore();applyPreferences();page=users[currentEmail].profile?'dashboard':'profile';render();}
  else{currentEmail='';renderAuth();}
}, Math.max(0, minimumLoadingTime - (Date.now() - loadingStartedAt)));
