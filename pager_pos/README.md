# Dingly for Odoo Point of Sale

Connect an Odoo 18 register to the restaurant pager service. The cashier receipt prints Odoo's order tracking number in large type. Assign and Done call the pager service. Caps and subscription stay on the pager service.

License: LGPL-3.

## Install

1. Copy `addons/pager_pos` to your Odoo addons path (or add this repo's `addons` directory to `addons_path`).
2. Restart Odoo and update the apps list.
3. Install **Dingly**.
4. Open **Point of Sale → Configuration → Dingly Setup**.
5. Choose the register, keep the API base (default `https://dingly.win`), and paste the setup token from the Dingly dashboard.
6. Confirm. The register stores the site, counter, and credential. The credential is not written to the log and is not shown on the settings form.

## Dingly Orders

On **Point of Sale → Dashboard**, each register card has **Place order**. Enter the order number. The register sends it to the pager service and the card shows the status code that comes back: `on_track`, `done`, or `not_done`. **Refresh status** reads those codes again.

The same screen is under **Point of Sale → Dingly Orders**. On track, Done, and Not done send that status. A refusal, including a pager cap or an inactive subscription, stays on the status line and does not change the last successful status.

The shop dashboard lists the same order and status code, because both screens read the pager service.

## Cashier

After payment, the receipt shows the order tracking number in large type. That is Odoo's number.

On the receipt screen, **Assign** binds that number to the counter and marks the pager on track. **Done** marks it done. **Not done** clears it without a done stamp. The same controls sit on the Orders list for the selected ticket.

If the service refuses the request, its message stays on the status line. The Odoo sale stays as it was.

The register refreshes those orders every 8 seconds while the point of sale is open.

## Dingly app inside Odoo

The whole Dingly shop app (desk, menu, customers, insights, settings) opens inside Odoo, behind Dingly's own login. Odoo passes no credential: it frames `<API base>/embed/app`, and the sign-in page inside the frame is the gate. The base URL is the register's Dingly API Base URL set by Dingly Setup.

- **Dingly app** (top-level menu, and **Point of Sale → Dingly**): the shop app fills the screen, with a slim bar to Reload or Open in new tab. If no register is paired, it offers to open Dingly Setup.
- **In the register**: a **Dingly** button in the top bar and a Dingly icon in the rail header open the same app in a fullscreen overlay. Close returns to the sale. The buttons are hidden on a register that is not set up.

The Odoo page must be allowed to frame the Dingly host, and Dingly must be reachable from the browser.
