export default class TaskboardApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "taskboard";
        this.orders = [];
        this._order_cache = {};
        this.reset_time = 0;
    }
    event(type, data) {
        super.event(type, data);
        if (type == "taskboard") {

            //let cec = this.importAppFunction('iteminfo.crafting_energy_cost');

            //let cost_report = [];
            //let cost_report_str = "";

            // if an order was delivered between this taskboard update and the previous one, send an event
            for (let i=0; i<this.orders.length; i++) {
                let old_order = this.orders[i];
                let new_order = data.orders[i];

                if ((!old_order.deliveredAt) && (new_order.deliveredAt)) {
                    this.dispatchEvent('order_delivered', new_order);
                }

                /*let cost = cec(new_order.requestItems[0].itemId)

                    
                let report = {
                    item: new_order.requestItems[0].itemId,
                    quantity: new_order.requestItems[0].quantity,
                    energy_cost: cost.energy * new_order.requestItems[0].quantity,
                    unknown_costs: cost.uncertain_num * new_order.requestItems[0].quantity,
                    reward_currency: new_order.reward.currency.currencyId,
                    reward_amount: new_order.reward.currency.amount

                };

                cost_report.push(report);

                cost_report_str += this.sys.getItemName(report.item) + " x" + report.quantity + " costs " + report.energy_cost + " energy for " + report.reward_amount + " " + (report.reward_currency == "cur_coins"?"Coins":"Pixels") + "." + (report.unknown_costs>0?" " + report.unknown_costs + " ingredients with unknown costs ignored.":"") + "\n";
                */
            }
            

            //console.log("COST REPORT: ", cost_report, cost_report_str);

            this.orders = data.orders;
            this.reset_time = data.nextReset;

            this.updateOrders();
            this.save();
        }
        if (type == "update") {
            this.updateOrders();
        }
        if (type == "inventory") {
            this.updateOrders();
        }
        if (type == "set_storage") {
            this.updateOrders();
        }
    }
    onCreate() {
        this.window = this.sys.createWindow({ 
            docked: "left",
            icon: "builtin:img/nhud_icon_task.png",
            name: "taskboard",
            title: "Taskboard"
        });
        this.window.dataset.placeholder = "Visit the taskboard to register orders here!"
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

        let in_inventory = have_inventory(order.requestItems[0].itemId)
        let in_storage = have_storage(order.requestItems[0].itemId);
        let have = in_inventory+in_storage;

        let order_slot = this._order_cache[slot];
        if (!order_slot) {
            let elements = {
                main: document.createElement('div'),
                order: document.createElement('div'),
                details: document.createElement('div'),
                details_img: document.createElement('img'),
                details_title: document.createElement('div'),
                details_reward: document.createElement('div'),
                details_cost: document.createElement('div'),
                countdown: document.createElement('div')
            }

            elements.main.addEventListener('click', () => {
                let order = this.orders[slot];
                let market_entry = document.getElementsByClassName('Marketplace_filter__3ynr2');
                if (market_entry[0]) {
                    const element = market_entry[0];
                    const text = this.sys.getItemName(order.requestItems[0].itemId);

                    // Set the value programmatically
                    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, text);

                    // Create and dispatch an input event to simulate React's onChange handling
                    const inputEvent = new Event('input', { bubbles: true });
                    element.dispatchEvent(inputEvent);
                } else {
                    let show_item = this.importAppFunction('iteminfo.show_item');
                    show_item(order.requestItems[0].itemId);
                }
            });

            let img_holder = document.createElement('div');
            img_holder.appendChild(elements.details_img);
            img_holder.style = "display: flex; align-items: center; margin-right: 11px;"

            elements.main.appendChild(elements.order);
            elements.order.appendChild(img_holder);
            elements.order.appendChild(elements.details);
            elements.details.appendChild(elements.details_title);
            elements.details.appendChild(elements.details_reward);
            elements.details.appendChild(elements.details_cost);
            elements.main.appendChild(elements.countdown);

            elements.main.className = "hud_interactive_list";

            // apply formatting
            elements.order.style.padding = "6px";
            elements.order.className = "hud_interactive_list_item";
            //elements.order.style.verticalAlign = "middle";

            let img = elements.details_img;
            img.className="hud_icon_large";
            //img.src = this.sys.getItemData(order.requestItems[0].itemId).image;
            img.style.marginRight = "6px";
            let countdown = elements.countdown;

            countdown.style.textAlign = "center";
            countdown.style.color = '#aaa';
            countdown.style.padding = "11px";
            countdown.style.paddingBottom = "11px";

            this.window.appendChild(elements.main);
            
            order_slot = this._order_cache[slot] = elements;

            elements.details.addEventListener('mouseover', () => {
                highlight_storage(elements.details.dataset.highlight_itm)
            });
            elements.details.addEventListener('mouseout', () => {
                highlight_storage()
            });
        }
        
        // update where necessary
        let img_src = this.sys.getItemData(order.requestItems[0].itemId).image;
        let title_text = have + "/" + order.requestItems[0].quantity + "&nbsp;" + this.sys.getItemName(order.requestItems[0].itemId);
        let reward_text  = '<img class="hud_icon_small" src="' + this.sys.getCurrencyData(order.reward.currency.currencyId).sprite.image +'">&nbsp;' + order.reward.currency.amount + '&nbsp;&nbsp;&nbsp;<img class="hud_icon_small" src="https://d31ss916pli4td.cloudfront.net/game/ui/skills/skills_icon_' + order.reward.skill.skillType + '.png?v6">&nbsp;' + order.reward.skill.xp;
        let countdown_text = "";

        order_slot.details_title.style.background = "";
        if (order.playerClassId == "vip") {
            order_slot.details_title.style.background = "#007";
        }
        if (order.playerClassId == "landowner") {
            order_slot.details_title.style.background = "#666600";
        }

        if (order_slot.details_img.src != img_src) {
            order_slot.details_img.src = img_src;
        }
        if (order_slot.details_title.innerHTML != title_text) {
            order_slot.details.dataset.highlight_itm =  order.requestItems[0].itemId;
            order_slot.details_title.innerHTML = title_text;
        }
        
        if (order_slot.details_reward.innerHTML != reward_text) {
            order_slot.details_reward.innerHTML = reward_text;
            
        }

        let title_color = '';
        let cost_text = 'Buy ' + (order.requestItems[0].quantity - have) + ' for <img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image +'">&nbsp;' + this.sys.formatCurrency(price(order.requestItems[0].itemId) * (order.requestItems[0].quantity - have));
        if (price(order.requestItems[0].itemId) == 0) {
            cost_text = "Craft " + (order.requestItems[0].quantity - have) + " more!";
        }

        if (have >= order.requestItems[0].quantity) {
            title_color = '#F0E68C';
            cost_text = "Get " + (order.requestItems[0].quantity - in_inventory) + " from storage!";
        }
        if (in_inventory >= order.requestItems[0].quantity) {
            title_color = '#17B169';
            cost_text = "Ready to deliver!";
        }
        if (order_slot.details_cost.innerHTML != cost_text) {
            order_slot.details_cost.innerHTML = cost_text;
        }

        if (order_slot.details_title.style.color != title_color) {
            order_slot.details_title.style.color = title_color;
        }

        // Switch between order and countdown display if necessary
        if (order.deliveredAt) {
            let finish_time = order.deliveredAt + order.cooldown;
            if (finish_time > Date.now()) {
                countdown_text = "New order in " + this.sys.formatRelativeTime(finish_time);
            } else {
                countdown_text = "New order ready!"
            }

            if (order_slot.countdown.innerHTML != countdown_text) {
                order_slot.countdown.innerHTML = countdown_text;
            }
            if (order_slot.countdown.style.display != "block") {
                order_slot.countdown.style.display = "block";
                order_slot.order.style.display = "none";
            }
            
        } else {
            if (order_slot.order.style.display != "flex") {
                order_slot.order.style.display = "flex";
                order_slot.countdown.style.display = "none";
            }
        }        
    }
}

//https://d31ss916pli4td.cloudfront.net/game/ui/skills/skills_icon_farming.png?v6