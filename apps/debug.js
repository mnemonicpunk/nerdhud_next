export default class DebugApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "debug";

        window.queryScene = (func) => {
            let entities = this.sys.scene_state.entities;
            let ret = [];
            for (let i in entities) {
                const entity = entities[i];
                if (func(entity)) {
                    ret.push(entity);
                }
            }
            return ret;
        }
    }
    event(type, data) {
        super.event(type, data);
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
