// Landing page motion + live data. Every number and bubble that names a real
// session is filled from data/events.json, so the page never shows made-up times.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PX = function (id) { return "img/" + id + "-160.jpg"; }; // Pexels photos, saved locally

  // ---------- headline word reveal ----------
  function splitWords(el) {
    var i = 0;
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim()); // read as one heading, not word by word
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 1) { walk(c); return; }
        if (c.nodeType !== 3 || !c.textContent.trim()) return;
        var frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
          var w = document.createElement("span"), inner = document.createElement("span");
          w.className = "w"; w.setAttribute("aria-hidden", "true"); inner.textContent = part; inner.style.setProperty("--i", i++);
          w.appendChild(inner); frag.appendChild(w);
        });
        node.replaceChild(frag, c);
      });
    })(el);
  }
  if (!reduce) document.querySelectorAll(".hero h1, .copy h2, .statement h2, .today-head h2").forEach(splitWords);

  // ---------- photo parallax inside the rounded frames ----------
  var photos = [].slice.call(document.querySelectorAll(".photo img"));
  function parallaxPhotos() {
    photos.forEach(function (img) {
      var r = img.parentNode.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) return;
      var p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      img.style.transform = "scale(1.12) translate3d(0," + (p * -7).toFixed(2) + "%,0)";
    });
  }
  if (!reduce) { addEventListener("scroll", function () { requestAnimationFrame(parallaxPhotos); }, { passive: true }); parallaxPhotos(); }

  // ---------- nav + hero entrance ----------
  var nav = $("nav");
  addEventListener("scroll", function () { nav.classList.toggle("scrolled", scrollY > 10); }, { passive: true });
  var heroImg = document.querySelector(".hero-img");
  function heroReady() { document.querySelector(".hero-card").classList.add("ready"); }
  if (heroImg.complete) heroReady(); else { heroImg.addEventListener("load", heroReady); setTimeout(heroReady, 1500); }

  // ---------- scroll reveals ----------
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("seen");
      en.target.querySelectorAll(".pop").forEach(function (p) { p.classList.add("seen"); });
      io.unobserve(en.target);
    });
  }, { threshold: 0.2 });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  // ---------- statement: floating hellos (Mississauga's languages) ----------
  var FACES = [19802254, 17910791, 16933877, 13594616, 9657249, 7243966, 34526411, 6764339, 3764547];
  var HELLOS = [
    // [left %, top %, face, text, mine?, depth]
    // kept out of the middle band, where the headline sits
    [6, 8, 0, "Bonjour", false, 0.5], [32, 4, 1, "", false, 0.8], [56, 10, 2, "Sat Sri Akal", false, 0.35],
    [86, 6, 3, "", false, 0.7], [3, 46, 4, "Kumusta!", false, 0.6], [88, 44, 5, "Hola!", true, 0.6],
    [10, 84, 6, "مرحبا", true, 0.8], [36, 88, 7, "", false, 0.45], [58, 82, 8, "Cześć!", false, 0.9],
    [84, 86, 0, "你好", true, 0.55], [74, 22, 2, "Olá!", false, 0.4]
  ];
  var fl = $("floaters");
  fl.innerHTML = HELLOS.map(function (h, i) {
    return '<div class="fl' + (h[4] ? " me" : "") + '" data-depth="' + h[5] + '" style="left:' + h[0] + "%;top:" + h[1] + '%">' +
      '<i style="--p:url(' + PX(FACES[h[2] % FACES.length], 120) + ')"></i>' +
      (h[3] ? "<span>" + h[3] + "<small>6:3" + (i % 10) + "</small></span>" : "") + "</div>";
  }).join("");
  var floaters = [].slice.call(fl.children), stmt = document.querySelector(".statement");
  function parallax() {
    var r = stmt.getBoundingClientRect(), p = (innerHeight - r.top) / (innerHeight + r.height); // 0..1 across the viewport
    if (p < -0.2 || p > 1.2) return;
    floaters.forEach(function (f, i) {
      var d = +f.dataset.depth;
      f.style.transform = "translate3d(0," + ((0.5 - p) * 160 * d).toFixed(1) + "px,0) scale(" + (0.9 + Math.min(1, Math.max(0, p * 1.6)) * 0.1).toFixed(3) + ")";
      f.style.opacity = Math.min(1, Math.max(0, (p - 0.05 - i * 0.02) * 4)).toFixed(2);
    });
  }
  if (!reduce) { addEventListener("scroll", function () { requestAnimationFrame(parallax); }, { passive: true }); parallax(); }
  else floaters.forEach(function (f) { f.style.opacity = 1; });

  // ---------- time helpers (Mississauga) ----------
  function torontoNow() {
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    var g = function (t) { return p.find(function (x) { return x.type === t; }).value; };
    return g("year") + "-" + g("month") + "-" + g("day") + " " + g("hour") + ":" + g("minute");
  }
  function mins(s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16)) / 60000; }
  function clock(s) { var h = +s.slice(11, 13), m = s.slice(14, 16); return (h % 12 || 12) + (m === "00" ? "" : ":" + m) + (h < 12 ? " AM" : " PM"); }
  function shortName(c) { if (!c) return ""; return c.name.replace(" Community Centre", " CC").replace(" Recreation Centre", "").replace("Mississauga ", "").replace(/Sports and Ent\. Centre\s*/, ""); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function plain(t) { return t.replace(/^Drop[\s-]*In\s*/i, "").replace(/\s*\(.*?\)\s*/g, " ").replace(/Sauga At Play\s*/i, "").trim(); }

  // ---------- scramble + typing (dark section) ----------
  var GLYPHS = "&%^{*}/<>#@!$+=?";
  function scrambleTo(el, text) {
    if (reduce) { el.textContent = text; return; }
    var from = el.textContent, len = Math.max(from.length, text.length), frame = 0, total = 26;
    (function tick() {
      var out = "";
      for (var i = 0; i < len; i++) {
        var settle = (i / len) * total * 0.7 + total * 0.3;
        out += frame >= settle ? (text[i] || "") : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (frame++ < total) requestAnimationFrame(tick); else el.textContent = text;
    })();
  }
  function typeLoop(el, lines) { // types two lines then rests on the second (no endless motion)
    lines = lines.slice(0, 2);
    if (!lines.length) return;
    var li = 0, ci = 0, del = false;
    (function step() {
      var line = lines[li];
      if (reduce) { el.textContent = line; return; }
      if (!del) { el.textContent = line.slice(0, ++ci); if (ci === line.length) { if (li === lines.length - 1) return; del = true; return setTimeout(step, 1800); } }
      else { el.textContent = line.slice(0, --ci); if (ci === 0) { del = false; li = (li + 1) % lines.length; } }
      setTimeout(step, del ? 25 : 55);
    })();
  }

  // ---------- live data ----------
  fetch("data/events.json").then(function (r) { return r.json(); }).then(function (d) {
    var centers = {}; d.centers.forEach(function (c) { centers[c.id] = c; });
    var now = torontoNow(), n = mins(now), today = now.slice(0, 10);
    var upcoming = d.events.filter(function (e) { return mins(e.e) > n; });
    var todayLeft = upcoming.filter(function (e) { return e.s.slice(0, 10) === today; });
    var dayWord = function (s) {
      var dd = s.slice(0, 10);
      if (dd === today) return "Today";
      var t = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) + 1)).toISOString().slice(0, 10);
      return dd === t ? "Tomorrow" : new Date(dd + "T12:00:00Z").toLocaleDateString("en-CA", { timeZone: "UTC", weekday: "long" });
    };
    var nextOf = function (re, pool) { return (pool || upcoming).find(function (e) { return re.test(e.t); }); };

    // hero: the next youth basketball (or any basketball), for real
    var hb = nextOf(/youth.*basketball|basketball.*youth/i) || nextOf(/basketball/i);
    if (hb && centers[hb.c]) {
      var c = centers[hb.c];
      $("heroEvent").textContent = plain(hb.t);
      $("heroAsk").textContent = "Ball at " + shortName(c) + "?";
      $("heroReply").textContent = shortName(c) + ", " + clock(hb.s) + (hb.s.slice(0, 10) === today ? "" : " " + new Date(hb.s.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-CA", { timeZone: "UTC", weekday: "short" })) + ". Ready when you are!";
    }
    var free = d.events.filter(function (e) { return e.free && mins(e.e) > n && mins(e.s) < n + 7 * 1440; }).length;
    $("freeCount").textContent = free + " free drop-ins in the next 7 days";
    var swim = nextOf(/lane|leisure swim|swim/i, todayLeft) || nextOf(/swim/i);
    if (swim) { $("poolBubble").textContent = shortName(centers[swim.c]) + " · " + clock(swim.s); $("poolWhen").textContent = dayWord(swim.s); }
    var bad = nextOf(/badminton/i);
    if (bad) $("shareBubble").textContent = "Badminton " + (bad.s.slice(0, 10) === today ? "tonight" : dayWord(bad.s).toLowerCase()) + "? " + clock(bad.s) + " at " + shortName(centers[bad.c]);
    var nx = upcoming.find(function (e) { return mins(e.s) > n && centers[e.c]; });
    if (nx) $("nearBubble").textContent = shortName(centers[nx.c]) + " · " + plain(nx.t) + " · " + clock(nx.s);
    var nextBall = nextOf(/basketball/i), nextSwim = nextOf(/swim/i);
    if (nextBall && centers[nextBall.c]) $("cBall").textContent = "Next: " + clock(nextBall.s) + " · " + shortName(centers[nextBall.c]);
    if (nextSwim && centers[nextSwim.c]) $("cSwim").textContent = "Next: " + clock(nextSwim.s) + " · " + shortName(centers[nextSwim.c]);
    $("statCount").textContent = d.events.length.toLocaleString("en-CA");
    var freeNext = upcoming.filter(function (e) { return e.free && centers[e.c] && (/youth|teen|at play/i.test(e.t) || e.age === "Youth" || e.age === "Teen"); }).slice(0, 3);
    if (freeNext.length) $("freeRows").innerHTML = freeNext.map(function (e) {
      return '<span class="row"><i></i>' + esc(plain(e.t)) + "<small>" + (e.s.slice(0, 10) === today ? "" : new Date(e.s.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-CA", { timeZone: "UTC", weekday: "short" }) + " ") + clock(e.s) + "</small></span>";
    }).join("");
    // "closest first": real distances between real centres, measured from Malton CC
    var home = d.centers.find(function (c) { return /Malton/.test(c.name) && c.lat != null; });
    if (home) {
      var R = 6371, rad = Math.PI / 180;
      var km = function (a, b) { var x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
      var busy = {}; upcoming.forEach(function (e) { busy[e.c] = 1; });
      var rows = d.centers.filter(function (c) { return c.lat != null && busy[c.id]; })
        .map(function (c) { return { c: c, km: km(home, c) }; }).sort(function (a, b) { return a.km - b.km; }).slice(0, 3);
      $("nearHead").textContent = "Closest to " + shortName(home);
      $("nearRows").innerHTML = rows.map(function (r) { return '<span class="row"><i></i>' + esc(shortName(r.c)) + "<small>" + r.km.toFixed(1) + " km</small></span>"; }).join("");
    }
    $("centresP").textContent = d.centers.length + " community centres, pools and arenas across the city, from Malton to Clarkson. Right now that's " +
      d.events.length.toLocaleString("en-CA") + " drop-ins over the next two weeks, all in one list.";

    // dark section: times scramble into the next real start times
    var startingLater = upcoming.filter(function (e) { return mins(e.s) > n; });
    var times = startingLater.filter(function (e) { return e.s.slice(0, 10) === today; }).slice(0, 40).map(function (e) { return clock(e.s); }).filter(function (t, i, a) { return a.indexOf(t) === i; }).slice(0, 6);
    if (!times.length) times = startingLater.slice(0, 6).map(function (e) { return clock(e.s); });
    var ti = 0, sc = $("scramble");
    var darkSeen = false;
    new IntersectionObserver(function (en, obs) {
      if (!en[0].isIntersecting || darkSeen || !times.length) return;
      darkSeen = true; obs.disconnect();
      scrambleTo(sc, times[0] || "6:30 PM");
      var spins = 0, timer = setInterval(function () { // two changes, then it stays put
        ti = (ti + 1) % times.length; scrambleTo(sc, times[ti]);
        if (++spins >= 2) clearInterval(timer);
      }, 2400);
      typeLoop($("typed"), startingLater.slice(0, 30).filter(function (e, i, a) { return a.findIndex(function (x) { return x.t === e.t; }) === i; }).slice(0, 4)
        .map(function (e) { return plain(e.t) + " at " + clock(e.s) + "?"; }));
    }, { threshold: 0.4 }).observe(document.querySelector(".dark"));

    // on right now: three real sessions, different activities, soonest first
    var picks = [], cats = {};
    (todayLeft.length >= 3 ? todayLeft : upcoming).some(function (e) {
      var k = plain(e.t).split(" ")[0] + e.cat;
      if (cats[k]) return false;
      cats[k] = 1; picks.push(e); return picks.length === 3;
    });
    $("todayCards").innerHTML = picks.map(function (e, i) {
      var c = centers[e.c] || { name: "" }, on = mins(e.s) <= n && e.s.slice(0, 10) === today;
      return '<a class="tcard reveal" style="transition-delay:' + i * 90 + 'ms" href="app.html">' +
        '<span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg></span>' +
        "<h3>" + esc(plain(e.t)) + "</h3><p>" + esc(c.name) + "<br>" + clock(e.s) + " to " + clock(e.e) + (e.free ? " · Free" : "") + "</p>" +
        '<span class="live">' + (on ? "On now" : e.s.slice(0, 10) === today ? "Starts in " + (mins(e.s) - n) + " min" : "Next up") + "</span>" +
        '<span class="go">See it in the app</span></a>';
    }).join("");
    document.querySelectorAll(".tcard").forEach(function (el) { io.observe(el); });
  }).catch(function () { /* the page still reads fine with its default copy */ });
})();
