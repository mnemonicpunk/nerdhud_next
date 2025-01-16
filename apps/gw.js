const STATE = {
    growing: 0,
    water: 1,
    dead: 2,
    enemy: 3,
    harvest: 4
}

const SPORE_COL = {
    itm_mushroomSeeds_01: "#ffffff", // Normal
    itm_mushroomSeeds_02: "#3e86f6", // Magic
    itm_mushroomSeeds_03: "#ffff00", // Rare
    itm_mushroomSeeds_04: "#ff3c00"  // Unique
};

export default class GWApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "gw";
        this.energy = 1000;

        // create loading screen logo
        this.icons = document.createElement('img');
        this.icons.src = "#"; 
        resolveURL("img/nhud_gw_icons.png").then(url => {
            this.icons.src = url;
        });
    }
    event(type, data) {
        super.event(type, data);
        if (type == "energy") {
            this.energy = data;
        }
        if (type == "state_change") {
            // special case for bed timer
            if (this.sys.getCurrentMap().startsWith('cavehub')) {
                const hasTimer = this.sys.importAppFunction('timer.has_timer');
                const addTimer = this.sys.importAppFunction('timer.add_timer');
                const removeTimer = this.sys.importAppFunction('timer.remove_timer');
                const getEntityTimer = this.sys.importAppFunction('timer.get_entity_timer');

                for (let e in data.entities) {
                    let entity = data.entities[e];

                    // special case for tracking bed covers
                    if ((entity.entity == "ent_spore_chamber") || (entity.entity == "ent_goo_pot") || (entity.entity == "ent_guano_mixer")) {
                        if ((hasTimer(entity.mid)) && (getEntityTimer(entity.entity).finish_time <= Date.now())) {
                            removeTimer(entity.mid);
                            this.save();
                        }
                        if ((!hasTimer(entity.mid)) && (entity.generic.trackers.utcRefresh > Date.now())) {
                            addTimer("entity", entity.mid, this.sys.getCurrentMap(), entity.entity, 1, entity.generic.utcRefresh)
                            this.save();
                        }
                    }
                }
            }
        }
    }
    declareSettings() {
        return {
            title: 'Spore Sports',
            settings: [
                {
                    name: 'Display advanced crop data',
                    var: 'display_soils',
                    type: 'bool',
                    default: true,
                    description: 'When this is set to on it will display an advanced overlay in Spore Sports, showing who owns a soil, what state it is in and when it will be ready'
                },
                {
                    name: 'Mark enemy guild members',
                    var: 'display_enemies',
                    type: 'bool',
                    default: true,
                    description: 'When this is set to on enemy guild members will be marked with a red rectangle in Spore Sports'
                },
                {
                    name: 'Mark damaged stones',
                    var: 'display_damaged_stones',
                    type: 'bool',
                    default: true,
                    description: 'When this is set to on damaged stones will be marked with a blue rectangle in Spore Sports'
                },
                {
                    name: 'Low energy warning',
                    var: 'display_energy_warning',
                    type: 'bool',
                    default: true,
                    description: 'When this is set to on a vignette effect will indicate < 50 energy in Spore Sports'
                },
            ]
        }
    }
    draw(ctx, width, height) {
        if (!this.sys.getCurrentMap().startsWith('sporesports')) { return; }
        if ((this.energy > 50)) { return; }

        // Save the current canvas state
        ctx.save();
    
        // Create a radial gradient for the vignette
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.sqrt((width / 2) ** 2 + (height / 2) ** 2); // Diagonal distance for smooth fading
    
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    
        // Define gradient color stops with stronger edges and a touch of red
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Fully transparent at the center
        gradient.addColorStop(0.7, 'rgba(50, 0, 0, 0.6)'); // Slightly red and semi-transparent towards edges
        gradient.addColorStop(1, 'rgba(100, 0, 0, 1)'); // Strong red-black at the corners
    
        // Set the gradient as the fill style
        ctx.fillStyle = gradient;
    
        // Draw a rectangle covering the whole screen
        ctx.fillRect(0, 0, width, height);
    
        // Restore the previous canvas state
        ctx.restore();
    }    
    onDrawEntity(ctx, entity, bounds, camera) {
        if (this.sys._showing_inventory) { return; }

        let opacity = this.sys.getOverlayOpacity();
        
        if ((entity.entity == "ent_spore_chamber") || (entity.entity == "ent_goo_pot") || (entity.entity == "ent_guano_mixer")) {
            let points = entity.generic.trackers.points || 0;
            let uniques = entity.generic.trackers.uniqueItems || 0;

            let spore_info = "Points: " + points + " // Unique Items: " + uniques;
            if (spore_info == "") { return; }
            
            let dim = ctx.measureText(spore_info);

            let x = bounds.x;
            let y = bounds.y+bounds.height/2;

            ctx.fillStyle = "#000";
            ctx.globalAlpha = 0.5 * opacity;

            ctx.fillRect(x - dim.width/2 - 2, y - 11, dim.width + 4, 16);

            ctx.globalAlpha = 1 * opacity;

            ctx.fillStyle = "#000";
            ctx.fillText(spore_info, x - dim.width/2 - 1, y);
            ctx.fillText(spore_info, x - dim.width/2 + 1, y);
            ctx.fillText(spore_info, x - dim.width/2, y - 1);
            ctx.fillText(spore_info, x - dim.width/2, y + 1);
            ctx.fillStyle = "#fff";
            ctx.fillText(spore_info, x - dim.width/2, y);
        }

        if (!this.sys.getCurrentMap().startsWith('sporesports')) { return; }
        const settings = this.getSettings();
       
        if (settings.display_soils && (entity.entity == "ent_guildwarscrops") || (entity.entity == "ent_allcrops")) {
        //if (entity.entity == "ent_guildwarscrops") {
            let icon = -1;

            ctx.strokeStyle = "#888";
            ctx.fillStyle = "#888";

            if (entity.generic.statics.guild == this.sys.userguild) {
                if (entity.generic.state == "grown") {
                    ctx.strokeStyle = "#0f0";
                    ctx.fillStyle = "#0f0";

                    icon = STATE.harvest;
                } else {
                    if (entity.generic.displayInfo.utcTarget != 0) {
                        ctx.strokeStyle = "#FFFF00";
                        ctx.fillStyle = "#FFFF00";

                        icon = STATE.growing;
                    } else {
                        if (entity.generic.statics.seedItem && entity.generic.statics.inUseBy) {
                            ctx.strokeStyle = "#00f";
                            ctx.fillStyle = "#00f";

                            icon = STATE.water;
                        } else {

                        }
                  
                    }
                }

                if (entity.generic.state == "dead") {
                    ctx.strokeStyle = "#720e9e";
                    ctx.fillStyle = "#720e9e";

                    icon = STATE.dead;
                }
            } else {
                if (entity.generic.statics.guild != '') {
                    ctx.strokeStyle = "#333";
                    ctx.fillStyle = "#333";
    
                    icon = STATE.enemy;
                }
            }

            if (entity.generic.statics.isEvolved) {
                if (!this.lastComputedTime || this.lastComputedTime !== Math.floor(Date.now() / 16.67)) {
                    this.lastComputedTime = Math.floor(Date.now() / 16.67); // Approx. 60 FPS, convert to frame time
            
                    const modTime = (Date.now() % 3000) / 3000; // Normalize to a value between 0 and 1
            
                    // Calculate RGB values
                    const r = Math.floor(255 * Math.sin(2 * Math.PI * modTime + 0) ** 2);
                    const g = Math.floor(255 * Math.sin(2 * Math.PI * modTime + (2 * Math.PI / 3)) ** 2);
                    const b = Math.floor(255 * Math.sin(2 * Math.PI * modTime + (4 * Math.PI / 3)) ** 2);
            
                    this.cachedColor = `rgb(${r}, ${g}, ${b})`; // Cache the computed color
                }
            
                ctx.strokeStyle = this.cachedColor; // Use the cached color

                ctx.strokeRect( 1 + (bounds.x - bounds.width/2), 1 + (bounds.y - bounds.height/2), bounds.width-2, bounds.height-2);
            }

            ctx.strokeRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
            ctx.globalAlpha = 0.5 * opacity;
            ctx.fillRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);

            if (entity.generic?.statics?.seedItem && SPORE_COL[entity.generic.statics.seedItem]) {
                ctx.globalAlpha = 1 * opacity;
                ctx.fillStyle = SPORE_COL[entity.generic.statics.seedItem];
                
                // Calculate the center of the circle
                const centerX = bounds.x;
                const centerY = bounds.y;
                const radius = Math.min(bounds.width, bounds.height) / 4; // Adjust radius to fit within bounds
            
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); // Full circle
                ctx.fill();
            }            

            ctx.globalAlpha = 0.5 * opacity;

            if (icon != -1) {
                let rect = {
                    x: bounds.x - bounds.width/4,
                    y: bounds.y - bounds.height/4,
                    w: bounds.width/2,
                    h: bounds.height/2
                }

                ctx.drawImage(this.icons, icon*64, 0, 64, 64, rect.x, rect.y, rect.w, rect.h);
            }

            if (entity.generic.displayInfo.utcTarget != 0) {
                let time = this.sys.formatRelativeTime(entity.generic.displayInfo.utcTarget);
                let dim = ctx.measureText(time);

                ctx.globalAlpha = 1 * opacity;

                ctx.fillStyle = "#000";
                ctx.fillText(time, bounds.x-1  - dim.width/2, bounds.y);
                ctx.fillText(time, bounds.x+1 - dim.width/2, bounds.y);
                ctx.fillText(time, bounds.x - dim.width/2, bounds.y-1);
                ctx.fillText(time, bounds.x - dim.width/2, bounds.y+1);

                ctx.fillStyle = "#fff";
                ctx.fillText(time, bounds.x - dim.width/2, bounds.y);
            }
            
        }

        if (settings.display_damaged_stones && (entity.entity == "ent_mineralDeposit")) {
            if (entity.generic.statics.health == 30) {
                return; 
            }

            ctx.strokeStyle = "#00f";
            ctx.fillStyle = "#00f";
    
            ctx.strokeRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
            ctx.globalAlpha = 0.2 * opacity;
            ctx.fillRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);

        }

        
    }
    onDrawPlayer(ctx, entity, bounds) {
        if (!this.sys.getCurrentMap().startsWith('sporesports')) { return; }

        const settings = this.getSettings();
        let opacity = this.sys.getOverlayOpacity();
        if (!settings.display_enemies) { return; }
        
        if ((entity.guild?.handle != this.sys.userguild) && (entity.guild?.handle != undefined)) {
            ctx.strokeStyle = "#f00";
            ctx.fillStyle = "#f00";
        
            ctx.strokeRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
            ctx.globalAlpha = 0.1 * opacity;
            ctx.fillRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
        }
    }
   
}
