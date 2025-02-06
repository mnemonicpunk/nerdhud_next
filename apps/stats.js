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

export default class StatsApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "stats";
        this.elements = {};
        this.orders = [];
        this.balance = {}
        this.reset_time = 0;
        this.levels = null;
        this.past_days = [];
        this.map_limits = {};
    }
    event(type, data) {
        super.event(type, data);
        if (type == "update") {
            this.update();
        }
        if (type == "order_delivered") {
            this.orderDelivered(data);
            this.save();
        }
        if (type == "currency") {
            this.updateCurrency(data);
            this.save();
        }
        if (type == "taskboard") {
            this.reset_time = data.nextReset;
            this.save();
        }
        if (type == "levels") {
            this.levels = data;
        }
        if (type == "map_limits") {
            this.map_limits = data;
            this.updateMapLimits();
        }
    }
    update() {
        let timer_element = this.window.querySelector('#hud_reset_timer');
        let net_worth_element = this.window.querySelector('#hud_net_worth');
        let my_listings = this.importAppFunction('market.my_listings');
        let price = this.importAppFunction('market.price');
        let inventory_value = this.importAppFunction('inventory.total_value');
        let storage_value = this.importAppFunction('storage.total_value');
        
        if (this.reset_time != 0) {
            let rt = this.timestampToServerTime(this.reset_time);

            timer_element.innerHTML = this.sys.formatRelativeTime(rt) + " until reset";

            if (rt < Date.now()) {
                this.performReset();
            }
        } else {
            timer_element.innerHTML = "Visit taskboard to set reset time.";
        }

        let net_worth_html = 'Net Worth: <img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image + '"> ' + this.sys.formatCurrency(inventory_value() + storage_value());
        if (net_worth_element.innerHTML != net_worth_html) {
            net_worth_element.innerHTML = net_worth_html;
        }

        let levels_element = this.elements.levels;
        if (this.levels) {
            let new_html = "Total level: " + this.levels.total.level;
            if (levels_element.innerHTML != new_html) {
                levels_element.innerHTML = new_html;
            }
        }

        let listings_entries = this.elements.listing_entries;
        let listings = my_listings();
        let listings_html = "";
        if (listings && listings.length > 0) {
            listings_html +='<table class="nerd_window_table" style="text-align: center;"><thead><tr><th></th><th>Market</th><th>Quantity</th><th>Price</th><th>Fee</th></tr></thead><tbody>';
            for (let i=0; i<listings.length; i++) {
                let listing = listings[i];

                listings_html += '<tr>';

                // add item image
                listings_html += '<td><img class="hud_icon_medium" src="' + this.sys.getItemData(listing.itemId).image + '">&nbsp;' + this.sys.getItemName(listing.itemId) + '</td>';
                
                // add market price
                listings_html += '<td><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image + '">' + price(listing.itemId) + '</td>';

                // add quantity
                listings_html += '<td>' + listing.quantity + '</td>';

                // add asking price
                listings_html += '<td><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image + '">' + listing.price + '</td>';

                // add fee
                listings_html += '<td><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image + '">' + this.sys.formatCurrency(listing.price * listing.fee) + '</td>';

                // end row
                listings_html +='</tr>';
            }
            listings_html += '</tbody></table>';
        } else {
            listings_html = "You have no current market listings.";
        }

        if (listings_entries.innerHTML != listings_html) {
            listings_entries.innerHTML = listings_html;
        }
        
    }
    updateMapLimits() {
        let total_value = 0;
        let total_count = 0;
        let limits = [];

        for (let i in this.map_limits) {
            let l = this.map_limits[i];
            if (!(i.endsWith("-boost") || (i == "total")|| (i == "billboards"))) {
                total_value += (l.used / l.max);
                total_count++;

                limits.push({
                    id: i,
                    name: String(i).charAt(0).toUpperCase() + String(i).slice(1),
                    percent: (l.used / l.max),
                    used: l.used,
                    max: l.max
                });
            }
        }

        limits.unshift({
            id: "total",
            name: "Total",
            percent: total_value / total_count,
            used: total_value,
            max: total_count
        })

        let entries_el = this.elements.limits_entries;
        entries_el.innerHTML = "";

        const formatter = new Intl.NumberFormat('en-US', {
            style: 'decimal',
            maximumFractionDigits: 2,
            minimumFractionDigits: 0,
        })

        if (limits.length > 1) {
            for (let i=0; i < limits.length; i++) {
                let limit = limits[i];
                let el = document.createElement('div');
    
                let breakdown = "";
                if (limit.id != "total") {
                    breakdown = ", " + limit.used + "/" + limit.max;
                }
    
                el.innerHTML = '<div>' + limit.name + ' (' + formatter.format(limit.percent*100) + '%' + breakdown + ')</div><progress max="100" value="' + (limit.percent<=1? limit.percent*100:100) + '">';
                if (limit.percent > 1) {
                    el.style = "color: #faa";
                }
                entries_el.appendChild(el);
            }
        } else {
            entries_el.innerHTML = "This location does not have map limits.";
        }
        
    }
    performReset() {
        // Initialize past_days if null
        if (!this.past_days) {
            this.past_days = [];
        }
    
        // Push current stats to the past days
        this.past_days.push({
            time: this.reset_time,
            orders: [...this.orders], // Clone orders array to avoid mutation issues
            balance: { ...this.balance }, // Clone balance object
        });
    
        // Trim to the last 7 days
        while (this.past_days.length > 7) {
            this.past_days.shift();
        }
    
        // Reset orders and balance changes
        this.orders = [];
        this.order_cache = {};
        for (let key in this.balance) {
            if (this.balance.hasOwnProperty(key)) {
                this.balance[key].change = 0; // Reset changes but keep previous balance intact
            }
        }
    
        // Calculate the next reset time
        const oneDayInMs = 24 * 60 * 60 * 1000;
        let newResetTime = this.timestampToServerTime(this.reset_time);
        while (newResetTime <= Date.now()) {
            newResetTime += oneDayInMs;
        }
        this.reset_time = newResetTime;
    
        // Update dependent UI components AFTER resetting data
        this.updateCurrency();
        this.createOrderCache(); // Ensure this works with an empty orders array
        this.updateBreakdown(); // Update UI based on the new reset state
    
        // Save the new state
        this.save();
    }    
    onCreate() {
        super.onCreate();
        this.window = this.sys.createWindow({ 
            docked: "left",
            icon: "img/nhud_icon_coin.png",
            name: "stats",
            title: "Stats"
        });
        this.window.dataset.placeholder = "This window tracks your $PIXEL and coin stats!"
        this.createStats();
    }
    onSave() {
        return {
            orders: this.orders,
            balance: this.balance,
            reset_time: this.reset_time,
            past_days: this.past_days
        }
    }
    onLoad(data) {
        this.balance = data.balance;
        this.reset_time = data.reset_time;
        this.past_days = data.past_days;

        this.updateCurrency(this.balance);
        for (let i=0; i < data.orders.length; i++) {
            this.orderDelivered(data.orders[i]);
        }
    }
    createStats() {
        // build income element
        let income_element = document.createElement('div');
        income_element.className = "hud_stat_pane";

        //let coin_display = '<img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image +'"> <span data-currency="cur_coins">0</span>';
        //let pixel_display = '<img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_pixel').sprite.image +'"> <span data-currency="cur_pixel">0</span>';
        
        let all_currencies = this.sys.getGameLibrary().currencies;
        let currency_list = ['cur_coins', 'cur_pixel', 'cur_guildtoken', 'cur_mistletoe_white', 'cur_mistletoe_green', 'cur_mistletoe']

        let income_currencies = "";
        for (let i=0; i < currency_list.length; i++) {
            let c = all_currencies[currency_list[i]];
            if (c) {
                let currency_display = '<img class="hud_icon_small" src="' + c.sprite.image +'"> <span data-currency="' + currency_list[i] + '">0</span>';
                income_currencies += '<div class="hud_stat_entry">' + currency_display + '</div>'    
            }
        }

        income_element.innerHTML = '<div class="hud_stat_header">Currencies and Income</div><div class="hud_stat_display" style="display: flex; flex-wrap: wrap; text-align: center; gap: 6px;">' + income_currencies + '</div><div class="hud_stat_display"><div class="hud_stat_entry" id="hud_reset_timer"></div></div><div class="hud_stat_display"><div class="hud_stat_entry" id="hud_net_worth"></div></div></div>';

        this.elements.income = income_element;

        this.window.appendChild(income_element);

        let levels_element = document.createElement('div');
        levels_element.className = "hud_stat_pane";
        levels_element.style = "text-align: center;"

        if (this.levels) {
            levels_element.innerHTML = "Total level: " + this.levels.total.level;
        }
        
        this.elements.levels = levels_element;
        this.window.appendChild(levels_element);

        let listings_element = document.createElement('div');
        listings_element.className = "hud_window_group";
        
        let header_el = document.createElement('div');
        header_el.className = "hud_window_group_header";
        header_el.innerHTML = "My Market Listings";
        listings_element.appendChild(header_el);

        let entries_el = document.createElement('div');
        entries_el.className = "hud_window_group_entries";
        entries_el.style.display = "none";
        listings_element.appendChild(entries_el);

        this.elements.listings = listings_element;
        this.elements.listing_entries = entries_el;
        this.window.appendChild(listings_element);

        // attach event handler
        let collapsed = true;
        listings_element.addEventListener('click', () => {
            collapsed =! collapsed;
            if (collapsed) {
                entries_el.style.display = "none";
            } else {
                entries_el.style.display = "block";
            }
        });

        let limits_element = document.createElement('div');
        limits_element.className = "hud_window_group";
        
        let limits_header_el = document.createElement('div');
        limits_header_el.className = "hud_window_group_header";
        limits_header_el.innerHTML = "Current Map Limits";
        limits_element.appendChild(limits_header_el);

        let limits_entries_el = document.createElement('div');
        limits_entries_el.className = "hud_window_group_entries";
        limits_entries_el.style.display = "none";
        limits_element.appendChild(limits_entries_el);

        this.elements.limits = limits_element;
        this.elements.limits_entries = limits_entries_el;
        this.window.appendChild(limits_element);

        // attach event handler
        let limits_collapsed = true;
        limits_element.addEventListener('click', () => {
            limits_collapsed =! limits_collapsed;
            if (limits_collapsed) {
                limits_entries_el.style.display = "none";
            } else {
                limits_entries_el.style.display = "block";
            }
        });

        // build delivery table
        let delivery_details = document.createElement('table');
        delivery_details.className = "hud_data_table";
        delivery_details.style.textAlign = "center";
        delivery_details.style.padding = "6px";
        let delivery_header = document.createElement('tr');
        delivery_header.innerHTML = '<th></th><th>#</th><th><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_pixel').sprite.image +'"></th><th><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image +'"></th><th>CPP</th><th>Value</th>';

        delivery_details.appendChild(delivery_header);

        this.elements.breakdown = {};

        for (let i in SKILLS) {
            let skill = SKILLS[i];
            let skill_row = document.createElement('tr');
            let icon = '<img class="hud_icon_medium" src="https://d31ss916pli4td.cloudfront.net/game/ui/skills/skills_icon_' + skill +'.png?v6">';
            if (skill == "total") {
                icon = "Total";
            }
            skill_row.innerHTML = '<td>' + icon +  '</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td>';
            delivery_details.appendChild(skill_row);

            this.elements.breakdown[skill] = skill_row;

            if (skill != "total") {
                skill_row.style.display = "none";
            }
        }

        this.window.appendChild(delivery_details);
        
    }
    updateBreakdown() {
        for (let i in SKILLS) {
            let skill = SKILLS[i];
            let el = this.elements.breakdown[skill];
            let data = this.order_cache[skill];
            let icon = '<img class="hud_icon_medium" src="https://d31ss916pli4td.cloudfront.net/game/ui/skills/skills_icon_' + skill +'.png?v6">';
            if (skill == "total") {
                icon = "Total";
            }

            let cpp = "n/a";
            if (data.pixels > 0) {
                cpp = this.sys.formatCurrency(data.value / data.pixels);
            }
 
            let html = '<td>' + icon +  '</td><td>' + data.delivered + '</td><td>' + this.sys.formatCurrency(data.pixels) + '</td><td>' + this.sys.formatCurrency(data.coins) + '</td><td>' + cpp + '</td><td>' + this.sys.formatCurrency(data.value) + '</td>'
            if (el.innerHTML != html) {
                el.innerHTML = html;
            }

            if (skill != "total") {
                if (data.delivered > 0) {
                    el.style.display = "table-row";
                } else {
                    el.style.display = "none";
                }
            }
        }
    }
    createOrderCache() {
        let breakdown = {};

        for (let i in SKILLS) {
            let skill = SKILLS[i];
            breakdown[skill] = {
                delivered: 0,
                pixels: 0,
                coins: 0,
                value: 0
            }
        }

        this.order_cache = breakdown;
    }
    orderDelivered(order) {
        let price = this.importAppFunction('market.price');

        if (order) {
            this.orders.push(order);
        }

        if (!this.order_cache) {
            this.createOrderCache();
        }

        let breakdown = this.order_cache;

        let order_skill = order.reward.skill.skillType;
        breakdown["total"].delivered++;
        breakdown[order_skill].delivered++;

        if (order.reward.currency.currencyId == "cur_coins") {
            breakdown["total"].coins += order.reward.currency.amount; 
            breakdown[order_skill].coins += order.reward.currency.amount;
        }
        if (order.reward.currency.currencyId == "cur_pixel") {
            breakdown["total"].pixels += order.reward.currency.amount; 
            breakdown[order_skill].pixels += order.reward.currency.amount;
        }

        // simulate pixel gain for texting
        //breakdown["total"].pixels += 1; 
        //breakdown[order_skill].pixels += 1;

        let value = price(order.requestItems[0].itemId) * order.requestItems[0].quantity;
        breakdown["total"].value += value; 
        breakdown[order_skill].value += value;

        this.updateBreakdown();
    }
    updateCurrency(currency) {
        if (currency) { 
            for (let i=0; i < currency.length; i++) {
                let c = currency[i];
                if (!this.balance[c.currencyId]) {
                    this.balance[c.currencyId] = {
                        balance: c.balance,
                        change: 0
                    }
                }

                let balance = this.balance[c.currencyId];
                let change = c.balance - balance.balance;

                balance.balance = c.balance;
                balance.change += change;
            }
        }

        // update balance change UI
        for (let i in this.balance) {
            let balance = this.balance[i];
            let el = this.elements.income.querySelector('[data-currency="' + i + '"]');
            if (el) {
                let change = '<span style="' + (balance.change>0?'color:#afa;">(+':'color:#faa;">(') + this.sys.formatCurrency(balance.change) + ')</span>'
                if (balance.change == 0) { change = ""};
                el.innerHTML = this.sys.formatCurrency(balance.balance) + "&nbsp;" + change;
            }
        }
    }
}