# -*- coding: utf-8 -*-
# License LGPL-3. See <https://www.gnu.org/licenses/lgpl-3.0.html>.

{
    "name": "Dingly",
    "version": "16.0.1.2.0",
    "category": "Sales/Point of Sale",
    "summary": "Order pager, live rail board and stamp card for Odoo POS. Guests follow their order on their phone.",
    "description": """
Connect an Odoo register to the restaurant pager service.
Cashiers assign the order number to a counter and mark it done from the receipt screen.
The Point of Sale dashboard can also place an order and show its status code.
    """,
    "license": "LGPL-3",
    "author": "Dingly",
    "website": "https://dingly.win",
    "maintainer": "Dingly",
    "images": ["static/description/banner.png"],
    "depends": ["point_of_sale"],
    "data": [
        "security/ir.model.access.csv",
        "views/pager_setup_wizard_views.xml",
        "views/pos_config_views.xml",
        "views/pager_desk_order_views.xml",
        "views/pager_app_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "pager_pos/static/src/css/pager_backend.css",
            "pager_pos/static/src/embed/dingly_frame.js",
            "pager_pos/static/src/embed/dingly_frame.xml",
            "pager_pos/static/src/backend/dingly_app.js",
            "pager_pos/static/src/backend/dingly_app.xml",
        ],
        "point_of_sale.assets": [
            # dingly_frame.js (the URL helper) reaches the POS through web.assets_backend
            # (included by point_of_sale.pos_assets_backend). Its template is not loaded into
            # the POS app, so the overlay carries its own markup (popup/dingly_popup.xml).
            "pager_pos/static/src/css/pager.css",
            "pager_pos/static/src/css/pager_backend.css",
            "pager_pos/static/src/app/pager_client.js",
            "pager_pos/static/src/app/pager_service.js",
            "pager_pos/static/src/app/models/pager_models.js",
            "pager_pos/static/src/app/pager_widget/pager_widget.js",
            "pager_pos/static/src/app/pager_widget/pager_widget.xml",
            "pager_pos/static/src/app/pager_rail/pager_rail.js",
            "pager_pos/static/src/app/pager_rail/pager_rail.xml",
            "pager_pos/static/src/app/button/dingly_button.js",
            "pager_pos/static/src/app/button/dingly_button.xml",
            "pager_pos/static/src/app/popup/dingly_popup.js",
            "pager_pos/static/src/app/popup/dingly_popup.xml",
            "pager_pos/static/src/app/receipt/order_receipt.xml",
            "pager_pos/static/src/app/screens/screens.xml",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}