export default class ShoppingListApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "shoppinglist";
        this.list = {};
    }
    event(type, data) {
        super.event(type, data);
        if (type == "inventory_slot") {
            console.log("SLOT CHANGE: ", data);
            
            // we're only interested in slots with contents anyway, so if there is none ignore
            if (data.value) {
                let inventory_slot = this.sys.importAppFunction('inventory.slot');
                
                let slot = inventory_slot(data.key);
                let new_slot = data.value;

                let item = slot?.item || new_slot?.item;

                console.log("SLOT VALUES: ", slot, new_slot);

                if (item in this.list) {
                    let old_num = slot?.quantity || 0;
                    let new_num = new_slot?.quantity || 0;
                    let diff = new_num - old_num;
                    
                    // if the number increased, decrease the number of the item on the list by that much
                    if (diff > 0) {
                        this.changeListItem(item, -diff);
                    }
                }
            }
        }
    }
    onSave() {
        return {
            list: this.list
        }
    }
    onLoad(data) {
        this.list = data.list;
        this.updateList();
    }
    onCreate() {
        this.window = this.sys.createWindow({ 
            docked: "right",
            icon: chrome.runtime.getURL("img/nhud_icon_list.png"),
            name: "shoppinglist",
            title: "Shopping List"
        });
        this.window.dataset.placeholder = "Keep track of your shopping list here!";

        this.exportAppFunction("add", (item, amount = 1) => {
            this.showAddMenu(item, amount);
            this.show();
        });

        this.add_el = document.createElement('div');
        this.add_el.className = "nerd_hud_panel_right";
        this.add_el.style.display = "none";
        this.add_el.style.flexDirection = "flew-row";
        this.add_el.style.whiteSpace = "nowrap";
        this.add_el.style.alignItems = "center";
        this.add_el.style.justifyContent = "center";
        this.window.appendChild(this.add_el);

        this.list_el = document.createElement('div');
        this.window.appendChild(this.list_el);

        //this.changeListItem('itm_popberryFruit', 999);
        //this.changeListItem('itm_barn', 13);

        this.updateList();
    }
    showAddMenu(item, amount = 1) {
        if (amount < 1) {
            amount = 1;
        }

        let single_craft = this.sys.importAppFunction("iteminfo.single_craft");
        let price = this.sys.importAppFunction("market.price");

        this.add_el.innerHTML = "";

        let add_header = document.createElement('div');
        add_header.justifyContent = "center";

        add_header.innerHTML = '<div style="padding: 11px; text-align: center;"><img class="hud_icon_large" src="' + this.sys.getItemData(item).image +'">&nbsp;' + this.sys.getItemName(item) + '</div>';

        let add_entry_num = document.createElement('input');
        
        add_entry_num.style = "text-align: center";
        add_entry_num.placeholder = "Amount";
        add_entry_num.value = amount;
        add_entry_num.type = "number";
        add_entry_num.min = 1;

        add_entry_num.addEventListener('input', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        add_entry_num.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
        add_entry_num.addEventListener('keyup', (e) => {
            e.stopPropagation();
        });

        add_header.appendChild(add_entry_num);
        this.add_el.appendChild(add_header);
        //this.add_el.style.display = "none";

        let add_choice = document.createElement('div');
        add_choice.style = "padding: 11px;";

        let item_btn = document.createElement('div');
        item_btn.className = "hud_button";

        if (!(price(item) > 0)) {
            item_btn.style = "color: #aaa; background-color: #444";
        }
        item_btn.innerHTML = "Add item";
        item_btn.addEventListener('click', (e) => {
            if (price(item) > 0) {
                let amount = add_entry_num.value;
                if (amount > 0) {
                    this.changeListItem(item, amount);
                }
                this.add_el.style.display = "none";
            }
        });
        add_choice.appendChild(item_btn);

        let recipe = single_craft(item);
        let recipe_btn = document.createElement('div');
        recipe_btn.className = "hud_button";
       
        if (!recipe) {
            recipe_btn.style = "color: #aaa; background-color: #444";
        }
        recipe_btn.innerHTML = "Add crafting materials";
        recipe_btn.addEventListener('click', (e) => {
            if (recipe) {
                let amount = add_entry_num.value;
                for (let i=0; i<recipe.craftable.requiredItems.length; i++) {
                    let item = recipe.craftable.requiredItems[i];
                    this.changeListItem(item.id, item.quantity*amount);
                }
                this.add_el.style.display = "none";
            }
            
        });
        add_choice.appendChild(recipe_btn);

        let cancel_btn = document.createElement('div');
        cancel_btn.className = "hud_button";
        cancel_btn.innerHTML = "Cancel";
        cancel_btn.addEventListener('click', (e) => {
            this.add_el.style.display = "none";
        });
        add_choice.appendChild(cancel_btn);

        this.add_el.appendChild(add_choice);

        this.add_el.style.display = "flex";
    }
    changeListItem(item, amount) {
        if (!this.list[item]) {
            this.list[item] = 0;
        }
        this.list[item] += parseInt(amount);

        if (this.list[item] < 1) {
            delete this.list[item];
        }

        this.save();
        this.updateList();
    }
    removeListItem(item) {
        if (this.list[item]) {
            delete this.list[item];
            this.updateList();
        }
        this.save();
    }
    updateList() {
        let price = this.importAppFunction('market.price');

        if (Object.values(this.list).length == 0) {
            this.list_el.innerHTML = this.window.dataset.placeholder;
        } else {
            this.list_el.innerHTML = "";
            let table = document.createElement('table');
            //table.className = "hud_data_table";
            table.style = "border-collapse: separate; border-spacing: 11x;";

            for (let itemId in this.list) {
                let amount = this.list[itemId];
                let el = this.list_el.querySelector('[data-item="' + itemId + '"]');
                if (!el) {
                    el = document.createElement('tr');
                    el.dataset.item = itemId;
                    
                    let desc = document.createElement('td');
                    let cost = document.createElement('td');
                    let remove_btn = document.createElement('td');
                    remove_btn.className = "hud_button";
                    remove_btn.style = "padding: 11px;";
                    remove_btn.innerHTML = "🗑️";
                    remove_btn.addEventListener('click', () => {
                        this.removeListItem(itemId);
                    })

                    el.appendChild(desc);
                    el.appendChild(cost);
                    el.appendChild(remove_btn);

                    table.appendChild(el);
                }

                let new_desc = '<img class="hud_icon_medium" src="' + this.sys.getItemData(itemId).image +'"></img>&nbsp;' + amount + "x " + this.sys.getItemName(itemId);
                let new_cost = '<img class="hud_icon_small" src="' + this.sys.getCurrencyData("cur_coins").sprite.image +'">&nbsp;' + this.sys.formatCurrency(price(itemId) * amount);
                
                if (el.childNodes[0].innerHTML != new_desc) {
                    el.childNodes[0].innerHTML = new_desc;
                }
                if (el.childNodes[1].innerHTML != new_cost) {
                    el.childNodes[1].innerHTML = new_cost;
                }
            }
            this.list_el.appendChild(table);
        }


    }
}