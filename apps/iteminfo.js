const SKILLS = [
    "total",
    "cooking",
    "woodwork",
    "forestry",
    "metalworking",
    "stoneshaping",
    "farming",
    "mining",
    "business",
    "petcare",
    "exploration"
]

export default class ItemInfoApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "iteminfo";
        this.elements = {};

        this.selected_item = "";
    }
    event(type, data) {
        super.event(type, data);
        if (type == "update") {
         
        }

    }
    onCreate() {
        this.window = this.sys.createWindow({ 
            docked: "left",
            icon: "builtin:img/nhud_icon_info.png",
            name: "iteminfo",
            title: "Item Info"
        });
        this.window.dataset.placeholder = "This window shows all kinds of information about an item."
        this.createItemInfoWindow();
        this.setMode("search");
        //this.setSelectedItem('itm_shears_04');

        this.exportAppFunction("show_item", (item) => {
            //return this.getPrice(item);
            this.setSelectedItem(item);
            this.setMode("item_display");
            this.show();
        });
        this.exportAppFunction("single_craft", (item) => {
            return this.getSingleCraftingRecipeFor(item);
        });
        this.exportAppFunction("crafting_energy_cost", (item) => {
            return this.getCraftingEnergyCostFor(item);
        });
    }
    createItemInfoWindow() {
        let elements = {
            search: document.createElement('div'),
            info: document.createElement('div')
        }
        this.elements = elements;

        this.window.appendChild(elements.search);
        this.window.appendChild(elements.info);

        let search_entry = document.createElement('div');
        search_entry.style = "position: fixed; bottom: calc(100% + 11px); height: 44px;";
        let search_options = elements.search_options = document.createElement('div');
        search_options.className = "hud_interactive_list";
        search_options.style = "max-height: calc(50vh - 44px);";
        let search_entry_text = document.createElement('input');
        search_entry_text.placeholder = "Item name";

        search_options.innerHTML = 'Type an item name or part of it to show options.'

        search_entry_text.addEventListener('input', (e) => {
            let matches = this.sys.findItemsByName(search_entry_text.value);
            console.log("MATCHES: ", matches);

            this.setSearchSuggestions(matches);

            e.preventDefault();
            e.stopPropagation();
        });
        search_entry_text.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
        search_entry_text.addEventListener('keyup', (e) => {
            e.stopPropagation();
        });

        search_entry.appendChild(search_entry_text);
        elements.search.appendChild(search_options);
        elements.search.appendChild(search_entry);
        
    }
    setMode(mode) {
        console.log("ITEM INFO MODE: ", mode)
        if (mode == "item_display") {
            this.elements.search.style.display = "none";
            this.elements.info.style.display = "block";
        }
        if (mode == "search") {
            this.elements.search.style.display = "block";
            this.elements.info.style.display = "none";
        }
    }
    setSelectedItem(item) {
        let price = this.sys.importAppFunction('market.price');
        let shopping_list_add = this.sys.importAppFunction('shoppinglist.add');

        this.setMode("item_display");
        this.selected_item = item;
        this.elements.info.innerHTML = ""; //JSON.stringify(this.hud.getItemData(item));
        let data = this.sys.getItemData(item);
        if (data) {
            console.log("ITEM DATA: ", data);
            console.log("CRAFTING COST: ", this.getCraftingEnergyCostFor(item));
            this.elements.info.innerHTML = "";

            // BEGIN DETAILS
            let details = document.createElement('div');
            let html = "";

            // add image
            html += '<div style="display: flex; justify-content: center; padding: 6px; font-weight: bold; align-item: center; margin-bottom: 11px; border-bottom: 1px solid rgba(47, 173, 177, 0.778);"><img class="hud_icon_large" style="margin-right: 11px;" src="' + data.image + '">';

            let item_price = price(data.id);

            // add name
            html += '<div>' + this.sys.getItemName(data.id) + (item_price>0?'<br><img class="hud_icon_small" src="' + this.sys.getCurrencyData("cur_coins").sprite.image +'">&nbsp;' + this.sys.formatCurrency(item_price):'') + '</div></div>';

            // frame tier and requirement
            html += '<div style="display: flex; justify-content: space-between; align-items: center;">';

            // add tier
            if (data.tier) {
                html += '<div style="text-align: left;">Tier ' + data.tier + '</div>'
            }

            // add requirement info
            if (data.requirements) {
                if (data.requirements.types.includes("levels")) {
                    html += '<div style="text-align: right;"> Requires&nbsp;';
                    for (let l in data.requirements.levels) {
                        let req = data.requirements.levels[l];
                        html += '<img class"hud_icon_medium" src="https://d31ss916pli4td.cloudfront.net/game/ui/skills/skills_icon_' + req.levelType + '.png?v6">&nbsp;' + req.level + "&nbsp;";
                    }
                    html+="</div>";
                }
            }

            // end frame tier and requirement
            html += "</div>";

            // add onUse info
            if (data.onUse) {
                let use_html = "";
                
                if (data.onUse.types.includes("plant")) {
                    let plant_html = "<div>";
                    if (data.onUse.plant.fruit) {
                        let fruit = data.onUse.plant.fruit;
                        plant_html += 'Used to plant <img class="hud_icon_medium" src="' + this.sys.getItemData(fruit).image + '">&nbsp;' + this.sys.getItemName(fruit);
                    } else {
                        plant_html += "This seed does not work anymore.";
                    }
                    if (data.onUse.plant.growTime) {
                        plant_html += '&nbsp;(' + data.onUse.plant.growTime + ' minutes)';
                    }
                    plant_html += "</div>";
                    use_html += plant_html;
                }

                if (data.onUse.types.includes("placeObject") || data.onUse.types.includes("placeEntity")) {
                    let qualifier = "";

                    if (data.useTargets?.mapLabels?.includes('exterior')) {
                        qualifier += "outside";
                    }
                    if (data.useTargets?.mapLabels?.includes('interior')) {
                        if (qualifier != "") {
                            qualifier += " and ";
                        }
                        qualifier += "inside";
                    }

                    use_html += "<div>Can be placed." + (qualifier!=""?"(" + qualifier + ")":"") + "</div>";
                } else {
                    if (data.onUse.quantityChange == -1) {
                        use_html += "<div>Consumed on use.</div>";
                    }
                }

                if (data.onUse.types.includes("harvest")) {
                    if (data.onUse.harvest.value == true) {
                        use_html += "<div>Can be used to harvest.</div>";
                    }

                }
                if (data.onUse.types.includes("energy")) {
                    let val = data.onUse.energy.value;
                    if (val > 0) {
                        use_html += "<div>Grants " + val +   " energy when used.</div>";
                    } else {
                        use_html += "<div>Consumes " + Math.abs(val) +   " energy when used.</div>";
                    }
                    
                }

                if (data.trade?.disableTrading == true) {
                    use_html += "<div>(Untradable)</div>";
                }

                // if no details are available, mark it as common item
                if (use_html == "") {
                    use_html = "<div>No special properties.</div>";
                }

                html+= '<div class="hud_details_card">' + use_html + '</div>';
            }

            details.innerHTML = html;
            // END DETAILS

            // BEGIN CRAFTING
            let crafting = document.createElement('div');
            let recipes = this.getCraftingRecipesFor(item);
            for (let i = 0; i < recipes.length; i++) {
                let el = this.createCraftingCard(recipes[i]);
                crafting.appendChild(el);
            }
            // END CRAFTING

            let shopping_list_btn = document.createElement('div');
            shopping_list_btn.className = "hud_button";
            shopping_list_btn.innerHTML = "Add to shopping list";
            shopping_list_btn.addEventListener('click', () => {
                shopping_list_add(data.id);
            });

            let bts = document.createElement('div');
            bts.className = "hud_button";
            bts.innerHTML = "↩&nbsp;Search";
            bts.addEventListener('click', () => {
                this.setMode("search");
            })

            
            this.elements.info.appendChild(details);
            this.elements.info.appendChild(crafting);
            this.elements.info.appendChild(shopping_list_btn);
            this.elements.info.appendChild(bts);
        }
    }
    setSearchSuggestions(items) {
        this.elements.search_options.innerHTML = "";

        for (let i in items) {
            let el = document.createElement('div');
            el.className = "hud_interactive_list_item";
            el.style = "padding: 11px; margin-right: 6px;";
            el.dataset.item = i;
            el.innerHTML = items[i];

            el.addEventListener('click', () => {
                this.setSelectedItem(el.dataset.item);
            });

            this.elements.search_options.appendChild(el);
        }
    }
    getCraftingRecipesFor(item) {
        let lib = this.sys.getGameLibrary();
        let ret = [];
        for (let i in lib.achievements) {
            let recipe = lib.achievements[i];
            let result = recipe.craftable?.result?.items;
            if (!result) { continue; }
            for (let r = 0; r < result.length; r++) {
                if (result[r].id == item) {
                    ret.push(recipe);
                }
            }
        }
        return ret;
    }
    getSingleCraftingRecipeFor(item) {
        let recipes = this.getCraftingRecipesFor(item);
        for (let i=0; i<recipes.length; i++) {
            if (recipes[i].craftable.result.items[0].quantity == 1) {
                return recipes[i];
            }
        }
        return null;
    }
    getIngredientsFor(item) {
        let recipe = this.getSingleCraftingRecipeFor(item);
        if (recipe == null) {
            return null;
        }

        return recipe.craftable.requiredItems;
    }
    getSeedFor(item) {
        let lib = this.sys.getGameLibrary();
        for (let i in lib.items) {
            let compare_item = lib.items[i];
            if (compare_item.onUse?.plant?.fruit == item) {
                return compare_item;
            }
        }
        return null;
    }
    getCraftingEnergyCostFor(item) {
        let cost = {
            energy: 0,
            uncertain: false,
            uncertain_num: 0
        }

        // if our item is craftable factor in crafting cost
        let recipe = this.getSingleCraftingRecipeFor(item);
        if (recipe != null) {
            cost.energy += recipe.craftable.energy;

            for (let i in recipe.craftable.requiredItems) {
                let ingredient = recipe.craftable.requiredItems[i];
                let ingredient_cost = this.getCraftingEnergyCostFor(ingredient.id);

                cost.energy += ingredient_cost.energy * ingredient.quantity;
                cost.uncertain  |= ingredient_cost.uncertain;
                cost.uncertain_num += ingredient_cost.uncertain_num * ingredient.quantity;
            }
        } else {
            let seed = this.getSeedFor(item);
            if (seed) { // if our item is farmable factor in growing cost
                cost.energy += (-seed.onUse.energy.value + 0.5 + seed.onUse.plant.harvestNRG);
            } else {
                // we have neither a crafting recipe nor a seed for this item
                cost.uncertain = true;
                cost.uncertain_num += 1;
            }
        }

        return cost;
    }
    createCraftingCard(recipe) {
        let skill = recipe.craftable.requiredSkill;
        let skill_lv = recipe.craftable.requiredLevel;
        let items = recipe.craftable.requiredItems;
        let duration = recipe.craftable.minutesRequired;
        let result = recipe.craftable.result.items;
        let energy = recipe.craftable.energy;
        let exp = recipe.craftable.result.exps;

        let header = document.createElement('div');
        header.innerHTML = "Craft " + result[0].quantity + "x";
        header.className = "hud_window_group_header";

        let el = document.createElement('div');
        el.style.display = "none";
        el.className = "hud_window_group_entry";
        

        let req_el = document.createElement('div');
        req_el.style = "display: flex; justify-content: center; margin-bottom: 6px; font-size: 80%; color: #ddd;";

        if (skill) {
            let skillreq_el = document.createElement('div');
            skillreq_el.style = "text-align: left; margin-right: 11px;";
            skillreq_el.innerHTML = '<img class="hud_icon_small" src="https://d31ss916pli4td.cloudfront.net/game/ui/skills/skills_icon_' + skill + '.png?v6">&nbsp;' + skill_lv;
            req_el.appendChild(skillreq_el);
        }

        

        let cost_el = document.createElement('div');
        cost_el.style = "text-align: right; margin-left: 11px;";
        cost_el.innerHTML = duration + '&nbsp;min, <img class="hud_icon_small" src="https://d31ss916pli4td.cloudfront.net/game/ui/hud/hud_icon_energy.png">' + energy + ' energy';
        req_el.appendChild(cost_el);

        el.appendChild(req_el);

        let items_el = document.createElement('div');
        for (let i=0; i<items.length; i++) {
            let item = items[i];
            let data = this.sys.getItemData(item.id);
            let item_el = document.createElement('div');
            item_el.style = "display: flex; justify-content: left; font-weight: bold; align-item: center;";

            let html = "";

            // add image
            html += '<img class="hud_icon_small" style="margin-right: 11px;" src="' + data.image + '">';

            // add name
            html += '<div>' + item.quantity + 'x&nbsp;' + this.sys.getItemName(data.id) + '</div></div>'

            item_el.innerHTML = html;

            items_el.appendChild(item_el);
        }
        el.appendChild(items_el);
        
        let card = document.createElement('div');
        card.className = "hud_window_group";
        card.appendChild(header);
        card.appendChild(el);

        let collapsed = true;
        card.addEventListener('click', () => {
            collapsed =! collapsed;
            if (collapsed) {
                el.style.display = "none";
            } else {
                el.style.display = "block";
            }
        });

        return card;
    }
}