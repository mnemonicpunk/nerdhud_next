const ENTITY_NAME_OVERRIDES = {
    ent_saunarocks_charger: "VIP Charger",
    ent_cow_pickup: "Cow",
    ent_bed_covers: "Bed",
    ent_goosetrailer: "OG Ticket Redemption"
}

export default class TimerApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "timer";
        this.timers = {};
        this.timerUI = {};

        this.highlights = [];
    }
    event(type, data) {
        super.event(type, data);
        if (type == "crop_planted") {
            this.addTimer("crop", data.mid, this.sys.getCurrentMap(), data.generic.statics.fruitItem, 1, (Date.now() + (60000 * data.generic.statics.minutesNeeded)));
            this.save();
        }
        if (type == "crop_picked") {
            this.removeTimer(data.mid);
            this.save();
        }
        if (type == "industry_started") {
            let craft_result = this.sys.getCraftResult(data.generic?.trackers?.myCraftItem);
            this.addTimer("industry", data.mid, this.sys.getCurrentMap(), craft_result.id, craft_result.quantity, data.generic?.trackers?.myCraftFinish);
            this.save();
        }
        if (type == "industry_picked") {
            this.removeTimer(data.mid);
            this.save();
        }
        if (type == "mine_started") {
            this.addTimer("mine", data.mid, this.sys.getCurrentMap(), data.generic.trackers.rolledItem, data.generic.trackers.quantity, data.generic.statics.thetimer);
            this.save();
        }
        if (type == "mine_picked") {
            this.removeTimer(data.mid);
            this.save();
        }
        if (type == "entity_started") {
            this.removeTimer(data.mid);
            this.addTimer("entity", data.mid, this.sys.getCurrentMap(), data.entity, 1, data.generic.utcRefresh || data.generic.trackers.lastTimer)
            this.save();
        }
        if (type == "cow_picked") {
            this.removeTimer(data.mid);
            this.save();
        }
        if (type == "sheep_picked") {
            this.removeTimer(data.mid);
            this.save();
        }
        if (type == "state_change") {
            if (this.sys.getCurrentMap().startsWith('shareInterior')) {
                for (let e in data.entities) {
                    let entity = data.entities[e];

                    // special case for tracking bed covers
                    if (entity.entity == "ent_bed_covers") {
                        console.log("CHECKING OUT ent_bed_covers: ", entity);
                        if ((!this.hasTimer(entity.mid)) && (entity.generic.utcRefresh > Date.now())) {
                            this.addTimer("entity", entity.mid, this.sys.getCurrentMap(), entity.entity, 1, entity.generic.utcRefresh || entity.generic.trackers.lastTimer)
                        }
                        if ((this.hasTimer(entity.mid)) && (entity.generic.utcRefresh <= Date.now())) {
                            this.removeTimer(entity.mid)
                        }
                    }
                }
            }
        }
        if (type == "update") {
            this.updateTimers();
            this.updateTimerUI();
        }
    }
    onCreate() {
        this.window = this.sys.createWindow({ 
            docked: "right",
            icon: "builtin:img/nhud_icon_timer.png",
            name: "timers",
            title: "Timers"
        });
        this.window.dataset.placeholder = "Craft or plant something to make a timer appear here!";

        this.updateTimerUI();
    }
    onSave() {
        return {
            timers: this.timers
        }
    }
    onLoad(data) {
        this.timers = data.timers;
        this.updateTimers();
        this.updateTimerUI();
    }
    highlightMids(mids) {
        this.highlights = mids;
    }
    onDrawEntity(ctx, entity, bounds, camera) {
        if ((this.highlights) && (this.highlights.includes(entity.mid))) {
            ctx.strokeStyle = "#ccf";
            ctx.strokeRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
            ctx.fillStyle = "#88d";
            ctx.globalAlpha = 0.5;
            ctx.fillRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
        }

        if ((this.timers[entity.mid]) && (!this.timers[entity.mid].elapsed)) {
            let t = this.timestampToServerTime(this.timers[entity.mid].finish_time);
            this.drawEntityTimer(ctx, bounds, entity, t, "#444");
        } else {
            if (entity.generic?.statics.thetimer) {
                let t = this.timestampToServerTime(entity.generic?.statics.thetimer);
                this.drawEntityTimer(ctx, bounds, entity, t, "#f44");
            }
        }
    }
    drawEntityTimer(ctx, bounds, entity, timestamp, color) {
        let time = this.sys.formatRelativeTime(timestamp);
        if (time == "") { return; }
        
        let dim = ctx.measureText(time);

        let x = bounds.x;
        let y = bounds.y+bounds.height/2;
        if (entity.entity.includes("crops")) {
            y = bounds.y;
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;

        ctx.fillRect(x - dim.width/2 - 2, y - 11, dim.width + 4, 16);

        ctx.globalAlpha = 1;

        ctx.fillStyle = "#000";
        ctx.fillText(time, x - dim.width/2 - 1, y);
        ctx.fillText(time, x - dim.width/2 + 1, y);
        ctx.fillText(time, x - dim.width/2, y - 1);
        ctx.fillText(time, x - dim.width/2, y + 1);
        ctx.fillStyle = "#fff";
        ctx.fillText(time, x - dim.width/2, y);
    }
    updateTimers() {
        for (let i in this.timers) {
            let t = this.timers[i];
            if (t.elapsed == false) {
                if (t.finish_time <= Date.now()) {
                    t.elapsed = true;
                    this.sys.dispatchEvent('timer_finished', t);
                }
            }
        }
    }
    updateTimerUI() {
        // generate timer groups
        let groups = {};
        for (let i in this.timers) {
            let t = this.timers[i];
            let key = t.map + "_" + t.type + "_" + t.item;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(t);
        }

        for (let i in groups) {
            let group = groups[i];
            let land_el = this.window.querySelector('[data-map="' + group[0].map +'"]');

            // construct land groups for each land we have if not there yet
            if (!land_el) {
                land_el = document.createElement('div');
                land_el.className = "hud_window_group";
                land_el.dataset.map = group[0].map;
                
                let header_el = document.createElement('div');
                header_el.className = "hud_window_group_header";
                header_el.innerHTML = this.sys.getMapName(group[0].map);
                land_el.appendChild(header_el);

                let entries_el = document.createElement('div');
                entries_el.className = "hud_window_group_entries";
                land_el.appendChild(entries_el);

                this.window.appendChild(land_el);

                // attach event handler
                let collapsed = true;
                land_el.addEventListener('click', () => {
                    collapsed =! collapsed;
                    if (collapsed) {
                        entries_el.style.display = "none";
                    } else {
                        entries_el.style.display = "block";
                    }
                });

                land_el.addEventListener('mouseout', () => {
                    this.highlightMids([]);
                })
            }

            // construct timer groups as single elements into land groups
            let group_el = land_el.querySelector('.hud_window_group_entries').querySelector('[data-key="' + i + '"]');

            if (!group_el) {
                group_el = document.createElement('div');
                group_el.className = 'hud_window_group_entry';
                group_el.dataset.key = i;
                group_el.style.display = "flex";
                group_el.style.verticalAlign = "middle";

                let img = document.createElement('img');
                img.className = "hud_icon_large";
                if (group[0].type == "entity") {
                    let lib  = this.sys.getGameLibrary();
                    let entity = lib.entities[group[0].item];

                    if (entity) {
                        let sprite = entity.sprite.image;
                    
                        img.crossOrigin = "anonymous"; // Set cross-origin attribute
                        img.src = sprite;

                        let load_func = () => {
                            // estimate the number of frames
                            let frames = Math.round(img.width/img.height);
                            if (frames < 1) {
                                frames = 1;
                            }

                            let size = {
                                width: img.width/frames,
                                height: img.height
                            };
                            if (size) {
                                // Create a canvas
                                let canvas = document.createElement('canvas');
                                canvas.width = 32;
                                canvas.height = 32;
                                let ctx = canvas.getContext('2d');

                                // Crop the left side of the image
                                let w = size.width; 
                                let h = size.height;

                                // Draw the cropped image scaled to 32x32
                                ctx.drawImage(
                                    img, 
                                    0, 0, w, h, // Source (left side)
                                    0, 0, 32, 32                // Destination (scaled to 32x32)
                                );

                                console.log("SPRITE SCALING: ", size, sprite, entity, frames);

                                img.removeEventListener('load', load_func);

                                // Replace the image source with the canvas content
                                img.src = canvas.toDataURL();
                            }
                        }

                        if (entity.generic.layers[0].sprite.isSpritesheet) {
                            img.addEventListener('load', load_func);
                        }
                       
                        console.log("UPDATING ENTITY IMAGE");
                    }
                } else {
                    img.src = this.sys.getItemData(group[0].item).image;
                }
                
                img.style.marginRight = '6px';
                group_el.appendChild(img);

                let details = document.createElement('div');
                details.style.display = "inline-block";
                details.style.flex = "1";

                let status = document.createElement('div');
                details.appendChild(status);

                let progress = document.createElement('progress');
                progress.max = 100;
                progress.value = 0;
                progress.style.float = "right";
                details.appendChild(progress);
                group_el.appendChild(details);

                land_el.querySelector('.hud_window_group_entries').appendChild(group_el);

                // attach highlight event listener
                group_el.addEventListener('mouseover', () => {
                    this.highlightMids(group_el.dataset.highlights.split(','))
                });
            }

            let elapsed = group.filter(item => item.elapsed == true).length;
            let latest = group.reduce((prev, current) => { return prev.finish_time > current.finish_time?prev:current });
            let progress = latest.elapsed?100:((Date.now() - latest.start_time) / (latest.finish_time - latest.start_time))*100;

            let mids = [group.map(item => item.mid)]
            group_el.dataset.highlights = mids;

            let name = "";
            if (group[0].type != "entity") {
                name = this.sys.getItemName(group[0].item)
            } else {
                if (ENTITY_NAME_OVERRIDES[group[0].item]) {
                    name = ENTITY_NAME_OVERRIDES[group[0].item];
                } else {
                    let entity_name = group[0].item;
                    entity_name = entity_name.replace(/^ent_/, '').replace(/_\d+$/, '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    
                    name = entity_name;     
                }
            }

            group_el.childNodes[1].childNodes[0].innerHTML = name + "&nbsp;(" + elapsed + "/" + group.length +")&nbsp;" + this.sys.formatRelativeTime(latest.finish_time);
            group_el.childNodes[1].childNodes[1].value = progress;
        }

        // prune timer groups that no longer have timers in them
        let group_elements = this.window.querySelectorAll('[data-key]');
        for (let i=0; i < group_elements.length; i++) {
            let el = group_elements[i];
            let key = el.dataset.key;
            if (!groups[key]) {
                el.remove();
            }
        }

        // prune land groups that no longer have timer groups in them
        let land_elements = this.window.querySelectorAll('[data-map]');
        for (let i = 0; i < land_elements.length; i++) {
            let el = land_elements[i];
            let in_use = false;
            for (let j in groups) {
                if (groups[j][0].map == el.dataset.map) {
                    in_use = true;
                }
            }

            if (!in_use) { //(!groups.entries().filter(group => group[0].map == el.dataset.map)) {
                this.window.removeChild(el);
            }
        }
        
    }
    addTimer(type, mid, map, item, quantity, time) {
        const timer = {
            type,
            mid,
            map,
            item,
            quantity,
            start_time: this.timestampToServerTime(Date.now()),
            finish_time: this.timestampToServerTime(time),
            elapsed: false
        }
        this.timers[mid] = timer;
    }
    hasTimer(mid) {
        return this.timers[mid] != undefined;
    }
    removeTimer(mid) {
        if (this.timers[mid]) {
            delete this.timers[mid];
        }
    }
    timestampToServerTime(timestamp) {
        return (timestamp + (libpixels.getServerTime() - Date.now())); 
    }
}
