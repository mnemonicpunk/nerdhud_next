export default class NerdMenuApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "nerdmenu";

        this.settings_declarations = null;
        this.settings_values = {};
    }
    onCreate() {
        super.onCreate();
        this.window = this.sys.createWindow({ 
            docked: "right",
            icon: "img/nhud_icon_nerd.png",
            name: "nerd_menu",
            title: "Nerd Menu"
        });
        this.window.dataset.placeholder = "This will contain the Nerd menu soon!";

        this.settings_window = this.sys.createWindow({
            name: 'nerd_settings',
            title: 'Settings',
            fullscreen: true
        });

        let settings_container = document.createElement('div');
        settings_container.className = "nerd_fullscreen_body";
        this.settings_window.appendChild(settings_container);

        let settings_tabs = document.createElement('div');
        settings_tabs.className = "nerd_sidebar";
        settings_container.appendChild(settings_tabs);

        let settings_display = document.createElement('div');
        settings_display.className = "nerd_content";
        settings_container.appendChild(settings_display);

        let settings_commit = document.createElement('div');
        let settings_commit_save = document.createElement('div');
        settings_commit.className = "hud_button";
        settings_commit.innerHTML = "Apply";
        settings_commit.appendChild(settings_commit_save);
        this.settings_window.appendChild(settings_commit);

        settings_commit.addEventListener('click', () => {
            this.applySettings();
            this.sys.showWindow('nerd_settings', false);
        })

        this.settings_tabs = settings_tabs;
        this.settings_display = settings_display;
        
        let cap = document.createElement('div');
        cap.className = "hud_button";
        cap.innerHTML = "Clear app data";
        cap.addEventListener('click', () => {
            if (confirm("Really clear all app data?")) {
                this.sys.clearAppData();
            }
        });
        
        let cs = document.createElement('div');
        cs.className = "hud_button";
        cs.innerHTML = "Clear Settings";
        cs.addEventListener('click', () => {
            if (confirm("Really clear all settings?")) {
                this.sys.saveAppSettings(this.sys.mid, {});
                window.location.reload();
            }
        });

        let settings_btn = document.createElement('div');
        settings_btn.innerHTML = "Settings";
        settings_btn.className = "hud_button";
        settings_btn.addEventListener('click', () => {
            this.showSettingsMenu();
        });

        // 
        let pixelsmetrics_btn = document.createElement('div');
        pixelsmetrics_btn.innerHTML = '<img src="https://pixelsmetrics.xyz/_next/image?url=%2Fimages%2Fpopberry.png&w=64&q=75" style="width: 64px; height: auto;">&nbsp;Pixels Metrics';
        pixelsmetrics_btn.className = "hud_button";
        pixelsmetrics_btn.addEventListener('click', () => {
            window.open('https://pixelsmetrics.xyz', '_blank');
        });

        // "https://pixelnerds.xyz/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.bd8c914b.png&w=640&q=75"
        let pixelnerds_btn = document.createElement('div');
        pixelnerds_btn.innerHTML = '<img src="https://pixelnerds.xyz/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.bd8c914b.png&w=640&q=75" style="max-width: 100%; height: auto;">';
        pixelnerds_btn.className = "hud_button";
        pixelnerds_btn.addEventListener('click', () => {
            window.open('https://pixelnerds.xyz', '_blank');
        });


        this.window.appendChild(pixelnerds_btn);
        this.window.appendChild(pixelsmetrics_btn);
        this.window.appendChild(cap);
        this.window.appendChild(cs);
        this.window.appendChild(settings_btn);
        

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
    showSettingsMenu() {
        if (this.settings_declarations == null) {
            this.settings_declarations = this.sys.getSettingsDeclarations();
        }
        this.current_settings = this.sys.getAllSettings();
        
        const data = this.settings_declarations;

        this.settings_tabs.innerHTML = "";

        // generate the tabs for the tabs display
        for (let i in data) {
            let e = data[i];
            let el = document.createElement('div');
            el.className = 'hud_tabs_entry';
            el.dataset.app = e.app;
            el.innerHTML = e.title;
            el.addEventListener('click', () => {
                this.showSettingsTab(e.app);
            })
            this.settings_tabs.appendChild(el);
        }

        // then select the first tab as default
        this.showSettingsTab("hud");

        this.sys.showWindow('nerd_settings', true);
    }
    showSettingsTab(app) {
        if (this.settings_declarations == null) {
            this.settings_declarations = this.sys.getSettingsDeclarations();
        }

        let tabs = this.settings_window.querySelectorAll('[data-app]');
        for (let i = 0; i < tabs.length; i++) {
            let tab = tabs[i];
            if (tab.dataset.app == app) {
                tab.classList.add('hud_tabs_entry_active')
            } else {
                tab.classList.remove('hud_tabs_entry_active')
            }
        }
        
        const data = this.settings_declarations;

        let el = this.settings_display;
        el.innerHTML = "";

        let idx = -1;
        for (let i in data) {
            if (data[i].app == app) {
                idx = i;
            }
        }

        console.log("APP: ", app, data);
        for (let i = 0; i < data[idx].settings.length; i++) {
            let setting = data[idx].settings[i];
            let sel = document.createElement('div');

            // add title
            let sel_title = document.createElement('div');
            sel_title.innerHTML = setting.name;
            sel_title.style = "font-weight: bold; margin-bottom: 11px;";
            sel.appendChild(sel_title);
            
            // add input
            switch(setting.type) {
                case "text":
                    let sel_text = document.createElement('input');
                    sel_text.type = "text";
                    // Initialize with current setting value if available, otherwise use default
                    sel_text.placeholder = setting.default || "";
                    sel_text.value = (this.current_settings[app] && this.current_settings[app][setting.var]) !== undefined ? this.current_settings[app][setting.var] : setting.default || sel_text.placeholder;
            
                    sel_text.addEventListener('input', () => {
                        this.setSettingsValue(app, setting.var, sel_text.value);
                    });
                    sel_text.addEventListener('keydown', (e) => {
                        e.stopPropagation();
                    });
                    sel_text.addEventListener('keyup', (e) => {
                        e.stopPropagation();
                    });
            
                    sel.appendChild(sel_text);
                    break;
            
                case "number":
                    let sel_num = document.createElement('input');
                    sel_num.type = "number";
                    // Initialize with current setting value if available, otherwise use default
                    sel_num.placeholder = setting.default || 0;
                    sel_num.value = (this.current_settings[app] && this.current_settings[app][setting.var]) !== undefined ? this.current_settings[app][setting.var] : setting.default || sel_num.placeholder;
            
                    sel_num.addEventListener('input', () => {
                        this.setSettingsValue(app, setting.var, parseInt(sel_num.value));
                    });
                    sel_num.addEventListener('keydown', (e) => {
                        e.stopPropagation();
                    });
                    sel_num.addEventListener('keyup', (e) => {
                        e.stopPropagation();
                    });
            
                    sel.appendChild(sel_num);
                    break;
            
                case "bool":
                    let sel_bool = document.createElement('input');
                    sel_bool.type = "checkbox";
                    // Initialize with current setting value if available, otherwise use default
                    sel_bool.checked = (this.current_settings[app] && this.current_settings[app][setting.var]) !== undefined ? this.current_settings[app][setting.var] : setting.default || false;
            
                    sel_bool.style.display = "inline";
                    sel_bool.style.float = "right";
                    sel_bool.style.marginTop = "-8px";
                    sel_bool.style.width = "auto";
            
                    sel_bool.addEventListener('change', () => {
                        this.setSettingsValue(app, setting.var, sel_bool.checked);
                    });
            
                    sel.appendChild(sel_bool);
                    break;
            
                case "slider":
                    // Create the slider input element
                    let sel_slider = document.createElement('input');
                    sel_slider.type = "range";
            
                    // Set optional min and max values if provided, or default values
                    sel_slider.min = setting.min !== undefined ? setting.min : 0; // Default min: 0
                    sel_slider.max = setting.max !== undefined ? setting.max : 100; // Default max: 100
                    // Initialize with current setting value if available, otherwise use default
                    sel_slider.value = (this.current_settings[app] && this.current_settings[app][setting.var]) !== undefined ? this.current_settings[app][setting.var] : (setting.default !== undefined ? setting.default : sel_slider.min); 
            
                    // Add an output display to show the current value
                    let sliderOutput = document.createElement('span');
                    sliderOutput.textContent = sel_slider.value;
            
                    // Update the setting value and display on input
                    sel_slider.addEventListener('input', () => {
                        this.setSettingsValue(app, setting.var, parseInt(sel_slider.value));
                        sliderOutput.textContent = sel_slider.value; // Update displayed value
                    });
            
                    // Add some spacing between the slider and the output
                    sliderOutput.style.marginLeft = "8px";
            
                    // Append the slider and its output
                    sel.appendChild(sel_slider);
                    sel.appendChild(sliderOutput);
                    break;
            }            
            
            // add description
            let sel_desc = document.createElement('div');
            sel_desc.innerHTML = setting.description;
            sel_desc.style = "padding: 22px; margin-bottom: 22px;";
            sel.appendChild(sel_desc);

            el.appendChild(sel);
        }
    }
    setSettingsValue(app, variable, value) {
        console.log("UPDATING SETTING: ", app, variable, value);

        if (!this.settings_values[app]) {
            this.settings_values[app] = {};
        }
        this.settings_values[app][variable] = value;

        console.log("SETTINGS: ", this.settings_values);
    }
    applySettings() {
        this.sys.applySettings(this.settings_values);
    }
}