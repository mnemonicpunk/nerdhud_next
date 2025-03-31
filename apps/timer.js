export default class TimerApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "timer";
        this.timers = {};
        this.timerUI = {};

        // track sauna energy
        this.sauna_ticks = 0;

        this.highlights = [];
    }
    event(type, data) {
        super.event(type, data);
        if (type == "timer_finished") {
            let group = this.getGroupOfTimer(data.mid);
            if (group) {
                let all_finished = true;
                for (let i in group) {
                    let timer = group[i];
                    all_finished &= timer.elapsed;
                }
                if (all_finished) {
                    this.sys.dispatchEvent('timer_group_finished', group);
                }
            }
        }
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
            this.addTimer("mine", data.mid, this.sys.getCurrentMap(), data.entity, 1, data.generic.statics.thetimer);
            this.save();
        }
        if (type == "mine_picked") {
            this.removeTimer(data.mid);
            this.save();
        }
        if (type == "entity_started") {
            if (!this.isEntityBlacklisted(data)) {
                this.removeTimer(data.mid);
                this.addTimer("entity", data.mid, this.sys.getCurrentMap(), data.entity, 1, data.generic.utcRefresh || data.generic.trackers.lastTimer)
                this.save();
            }
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
            // special case for bed timer
            if (this.sys.getCurrentMap().startsWith('shareInterior')) {
                for (let e in data.entities) {
                    let entity = data.entities[e];

                    // special case for tracking bed covers
                    if (entity.entity == "ent_bed_covers") {
                        if ((this.hasTimer(entity.mid)) && (this.timers[entity.mid].finish_time <= Date.now())) {
                            this.removeTimer(entity.mid);
                            this.save();
                        }
                        if ((!this.hasTimer(entity.mid)) && (entity.generic.utcRefresh > Date.now())) {
                            this.addTimer("entity", entity.mid, this.sys.getCurrentMap(), "ent_bed_speck", 1, entity.generic.utcRefresh || entity.generic.trackers.lastTimer)
                            this.save();
                        }
                    }
                }
            }

            // special case for sauna pool timer
            if (this.sys.getCurrentMap().startsWith('SaunaInterior')) {
                for (let e in data.entities) {
                    let entity = flattenEntity(data.entities[e]);

                    // special case for tracking bed covers
                    if (entity.entity == "ent_saunaenergy") {
                        console.log("POOL: ", entity);
                        const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

                        if (!entity.generic.trackers.lastStart) { console.log("SAUNA POOL HAS NO LASTSTART"); return; }
                        if (this.sauna_ticks != entity.generic.trackers.bonusCount) {
                            this.sauna_ticks = entity.generic.trackers.bonusCount;
                            this.save();
                        }
                        

                        if ((this.hasTimer(entity.mid)) && (this.timers[entity.mid].elapsed)) {
                            this.removeTimer(entity.mid);
                            this.save();
                        }
                        if ((!this.hasTimer(entity.mid)) && (entity.generic.trackers.lastStart > (Date.now() - oneDayInMs))) {
                            this.addTimer("entity", entity.mid, this.sys.getCurrentMap(), entity.entity, 1, entity.generic.trackers.lastStart + oneDayInMs);
                            this.save();
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
    declareSettings() {
        return {
            title: 'Timers',
            settings: [
                {
                    name: 'Display remaining time on active industries/crops',
                    var: 'display_active_timers',
                    type: 'bool',
                    default: true,
                    description: 'When this is enabled any industries with an active timer will overlay the remaining time on them on screen'
                },
                {
                    name: 'Display time until an industry can be used again',
                    var: 'display_use_timers',
                    type: 'bool',
                    default: false,
                    description: 'When this is enabled any industries that are in use by another player or otherwise on cooldown will show a timer until they can be used again with a red background'
                },
                {
                    name: 'Display VIP Sauna timer',
                    var: 'display_vip',
                    type: 'bool',
                    default: true,
                    description: 'When this is enabled the VIP Sauna timer will be displayed at the top of the screen'
                },
                {
                    name: 'Display Pool reset timer and energy',
                    var: 'display_pool',
                    type: 'bool',
                    default: true,
                    description: 'When this is enabled the remaining energy and the time until your sauna pool resets will be displayed at the top of the screen'
                },
                {
                    name: 'Display Speck bed timer',
                    var: 'display_bed',
                    type: 'bool',
                    default: true,
                    description: 'When this is enabled the time until you can use your speck bed again will be displayed at the top of the screen'
                },
            ]
        }
    }
    isEntityBlacklisted(entity) {
        const prefixes = [
            'ent_playertree'
        ];
        const suffixes = [
            '_start',
            '_starter',
            '_start_pixels',
            '_starter_pixels',
            'Start'
        ];
        const names = [
            'ent_mole',
            'ent_mole_pixels'
        ];

        for (let i=0; i < prefixes.length; i++) {
            let prefix = prefixes[i];
            if (entity.entity.startsWith(prefix)) {
                return true;
            }
        }
        for (let i=0; i < suffixes.length; i++) {
            let suffix = suffixes[i];
            if (entity.entity.endsWith(suffix)) {
                return true;
            }
        }
        for (let i=0; i < names.length; i++) {
            let name = names[i];
            if (entity.entity == name) {
                return true;
            }
        }
        return false;
    }
    onCreate() {
        super.onCreate();
        this.window = this.sys.createWindow({ 
            docked: "right",
            icon: "img/nhud_icon_timer.png",
            name: "timers",
            title: "Timers"
        });
        this.window.dataset.placeholder = "Craft or plant something to make a timer appear here!";

        this.exportAppFunction("add_timer", (type, mid, map, item, quantity, time) => {
            return this.addTimer(type, mid, map, item, quantity, time)

        });
        this.exportAppFunction("has_timer", (mid) => {
            return this.hasTimer(mid);
        });
        this.exportAppFunction("remove_timer", (mid) => {
            return this.removeTimer(mid)
        });
        this.exportAppFunction("get_entity_timer", (mid) => {
            return this.getEntityTimer(mid)
        });


        this.updateTimerUI();
    }
    onSave() {
        return {
            timers: this.timers,
            sauna_ticks: this.sauna_ticks
        }
    }   
    onLoad(data) {
        this.timers = data.timers || {};
        this.sauna_ticks = data.sauna_ticks || 0;
        this.updateTimers();
        this.updateTimerUI();
    }
    highlightMids(mids) {
        this.highlights = mids;
    }
    onDrawEntity(ctx, entity, bounds, camera) {
        const settings = this.getSettings();

        if ((this.highlights) && (this.highlights.includes(entity.mid))) {
            ctx.strokeStyle = "#ccf";
            ctx.strokeRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
            ctx.fillStyle = "#88d";
            ctx.globalAlpha = 0.5;
            ctx.fillRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
        }

        if ((this.timers[entity.mid]) && (!this.timers[entity.mid].elapsed)) {
            if (settings.display_active_timers) {
                let t = this.timestampToServerTime(this.timers[entity.mid].finish_time);
                this.drawEntityTimer(ctx, bounds, entity, t, "#444");
            }
        } else {
            if (settings.display_use_timers && entity.generic?.statics.finishTime) {
                let t = this.timestampToServerTime(entity.generic?.statics.finishTime);
                this.drawEntityTimer(ctx, bounds, entity, t, "#f44");
            } else if (entity.generic?.statics.thetimer) {
                let t = this.timestampToServerTime(entity.generic?.statics.thetimer);
                this.drawEntityTimer(ctx, bounds, entity, t, "#f44");
            } else if (entity.generic?.statics.firedUntil) {
                let t = this.timestampToServerTime(entity.generic?.statics.firedUntil);
                this.drawEntityTimer(ctx, bounds, entity, t, "#880");
            }
        }
    }
    draw(ctx, width, height) {
        const settings = this.getSettings();
        let timer_text = "";
        
        let vip_timer = this.getEntityTimer("ent_saunarocks_charger");
        if (settings.display_vip && vip_timer) {
            let vip_timer_text = "VIP Sauna";
            if (vip_timer.elapsed) {
                vip_timer_text += " ready!";
            } else {
                vip_timer_text += ": " + this.sys.formatRelativeTime(vip_timer.finish_time);
            }
            timer_text += vip_timer_text;
        }

        let pool_timer = this.getEntityTimer("ent_saunaenergy");
        if (settings.display_pool && pool_timer) {
            let pool_timer_text = "Pool: ";
            if (pool_timer.elapsed) {
                pool_timer_text += "120/120 energy";
            } else {
                pool_timer_text += (121 - (Math.min(this.sauna_ticks, 120))) + "/120 energy ( " + this.sys.formatRelativeTime(pool_timer.finish_time) + ")";
            }
            if (timer_text != "") {
                timer_text += " || ";
            }
            timer_text += pool_timer_text;
        }

        let bed_timer = this.getEntityTimer("ent_bed_speck");
        if (settings.display_bed && bed_timer) {
            let bed_timer_text = "Bed";
            if (bed_timer.elapsed) {
                bed_timer_text += " ready!";
            } else {
                bed_timer_text += ": " + this.sys.formatRelativeTime(bed_timer.finish_time);
            }
            if (timer_text != "") {
                timer_text += " || ";
            }
            timer_text += bed_timer_text;
        }
      
        if (timer_text != "") {
            /*let dim = ctx.measureText(timer_text);
            ctx.fillStyle = "#000";

            ctx.globalAlpha = 0.4;
            ctx.fillRect(width/2-dim.width/2 -5, 5, dim.width + 10, 20);
            ctx.globalAlpha = 1;

            ctx.fillText(timer_text, width/2-dim.width/2 - 1, 20);
            ctx.fillText(timer_text, width/2-dim.width/2 + 1, 20);
            ctx.fillText(timer_text, width/2-dim.width/2, 20 - 1);
            ctx.fillText(timer_text, width/2-dim.width/2, 20 + 1);

            ctx.fillStyle = "#fff";
            ctx.fillText(timer_text, width/2-dim.width/2, 20);*/
            this.drawTextCentered(ctx, timer_text, width/2, 20, '#fff', '#000');
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
                group_el.style.alignItems = "center";
                group_el.style.verticalAlign = "middle";

                let img = document.createElement('img');
                img.className = "hud_icon_large";
                if (group[0].type == "entity" || group[0].type == "mine") {
                    let lib  = this.sys.getGameLibrary();
                    let entity = lib.entities[group[0].item];

                    if (entity) {
                        let sprite = entity.sprite.image;

                        // SPECIAL CASE FOR SPORE CHAMBER //
                        if (group[0].item == "ent_spore_chamber") {
                            sprite = "https://d31ss916pli4td.cloudfront.net/uploadedAssets/i/itm_guildwarscharm/953cf680-dbea-4543-951b-52ee04a86be7.png";
                        }
                        //
                    
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

                                img.removeEventListener('load', load_func);

                                // Replace the image source with the canvas content
                                img.src = canvas.toDataURL();
                            }
                        }

                        if (entity?.generic?.layers?.[0]?.sprite?.isSpritesheet) {
                            img.addEventListener('load', load_func);
                        }
                    }
                } else {
                    img.src = this.sys.getItemImage(group[0].item) || "#";
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

                // append trash can for timer group deletion
                let remove_btn = document.createElement('div');
                remove_btn.className = "hud_button";
                remove_btn.style = "padding: 6px; margin-left: 6px;";
                remove_btn.innerHTML = "🗑️";
                remove_btn.addEventListener('click', () => {
                    let timer = group[0];
                    
                    let name = "";
                    if ((group[0].type != "entity") && (group[0].type != "mine")) {
                        name = this.sys.getItemName(group[0].item)
                    } else {
                        name = this.sys.getEntityName(group[0].item);
                    }
        
                    let confirm_text = "Really delete timer for  " + name + " x" + group.length + "?";

                    if (confirm(confirm_text)) {
                        let timers = this.getTimerGroup(timer.type, timer.map, timer.item);
                        this.removeTimerGroup(timers);
                        this.save();
                    }

                })
                group_el.appendChild(remove_btn);

                land_el.querySelector('.hud_window_group_entries').appendChild(group_el);

                // attach highlight event listener
                group_el.addEventListener('mouseover', () => {
                    this.highlightMids(group_el.dataset.highlights.split(','))
                });
                group_el.addEventListener('click', e => {
                    e.stopPropagation();
                    
                    let map = group[0].map;
                    let match = map.match(/^pixelsNFTFarm-(\d{1,4})$/) || map.match(/^nftHouse(\d{1,4})$/);
                    
                    if (match) {
                        let land_number = parseInt(match[1], 10);
                        this.sys.contextLandClick(land_number);
                    }
                });
            }

            let elapsed = group.filter(item => item.elapsed == true).length;
            let latest = group.reduce((prev, current) => { return prev.finish_time > current.finish_time?prev:current });
            let progress = latest.elapsed?100:((Date.now() - latest.start_time) / (latest.finish_time - latest.start_time))*100;

            let mids = [group.map(item => item.mid)]
            group_el.dataset.highlights = mids;

            let name = "";
            if ((group[0].type != "entity") && (group[0].type != "mine")) {
                name = this.sys.getItemName(group[0].item)
            } else {
                name = this.sys.getEntityName(group[0].item);
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
    addTimer(type, mid, map, item, quantity, time, options=null) {
        const timer = {
            type,
            mid,
            map,
            item,
            quantity,
            start_time: this.timestampToServerTime(Date.now()),
            finish_time: this.timestampToServerTime(time),
            elapsed: false,
            options
        }
        this.timers[mid] = timer;
    }
    getGroupOfTimer(mid) {
        if (!this.timers[mid]) { return null; }
        const compare_timer = this.timers[mid]; 

        let group = [];
        for (let i in this.timers) {
            const timer = this.timers[i];
            if ((compare_timer.type == timer.type) && (compare_timer.map == timer.map) && (compare_timer.item == timer.item)) {
                group.push(timer);
            }
        }
        return group;
    }
    hasTimer(mid) {
        return this.timers[mid] != undefined;
    }
    removeTimer(mid) {
        if (this.timers[mid]) {
            delete this.timers[mid];
        }
    }
    getTimerGroup(type, map, item) {
        let group = [];
        for (let i in this.timers) {
            const timer = this.timers[i];
            if ((type == timer.type) && (map == timer.map) && (item == timer.item)) {
                group.push(timer);
            }
        }
        return group;
    }
    getEntityTimer(entity_name) {
        for (let i in this.timers) {
            let t = this.timers[i];
            if ((t.type == "entity") && (t.item == entity_name)) {
                return t;
            }
        }
        return null;
    }
    removeTimerGroup(group) {
        for (let i=0; i<group.length; i++) {
            this.removeTimer(group[i].mid);
        }
    }
}
