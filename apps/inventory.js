const ITEMS_PER_ROW = 6;

export default class InventoryApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "inventory";
        this.inventory = {};
        this._show_inventory_ui = false;
        this._inventory_coords = [];
    }
    onCreate() {
        super.onCreate();
        this.exportAppFunction('have', (item) => {
            return this.have(item);
        });
        this.exportAppFunction('slot', (num) => {
            return this.getItemSlot(num);
        });

        let _self = this;
        this.sys.watchClass("Hud_slidingGroup__ZaO10 Hud_expanded__QJoAM", 100, () => {
            this.sys._showing_inventory = true;
            this._show_inventory_ui = true;
            this._inventory_coords = Array.from(document.querySelectorAll('.Hud_item__YGtIC')).map(element => {
                const rect = element.getBoundingClientRect();
                return { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height };
            });
        }, () => {
            this.sys._showing_inventory = false;
            this._show_inventory_ui = false;
            this._inventory_coords = [];
        });
    }
    event(type, data) {
        if (type == "inventory") {
            this.inventory = data;
        }
    }
    draw(ctx, width, height, camera) {
        let price = this.importAppFunction('market.price');

        if (this._show_inventory_ui) {
            for (let i=0; i<this._inventory_coords.length; i++) {
                let idx = (i + (this.inventory.activeRow * ITEMS_PER_ROW)) % this.inventory.size;
                let coords = this._inventory_coords[i];
                let slot = this.inventory.slots[idx];
                if (slot) {
                    let item_price = price(slot.item) * slot.quantity;

                    if (item_price != 0) {
                        let text = this.sys.formatCurrency(item_price);
                        let dim = ctx.measureText(text);
                        dim.height = dim.actualBoundingBoxAscent + dim.actualBoundingBoxDescent;
    
                        ctx.fillStyle = "rgba(0,0,0,0.3)";
                        ctx.fillRect(coords.x + coords.width - dim.width - 6, coords.y + dim.actualBoundingBoxAscent, dim.width, dim.height);
                        ctx.fillStyle = "#fff";
                        ctx.fontWeight = "bold";
                        ctx.fillText(text, coords.x + coords.width - dim.width - 6, coords.y + 12);
                    }
                    
                }
            }
        }
    }
    have(item) {
        let count = 0;
        for (let i in this.inventory.slots) {
            let slot = this.inventory.slots[i];
            if (slot.item == item) {
                count += slot.quantity;
            } 
        }
        return count;
    }
    getItemSlot(num) {
        return this.inventory.slots[num];
    }
}