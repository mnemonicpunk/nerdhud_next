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
        if (type == "update") {
            this.updateTimers();
            this.updateTimerUI();
        }
    }
    onCreate() {
        this.window = this.sys.createWindow({ 
            docked: "right",
            icon: chrome.runtime.getURL("img/nhud_icon_timer.png"),
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
        console.log("HIGHLIGHTING: ", mids);
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
                img.src = this.sys.getItemData(group[0].item).image;
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

            group_el.childNodes[1].childNodes[0].innerHTML = this.sys.getItemName(group[0].item) + "&nbsp;(" + elapsed + "/" + group.length +")&nbsp;" + this.sys.formatRelativeTime(latest.finish_time);
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
            start_time: Date.now(),
            finish_time: time,
            elapsed: false
        }
        this.timers[mid] = timer;
    }
    removeTimer(mid) {
        if (this.timers[mid]) {
            delete this.timers[mid];
        }
    }
}
