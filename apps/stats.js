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
        this.past_days = [];
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

    }
    update() {
        let timer_element = this.window.querySelector('#hud_reset_timer');
        
        if (this.reset_time != 0) {
            let rt = this.timestampToServerTime(this.reset_time);

            timer_element.innerHTML = this.sys.formatRelativeTime(rt) + " until reset";

            if (rt < Date.now()) {
                this.performReset();
                this.save();
            }

            
        } else {
            timer_element.innerHTML = "Visit taskboard to set reset time.";
        }
    }
    performReset() {
        if (!this.past_days) {
            this.past_days = [];
        }

        // push current stats to the past days
        this.past_days.push({
            time: this.reset_time,
            order: this.orders,
            balance: this.balance
        })
        while (this.past_days.length > 7) {
            this.past_days.shift();
        }
        
        // reset current stats
        this.orders = [];
        this.balance = {};
        let new_rt = this.timestampToServerTime(this.reset_time);
        const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        while (new_rt <= this.timestampToServerTime(Date.now())) {
            new_rt += oneDayInMs;
        }
        this.reset_time = new_rt;

        // update UI
        this.updateBreakdown();
        this.updateCurrency();

    }
    onCreate() {
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

        income_element.innerHTML = '<div class="hud_stat_header">Currencies and Income</div><div class="hud_stat_display" style="display: flex; flex-wrap: wrap; text-align: center; gap: 6px;">' + income_currencies + '</div><div class="hud_stat_display"><div class="hud_stat_entry" id="hud_reset_timer"></div></div></div>';

        this.elements.income = income_element;

        this.window.appendChild(income_element);

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
        if (!currency) { return; }
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