/**********************************
 * Order List Item Widget (Example)
 **********************************/

// OrderListItemWidget is an example item widget to be used with HUDInteractiveList.
// It expects an entry of the form { key, value }, where value is the order data.
class OrderListItemWidget extends HUDWidget {
    constructor(sys, entry) {
        const template = `
            <div class="order-container hud_interactive_list_item" style="padding: 6px;">
              <div class="img-holder" style="display: flex; align-items: center; margin-right: 11px;">
                <img class="hud_icon_large" style="margin-right: 6px;">
              </div>
              <div class="details-container">
                <div class="title"></div>
                <div class="reward"></div>
                <div class="cost"></div>
              </div>
            </div>
            <div class="countdown" style="text-align: center; color: #aaa; padding: 11px; padding-bottom: 11px;"></div>
        `;
        super(sys, { template });
        this.entry = entry; // Store the initial entry.
        this.order = entry.value;
        this.cacheElements();
        this.bindEvents();
        this.render(entry);
    }
    
    cacheElements() {
        this.orderContainer = this.root.querySelector('.order-container');
        this.imgHolder = this.root.querySelector('.img-holder');
        this.img = this.root.querySelector('.img-holder img');
        this.detailsContainer = this.root.querySelector('.details-container');
        this.titleElem = this.root.querySelector('.title');
        this.rewardElem = this.root.querySelector('.reward');
        this.costElem = this.root.querySelector('.cost');
        this.countdownElem = this.root.querySelector('.countdown');
    }
    
    create() {
        // No extra creation logic needed here.
    }
    
    bindEvents() {
        // Import highlight function from sys.
        const highlightStorage = this.sys.importAppFunction('storage.highlight');
        this.detailsContainer.addEventListener('mouseover', () => {
            highlightStorage(this.detailsContainer.dataset.highlight_itm);
        });
        this.detailsContainer.addEventListener('mouseout', () => {
            highlightStorage();
        });
        // Bind click event.
        this.root.addEventListener('click', () => {
            const requestItem = this.order && this.order.requestItems && this.order.requestItems[0];
            if (!requestItem) {
                console.warn('No current request items found.');
                return;
            }
            this.sys.contextItemClick(requestItem.itemId);
        });
    }
    
    update(entry) {
        this.entry = entry;
        this.order = entry.value;
        const requestItem = (this.order.requestItems && this.order.requestItems[0]) || { itemId: '', quantity: 0 };
        
        // Update image source.
        const imgSrc = this.sys.getItemImage(requestItem.itemId) || "#";
        if (this.img.src !== imgSrc) {
            this.img.src = imgSrc;
        }
        
        // Get current quantities using imported functions.
        const inventoryHave = this.sys.importAppFunction('inventory.have');
        const storageHave = this.sys.importAppFunction('storage.have');
        const inInventory = inventoryHave(requestItem.itemId);
        const inStorage = storageHave(requestItem.itemId);
        const have = inInventory + inStorage;
        
        // Update title text.
        const titleText = `${have}/${requestItem.quantity} ${this.sys.getItemName(requestItem.itemId)}`;
        if (this.titleElem.innerHTML !== titleText) {
            this.titleElem.innerHTML = titleText;
        }
        
        // Update reward display.
        const currencyId = this.order.reward?.currency?.currencyId || "cur_coins";
        const currencyData = this.sys.getCurrencyData(currencyId);
        const rewardText = `<img class="hud_icon_small" src="${currencyData.sprite.image}">&nbsp;${this.order.reward?.currency?.amount}&nbsp;&nbsp;&nbsp;` +
                           `<img class="hud_icon_small" src="https://d31ss916pli4td.cloudfront.net/game/ui/skills/skills_icon_${this.order.reward?.skill?.skillType}.png?v6">&nbsp;${this.order.reward?.skill?.xp}`;
        if (this.rewardElem.innerHTML !== rewardText) {
            this.rewardElem.innerHTML = rewardText;
        }
        
        // Determine cost text using market.price.
        const marketPrice = this.sys.importAppFunction('market.price');
        const price = marketPrice(requestItem.itemId);
        let costText = '';
        if (price === 0) {
            costText = `Craft ${requestItem.quantity - have} more!`;
        } else {
            costText = `Buy ${requestItem.quantity - have} for <img class="hud_icon_small" src="${this.sys.getCurrencyData('cur_coins').sprite.image}">&nbsp;` +
                       `${this.sys.formatCurrency(price * (requestItem.quantity - have))}`;
        }
        if (inInventory >= requestItem.quantity) {
            costText = "Ready to deliver!";
            this.titleElem.style.fontWeight = "900";
            this.titleElem.style.color = '#17B169';
        } else {
            this.titleElem.style.fontWeight = "normal";
            this.titleElem.style.color = (have >= requestItem.quantity) ? '#F0E68C' : '';
        }
        if (this.costElem.innerHTML !== costText) {
            this.costElem.innerHTML = costText;
        }
        
        // Update countdown display when order has been delivered.
        if (this.order.deliveredAt) {
            const finishTime = this.order.deliveredAt + this.order.cooldown;
            let countdownText = "";
            if (finishTime > Date.now()) {
                countdownText = (requestItem.itemId === '') ? "Order slot maxed out!" : "New order in " + this.sys.formatRelativeTime(finishTime);
            } else {
                countdownText = "New order ready!";
            }
            if (this.countdownElem.innerHTML !== countdownText) {
                this.countdownElem.innerHTML = countdownText;
            }
            this.countdownElem.style.display = "block";
            this.orderContainer.style.display = "none";
        } else {
            this.orderContainer.style.display = "flex";
            this.countdownElem.style.display = "none";
        }
        
        // Store the item id for highlighting.
        this.detailsContainer.dataset.highlight_itm = requestItem.itemId;
    }
}

/**********************************
 * TaskboardWidget Implementation
 **********************************/

// TaskboardWidget now uses HUDInteractiveList with OrderListItemWidget.
class TaskboardWidget extends HUDWidget {
    constructor(sys, orders = [], resetTime = 0, onOrderClick) {
        const template = `
            <div class="taskboard-widget">
                <div class="reset-display"></div>
                <div class="list-container"></div>
            </div>
        `;
        super(sys, { template });
        this.listContainer = this.root.querySelector('.list-container');
        this.resetDisplay = this.root.querySelector('.reset-display');
        this.resetTime = resetTime;
        this.onOrderClick = onOrderClick;
        
        // Create a generic interactive list for orders.
        this.interactiveList = new HUDInteractiveList(sys, {
            data: orders,
            itemWidgetClass: OrderListItemWidget
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
 * TaskboardApp Implementation
 **********************************/

export default class TaskboardApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "taskboard";
        this.orders = [];
        this.reset_time = 0;
        this.levels = null;
        this.taskboardWidget = null;
    }
    
    event(type, data) {
        super.event(type, data);
        if (type === "taskboard") {
            for (let i = 0; i < this.orders.length; i++) {
                let old_order = this.orders[i];
                let new_order = data.orders[i];
                if ((!old_order?.deliveredAt) && (new_order?.deliveredAt)) {
                    this.dispatchEvent('order_delivered', new_order);
                    this.dispatchEvent('report_order', {
                        levels: this.levels,
                        taskboard: data
                    });
                }
            }
            this.orders = data.orders;
            this.reset_time = data.nextReset;
            if (this.taskboardWidget) {
                this.taskboardWidget.update({ orders: this.orders, resetTime: this.reset_time });
            }
            this.save();
        }
        if (type === "update" || type === "inventory" || type === "set_storage") {
            if (this.taskboardWidget) {
                this.taskboardWidget.update({ orders: this.orders, resetTime: this.reset_time });
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
            icon: "img/nhud_icon_task.png",
            name: "taskboard",
            title: "Taskboard"
        });
        this.window.dataset.placeholder = "Visit the taskboard to register orders here!";
        
        // Create and attach the TaskboardWidget.
        this.taskboardWidget = new TaskboardWidget(this.sys, this.orders, this.reset_time, (itemId) => {
            this.sys.contextItemClick(itemId);
        });
        this.window.appendChild(this.taskboardWidget.root);
        
        // Export the 'requested' function.
        this.exportAppFunction("requested", (item) => {
            return this.getRequested(item);
        });
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
        if (this.taskboardWidget) {
            this.taskboardWidget.update({ orders: this.orders, resetTime: this.reset_time });
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
