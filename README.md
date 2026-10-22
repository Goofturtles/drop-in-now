# Drop-in Now

**Live:** https://goofturtles.github.io/drop-in-now/ · **App:** https://goofturtles.github.io/drop-in-now/app.html

Every City of Mississauga drop-in (basketball, swim, skate, badminton, volleyball and more) that's on now or starting in the next 2 hours, with the closest ones first.

## The problem, and how we know it's real

> **Fill this in with your own evidence before submitting. It's the most important part of the entry.**
> - What happened to you or your friends: a gym that was full or closed, or a time you didn't go because you couldn't find what was on.
> - Who you asked: run a quick Google Form at school, e.g. "How do you find out when drop-in basketball is on? Have you ever shown up and it wasn't on?" Put the numbers here.
> - What we measured (already true, from the city's own data on 21 Oct 2026): over the next 2 weeks there are **2,452 drop-ins at 21 city places**, including **149 free youth sessions** (mostly Sauga At Play, free for ages 10–17). The city's calendar shows **one centre and one calendar at a time**, so finding "what's on near me in the next hour" means opening centres one by one.

## What it does

- **Next 2 hours / rest of today / any day this week**, with "On now · ends 7:00 PM" and "Starts in 25 min".
- Filter by **activity**, **age** (teens, adults, older adults, kids & families) and **free only**.
- **Near:** use your location, or pick the centre closest to you; sort soonest-first or closest-first. Your location never leaves your phone.
- Every card has **walking directions**, the **city's own listing** (to check fees or sign up) and a **call** button.
- Remembers your filters, so a repeat check takes one tap.
- Works for anyone, anywhere: times are always shown in Mississauga time, even if the person viewing is in another time zone.

## Anywhere in North America

- The app opens on **Columbia Heights, Washington, DC**. Search any city, address or ZIP code in the US, Canada or Mexico, or use your location.
- Where a city publishes its drop-in calendar (Mississauga today), you get live session times. Everywhere else you get the courts, pools, rinks and gyms around you from OpenStreetMap (via the Photon search API), with walking directions.

## Pages

- `index.html`: the landing page. Its layout and motion copy whatsapp.com, with our own words and colours. Every time and place in its chat bubbles and "On right now" cards comes from the live data.
- `app.html`: the app. Its layout copies the Apple Store app's "Upcoming" sessions screen: a week strip, photo cards, a floating tab bar, and slide-up filter and detail sheets.
- Photos are from Pexels (free licence) and are saved in `img/`.

## How it works

- `tools/build_data.py` reads the City's **Active Mississauga drop-in calendar** (the same data the city's site uses), matches each session to its activity type and age group, maps every centre with OpenStreetMap, and writes `data/events.json` covering the next 14 days.
- A GitHub Action (`.github/workflows/refresh.yml`) re-runs it every morning, so the page is never more than a day old. The page warns you if the data is over 2 days old.
- The page is plain HTML/CSS/JavaScript with no framework, no build step and no tracking.

**Built with:** Python (standard library), HTML, CSS, JavaScript, the City of Mississauga's public Active Mississauga calendar, and OpenStreetMap Nominatim geocoding. Built with help from Claude (AI) for the code.

## Run it

```bash
python tools/build_data.py
python -m http.server 3578
```
Then open http://localhost:3578.

## Challenges

- The city's old drop-in page reads from Google Sheets that still list 2021 programs. We switched to the live Active Mississauga calendar, which has real dates.
- The calendar doesn't mark Sauga At Play as free, so we flag it from the city's Sauga At Play page.
- Judges and visitors can be in any time zone, so "now" is always worked out in Mississauga time.

## What's next

- A "this was cancelled" button, so people warn each other.
- Add Brampton and Toronto (they use similar booking systems).
- Text alerts: "Youth basketball starts at Malton in 30 min."

Not an official City of Mississauga site.
