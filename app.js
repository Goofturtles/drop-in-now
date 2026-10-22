// Drop-in Now app: reads data/events.json (built daily from the city's calendar).
// Times in the data are Mississauga local time, so "now" is always computed in
// America/Toronto, whatever the visitor's own time zone is.
(function () {
  "use strict";

  var SIGNUP = "https://ca.apm.activecommunities.com/activemississauga/Activity_Search/";
  var SOON_MIN = 120;
  // photos are from Pexels (free licence), saved in img/ so they never depend on a third-party CDN
  var PX = function (id) { return "img/" + id + "-900.jpg"; };

  // Activities: city category or words in the title, plus a real photo for each (Pexels, free licence).
  var ACTS = [
    { id: "all", label: "Everything", photo: 7156048, test: function () { return true; } },
    { id: "basketball", label: "Basketball", photo: [34197287, 6777179], test: titleHas(/basketball/) },
    { id: "swim", label: "Swim", photo: [261185, 5269487, 38642641], test: catIs("Recreational Swim") },
    { id: "skate", label: "Skate & hockey", photo: [6469035, 6539364], test: catIs("Skating & Hockey") },
    { id: "badminton", label: "Badminton", photo: 8007094, test: titleHas(/badminton/) },
    { id: "volleyball", label: "Volleyball", photo: 6203568, test: titleHas(/volleyball/) },
    { id: "pickleball", label: "Pickleball", photo: 17299530, test: titleHas(/pickleball/) },
    { id: "soccer", label: "Soccer", photo: 13521967, test: titleHas(/soccer|futsal/) },
    { id: "tabletennis", label: "Table tennis", photo: 38446271, test: titleHas(/table tennis|ping pong/) },
    { id: "fitness", label: "Fitness class", photo: [6339401, 8436610], test: catIs("Fitness") },
    { id: "aqua", label: "Aquafit", photo: 37304089, test: function (e) { return e.cat === "Water Exercise" || e.cat === "Therapeutic"; } },
    { id: "social", label: "Social & arts", photo: 13871043, test: function (e) { return /Social|Arts|Dance/.test(e.cat); } }
  ];
  var HOCKEY = 8972987, HANGOUT = 3764547;
  var AGES = [
    ["any", "Any age", null],
    ["teen", "Teens 10–17", ["Youth", "Teen", "All Ages", "Family/Group"]],
    ["adult", "Adults", ["Adult", "All Ages"]],
    ["older", "Older adults", ["Older Adult", "All Ages"]],
    ["kids", "Kids & families", ["Preschool", "Youth", "Family/Group", "All Ages"]]
  ];

  function titleHas(re) { return function (e) { return re.test(e.t.toLowerCase()); }; }
  function catIs(c) { return function (e) { return e.cat === c; }; }

  var $ = function (id) { return document.getElementById(id); };
  var data, centers = {}, byId = {};
  var DEFAULTS = { day: 0, when: "soon", act: "all", age: "any", near: "", free: false };
  var state = load();
  var here = null; // device location, never stored
  var lastFocus = null;
  var BACKDROP = ["#bar", "main", "nav.tabs", ".dtop", ".band", ".side"]; // made inert while a sheet is open
  var DESK = matchMedia("(min-width: 1024px)"); // desktop: filters live in the sidebar, 2-week strip, card grid

  // ---------- time (Mississauga) ----------
  function torontoNow() {
    var p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    var g = function (t) { return p.find(function (x) { return x.type === t; }).value; };
    return g("year") + "-" + g("month") + "-" + g("day") + " " + g("hour") + ":" + g("minute");
  }
  function mins(s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16)) / 60000; }
  function addDays(date, n) { return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)).toISOString().slice(0, 10); }
  function clock(s) { var h = +s.slice(11, 13); return (h % 12 || 12) + ":" + s.slice(14, 16) + " " + (h < 12 ? "AM" : "PM"); }
  function dayLabel(date, style) { return new Date(date + "T12:00:00Z").toLocaleDateString("en-CA", Object.assign({ timeZone: "UTC" }, style)); }
  function inWords(m) { if (m < 60) return m + " min"; var h = Math.floor(m / 60), r = m % 60; return h + " hr" + (r ? " " + r + " min" : ""); }

  // ---------- distance ----------
  function km(a, b) {
    var R = 6371, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLon = (b.lon - a.lon) * t;
    var x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function origin() {
    if (state.near === "me") return here;
    var c = centers[state.near];
    return c && c.lat != null ? { lat: c.lat, lon: c.lon } : null;
  }

  // ---------- saved choices (this device only) ----------
  function load() {
    var s = Object.assign({}, DEFAULTS);
    try { Object.assign(s, JSON.parse(localStorage.getItem("dropin2") || "{}")); } catch (e) { /* private mode */ }
    s.day = 0; s.when = "soon";
    if (!AGES.some(function (a) { return a[0] === s.age; })) s.age = "any";
    if (!ACTS.some(function (a) { return a.id === s.act; })) s.act = "all";
    return s;
  }
  function save() {
    try { localStorage.setItem("dropin2", JSON.stringify({ act: state.act, age: state.age, near: state.near === "me" ? "" : state.near, free: state.free })); }
    catch (e) { /* private mode */ }
  }

  // ---------- filtering ----------
  function ageOk(e) { var a = AGES.find(function (x) { return x[0] === state.age; }); return !a || !a[2] || a[2].indexOf(e.age) >= 0; }
  function baseOk(e) { return ageOk(e) && (!state.free || e.free); }
  function act() { return ACTS.find(function (a) { return a.id === state.act; }) || ACTS[0]; }
  function inWindow(e, now) {
    var date = addDays(now.slice(0, 10), state.day);
    if (e.s.slice(0, 10) !== date) return false;
    if (state.day > 0) return true;
    var n = mins(now);
    if (mins(e.e) <= n) return false;
    return state.when === "today" || mins(e.s) <= n + SOON_MIN;
  }
  function photoFor(e) {
    if (/hockey|shinny|stick/i.test(e.t)) return HOCKEY;
    if (/chill zone/i.test(e.t)) return HANGOUT;
    for (var i = 1; i < ACTS.length; i++) if (ACTS[i].test(e)) return pick(ACTS[i].photo, e);
    return ACTS[0].photo;
  }
  function pick(p, e) { // a few photos per activity, chosen by program so a grid isn't one image repeated
    if (!Array.isArray(p)) return p;
    var h = 0; for (var i = 0; i < e.t.length; i++) h = (h * 31 + e.t.charCodeAt(i) + e.c) | 0;
    return p[Math.abs(h) % p.length];
  }

  // ---------- render ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
  var ARROW = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5 3.5 10.6l7.4 2.5 2.5 7.4 7.1-17Z"/></svg>';

  function ageTag(e) {
    var m = e.t.match(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:yrs|years)?/i);
    if (m) return "Ages " + m[1] + "–" + m[2];
    m = e.t.match(/(\d{1,2})\s*(?:yrs|years)?\s*\+/i);
    return m ? "Ages " + m[1] + "+" : e.age;
  }

  function renderDays(today) {
    var html = "";
    for (var i = 0; i < (DESK.matches ? 14 : 7); i++) {
      var d = addDays(today, i);
      html += '<button type="button" class="day" data-day="' + i + '" aria-pressed="' + (state.day === i) + '" aria-label="' +
        (i === 0 ? "Today, " : "") + dayLabel(d, { weekday: "long", month: "long", day: "numeric" }) + '">' +
        '<span class="dow" aria-hidden="true">' + dayLabel(d, { weekday: "narrow" }) + '</span>' +
        '<span class="dom" aria-hidden="true">' + dayLabel(d, { day: "numeric" }) + "</span></button>";
    }
    $("days").innerHTML = html;
    moveDot();
  }
  function moveDot() {
    var b = $("days").children[state.day];
    if (!b) return;
    // measured against the dot's own containing block (.week), so it lands exactly on the circle
    var dom = b.querySelector(".dom"), box = $("weekDot").parentNode.getBoundingClientRect(), r = dom.getBoundingClientRect();
    $("weekDot").style.transform = "translate(" + (r.left - box.left) + "px, " + (r.top - box.top) + "px)";
  }
  // re-measure whenever the strip changes size (scrollbar appearing, fonts loading, window resize)
  if (window.ResizeObserver) new ResizeObserver(function () { moveDot(); }).observe($("days"));

  function summary() {
    var a = AGES.find(function (x) { return x[0] === state.age; });
    var near = state.near === "me" ? "Near you" : centers[state.near] ? "Near " + centers[state.near].name : "Anywhere";
    var when = state.day > 0 ? "All day" : state.when === "soon" ? "Next 2 hours" : "Rest of today";
    $("summary").textContent = [act().id === "all" ? "All activities" : act().label, a[1], near, when].concat(state.free ? ["Free only"] : []).join(", ");
  }

  function card(e, i, n, isToday) {
    var c = centers[e.c] || {}, s = mins(e.s), live = isToday && s <= n;
    var dist = e._km != null ? " · " + (e._km < 10 ? e._km.toFixed(1) : Math.round(e._km)) + " km" : "";
    var badges = [];
    if (live) badges.push('<span class="badge live">On now · ends ' + clock(e.e) + "</span>");
    else if (isToday) badges.push('<span class="badge">In ' + inWords(s - n) + "</span>");
    if (e.free) badges.push('<span class="badge free">Free</span>');
    var a = ageTag(e);
    if (a) badges.push('<span class="badge">' + esc(a) + "</span>");
    return '<button type="button" class="card" data-ev="' + e._k + '" style="--i:' + Math.min(i, 12) + '">' +
      // buttons may only hold phrasing content, so the card is built from spans
      '<span class="ph"><img loading="' + (i < 2 ? "eager" : "lazy") + '" alt="" src="' + PX(photoFor(e), 700) + '" onload="this.classList.add(\'ok\')"></span>' +
      '<span class="txt"><span class="col"><span class="t">' + esc(e.t) + "</span>" +
      '<span class="when">' + clock(e.s) + " - " + clock(e.e) + "</span>" +
      '<span class="where">' + esc(c.name || "") + dist + "</span>" +
      '<span class="badges">' + badges.join("") + "</span></span>" + CHEV + "</span></button>";
  }

  function render(quiet) { // quiet = the 60 s clock tick: no entrance animation, no announcement
    if (!data) return;
    if (!DESK.matches && state.day > 6) state.day = 0; // phones only show one week
    var now = torontoNow(), n = mins(now), today = now.slice(0, 10), isToday = state.day === 0;
    renderDays(today);
    summary();
    syncTabs();
    var a = act(), o = origin();
    var list = data.events.filter(function (e) { return inWindow(e, now) && baseOk(e) && a.test(e); });
    list.forEach(function (e) { var c = centers[e.c]; e._km = o && c && c.lat != null ? km(o, c) : null; });
    if (o) list.sort(function (x, y) { return (x._km ?? 99) - (y._km ?? 99) || (x.s < y.s ? -1 : 1); });

    var nearLink = '<button type="button" class="near-link" id="nearLink">' + ARROW +
      (o ? (state.near === "me" ? "Closest to you" : "Closest to " + esc(centers[state.near].name)) : "Happening near you") + CHEV + "</button>";
    var html = "", idx = 0;
    if (isToday) {
      var nowList = list.filter(function (e) { return mins(e.s) <= n; });
      var later = list.filter(function (e) { return mins(e.s) > n; });
      html += '<h2 class="group-h">Today</h2>' + nearLink;
      if (nowList.length) html += '<h2 class="group-h sub">On now</h2><div class="cards">' + nowList.map(function (e) { return card(e, idx++, n, true); }).join("") + "</div>";
      if (later.length) html += '<h2 class="group-h sub">' + (state.when === "soon" ? "Starting soon" : "Later today") + '</h2><div class="cards">' + later.map(function (e) { return card(e, idx++, n, true); }).join("") + "</div>";
    } else {
      html += '<h2 class="group-h">' + dayLabel(addDays(today, state.day), { weekday: "long", month: "long", day: "numeric" }) + "</h2>" + nearLink +
        '<div class="cards">' + list.map(function (e) { return card(e, idx++, n, false); }).join("") + "</div>";
    }
    if (!list.length) {
      html += '<div class="empty"><strong>Nothing matches yet.</strong>' +
        (isToday && state.when === "soon" ? "Nothing in the next 2 hours with these filters." : "Try another day or fewer filters.") +
        '<br><button type="button" class="cta" data-fix="' + (isToday && state.when === "soon" ? "today" : "clear") + '">' +
        (isToday && state.when === "soon" ? "Show the rest of today" : "Clear filters") + "</button></div>";
    }
    var feed = $("feed");
    feed.setAttribute("aria-busy", "false");
    feed.classList.toggle("quiet", !!quiet);
    feed.innerHTML = html;
    if (DESK.matches) renderFilter();
    if (!quiet) $("status").textContent = list.length + (list.length === 1 ? " drop-in" : " drop-ins") + " shown";
  }

  // ---------- filter sheet ----------
  function renderFilter() {
    var now = torontoNow();
    var pool = data.events.filter(function (e) { return inWindow(e, now) && baseOk(e); });
    $("when").innerHTML = state.day > 0 ? '<button type="button" aria-pressed="true" disabled>All day</button>' :
      seg([["soon", "Next 2 hours"], ["today", "Rest of today"]], state.when, "when");
    $("acts").innerHTML = ACTS.map(function (a) {
      var count = a.id === "all" ? pool.length : pool.filter(a.test).length;
      if (!count && a.id !== "all" && a.id !== state.act) return "";
      return '<button type="button" class="chip" data-act="' + a.id + '" aria-pressed="' + (state.act === a.id) + '">' + esc(a.label) + '<span class="n">' + count + "</span></button>";
    }).join("");
    $("ages").innerHTML = seg(AGES.map(function (a) { return [a[0], a[1]]; }), state.age, "age");
    $("free").setAttribute("aria-checked", state.free);
    $("near").value = state.near === "me" && !here ? "" : state.near;
  }
  function seg(opts, cur, key) {
    return opts.map(function (o) { return '<button type="button" data-' + key + '="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + esc(o[1]) + "</button>"; }).join("");
  }
  function renderNear() {
    var opts = ['<option value="">Anywhere in Mississauga</option>'];
    if ("geolocation" in navigator) opts.push('<option value="me">My location</option>');
    Object.keys(centers).map(function (k) { return centers[k]; })
      .filter(function (c) { return c.lat != null; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (c) { opts.push('<option value="' + c.id + '">' + esc(c.name) + "</option>"); });
    $("near").innerHTML = opts.join("");
    if (!centers[state.near] || centers[state.near].lat == null) state.near = "";
  }

  // ---------- tabs ----------
  function currentTab() {
    if (state.free) return "free";
    if (state.age === "teen") return "teens";
    if (state.day === 0 && state.when === "soon") return "now";
    if (state.day === 0) return "today";
    return "";
  }
  function syncTabs() {
    var cur = currentTab(), pill = $("tabPill"), shown = false;
    document.querySelectorAll(".dtab").forEach(function (t) { t.setAttribute("aria-pressed", t.dataset.tab === cur); });
    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t.dataset.tab === cur;
      t.setAttribute("aria-pressed", on);
      if (on) { pill.style.width = t.offsetWidth + "px"; pill.style.transform = "translateX(" + t.offsetLeft + "px)"; shown = true; }
    });
    pill.style.opacity = shown ? 1 : 0;
  }

  // ---------- sheets ----------
  function openSheet(el, morph) {
    lastFocus = document.activeElement;
    $("scrim").hidden = false; $("scrim").classList.remove("out");
    el.hidden = false; el.classList.remove("out"); el.classList.toggle("vt", !!morph); (el.querySelector(".d-scroll") || el).scrollTop = 0;
    document.body.classList.add("locked");
    BACKDROP.forEach(function (s) { document.querySelector(s).inert = true; });
    var f = el.querySelector("button, a[href], select");
    if (f) f.focus({ preventScroll: true });
  }
  function restoreFocus() { // the opener may have been re-rendered away; fall back to the selected day
    var el = lastFocus && document.contains(lastFocus) ? lastFocus : document.querySelector('.day[aria-pressed="true"]');
    if (el) el.focus({ preventScroll: true });
  }
  function closeSheets() {
    var open = [$("filter"), $("detail")].filter(function (s) { return !s.hidden; });
    if (!open.length) return;
    // detail opened from a card: morph the photo back into that card
    if (!$("detail").hidden && morphFrom && document.contains(morphFrom) && canMorph()) {
      var card = morphFrom;
      $("dImg").style.viewTransitionName = "photo";
      morph(function () {
        $("dImg").style.viewTransitionName = "";
        card.style.viewTransitionName = "photo";
        open.forEach(function (s) { s.hidden = true; s.classList.remove("vt"); });
        $("scrim").hidden = true;
        document.body.classList.remove("locked");
        BACKDROP.forEach(function (s) { document.querySelector(s).inert = false; });
        restoreFocus();
      }, function () { card.style.viewTransitionName = ""; });
      morphFrom = null;
      return;
    }
    $("scrim").classList.add("out");
    open.forEach(function (s) { s.classList.add("out"); });
    setTimeout(function () {
      open.forEach(function (s) { s.hidden = true; s.classList.remove("out"); });
      $("scrim").hidden = true;
      document.body.classList.remove("locked");
      BACKDROP.forEach(function (s) { document.querySelector(s).inert = false; });
      restoreFocus();
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320);
  }

  var morphFrom = null;
  var vtBusy = false; // one photo morph at a time, or two elements would share the name
  function canMorph() { return !vtBusy && !!document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function morph(update, done) {
    vtBusy = true;
    document.startViewTransition(update).finished.finally(function () { vtBusy = false; done(); });
  }
  function openDetail(e, fromImg) {
    var c = centers[e.c] || {};
    var img = $("dImg");
    img.src = PX(photoFor(e), 1100);
    $("dTitle").textContent = e.t;
    var dest = encodeURIComponent((c.address || "") + ", Mississauga, ON");
    var maps = "https://www.google.com/maps/dir/?api=1&destination=" + dest + "&travelmode=walking";
    $("dPlace").href = maps;
    $("dPlace").querySelector("span").textContent = c.name || "";
    $("dBox").innerHTML = "<div><b>" + dayLabel(e.s.slice(0, 10), { weekday: "long", day: "numeric", month: "long" }) + "</b>" +
      "<span>" + clock(e.s) + " - " + clock(e.e) + "</span><span>" + esc(e.room || c.name || "") + "</span></div>" + CHEV;
    var more = data.events.filter(function (x) { return x.t === e.t && x.c === e.c && x.s > e.s; }).length;
    $("dMore").textContent = more ? more + " more session" + (more > 1 ? "s" : "") + " in the next 2 weeks" : "No more sessions in the next 2 weeks";
    $("dSignup").href = SIGNUP + encodeURIComponent(e.u) + "/" + e.id;
    var d = data.desc && data.desc[e.t];
    $("dDesc").textContent = (e.free && !/free/i.test(d || "") ? "Free. " : "") + (d || "Drop in, no sign-up needed for most sessions. Check the City listing for fees and age rules.");
    $("dAddr").innerHTML = esc(c.address || "") + "<br>Mississauga, ON";
    $("dDirections").href = maps;
    $("dCall").hidden = !c.phone;
    if (c.phone) { $("dCall").href = "tel:" + c.phone.replace(/[^\d+]/g, ""); $("dCall").textContent = "Call " + c.phone; }
    $("dShare").dataset.k = e._k;
    // Apple-style: the card photo grows into the detail photo
    if (fromImg && fromImg.complete && canMorph()) {
      morphFrom = fromImg;
      fromImg.style.viewTransitionName = "photo";
      morph(function () {
        fromImg.style.viewTransitionName = "";
        img.style.viewTransitionName = "photo";
        openSheet($("detail"), true);
      }, function () { img.style.viewTransitionName = ""; });
    } else {
      morphFrom = null;
      openSheet($("detail"));
    }
  }

  function freshNote() {
    var f = new Date(data.fetched), ageH = (Date.now() - f) / 36e5;
    var when = f.toLocaleString("en-CA", { timeZone: "America/Toronto", weekday: "short", hour: "numeric", minute: "2-digit" });
    $("fresh").textContent = (ageH > 48 ? "This schedule may be out of date. Last checked " : "From the City of Mississauga's drop-in calendar. Checked ") + when + ".";
  }

  // ---------- events ----------
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("button, a");
    if (!t) return;
    var d = t.dataset;
    if (d.ev) { openDetail(byId[d.ev], t.querySelector(".ph img")); return; }
    if (!data) return;
    if (t.id === "openFilter" || t.id === "openFilter2") { renderFilter(); openSheet($("filter")); return; }
    if (t.id === "doneFilter" || t.id === "closeDetail") { closeSheets(); return; }
    if (t.id === "dShare") { share(byId[d.k]); return; }
    if (t.id === "nearLink") { useMyLocation(); return; }
    if (t.id === "resetFilter" || "reset" in d) { Object.assign(state, DEFAULTS, { day: state.day }); }
    else if (d.day) { state.day = +d.day; }
    else if (d.when) { state.when = d.when; }
    else if (d.act) { state.act = d.act; }
    else if (d.age) { state.age = d.age; }
    else if (t.id === "free") { state.free = !state.free; }
    else if (d.tab) { applyTab(d.tab); }
    else if (d.fix === "today") { state.when = "today"; }
    else if (d.fix === "clear") { Object.assign(state, DEFAULTS, { day: state.day }); }
    else return;
    save();
    render();
    if (!$("filter").hidden || DESK.matches) { renderFilter(); var f = d.act ? '[data-act="' + d.act + '"]' : d.age ? '[data-age="' + d.age + '"]' : d.when ? '[data-when="' + d.when + '"]' : t.id ? "#" + t.id : null; var el = f && document.querySelector(f); if (el) el.focus(); }
    if (d.day) { var b = document.querySelector('[data-day="' + d.day + '"]'); if (b) b.focus(); }
    if (d.tab) { var tb = document.querySelector((DESK.matches ? ".dtab" : ".tab") + '[data-tab="' + d.tab + '"]'); if (tb) tb.focus(); }
    if (document.activeElement === document.body && $("nearLink")) $("nearLink").focus({ preventScroll: true });
  });
  function applyTab(tab) {
    var cur = currentTab();
    if (tab === "now") Object.assign(state, { day: 0, when: "soon", free: false, age: state.age === "teen" ? "any" : state.age });
    if (tab === "today") Object.assign(state, { day: 0, when: "today", free: false, age: state.age === "teen" ? "any" : state.age });
    if (tab === "teens") Object.assign(state, { age: cur === "teens" ? "any" : "teen", free: false });
    if (tab === "free") state.free = cur !== "free";
  }
  $("near").addEventListener("change", function () {
    if (this.value === "me") { useMyLocation(); return; }
    state.near = this.value; save(); render(); renderFilter();
  });
  function useMyLocation() {
    if (!("geolocation" in navigator)) { renderFilter(); if (DESK.matches) $("near").focus(); else openSheet($("filter")); return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      here = { lat: p.coords.latitude, lon: p.coords.longitude };
      state.near = "me"; render();
      if (!$("filter").hidden) renderFilter(); else $("nearLink").focus({ preventScroll: true });
    }, function () {
      renderFilter(); if ($("filter").hidden && !DESK.matches) openSheet($("filter"));
      $("near").focus();
    }, { timeout: 10000, maximumAge: 300000 });
  }
  function share(e) {
    var c = centers[e.c] || {};
    var text = e.t + " · " + dayLabel(e.s.slice(0, 10), { weekday: "short", month: "short", day: "numeric" }) + " " + clock(e.s) + " at " + (c.name || "");
    var url = location.href.split("#")[0];
    if (navigator.share) navigator.share({ title: e.t, text: text, url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text + " " + url).then(function () { $("dShare").lastChild.textContent = "Copied to clipboard"; $("status").textContent = "Copied to clipboard"; });
  }
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeSheets(); });
  $("scrim").addEventListener("click", closeSheets);
  addEventListener("scroll", function () { $("bar").classList.toggle("scrolled", scrollY > 8); }, { passive: true });
  addEventListener("resize", function () { moveDot(); syncTabs(); });
  // the filter controls are one set of elements: in the sheet on phones, in the sidebar on desktop
  function placeFilters() {
    if (DESK.matches) { $("side").appendChild($("fbody")); if (!$("filter").hidden) closeSheets(); }
    else $("filter").insertBefore($("fbody"), $("doneFilter"));
  }
  placeFilters();
  DESK.addEventListener("change", function () { placeFilters(); render(); });

  fetch("data/events.json").then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (d) {
    data = d;
    d.centers.forEach(function (c) { centers[c.id] = c; });
    d.events.forEach(function (e, i) { e._k = i; byId[i] = e; });
    renderNear();
    freshNote();
    render();
    setInterval(function () {
      var a = document.activeElement; // don't pull focus out from under a keyboard user
      if ($("filter").hidden && $("detail").hidden && !(a && ($("days").contains(a) || $("feed").contains(a) || $("side").contains(a)))) render(true);
    }, 60000);
  }).catch(function () {
    $("feed").setAttribute("aria-busy", "false");
    $("feed").innerHTML = '<div class="empty"><strong>Couldn\'t load the schedule.</strong>Check your connection and refresh.</div>';
  });
})();
