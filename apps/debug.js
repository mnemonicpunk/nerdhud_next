export default class DebugApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "debug";

        this.hover_player_data = null;

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

        if (type == "hover_player") {
            this.hover_player_data = data;
        }
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
    onDrawPlayer(ctx, entity, bounds) {
        if (!this.hover_player_data) { return; }

        if (entity.mid == this.hover_player_data.mid) {
            if ((entity.currentAvatar.id != "players") && (entity.currentAvatar.id != "players_v2")) {
                let name = entity.username;
                this.drawTextCentered(ctx, name, bounds.x, bounds.y+bounds.height/2, '#fff', '#000');
                let avatar = "NFT: " + entity.currentAvatar.id;
                this.drawTextCentered(ctx, avatar, bounds.x, bounds.y+bounds.height/2+20, '#fff', '#000');
            }            
        }
    }
}
