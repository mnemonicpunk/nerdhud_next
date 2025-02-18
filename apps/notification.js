export default class NotificationApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "notification";
        this.queue = [];
        this.current_notification = null;

        this.icon = null;
        resolveURL('img/nhud_icon_nerd.png').then(path => {
            this.icon = path;
        })
    }
    onCreate() {
        super.onCreate();
        this.exportAppFunction("show", (title, message) => {
            return this.queueNotification({
                title,
                message
            });
        });

        this.queueNotification("Want to support Nerd HUD Next?", "Use creator code ILIKEMONEY to get 5% off Pixel purchases!")
    }
    event(type, data) {
        super.event(type, data);
        if (type == "timer_group_finished") {

            let t = data[0];
            let title = this.sys.getMapName(t.map);
            let timer_name = "";
            if (t.type == "entity") {
                timer_name = this.sys.getEntityName(t.item);
            } else {
                timer_name = this.sys.getItemName(t.item);
            }
            let quantity = data.length;

            this.queueNotification({
                title,
                message: timer_name + (quantity>1?" x"+quantity+"":"") + " just finished."
            })
        }
        if (type == "hud_notification_cleared") {
            this.current_notification = null;
            this.nextNotification();
        }
        if (type == "update") {
            if ((this.current_notification != null) && (this.current_notification.timestamp < Date.now()-5000)) {
                this.current_notification = null;
                this.nextNotification();
            }
        }
    }
    queueNotification(notification) {
        this.queue.push(notification);
        this.nextNotification();
    }
    nextNotification() {
        if ((this.current_notification == null) && (this.queue.length > 0)) {
            let n = this.queue.shift();
            this.current_notification = n;

            n.timestamp = Date.now();
            n.mode =  document.hasFocus()?"toast":"notification";

            if (n.mode == "notification") {
                this.createNotification(n.title, n.message);
            }
        }
    }
    createNotification(title, message) {
        window.postMessage({
            type: "show_hud_notification",
            title: title,
            message: message,
            icon: this.icon
        });
    }
    draw(ctx, width, height, camera) {
        if (this.current_notification != null) {

            let n = this.current_notification;
            if (n.mode != "toast") {  return; }
            let time = Date.now() - n.timestamp;

            let t_width = ctx.measureText(n.title).width;
            let m_width = ctx.measureText(n.message).width;
            let r_width = Math.max(t_width, m_width) + 22;
            let r_height = 44;
            let ry = -44;
            let cornerRadius = 10;  // Adjust for rounded corners
            
            let alpha = 1;
            if (time < 500) {
                alpha = (time/500);
            }
            if ((time > 4500) && (time < 5000)) {
                alpha = 1-((time-4500)/500)
            }
            if (time > 5000) {
                alpha = 0;
            }
            ry += alpha * 88;
            
            // Set up drop shadow
            ctx.shadowOffsetX = 4; // Horizontal shadow offset
            ctx.shadowOffsetY = 4; // Vertical shadow offset
            ctx.shadowBlur = 10;   // Blur intensity
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; // Shadow color
            
            // Draw rectangle with rounded corners
            ctx.globalAlpha = alpha * 0.65;
            ctx.fillStyle = "#4040a0";
            ctx.beginPath();
            ctx.moveTo(width / 2 - r_width / 2 + cornerRadius, ry); // Start from the top-left corner with a rounded edge
            ctx.arcTo(width / 2 + r_width / 2, ry, width / 2 + r_width / 2, ry + r_height, cornerRadius); // Top-right corner
            ctx.arcTo(width / 2 + r_width / 2, ry + r_height, width / 2 - r_width / 2, ry + r_height, cornerRadius); // Bottom-right corner
            ctx.arcTo(width / 2 - r_width / 2, ry + r_height, width / 2 - r_width / 2, ry, cornerRadius); // Bottom-left corner
            ctx.arcTo(width / 2 - r_width / 2, ry, width / 2 + r_width / 2, ry, cornerRadius); // Top-left corner to close
            ctx.closePath();
            ctx.fill();
            
            // Reset shadow to avoid affecting other drawing
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            
            ctx.globalAlpha = alpha;
            ctx.fillStyle = "#fff";
            ctx.fillText(n.title, width / 2 - t_width / 2, ry + 16);
            ctx.fillStyle = "#eee";
            ctx.fillText(n.message, width / 2 - m_width / 2, ry + 34);
        }
    }
}
