const STATE = {
    growing: 0,
    water: 1,
    dead: 2,
    enemy: 3,
    harvest: 4
}

export default class GWApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "gw";

        // create loading screen logo
        this.icons = document.createElement('img');
        this.icons.src = "#"; 
        resolveURL("img/nhud_gw_icons.png").then(url => {
            this.icons.src = url;
        });
    }
    event(type, data) {
        super.event(type, data);
        if (type == "state_change") {
            //console.log("DEBUG: ", data);
        }
    }
    onDrawEntity(ctx, entity, bounds, camera) {
        if (!this.sys.getCurrentMap().startsWith('sporesports')) { return; }
       
        if ((entity.entity == "ent_guildwarscrops") || (entity.entity == "ent_allcrops")) {
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

            ctx.strokeRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
            ctx.globalAlpha = 0.5;
            ctx.fillRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);

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

                ctx.globalAlpha = 1;

                ctx.fillStyle = "#000";
                ctx.fillText(time, bounds.x-1  - dim.width/2, bounds.y);
                ctx.fillText(time, bounds.x+1 - dim.width/2, bounds.y);
                ctx.fillText(time, bounds.x - dim.width/2, bounds.y-1);
                ctx.fillText(time, bounds.x - dim.width/2, bounds.y+1);

                ctx.fillStyle = "#fff";
                ctx.fillText(time, bounds.x - dim.width/2, bounds.y);
            }
            
        }

        if (entity.entity == "ent_mineralDeposit") {
            if (entity.generic.statics.health == 30) {
                return; 
            }

            ctx.strokeStyle = "#f00";
            ctx.fillStyle = "#f00";
    
            ctx.strokeRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
            ctx.globalAlpha = 0.2;
            ctx.fillRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);

        }
    }
    onDrawPlayer(ctx, entity, bounds) {
        if (!this.sys.getCurrentMap().startsWith('sporesports')) { return; }
        
        if ((entity.guild?.handle != this.sys.userguild) && (entity.guild?.handle != undefined)) {
            ctx.strokeStyle = "#f00";
            ctx.fillStyle = "#f00";
        
            ctx.strokeRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
            ctx.globalAlpha = 0.1;
            ctx.fillRect(bounds.x - bounds.width/2, bounds.y - bounds.height/2, bounds.width, bounds.height);
        }
    }
   
}
