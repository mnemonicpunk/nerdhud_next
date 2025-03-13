export default class StorageApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "storage";
        this.storages = {};
        this.storage_values = {};
        this.highlighted_storages = [];
        this.hovered_storage = null;
    }
    event(type, data) {
        super.event(type, data);
        /*if (type == "set_storage") {
            this.trackStorage(data);
            this.save();
        }*/
        if (type == "set_storages") {
            this.trackStorages(data);
            this.save();
        }
        if (type == "hover_entity") {
            this.hoverStorage(data);
        }
    }
    hoverStorage(mid) {
        let storage = null;
        for (let i in this.storages) {
            if (this.storages[i].mapEntity_id == mid) {
                storage = this.storages[i];
            }
        }

        // if we are not already hovering the storage
        if ((storage != null) && (this.hovered_storage != storage.mid)) {
            this.constructStorageContainer(this.hover_window, this.storages[mid]);
            this.hovered_storage = mid;
            this.sys.showWindow('storage_hover', true);
        } else {
            if (this.hovered_storage != null) {
                this.hovered_storage = null;
                this.sys.showWindow('storage_hover', false);
            }
        }
    }
    trackStorages(data) {
        let updated_storages = {};
        for (let s in data) {
            const storage = data[s];
            if (this.storageEmpty(storage)) {
                this.removeStorage(storage);
            } else {
                this.storages[storage.mapEntity_id] = storage;
                updated_storages[storage.mapEntity_id] = storage;
            }
        }
        this.updateStorages(updated_storages);
    }
    storageEmpty(storage) {
        for (let slot_num in storage.storage.slots) {
            let slot = storage.storage.slots[slot_num];
            if (slot?.quantity > 0) {
                return false;
            }
        }
        return true;
    }
    removeStorage(storage) {
        if (this.storages[storage.mapEntity_id]) {
            delete this.storages[storage.mapEntity_id];
            this.save();
        }
    }
    getStorageValue(mid) {
        return this.storage_values[mid] || 0;
    }
    getTotalStorageValue() {
        let value = 0;
        for (let i in this.storages) {
            const storage = this.storages[i];
            value += this.getStorageValue(storage.mid);
        }
        return value;
    }
    onCreate() {
        super.onCreate();
        this.exportAppFunction('have', (item) => {
            return this.have(item);
        });
        this.exportAppFunction('highlight', (item) => {
            return this.highlightItem(item);
        });
        this.exportAppFunction('total_value', () => {
            return this.getTotalStorageValue();
        });

        this.window = this.sys.createWindow({ 
            docked: "right",
            icon: "img/nhud_icon_storage.png",
            name: "storage",
            title: "Storage"
        });
        this.window.placeholder = "Your storages will be checked in here automatically when you visit them!";
    
        this.hover_window = this.sys.createWindow({
            name: 'storage_hover',
            hover: true
        });


    }
    onSave() {
        return {
            storages: this.storages
        }
    }
    onLoad(data) {
        this.storages = data.storages;
        this.updateStorages();
    }
    highlightItem(item) {
        if (!item) {
            this.highlighted_storages = [];
            return;
        }
        let storages = this.findStoragesWithItem(item);
        let mids = [];
        for (let i in storages) {
            mids.push(storages[i].mapEntity_id);
        }
        this.highlighted_storages = mids;
    }
    highlightStorage(mid) {
        if ((!mid) || (!this.storages[mid])) {
            this.highlighted_storages = [];
            return;
        }
        this.highlighted_storages = [this.storages[mid].mapEntity_id];
    }
    onDrawEntity(ctx, entity, bounds, camera) {
        if ((this.highlighted_storages) && (this.highlighted_storages.includes(entity.mid))) {
            ctx.strokeStyle = "#ccf";
            ctx.strokeRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
            ctx.fillStyle = "#88d";
            ctx.globalAlpha = 0.5;
            ctx.fillRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);

        }
    }
    findStoragesWithItem(item_id) {
        let ret = [];
        for (let storage_num in this.storages) {
            let storage = this.storages[storage_num];
            for (let slot_num in storage.storage.slots) {
                let slot = storage.storage.slots[slot_num];
                if (slot.item == item_id) {
                    ret.push(storage);
                }
            }
        }
        return ret;
    }
    constructStorageContainer(el, storage) {
        let price = this.importAppFunction('market.price');
        let show_item = this.importAppFunction('iteminfo.show_item');

        let storage_container = document.createElement('div');
        storage_container.style = "display: grid; grid-template-columns: repeat(6, 1fr);";
        let storage_value = 0;

        for (let slot_num in storage.storage.slots) {
            let slot = storage.storage.slots[slot_num];
            let item_img = this.sys.getItemImage(slot.item);
            let slot_value = price(slot.item) * slot.quantity;
            storage_value += slot_value;

            let item_el = document.createElement('div');
            item_el.style = "display: inline-block; text-align: center; padding: 6px;";
            item_el.innerHTML = '<img class="hud_icon_medium" src="' + item_img + '"><br>x' + slot.quantity + (slot_value>0?'<br><span style="font-size: 75%; color: #ddd"><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image +'">' + this.sys.formatCurrency(slot_value) + '</span>':'');
            item_el.addEventListener('click', (e) => {
                show_item(slot.item);
                e.preventDefault();
                e.stopPropagation();
            });
            storage_container.appendChild(item_el);

            //thtml += "<td style=''><img class='hud_icon_large' src='" + item_img + "'><br>x" + slot.quantity + "<td>";
        }
        el.innerHTML = '<div class="hud_list_heading">' + (storage.storage.name || "Unnamed Storage") + '&nbsp;<span style="font-size: 75%; color: #ddd"><img class="hud_icon_small" src="' + this.sys.getCurrencyData('cur_coins').sprite.image +'">' + this.sys.formatCurrency(storage_value) + '</span></div>';
        el.appendChild(storage_container);

        this.storage_values[storage.mid] = storage_value;
    }
    updateStorages(updated_storages) {
        let price = this.importAppFunction('market.price');
        let show_item = this.importAppFunction('iteminfo.show_item');

        if (!this.window) { return; }

        // sort storages by maps
        let map_groups = {};
        for (let storage_num in this.storages) {
            let storage = this.storages[storage_num];
            let map = storage.mapId;
            if (!map_groups[map]) {
                map_groups[map] = {};
            }
            map_groups[map][storage.mapEntity_id] = storage;
        }

        // now let's build/update the actual UI
        for (let m in map_groups) {
            let map = map_groups[m];

            let map_el = this.window.querySelector('[data-map="' + m + '"');
            if (!map_el) {
                map_el = document.createElement('div');
                map_el.className = "hud_window_group";
                map_el.dataset.map = m;

                // add header
                let map_header = document.createElement('div');
                map_header.className = "hud_window_group_header";
                map_header.innerHTML = this.sys.getMapName(m);
                map_el.appendChild(map_header);

                let entries_el = document.createElement('div');
                entries_el.className = "hud_window_group_entries";
                entries_el.style.display = "none";
                map_el.appendChild(entries_el);

                // attach event handler
                let collapsed = true;
                map_el.addEventListener('click', () => {
                    collapsed =! collapsed;
                    if (collapsed) {
                        entries_el.style.display = "none";
                    } else {
                        entries_el.style.display = "block";
                    }
                });

                this.window.appendChild(map_el);
            }
            let entries_el = map_el.childNodes[1];

            for (let s in map) {
                let storage = map[s];

                let el = entries_el.querySelector('[data-storage="' + s + '"');
            
                let new_storage = false;
                if (!el) {
                    new_storage = true;
                    el = document.createElement('div');
                    el.dataset.storage = s;
                    el.style = "padding: 5px; margin: 5px;"

                    el.addEventListener('mouseover', () => {
                        this.highlightStorage(s);
                    });
                    el.addEventListener('mouseout', () => {
                        this.highlightStorage();
                    });
                    
                    entries_el.appendChild(el);
                }

                // if the updated_storage is the one we just got, force an update on the contents as well
                if (new_storage || (updated_storages && updated_storages[s])) {
                    this.constructStorageContainer(el, storage);
                }
            }

            // prune empty storages
            let entries = entries_el.querySelectorAll('[data-storage]');
            for (let storage_el of entries) {
                let storage = this.storages[storage_el.dataset.storage] || null;

                // if storage isn't being tracked anymore or is empty, prune element
                if ((storage == null) || this.storageEmpty(storage)) {
                    entries_el.removeChild(storage_el);
                }
            }
            
            // now select the elements again, if we no longer have any storages attached, prune the map element
            entries = entries_el.querySelectorAll('[data-storage]');
            if (!entries) {
                this.window.removeChild(map_el);
            }
        }
    }
    have(item) {
        let count = 0;
        for (let s in this.storages) {
            let storage = this.storages[s];
            for (let i in storage.storage.slots) {
                let slot = storage.storage.slots[i];
                if (slot.item == item) {
                    count += slot.quantity;
                } 
            }
        }
        
        return count;
    }
}
