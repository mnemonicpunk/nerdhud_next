export default class NerdMenuApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "nerdmenu";
    }
    onCreate() {
        this.window = this.sys.createWindow({ 
            docked: "right",
            icon: "builtin:img/nhud_icon_nerd.png",
            name: "nerd_menu",
            title: "Nerd Menu"
        });
        this.window.dataset.placeholder = "This will contain the Nerd menu soon!";
        
        let cap = document.createElement('div');
        cap.innerHTML = "Clear app data";
        cap.addEventListener('click', () => {
            if (confirm("Really clear all app data?")) {
                this.sys.clearAppData();
            }
        });

        this.window.appendChild(cap);

        // hide the docks when chat is visible
        this.sys.watchClass("ChatWindow_chatwindow__iDeJq", 1000, () => {
            this.sys.showDock(false, "left");
        }, () => {
            this.sys.showDock(true, "left");
        });

        // hide the docks when skills are visible
        this.sys.watchClass("Skills_skillPopup__WiCoX", 1000, () => {
            this.sys.showDock(false, "right");
        }, () => {
            this.sys.showDock(true, "right");
        });
    }
}