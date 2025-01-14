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
    /*draw(ctx, width, height) {
        let rect = this.sys._inventory_dimensions;
        ctx.strokeStyle = '#f00';
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }*/
    /*onDrawPlayer(ctx, entity, bounds) {
        ctx.fillStyle = "#fff";
        ctx.fillText(entity.mid, bounds.x + 20, bounds.y + 20);
    }*/
}
