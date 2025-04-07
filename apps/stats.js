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
];

class HUDCollapsiblePane extends HUDWidget {
    /**
     * @param {object} sys - The system object.
     * @param {object} options - Options for the pane:
     *    - header: The text (or HTML) for the pane header.
     *    - content: Either an HTML string, a DOM element, or a HUDWidget instance.
     *    - collapsed: (optional) Boolean initial collapsed state.
     */
    constructor(sys, options = {}) {
      const template = `
        <div class="hud-collapsible-pane">
          <div class="pane-header" style="cursor: pointer; user-select: none; background: #ddd; padding: 4px 8px;">
            ${options.header || 'Pane'}
          </div>
          <div class="pane-content" style="padding: 8px;"></div>
        </div>
      `;
      super(sys, { template });
      this.collapsed = options.collapsed || false;
      this.options = options;
      this.cacheElements();
      this.bindEvents();
      this.create();
    }
    
    cacheElements() {
      this.headerEl = this.root.querySelector('.pane-header');
      this.contentEl = this.root.querySelector('.pane-content');
    }

    bindEvents() {
      // Add a click listener on the header. Only toggle if the header itself is the event target.
      this.headerEl.addEventListener('click', (event) => {
        if (event.target === this.headerEl) {
          event.stopPropagation();
          this.toggle();
        }
      });
    }
    
    create() {
      // Set initial display state programmatically.
      this.contentEl.style.display = this.collapsed ? 'none' : 'block';
      
      // Add provided content.
      if (this.options.content) {
        if (this.options.content instanceof HUDWidget) {
          this.contentEl.appendChild(this.options.content.root);
        } else if (this.options.content instanceof HTMLElement) {
          this.options.content.style.display = "inherit";
          this.contentEl.appendChild(this.options.content);
        } else {
          this.contentEl.innerHTML = this.options.content;
        }
      }
    }
    
    toggle() {
        console.log("STATE: ", this.collapsed, this.contentEl);
      this.collapsed = !this.collapsed;
      this.contentEl.style.display = this.collapsed ? 'none' : 'block';
    }
    
    setHeader(text) {
      this.headerEl.innerHTML = text;
    }
  }
  
/**********************************
 * HUDDataTable Widget
 **********************************
 * A reusable data table widget.
 * The 'columns' option is an object mapping column header titles
 * to a formatter function that produces cell content for each data item.
 */
class HUDDataTable extends HUDWidget {
  /**
   * @param {object} sys - The system object.
   * @param {object} options - Options for the table:
   *    - columns: An object mapping column header titles to formatter functions.
   *    - data: An array of data items.
   *    - tableClass: (optional) CSS classes for the table.
   *    - headerRowClass: (optional) CSS classes for the header row.
   */
  constructor(sys, options = {}) {
    const template = `<table class="hud-data-table ${options.tableClass || ''}" style="width: 100%; text-align: center;">
      <thead><tr class="${options.headerRowClass || ''}"></tr></thead>
      <tbody></tbody>
    </table>`;
    super(sys, { template });
    this.options = options;
    this.data = options.data || [];
    this.columns = options.columns || {};
    this.cacheElements();
    this.create();
    this.update(this.data);
  }
  
  cacheElements() {
    this.theadRow = this.root.querySelector('thead tr');
    this.tbody = this.root.querySelector('tbody');
  }
  
  create() {
    // Build header row.
    this.theadRow.innerHTML = '';
    for (let colHeader in this.columns) {
      let th = document.createElement('th');
      th.innerHTML = colHeader;
      this.theadRow.appendChild(th);
    }
  }
  
  update(data) {
    this.data = data;
    this.tbody.innerHTML = '';
    this.data.forEach(item => {
      let tr = document.createElement('tr');
      for (let colHeader in this.columns) {
        let td = document.createElement('td');
        let formatter = this.columns[colHeader];
        td.innerHTML = formatter(item);
        tr.appendChild(td);
      }
      this.tbody.appendChild(tr);
    });
  }
}

/**********************************
 * StatsApp Implementation
 **********************************/

export default class StatsApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "stats";
        this.elements = {};
        this.orders = [];
        this.balance = {};
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
        // Update reset timer and net worth.
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
        
        // Update levels.
        let levels_element = this.elements.levels;
        if (this.levels) {
            let new_html = "Total level: " + this.levels.total.level;
            if (levels_element.innerHTML != new_html) {
                levels_element.innerHTML = new_html;
            }
        }
        
        // Update market listings.
        let listings_entries = this.elements.listing_entries;
        let listings = my_listings();
        let listings_html = "";
        if (listings && listings.length > 0) {
            listings_html += '<table class="nerd_window_table" style="text-align: center;"><thead><tr><th></th><th>Market</th><th>Quantity</th><th>Price</th><th>Fee</th></tr></thead><tbody>';
            for (let i = 0; i < listings.length; i++) {
                let listing = listings[i];
                listings_html += '<tr>';
                listings_html += '<td><img class="hud_icon_medium" src="' + this.sys.getItemImage(listing.itemId) + '">&nbsp;' + this.sys.getItemName(listing.itemId) + '</td>';
                listings_html += '<td><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image + '">' + price(listing.itemId) + '</td>';
                listings_html += '<td>' + listing.quantity + '</td>';
                listings_html += '<td><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image + '">' + listing.price + '</td>';
                listings_html += '<td><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image + '">' + this.sys.formatCurrency(listing.price * listing.fee) + '</td>';
                listings_html += '</tr>';
            }
            listings_html += '</tbody></table>';
        } else {
            listings_html = "You have no current market listings.";
        }
        if (listings_entries.innerHTML != listings_html) {
            listings_entries.innerHTML = listings_html;
        }
    }

    performReset() {
        if (!this.past_days) {
            this.past_days = [];
        }
        this.past_days.push({
            time: this.reset_time,
            orders: [...this.orders],
            balance: { ...this.balance }
        });
        while (this.past_days.length > 7) {
            this.past_days.shift();
        }
        this.orders = [];
        this.order_cache = {};
        for (let key in this.balance) {
            if (this.balance.hasOwnProperty(key)) {
                this.balance[key].change = 0;
            }
        }
        const oneDayInMs = 24 * 60 * 60 * 1000;
        let newResetTime = this.timestampToServerTime(this.reset_time);
        while (newResetTime <= Date.now()) {
            newResetTime += oneDayInMs;
        }
        this.reset_time = newResetTime;
        this.updateCurrency();
        this.createOrderCache();
        this.updateBreakdown();
        this.save();
    }    
    
    createStats() {
        // Build income element.
        let income_element = document.createElement('div');
        income_element.className = "hud_stat_pane";
        let all_currencies = this.sys.getGameLibrary().currencies;
        let currency_list = ['cur_coins', 'cur_pixel', 'cur_buoybuck', 'cur_speedup', 'cur_guildtoken'];
        let income_currencies = "";
        for (let i = 0; i < currency_list.length; i++) {
            let c = all_currencies[currency_list[i]];
            if (c) {
                let currency_display = '<img class="hud_icon_small" src="' + c.sprite.image + '"> <span data-currency="' + currency_list[i] + '">0</span>';
                income_currencies += '<div class="hud_stat_entry">' + currency_display + '</div>';
            }
        }
        income_element.innerHTML = '<div class="hud_stat_header">Currencies and Income</div><div class="hud_stat_display" style="display: flex; flex-wrap: wrap; text-align: center; gap: 6px;">' + income_currencies + '</div><div class="hud_stat_display"><div class="hud_stat_entry" id="hud_reset_timer"></div></div><div class="hud_stat_display"><div class="hud_stat_entry" id="hud_net_worth"></div></div>';
        this.elements.income = income_element;
        this.window.appendChild(income_element);
        
        let levels_element = document.createElement('div');
        levels_element.className = "hud_stat_pane";
        levels_element.style = "text-align: center;";
        if (this.levels) {
            levels_element.innerHTML = "Total level: " + this.levels.total.level;
        }
        this.elements.levels = levels_element;
        this.window.appendChild(levels_element);
        
        // Create a collapsible pane for Market Listings.
        let listingsContainer = document.createElement('div');
        listingsContainer.innerHTML = "";
        this.elements.listing_entries = listingsContainer;
        let listingsPane = new HUDCollapsiblePane(this.sys, {
            header: "My Market Listings",
            content: listingsContainer,
            collapsed: true
        });
        this.window.appendChild(listingsPane.root);
        
        // Create a collapsible pane for Map Limits.
        let limitsContainer = document.createElement('div');
        limitsContainer.innerHTML = "";
        this.elements.limits_entries = limitsContainer;
        let limitsPane = new HUDCollapsiblePane(this.sys, {
            header: "Current Map Limits",
            content: limitsContainer,
            collapsed: true
        });
        this.window.appendChild(limitsPane.root);
        
        // Create a HUDDataTable for Map Limits and append it to the limits container.
        // Define columns for the map limits table.
        const limitsColumns = {
            "Name": item => item.name,
            "Usage (%)": item => (item.percent * 100).toFixed(2) + '%',
            "Used/Max": item => item.used + '/' + item.max
        };
        // Create the data table widget.
        this.limitsTableWidget = new HUDDataTable(this.sys, {
            columns: limitsColumns,
            data: [] , // Initially empty; will be updated in updateMapLimits().
            tableClass: "nerd_window_table"
        });
        // Append the data table into the limits container.
        limitsContainer.appendChild(this.limitsTableWidget.root);
        
        // Build breakdown table using HUDDataTable.
        const breakdownColumns = {
            "Skill": item => item.name,
            "#": item => item.delivered,
            "Pixels": item => this.sys.formatCurrency(item.pixels),
            "Coins": item => this.sys.formatCurrency(item.coins),
            "CPP": item => item.pixels > 0 ? this.sys.formatCurrency(item.value / item.pixels) : "n/a",
            "Value": item => this.sys.formatCurrency(item.value)
        };
        this.breakdownTableWidget = new HUDDataTable(this.sys, {
            columns: breakdownColumns,
            data: [], // will be updated via updateBreakdown()
            tableClass: "nerd_window_table"
        });
        this.window.appendChild(this.breakdownTableWidget.root);
    }
    
    updateMapLimits() {
        let total_value = 0;
        let total_count = 0;
        let limits = [];
    
        for (let i in this.map_limits) {
            let l = this.map_limits[i];
            // Exclude certain keys.
            if (!(i.endsWith("-boost") || i == "total" || i == "billboards")) {
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
        // Prepend a "total" entry.
        limits.unshift({
            id: "total",
            name: "Total",
            percent: total_value / total_count,
            used: total_value,
            max: total_count
        });
    
        // Build the original-style HTML content.
        let entries_el = this.elements.limits_entries;
        entries_el.innerHTML = "";
    
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'decimal',
            maximumFractionDigits: 2,
            minimumFractionDigits: 0,
        });
    
        if (limits.length > 1) {
            limits.forEach(limit => {
                let el = document.createElement('div');
                let breakdown = "";
                if (limit.id != "total") {
                    breakdown = ", " + limit.used + "/" + limit.max;
                }
                el.innerHTML = '<div>' + limit.name + ' (' + formatter.format(limit.percent * 100) + '%' + breakdown + ')</div>' +
                               '<progress max="100" value="' + (limit.percent <= 1 ? limit.percent * 100 : 100) + '"></progress>';
                if (limit.percent > 1) {
                    el.style.color = "#faa";
                }
                entries_el.appendChild(el);
            });
        } else {
            entries_el.innerHTML = "This location does not have map limits.";
        }
    }    
    
    onCreate() {
        super.onCreate();
        this.window = this.sys.createWindow({ 
            docked: "left",
            icon: "img/nhud_icon_coin.png",
            name: "stats",
            title: "Stats"
        });
        this.window.dataset.placeholder = "This window tracks your $PIXEL and coin stats!";
        this.createOrderCache();
        this.createStats();
    }
    
    onSave() {
        return {
            orders: this.orders,
            balance: this.balance,
            reset_time: this.reset_time,
            past_days: this.past_days
        };
    }
    
    onLoad(data) {
        this.balance = data.balance;
        this.reset_time = data.reset_time;
        this.past_days = data.past_days;
        this.updateCurrency(this.balance);
        for (let i = 0; i < data.orders.length; i++) {
            this.orderDelivered(data.orders[i]);
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
            };
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
        let value = price(order.requestItems[0].itemId) * order.requestItems[0].quantity;
        breakdown["total"].value += value; 
        breakdown[order_skill].value += value;
        this.updateBreakdown();
    }
    
    updateCurrency(currency) {
        if (currency) { 
            for (let i = 0; i < currency.length; i++) {
                let c = currency[i];
                if (!this.balance[c.currencyId]) {
                    this.balance[c.currencyId] = {
                        balance: c.balance,
                        change: 0
                    };
                }
                let balance = this.balance[c.currencyId];
                let change = c.balance - balance.balance;
                balance.balance = c.balance;
                balance.change += change;
            }
        }
        for (let i in this.balance) {
            let balance = this.balance[i];
            let el = this.elements.income.querySelector('[data-currency="' + i + '"]');
            if (el) {
                let change = '<span style="' + (balance.change > 0 ? 'color:#afa;">(+' : 'color:#faa;">(-') + this.sys.formatCurrency(Math.abs(balance.change)) + ')</span>';
                if (balance.change == 0) { change = ""; }
                el.innerHTML = this.sys.formatCurrency(balance.balance) + "&nbsp;" + change;
            }
        }
    }
    
    updateBreakdown() {
        let limits = [];
        for (let i in this.order_cache) {
            let l = this.order_cache[i];
            // Even if l has all zeros, push the object.
            if (!(i.endsWith("-boost") || i == "billboards")) {
                limits.push({
                    id: i,
                    name: i == "total" ? "Total" : String(i).charAt(0).toUpperCase() + String(i).slice(1),
                    delivered: l.delivered,
                    pixels: l.pixels,
                    coins: l.coins,
                    value: l.value
                });
            }
        }
        if (this.breakdownTableWidget) {
            this.breakdownTableWidget.update(limits);
        }
    }    
    
    getRequested(item) {
        let amount = 0;
        for (let i = 0; i < this.orders.length; i++) {
            let order = this.orders[i];
            if (order?.requestItems[0]?.itemId == item) {
                amount += order.requestItems[0].quantity;
            }
        }
        return amount;
    }
}
