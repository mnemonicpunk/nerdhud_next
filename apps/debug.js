export default class DebugApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "debug";
    }
    event(type, data) {
        super.event(type, data);
        /*if (type == "state_change") {
            console.log("DEBUG: ", data);
        }*/
        if (type == "mine_started") {
            console.log("MINE STARTED: ", data);
        }
        if (type == "industry_started") {
            console.log("INDUSTRY STARTED: ", data);
        }
        if (type == "crop_planted") {
            console.log("CROP PLANTED: ", data);
        }
    }
    draw(ctx, width, height) {
        const banner = "Nerd HUD Next 0.1";
        let dim = ctx.measureText(banner);
        ctx.fillStyle = "#000";
        ctx.fillText(banner, width/2-dim.width/2 - 1, 20);
        ctx.fillText(banner, width/2-dim.width/2 + 1, 20);
        ctx.fillText(banner, width/2-dim.width/2, 20 - 1);
        ctx.fillText(banner, width/2-dim.width/2, 20 + 1);

        ctx.fillStyle = "#fff";
        ctx.fillText(banner, width/2-dim.width/2, 20);
    }
    /*onDrawPlayer(ctx, entity, bounds) {
        ctx.fillStyle = "#fff";
        ctx.fillText(entity.mid, bounds.x + 20, bounds.y + 20);
    }*/
}
