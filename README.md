# RestroBar

Restaurant ordering, kitchen display and billing that runs in the browser and works offline.

**Open the app:** https://tktarun03.github.io/RestroBar/

- Waiters take orders on their phones, with notes per dish.
- The kitchen tablet shows each order as a ticket with a timer; the cook marks dishes ready.
- Waiters get a "ready to serve" alert, serve, then bill: discount, service charge, taxes, cash/card/split, change, receipt.
- Your brand name, logo and colour, any currency, any number of tables.
- Phones and the kitchen tablet link over the same Wi-Fi by scanning QR codes. No server, no internet, no account.
- No Wi-Fi? Send an order or bill by QR code, Bluetooth or AirDrop through the share sheet.
- Daily sales with best sellers and CSV export. Backup and restore.

## Getting started

1. Open the link on the kitchen tablet, add it to the Home Screen, and open it from there.
2. Choose **Main kitchen tablet**, enter your restaurant details, prices and tax, and tables.
3. On each waiter phone: open the link, add to Home Screen, choose **Waiter phone**, and link it to the tablet by scanning the codes.
4. Back up from Settings at the end of each week.

A small place can run everything on one device: choose **One device does everything**.

## Good to know

- The live link drops when a phone sleeps for long or the app is closed. Scan again to relink; nothing is lost.
- Guest Wi-Fi often blocks devices from seeing each other. Use the staff network.
- Data stays on your devices. Make backups.

## For developers

See [AGENTS.md](AGENTS.md) for the repo map, rules, tests and release steps, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data and sync design. Third-party code: [THIRD_PARTY.md](THIRD_PARTY.md).
