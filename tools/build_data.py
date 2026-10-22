"""Build data/events.json: every City of Mississauga drop-in for the next DAYS days.

Source: the city's own Active Mississauga drop-in calendar (ActiveNet), the same
data behind anc.ca.apm.activecommunities.com/activemississauga/calendars.
The site is static, so this runs on a schedule (GitHub Action) to stay fresh.
Run: python tools/build_data.py
"""
import html, json, re, sys, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://anc.ca.apm.activecommunities.com/activemississauga/rest/onlinecalendar"
CALENDAR_ID = 1  # "Drop In Programs"
DAYS = 14
# Sauga At Play is the city's free after-school drop-in for ages 10-17 (the calendar
# doesn't flag it free): mississauga.ca/recreation-and-sports/sports-and-activities/free-youth-programs/sauga-at-play/
FREE_TITLES = ("sauga at play", "at play-")
UA = {"User-Agent": "drop-in-now/1.0 (student hackathon project)", "Content-Type": "application/json"}
BBOX = (43.47, 43.75, -79.81, -79.52)  # Mississauga, to reject geocoder hits elsewhere


def call(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{API}/{path}{'&' if '?' in path else '?'}locale=en-US", data=data, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.load(r)
    if out["headers"]["response_message"] != "Successful":
        raise RuntimeError(f"{path}: {out['headers']}")
    return out["body"]


def geocode(address, cache):
    """Street address -> [lat, lon] via OpenStreetMap Nominatim. Misses are not cached, so they retry."""
    if address in cache:
        return cache[address]
    q = urllib.parse.urlencode({"q": address, "format": "json", "limit": 3, "countrycodes": "ca"})
    try:
        req = urllib.request.Request(f"https://nominatim.openstreetmap.org/search?{q}", headers=UA)
        hits = json.load(urllib.request.urlopen(req, timeout=30))
    except Exception:
        return None
    finally:
        time.sleep(1.1)  # Nominatim policy: 1 request per second
    for h in hits:
        lat, lon = float(h["lat"]), float(h["lon"])
        if BBOX[0] < lat < BBOX[1] and BBOX[2] < lon < BBOX[3]:
            cache[address] = [round(lat, 5), round(lon, 5)]
            return cache[address]
    return None


def main():
    filters = call("filters", {"calendar_id": CALENDAR_ID})
    cats = {c["id"]: c["name"] for c in filters["activity_category"]}
    ages = {s["id"]: s["name"] for s in filters["activity_sub_category"]}
    activity = {a["id"]: a for a in filters["activity"]}
    center_ids = [c["id"] for c in filters["center"]]

    details = call(f"centerdetails?center_ids={','.join(map(str, center_ids))}")["center_details"]
    cache_path = ROOT / "tools" / "geo_cache.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    centers, problems = [], []
    for d in details:
        address = d["address1"].strip()
        geo = geocode(f"{address}, Mississauga, ON {d['zip_code']}", cache) or geocode(f"{address}, Mississauga, Ontario", cache)
        if not geo:
            problems.append(f"no map location for {d['name']} ({address})")
        centers.append({"id": d["id"], "name": " ".join(d["name"].split()), "address": address, "phone": d["phone"],
                        "lat": geo and geo[0], "lon": geo and geo[1]})
    cache_path.write_text(json.dumps(cache, indent=1))

    body = {"calendar_id": CALENDAR_ID, "center_ids": center_ids, "display_all": 0,
            "search_start_time": "", "search_end_time": "", "facility_ids": [],
            "activity_category_ids": [], "activity_sub_category_ids": [], "activity_ids": [],
            "activity_min_age": None, "activity_max_age": None, "event_type_ids": []}
    try:  # dates in the calendar are Mississauga time
        from zoneinfo import ZoneInfo
        today = datetime.now(ZoneInfo("America/Toronto")).date()
    except Exception:  # Windows without tzdata: this PC is in Toronto anyway
        today = datetime.now().date()
    last = today + timedelta(days=DAYS)
    events, unknown, desc = [], 0, {}
    for ce in call("multicenter/events", body)["center_events"]:
        for e in ce["events"]:
            start = datetime.strptime(e["start_time"], "%Y-%m-%d %H:%M:%S")
            if not today <= start.date() < last:
                continue
            a = activity.get(e["event_item_id"])
            unknown += a is None
            title = " ".join(e["title"].split())
            if title not in desc and e.get("description"):  # one blurb per program, for the detail sheet
                desc[title] = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", e["description"])).split())
            rooms = sorted({f["facility_name"] for f in e.get("facilities", [])})
            events.append({
                "c": ce["center_id"], "t": title,
                "s": e["start_time"][:16], "e": e["end_time"][:16],
                "cat": cats.get(a and a["category_id"], "Other"),
                "age": ages.get(a and a["sub_category_id"], ""),
                "free": bool(e["price"].get("free")) or any(f in e["title"].lower() for f in FREE_TITLES),
                "room": rooms[0] if len(rooms) == 1 else "",
                "id": e["event_item_id"],
                "u": e["activity_detail_url"].rstrip("/").split("/")[-2],  # slug for the city's sign-up page
            })
    events.sort(key=lambda x: x["s"])
    if unknown:
        problems.append(f"{unknown} events had no matching activity (category 'Other')")

    (ROOT / "data").mkdir(exist_ok=True)
    out = {"fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "from": str(today), "to": str(last), "centers": centers, "events": events, "desc": desc}
    (ROOT / "data" / "events.json").write_text(json.dumps(out, separators=(",", ":")))
    per = {}
    for e in events:
        per[e["c"]] = per.get(e["c"], 0) + 1
    for c in centers:
        print(f"{c['name'][:38]:38} {per.get(c['id'], 0):5}  {c['lat']},{c['lon']}")
    print(f"\n{len(events)} drop-ins at {len(centers)} places, {today} to {last}")
    print("\n".join(problems) or "no problems")
    return 0 if events else 1


if __name__ == "__main__":
    sys.exit(main())
