/**********************************
 * ContractListItemWidget
 **********************************
 * This widget represents one contract order.
 * It uses an HTML template to build the structure:
 *  - A main container with an overall title (“Contract X”),
 *  - A details section that contains:
 *       - A container for per-request item rows,
 *       - A buttons container with “Buy all” and “Buy missing” buttons.
 *  - A countdown area to display delivery info.
 */
 class ContractListItemWidget extends HUDWidget {
    constructor(sys, entry) {
        // The template builds the overall structure.
        const template = `
            <div class="contract-item" style="width: calc(100% - 16px); padding-bottom: 8px;">
                <div class="order" style="width: 100%; box-sizing: border-box; padding: 6px;">
                    <div class="details" style="width: 100%; box-sizing: border-box;">
                        <div class="details-title"></div>
                        <div class="details-items" style="width: 100%; box-sizing: border-box;"></div>
                        <div class="details-buttons" style="display: flex; gap: 4px;">
                            <div class="hud_button buy_all_btn">Buy all</div>
                            <div class="hud_button buy_missing_btn">Buy missing</div>
                        </div>
                    </div>
                </div>
                <div class="countdown" style="text-align: center; color: #aaa; padding: 11px; padding-bottom: 11px;"></div>
            </div>
        `;
        super(sys, { template });
        // Store the entry data (expected to be { key, value }).
        this.entry = entry;
        this.order = entry.value;
        // Will later hold the current set of request items.
        this.requestItems = null;
        this.cacheElements();
        this.bindEvents();
        this.render(entry);
    }
    
    cacheElements() {
        this.mainContainer = this.root; // overall container
        this.detailsTitle = this.root.querySelector('.details-title');
        this.detailsItems = this.root.querySelector('.details-items');
        this.detailsButtons = this.root.querySelector('.details-buttons');
        this.countdownElem = this.root.querySelector('.countdown');
        this.btnBuyAll = this.root.querySelector('.buy_all_btn');
        this.btnBuyMissing = this.root.querySelector('.buy_missing_btn');
    }

    bindEvents() {
        // Import functions needed for highlighting and adding items.
        this.highlightStorage = this.sys.importAppFunction('storage.highlight');
        this.addItem = this.sys.importAppFunction('shoppinglist.add_direct');
        
        // Bind events on the buttons.
        this.btnBuyAll.addEventListener('click', (e) => {
            e.stopPropagation();
            // Use the latest requestItems.
            let reqItems = this.requestItems;
            if (!reqItems) return;
            reqItems.forEach(item => {
                // Skip items that cannot be bought.
                if (this.sys.importAppFunction('market.price')(item.itemId) === 0) return;
                this.addItem(item.itemId, item.quantity);
            });
        });
        this.btnBuyMissing.addEventListener('click', (e) => {
            e.stopPropagation();
            let reqItems = this.requestItems;
            if (!reqItems) return;
            reqItems.forEach(item => {
                if (this.sys.importAppFunction('market.price')(item.itemId) === 0) return;
                let haveVal = this.sys.importAppFunction('inventory.have')(item.itemId) +
                              this.sys.importAppFunction('storage.have')(item.itemId);
                let missing = item.quantity - haveVal;
                if (missing > 0) {
                    this.addItem(item.itemId, missing);
                }
            });
        });
        // When clicking on an individual item row (set later) we delegate to sys.contextItemClick.
        // The row event handlers will be attached when rows are built.
    }
    
    update(entry) {
        // Update stored entry and order.
        this.entry = entry;
        this.order = entry.value;
        // Ensure requestItems is an array; if empty, use a default.
        const reqItems = (this.order.requestItems && this.order.requestItems.length > 0)
                            ? this.order.requestItems
                            : [{ itemId: '', quantity: 0 }];
        this.requestItems = reqItems;
        
        // Update overall title: "Contract X" (if entry key is numeric, use key+1)
        let title = "Contract ";
        if (!isNaN(this.entry.key)) {
            title += (Number(this.entry.key) + 1);
        } else {
            title += this.entry.key;
        }
        if (this.detailsTitle.innerHTML !== title) {
            this.detailsTitle.innerHTML = title;
        }
        
        // Set background based on player class.
        this.detailsTitle.style.background = "";
        if (this.order.playerClassId === "vip") {
            this.detailsTitle.style.background = "#007";
        }
        if (this.order.playerClassId === "landowner") {
            this.detailsTitle.style.background = "#666600";
        }
        
        // Update the per-item rows in the details-items container.
        // If the number of rows differs from requestItems.length, rebuild.
        if (this.detailsItems.childElementCount !== reqItems.length) {
            this.detailsItems.innerHTML = "";
            reqItems.forEach((item, idx) => {
                // Build row structure.
                let row = document.createElement('div');
                row.className = "item-row";
                row.style.width = "100%";
                row.style.boxSizing = "border-box";
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.justifyContent = "space-between";
                row.style.padding = "4px 0";
                
                let img = document.createElement('img');
                img.className = "hud_icon_small";
                img.style.marginRight = "6px";
                
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
                
                // Attach click event for this row.
                row.addEventListener('click', () => {
                    // On click, invoke contextItemClick with this request item.
                    if (!reqItems[idx]) {
                        console.warn('No current request item found.');
                        return;
                    }
                    this.sys.contextItemClick(reqItems[idx].itemId);
                });
                // Attach mouseover/mouseout for highlighting.
                row.addEventListener('mouseover', () => {
                    this.highlightStorage(row.dataset.highlight_itm);
                });
                row.addEventListener('mouseout', () => {
                    this.highlightStorage();
                });
                // Save index in dataset.
                row.dataset.index = idx;
                this.detailsItems.appendChild(row);
            });
        }
        // Update each row based on current requestItems.
        Array.from(this.detailsItems.children).forEach((row, idx) => {
            let item = reqItems[idx];
            let img = row.children[0];
            let textContainer = row.children[1];
            let itemTitleDiv = textContainer.children[0];
            let itemCostDiv = textContainer.children[1];
            
            // Update image.
            let expectedImg = this.sys.getItemImage(item.itemId) || "#";
            if (img.src !== expectedImg) {
                img.src = expectedImg;
            }
            
            // Compute inventory counts.
            const itemInv = this.sys.importAppFunction('inventory.have')(item.itemId);
            const itemStor = this.sys.importAppFunction('storage.have')(item.itemId);
            const itemHave = itemInv + itemStor;
            
            // Build title text.
            let expectedTitle = itemHave + "/" + item.quantity + "&nbsp;" + this.sys.getItemName(item.itemId);
            if (itemTitleDiv.innerHTML !== expectedTitle) {
                itemTitleDiv.innerHTML = expectedTitle;
            }
            
            // Compute cost or craft text.
            let price = this.sys.importAppFunction('market.price')(item.itemId);
            let expectedCost = "";
            if (price === 0) {
                expectedCost = (item.quantity - itemHave > 0) ? "Craft " + (item.quantity - itemHave) + "!" : "";
            } else {
                let missing = Math.max(0, item.quantity - itemHave);
                expectedCost = `<img class="hud_icon_small" src="${this.sys.getCurrencyData('cur_coins').sprite.image}">&nbsp;` +
                               this.sys.formatCurrency(price * missing);
            }
            if (itemCostDiv.innerHTML !== expectedCost) {
                itemCostDiv.innerHTML = expectedCost;
            }
            
            // Adjust title styling based on inventory.
            let titleColor = "";
            if (itemHave >= item.quantity) {
                titleColor = '#F0E68C';
            }
            if (itemInv >= item.quantity) {
                titleColor = '#17B169';
                itemTitleDiv.style.fontWeight = "900";
            } else {
                itemTitleDiv.style.fontWeight = "normal";
            }
            if (itemTitleDiv.style.color !== titleColor) {
                itemTitleDiv.style.color = titleColor;
            }
            
            // Update row dataset for highlighting.
            row.dataset.highlight_itm = item.itemId;
        });
        
        // Update countdown display.
        if (this.order.deliveredAt) {
            let finishTime = this.order.deliveredAt + this.order.deliveryTime;
            let countdownText = "";
            if (finishTime > Date.now()) {
                countdownText = (this.requestItems[0].itemId === '') ? "Order slot maxed out!" : "Delivered in " + this.sys.formatRelativeTime(finishTime);
            } else {
                countdownText = "New order ready!";
            }
            if (this.countdownElem.innerHTML !== countdownText) {
                this.countdownElem.innerHTML = countdownText;
            }
            this.countdownElem.style.display = "block";
            // Hide order details if delivered.
            this.root.querySelector('.order').style.display = "none";
        } else {
            this.root.querySelector('.order').style.display = "flex";
            this.countdownElem.style.display = "none";
        }
    }
}

/**********************************
 * ContractsWidget
 **********************************
 * This widget wraps the entire contracts view.
 * It uses our global HUDInteractiveList with ContractListItemWidget as the item widget.
 */
class ContractsWidget extends HUDWidget {
    constructor(sys, orders = [], resetTime = 0) {
        const template = `
            <div class="contracts-widget">
                <div class="reset-display"></div>
                <div class="list-container"></div>
            </div>
        `;
        super(sys, { template });
        this.listContainer = this.root.querySelector('.list-container');
        this.resetDisplay = this.root.querySelector('.reset-display');
        this.resetTime = resetTime;
        // Create the interactive list using the globally available HUDInteractiveList.
        this.interactiveList = new HUDInteractiveList(sys, {
            data: orders,
            itemWidgetClass: ContractListItemWidget
        });
        this.listContainer.appendChild(this.interactiveList.root);
        this.update({ orders, resetTime });
    }
    
    update({ orders, resetTime }) {
        this.resetTime = resetTime;
        this.interactiveList.update(orders);
        this.resetDisplay.textContent = "Next reset: " + this.sys.formatRelativeTime(resetTime);
    }
    
    destroy() {
        this.interactiveList.destroy();
        super.destroy();
    }
}

/**********************************
 * ContractsApp Implementation
 **********************************/

export default class ContractsApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "contracts";
        this.orders = [];
        // We no longer need _order_cache as the widget system handles caching.
        this.reset_time = 0;
        this.levels = null;
        this.contractsWidget = null;
    }
    
    event(type, data) {
        super.event(type, data);
        if (type === "contracts") {
            // If any contract was delivered, dispatch events.
            for (let i = 0; i < this.orders.length; i++) {
                let old_order = this.orders[i];
                let new_order = data.orders[i];
                if ((!old_order?.deliveredAt) && (new_order?.deliveredAt)) {
                    this.dispatchEvent('contract_delivered', new_order);
                    this.dispatchEvent('report_contract', {
                        levels: this.levels,
                        contracts: data
                    });
                }
            }
            this.orders = data.orders;
            this.reset_time = data.nextReset;
            if (this.contractsWidget) {
                this.contractsWidget.update({ orders: this.orders, resetTime: this.reset_time });
            }
            this.save();
        }
        if (type === "update" || type === "inventory" || type === "set_storage") {
            if (this.contractsWidget) {
                this.contractsWidget.update({ orders: this.orders, resetTime: this.reset_time });
            }
            const settings = this.getSettings();
            if (settings.remove_refresh === true) {
                document.querySelector('.commons_pushbutton__7Tpa3.SellOrdersResetButton_paidResetButton__T5c4x')?.remove();
            }
        }
        if (type === "levels") {
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
        // Create and attach the ContractsWidget.
        this.contractsWidget = new ContractsWidget(this.sys, this.orders, this.reset_time);
        this.window.appendChild(this.contractsWidget.root);
        
        // Set up a MutationObserver to remove the refresh button if needed.
        const observer = new MutationObserver(() => {
            const button = document.querySelector('.commons_pushbutton__7Tpa3.SellOrdersResetButton_paidResetButton__T5c4x');
            if (button) {
                button.remove();
            }
        });
        // (Observer configuration would be added here as needed.)
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
        };
    }
    
    onLoad(data) {
        this.orders = data.orders;
        this.reset_time = data.reset_time;
        if (this.contractsWidget) {
            this.contractsWidget.update({ orders: this.orders, resetTime: this.reset_time });
        }
    }
    
    getRequested(item) {
        let amount = 0;
        for (let order of this.orders) {
            if (order?.requestItems[0]?.itemId === item) {
                amount += order.requestItems[0].quantity;
            }
        }
        return amount;
    }
}
