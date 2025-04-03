export default class ContractsApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "contracts";
        this.orders = [];
        this._order_cache = {};
        this.reset_time = 0;
        this.levels = null;
    }
    event(type, data) {
        super.event(type, data);
        if (type == "contracts") {
            // if an order was delivered between this taskboard update and the previous one, send an event
            for (let i=0; i<this.orders.length; i++) {
                let old_order = this.orders[i];
                let new_order = data.orders[i];

                if ((!old_order.deliveredAt) && (new_order.deliveredAt)) {
                    this.dispatchEvent('contract_delivered', new_order);
                    this.dispatchEvent('report_contract', {
                        levels: this.levels,
                        contracts: data
                    });
                }

               
            }

            this.orders = data.orders;
            this.reset_time = data.nextReset;

            this.updateOrders();
            this.save();
        }
        if (type == "update") {
            this.updateOrders();

            const settings = this.getSettings();
            if (this.settings.remove_refresh == true) {
                document.querySelector('.commons_pushbutton__7Tpa3.SellOrdersResetButton_paidResetButton__T5c4x')?.remove();
            
                
            }
        }
        if (type == "inventory") {
            this.updateOrders();
        }
        if (type == "set_storage") {
            this.updateOrders();
        }
        if (type == "levels") {
            this.levels = data;
        }
    }
    onCreate() {
        super.onCreate();
        this.window = this.sys.createWindow({ 
            docked: "left",
            icon: "img/nhud_icon_contracts.png",
            name: "contracts",
            title: "Contracts"
        });
        this.window.dataset.placeholder = "Visit the harbour to register contracts here!";

        this.exportAppFunction("requested", (item) => {
            return this.getRequested(item);
        });

        const observer = new MutationObserver(() => {
            const button = document.querySelector('.commons_pushbutton__7Tpa3.SellOrdersResetButton_paidResetButton__T5c4x');
            if (button) {
                button.remove();
            }
        });
    }
    declareSettings() {
        return {
            title: 'Contracts',
            settings: [
                {
                    name: 'Remove Contracts Refresh Button',
                    var: 'remove_refresh',
                    type: 'bool',
                    default: false,
                    description: 'Removes the refresh button in Merchant Fleets to prevent accidental refreshes. (Requires reload to take effect.)'
                }
            ]
        }
    }
    onSave() {
        return {
            orders: this.orders,
            reset_time: this.reset_time
        }
    }
    onLoad(data) {
        this.orders = data.orders;
        this.reset_time = data.reset_time;
        this.updateOrders();
    }
    updateOrders() {
        for (let i=0; i<this.orders.length; i++) {
            let order = this.orders[i];
            this.updateOrderItem(i, order);
        }
    }
    updateOrderItem(slot, order) {
        let have_inventory = this.importAppFunction('inventory.have');
        let have_storage = this.importAppFunction('storage.have');
        let highlight_storage = this.importAppFunction('storage.highlight');
        let price = this.importAppFunction('market.price');
        let add = this.importAppFunction('shoppinglist.add_direct');
    
        // Ensure we have an array of request items (or a default item)
        let request_items = (order.requestItems && order.requestItems.length > 0)
                            ? order.requestItems
                            : [{ itemId: '', quantity: 0 }];
    
        // Use the first request item for order-level info (e.g. click and delivery status)
        let first_request = request_items[0];
        let in_inventory = have_inventory(first_request.itemId);
        let in_storage = have_storage(first_request.itemId);
        let have = in_inventory + in_storage;
    
        let order_slot = this._order_cache[slot];
        if (!order_slot) {
            let elements = {
                main: document.createElement('div'),
                order: document.createElement('div'),
                details: document.createElement('div'),
                // Overall order title: displays "Contract X"
                details_title: document.createElement('div'),
                // Container for rows corresponding to each request item
                details_items: document.createElement('div'),
                // Container for buttons
                details_buttons: document.createElement('div'),
                countdown: document.createElement('div')
            };
    
            // Make each order fill available width and add spacing between orders.
            elements.main.style.width = "calc(100% - 16px)";
            elements.main.style.paddingBottom = "8px";
    
            // Ensure the order container also fills its parent.
            elements.order.style.width = "100%";
            elements.order.style.boxSizing = "border-box";
    
            elements.details.style.width = "100%";
            elements.details.style.boxSizing = "border-box";
    
            // Build overall structure.
            elements.order.appendChild(elements.details);
            elements.details.appendChild(elements.details_title);
            elements.details.appendChild(elements.details_items);
            // Append the buttons container after the items.
            elements.details.appendChild(elements.details_buttons);
            elements.main.appendChild(elements.order);
            elements.main.appendChild(elements.countdown);
    
            elements.main.className = "hud_interactive_list";
            elements.order.style.padding = "6px";
            elements.order.className = "hud_interactive_list_item";
    
            // Force details_items to fill available width.
            elements.details_items.style.width = "100%";
            elements.details_items.style.boxSizing = "border-box";
    
            // Setup countdown styling.
            let countdown = elements.countdown;
            countdown.style.textAlign = "center";
            countdown.style.color = '#aaa';
            countdown.style.padding = "11px";
            countdown.style.paddingBottom = "11px";
    
            // Set up the buttons container styling.
            elements.details_buttons.style.display = "flex";
            elements.details_buttons.style.gap = "4px";  // space between buttons
    
            // Create "Buy all" button.
            let btnBuyAll = document.createElement('div');
            btnBuyAll.className = "hud_button";
            btnBuyAll.innerHTML = "Buy all";
            // Create "Buy missing" button.
            let btnBuyMissing = document.createElement('div');
            btnBuyMissing.className = "hud_button";
            btnBuyMissing.innerHTML = "Buy missing";
    
            // Append buttons to container.
            elements.details_buttons.appendChild(btnBuyAll);
            elements.details_buttons.appendChild(btnBuyMissing);
    
            // Attach event listener for "Buy all"
            btnBuyAll.addEventListener('click', (e) => {
                e.stopPropagation();
                // Always use the latest request items.
                let reqItems = order_slot.request_items || request_items;
                reqItems.forEach(item => {
                    // Skip items that cannot be bought on the market.
                    if (price(item.itemId) === 0) return;
                    add(item.itemId, item.quantity);
                });
            });
            // Attach event listener for "Buy missing"
            btnBuyMissing.addEventListener('click', (e) => {
                e.stopPropagation();
                let reqItems = order_slot.request_items || request_items;
                reqItems.forEach(item => {
                    if (price(item.itemId) === 0) return;
                    let haveVal = have_inventory(item.itemId) + have_storage(item.itemId);
                    let missing = item.quantity - haveVal;
                    if (missing > 0) {
                        add(item.itemId, missing);
                    }
                });
            });
    
            this.window.appendChild(elements.main);
            order_slot = this._order_cache[slot] = elements;
    
            elements.details.addEventListener('mouseover', () => {
                // For hover highlight, we assume the first item in the container (if available).
                highlight_storage(elements.details.dataset.highlight_itm);
            });
            elements.details.addEventListener('mouseout', () => {
                highlight_storage();
            });
        }
    
        // Always update the cached request items so event listeners have current data.
        order_slot.request_items = request_items;
    
        // Update overall title to "Contract X" (using slot index + 1)
        let newTitle = "Contract " + (Number(slot) + 1);
        if (order_slot.details_title.innerHTML !== newTitle) {
            order_slot.details_title.innerHTML = newTitle;
        }
    
        // Set background based on player class.
        order_slot.details_title.style.background = "";
        if (order.playerClassId === "vip") {
            order_slot.details_title.style.background = "#007";
        }
        if (order.playerClassId === "landowner") {
            order_slot.details_title.style.background = "#666600";
        }
    
        // Update the per-item rows.
        let container = order_slot.details_items;
        if (container.childElementCount !== request_items.length) {
            // If count doesn't match, rebuild the rows.
            container.innerHTML = "";
            request_items.forEach((item) => {
                let row = document.createElement('div');
                // Set each row to fill available width.
                row.style.width = "100%";
                row.style.boxSizing = "border-box";
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.justifyContent = "space-between";
                row.style.padding = "4px 0";
    
                // Create image element.
                let img = document.createElement('img');
                img.className = "hud_icon_small";
                img.style.marginRight = "6px";
    
                // Create a container for text.
                let textContainer = document.createElement('div');
                textContainer.style.width = "100%";
                textContainer.style.display = "flex";
                textContainer.style.flexGrow = "1";
                textContainer.style.justifyContent = "space-between";
                textContainer.style.alignItems = "center";
    
                let itemTitleDiv = document.createElement('div');
                let itemCostDiv = document.createElement('div');
    
                textContainer.appendChild(itemTitleDiv);
                textContainer.appendChild(itemCostDiv);
    
                row.appendChild(img);
                row.appendChild(textContainer);
    
                // Add click handler for this row.
                row.addEventListener('click', () => {
                    const currentItemId = row.dataset.itemId;
                    if (!currentItemId) {
                        console.warn('No current request item found.');
                        return;
                    }
                    this.sys.contextItemClick(currentItemId);
                });
    
                container.appendChild(row);
            });
        }
        // Now update each row based on request_items.
        Array.from(container.children).forEach((row, index) => {
            let item = request_items[index];
            // Get the image and text container from row.
            let img = row.children[0];
            let textContainer = row.children[1];
            let itemTitleDiv = textContainer.children[0];
            let itemCostDiv = textContainer.children[1];
    
            // Get expected image source.
            let expectedImgSrc = this.sys.getItemImage(item.itemId) || "#";
            if (img.src !== expectedImgSrc) {
                img.src = expectedImgSrc;
            }
    
            // Compute inventory counts for this item.
            let item_inventory = have_inventory(item.itemId);
            let item_storage = have_storage(item.itemId);
            let item_have = item_inventory + item_storage;
    
            // Build title text.
            let expectedTitle = item_have + "/" + item.quantity + "&nbsp;" +
                                this.sys.getItemName(item.itemId);
            if (itemTitleDiv.innerHTML !== expectedTitle) {
                itemTitleDiv.innerHTML = expectedTitle;
            }
    
            // Compute cost/craft text.
            let expectedCost = "";
            if (price(item.itemId) === 0) {
                expectedCost = (item.quantity - item_have > 0)?"Craft " + (item.quantity - item_have) + "!":"";
            } else {
                // Calculate missing amount and clamp to 0.
                let missing = item.quantity - item_have;
                if (missing < 0) missing = 0;
                expectedCost = "<img class=\"hud_icon_small\" src=\"" +
                               this.sys.getCurrencyData('cur_coins').sprite.image +
                               "\">&nbsp;" + this.sys.formatCurrency(price(item.itemId) * missing);
            }
            // Adjust title styling based on inventory.
            let titleColor = "";
            if (item_have >= item.quantity) {
                titleColor = '#F0E68C';
            }
            if (item_inventory >= item.quantity) {
                titleColor = '#17B169';
                itemTitleDiv.style.fontWeight = "900";
            } else {
                itemTitleDiv.style.fontWeight = "normal";
            }
            if (itemTitleDiv.style.color !== titleColor) {
                itemTitleDiv.style.color = titleColor;
            }
            if (itemCostDiv.innerHTML !== expectedCost) {
                itemCostDiv.innerHTML = expectedCost;
            }
            // Update the row's dataset for hover highlighting.
            row.dataset.highlight_itm = item.itemId;
        });
    
        // Update the deliveredAt countdown if present.
        let countdown_text = "";
        if (order.deliveredAt) {
            let finish_time = order.deliveredAt + order.deliveryTime;
            if (finish_time > Date.now()) {
                if (first_request.itemId === '') {
                    countdown_text = "Order slot maxed out!";
                } else {
                    countdown_text = "Delivered in " + this.sys.formatRelativeTime(finish_time);
                }
            } else {
                countdown_text = "New order ready!";
            }
            if (order_slot.countdown.innerHTML !== countdown_text) {
                order_slot.countdown.innerHTML = countdown_text;
            }
            if (order_slot.countdown.style.display !== "block") {
                order_slot.countdown.style.display = "block";
                order_slot.order.style.display = "none";
            }
        } else {
            if (order_slot.order.style.display !== "flex") {
                order_slot.order.style.display = "flex";
                order_slot.countdown.style.display = "none";
            }
        }
    }
       
    getRequested(item) {
        let amount = 0;
        for (let i=0; i<this.orders.length; i++) {
            let order = this.orders[i];
            if(order?.requestItems[0]?.itemId == item) {
                amount += order.requestItems[0].quantity;
            }
        }
        return amount;
    }
}