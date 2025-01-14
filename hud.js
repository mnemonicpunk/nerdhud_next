const ENTITY_NAME_OVERRIDES = {
    ent_saunarocks_charger: "VIP Sauna",
    ent_saunaenergy: "Sauna Pool Energy Reset",
    ent_cow_pickup: "Cow",
    ent_bed_covers: "Bed",
    ent_goosetrailer: "OG Ticket Redemption"
}

// Helper function to resolve "builtin:" paths to Chrome extension URLs
async function resolveURL(path) {
    path = window.nhud_repo + path;

    if (path.startsWith("builtin:")) {
        return await getChromeURL(path.replace('builtin:', ''));
    }
    return path;
}

async function getChromeURL(url) {
    return new Promise((resolve, reject) => {
        // Handler for messages
        function handleMessage(event) {
            if (event.data.type === 'resolve_url' && event.data.url && event.data.original_url == url) {
                window.removeEventListener('message', handleMessage); // Clean up listener
                resolve(event.data.url);
            }
        }

        // Add event listener for the response
        window.addEventListener('message', handleMessage);

        // Send out the message for resolving the URL
        window.postMessage({
            type: 'get_url',
            url
        });
    });
}

// Helper function to compare version strings (e.g., "1.0.0" > "0.9.9")
function isVersionNewer(newVersion, currentVersion) {
    const newParts = newVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
        const newPart = newParts[i] || 0;
        const currentPart = currentParts[i] || 0;
        if (newPart > currentPart) return true;
        if (newPart < currentPart) return false;
    }
    return false;
}

async function getStorage(key) {
    return new Promise((resolve, reject) => {
        // Handler for messages
        function handleMessage(event) {
            if (event.data.type === 'get_storage_response' && event.data.result) {
                window.removeEventListener('message', handleMessage); // Clean up listener
                resolve(event.data.result);
            }
        }

        // Add event listener for the response
        window.addEventListener('message', handleMessage);

        // Send out the message for resolving the URL
        window.postMessage({
            type: 'get_storage',
            key
        });
    });
}

async function putStorage(data) {
    return new Promise((resolve, reject) => {
        // Handler for messages
        function handleMessage(event) {
            if (event.data.type === 'put_storage_response' && event.data.success) {
                window.removeEventListener('message', handleMessage); // Clean up listener
                resolve(event.data.result);
            }
        }

        // Add event listener for the response
        window.addEventListener('message', handleMessage);

        // Send out the message for resolving the URL
        window.postMessage({
            type: 'put_storage',
            data
        });
    });
}

function flattenColyseus(arr) {
    if (!arr) { return {}; }
    const ret = {};
    for (let i=0; i<arr.length; i++) {
        if (arr[i].numeric) {
            ret[arr[i].name] = parseFloat(arr[i].value);
        } else {
            ret[arr[i].name] = arr[i].value;
        }
    }
    if (ret == {}) {
        console.log("Array resulted in empty obj: ", arr);
    }
    return ret;
}

function flattenEntity(entity) {
    if (!entity) { return null; }

    const new_entity = JSON.parse(JSON.stringify(entity)); // True deep copy

    if (entity.generic) { 
        new_entity.generic.statics = flattenColyseus(entity.generic.statics);
        new_entity.generic.trackers = flattenColyseus(entity.generic.trackers);
    }

    return new_entity;
}

class NerdHudApp {
    constructor(sys) {
        this.sys = sys;
    }
    onCreate() {
        this.initializeSettings();
    }
    event(type, data) {

    }
    draw(ctx, width, height, camera) {

    }
    show() {
        this.sys.activateApp(this.name);
    }
    exportAppFunction(name, func) {
        this.sys.registerAppFunction(this, name, func);
    }
    importAppFunction(name) {
        return this.sys.importAppFunction(name);
    }
    dispatchEvent(type, data) {
        return this.sys.dispatchEvent(type, data);
    }
    onSave() {
        return null;
    }
    onLoad() {

    }
    onLoadSettings(settings) {
        this.settings = settings;
    }
    onSaveSettings() {
        return this.settings;
    }
    save() {
        this.sys.dataDirty();
    }
    timestampToServerTime(timestamp) {
        return (timestamp + (libpixels.getServerTime() - Date.now())); 
    }
    declareSettings() {
        return null;
    }
    initializeSettings() {
        let dec = this.declareSettings();
        let settings = {};
        if (dec != null) {
            for (let i = 0; i < dec.settings.length; i++) {
                let setting = dec.settings[i];
                if (!setting.type && setting.default) {
                    settings[setting.var] = null;
                    continue;
                }
                if (setting.type == "text") {
                    settings[setting.var] = setting.default;
                }
                if (setting.type == "number") {
                    settings[setting.var] = parseInt(setting.default);
                }
                if (setting.type == "bool") {
                    settings[setting.var] = !!setting.default;
                }
            }
        }
        this.settings = settings;
    }    
    getSettings() {
        if (!this.settings) {
            this.initializeSettings();
        }
        return this.settings;
    }
}

class NerdHUD {
    constructor() {
        const _self = this;

        this.is_in_game = false;
        this.data_needs_saving = false;
        this.is_narrow_screen = false;
        this._game_modal = false;
        this._game_halfmodal = false;
        this._game_storemodal = false;
        this._inventory_dimensions = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        }

        /*if (undefined !== libpixels) {
            libpixels.debug_message = false;
        }*/

        // create loading screen logo
        this.logo = document.createElement('img');
        //this.logo.src = chrome.runtime.getURL("nerdhudnext_logo.png");
        this.logo.src = "#";
        resolveURL("nerdhudnext_logo.png").then(url => {
            this.logo.src = url;
        });
        this.logo_state = 0;
        this.logo_timer = Date.now();

        // for loading screen purposes track stats
        this._libPixels_version = "";
        this._loaded_libpixels = false;
        this._loaded_apps = false;
        this._app_load_state = {
            completed: 0,
            total: 0
        }
        this._known_good_app_data = {};
        this._initial_app_data_load_finished = false;

        // handle saving
        this.save_interval = 5000;
        this._debounceTimeout = null;
        this._latestArgs = null;
        this._lastSaveTime = 0;

        // handle cloud saving
        this.cloudsaveTimer = null; // Debounce timer
        this.cloudsaveLatestData = null; // Store the latest data
        this.cloudsaveLastSaveTime = 0; // Timestamp of the last save
        this.cloudsaveDebounceDelay = 5 * 60 * 1000; // 5 minutes in milliseconds

        // app function exports
        this.app_funcs = {};

        this.game_library = null;
        this.item_name_mapping = null;
        this.mid = "";
        this.username = "";
        this.current_map = null;
        this.scene_state = { entities: {}, players: {}};
        this._state_has_changed = false;

        this.mouse_x = 0;
        this.mouse_y = 0;
        this.hovered_entity = null;

        // manage all app-created windows
        this.registered_windows = [];

        // Create canvas element
        const canvas = document.createElement('canvas');
        this.canvas = canvas;
        canvas.id = 'nerd-hud-canvas';
        document.body.appendChild(canvas);

        // Create UI element
        const ui_root = document.createElement('div');
        this.ui_root = ui_root;
        ui_root.id = 'nerd-hud-ui';
        document.body.appendChild(ui_root);

        document.querySelector('#game-container').addEventListener('mousemove', e => {
            var rect = e.target.getBoundingClientRect();
            var x = e.clientX - rect.left; //x position within the element.
            var y = e.clientY - rect.top;  //y position within the element.

            this.mouse_x = x;
            this.mouse_y = y;
            this.updateMouse();
        })

        const dock_left = document.createElement('div');
        this.dock_left = dock_left;
        dock_left.id = "nerd_dock_left";
        this.ui_root.appendChild(dock_left);

        const dock_right = document.createElement('div');
        this.dock_right = dock_right;
        dock_right.id = "nerd_dock_right";
        this.ui_root.appendChild(dock_right);

        const windows_left = document.createElement('div');
        this.windows_left = windows_left;
        windows_left.id = "nerd_windows_left";
        this.ui_root.appendChild(windows_left);

        const windows_right = document.createElement('div');
        this.windows_right = windows_right;
        windows_right.id = "nerd_windows_right";
        this.ui_root.appendChild(windows_right);

        const _draw = () => {
            _self.draw();
            window.requestAnimationFrame(_draw);
        }
        _draw();
        const _tick = () => {
            _self.tick();
            window.setTimeout(_tick, 1000);
        }
        _tick();

        this.apps = [];

        window.addEventListener('message', e => _self.handleMessage(e.data));
        window.addEventListener('resize', () => _self.resize() )
        this.resize();

        //this.loadEnvironment(resolveBuiltinPath("builtin:install.json"));
        this.loadEnvironment(window.nhud_install);
        //this.loadEnvironment("builtin:install_builtin.json");
    }
    async loadEnvironment(install) {
        try {
            // Validate the loadout format
            if (!install.libPixels || !install.libPixels.version || !install.libPixels.url) {
                throw new Error("Invalid loadout file format.");
            }
    
            const libPixelsKey = 'nhud_libPixels';
            this._libPixels_version = install.libPixels.version;
    
            // Fetch the current version from Chrome storage
            getStorage([libPixelsKey]).then(async (result) => {
                const currentLibPixels = result[libPixelsKey] || {};
                const currentVersion = currentLibPixels.version || "0.0.0";
    
                // Compare versions
                if (isVersionNewer(install.libPixels.version, currentVersion)) {
                    console.log(`Newer version detected: ${install.libPixels.version}. Updating...`);
    
                    // Resolve the file URL if it starts with "builtin:"
                    const fileUrl = await resolveURL(install.libPixels.url);
    
                    // Fetch the new file content
                    const fileResponse = await fetch(fileUrl);
                    if (!fileResponse.ok) {
                        throw new Error(`Failed to fetch file from ${fileUrl}: ${fileResponse.statusText}`);
                    }
                    const fileContent = await fileResponse.text();
    
                    // Store the new version and file content in Chrome storage
                    putStorage({
                        [libPixelsKey]: {
                            version: install.libPixels.version,
                            file: fileContent
                        }
                    })

                    window.location.reload();
                } else {
                    console.log("libPixels is up-to-date.");
                    this._loaded_libpixels = true;

                    this.loadApps(install.apps, (apps) => {
                        for (let a in apps) {
                            let app = new apps[a](this);
                            this.apps.push(app);
                        }

                        this._loaded_apps = true;
            
                    }, (completed, total) => {
                        this._app_load_state = {
                            completed,
                            total
                        }
                    });
                }
            });
        } catch (error) {
            console.error(`Error in fetchLoadout: ${error.message}`);
        }
    }
    async loadApps(filenames, callback, progress_callback) {
        // Create an array of promises for each dynamic import
        let total = filenames.length;
        let completed = 0;
        const imports = await filenames.map(async (filename) => {
            const fileUrl = await resolveURL(filename); // Resolving to chrome-extension:// URL
            
            // call the progress callback so we can show progress and hide the interstitial screen when done
            completed++;
            progress_callback(completed, total);
            
            // Calculate a timestamp that changes every 5 minutes
            const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
            const currentTimestamp = Math.floor(Date.now() / fiveMinutes) * fiveMinutes;

            // Append the timestamp to the file URL
            const cacheBustedUrl = `${fileUrl}?_=${currentTimestamp}`;

            return import(cacheBustedUrl).then(app => {
                // Make sure the module is correctly imported, and return the default export (class)
                return app.default || null;
            }).catch(error => {
                console.error(`Failed to load script ${filename}:`, error);
                return null; // Return null if the import fails
            });
        });
      
        // Wait for all imports to finish
        Promise.all(imports).then(apps => {
          // Check if all apps were loaded successfully
          if (apps.every(app => app !== null)) {
            console.log('All scripts loaded successfully.');
            callback(apps); // Pass the loaded apps to the callback
          } else {
            console.error('Some scripts failed to load.');
          }
        });
    }
    enterGame() {
        console.log("Creating app instances...");

        this.withApps(app => {
            app.onCreate();
        });

        console.log("Apps created, loading save data...");

        this.loadAppData(this.mid, data => {
            if (data) {
                this.withApps(app => {
                    let app_data = data[app.name];
                    if (app_data) {
                        app.onLoad(app_data);
                    }
                });
            }
            this._known_good_app_data = data;
            this._initial_app_data_load_finished = true;

            this.loadAppSettings(this.mid).then(settings => {
                if (!settings) { return; }
                if (settings['hud']) {
                    this.applyHudSettings(settings['hud']);
                }
                this.withApps(app => {
                    if (settings[app.name]) {
                        app.onLoadSettings(settings[app.name]);
                    }
                });
            });
        });

        this.resize();

        this.watchClass("commons_modalBackdrop__EOPaN", 100, async () => {
            this._game_modal = true;
        }, async () => {
            this._game_modal = false;
        });
        this.watchClass("InventoryWindow_inventoryContainer__kDLsJ", 100, () => {
            this._game_halfmodal = true;
        }, () => {
            this._game_halfmodal = false;
        });
        this.watchClass("Store_storeDialog__K3NJB", 100, () => {
            this._game_storemodal = true;
        }, () => {
            this._game_storemodal = false;
        });

        // only set to in-game after loading app data to avoid clashes
        this.is_in_game = true;     
    }
    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.scaleUI();

        this.adjustDocks();
    }
    updateMouse() {
        if (!this.entity_bounds) { return; }

        const x = this.mouse_x;
        const y = this.mouse_y;

        let hover = false;

        // Convert this.entity_bounds to an array sorted by the `y` property
        const sortedEntityBounds = Object.entries(this.entity_bounds)
            .sort(([, a], [, b]) => a.y - b.y); // Sort by the `y` property

        // Iterate through the sorted array
        for (let [i, bounds] of sortedEntityBounds) {
            const screenBounds = this.boundsToScreenCoords(bounds);
            const rect = {
                left: screenBounds.x - screenBounds.width / 2,
                right: screenBounds.x + screenBounds.width / 2,
                top: screenBounds.y - screenBounds.height / 2,
                bottom: screenBounds.y + screenBounds.height / 2,
            };

            if ((x > rect.left) && (x < rect.right) && (y > rect.top) && (y < rect.bottom)) {
                if (this.hovered_entity != i) {
                    this.hovered_entity = i;
                    this.dispatchEvent("hover", i);
                }
                hover = true;
            }
        }

        if ((!hover) && (this.hovered_entity != null)) {
            this.hovered_entity = null;
            this.dispatchEvent("hover", null);
        }

        this.dispatchEvent('mouse', {
            mouse_x: this.mouse_x,
            mouse_y: this.mouse_y,
            screen_width: this.canvas.width,
            screen_height: this.canvas.height
        });

        for (let i in this.registered_windows) {
            let w = this.registered_windows[i];

            if (w.options.hover == true) {
                if (this.mouse_x < this.canvas.width/2) {
                    w.el.classList.remove('hover_left');
                    w.el.classList.add('hover_right');
                } else {
                    w.el.classList.remove('hover_right');
                    w.el.classList.add('hover_left')
                }
            }
        }
    }
    scaleUI() {
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);

        // Check if the device has a high DPI (device pixel ratio >= 2)
        const isHighDPI = window.devicePixelRatio >= 2;
      
        // If it's a high DPI, non-mobile device, set zoom to 2
        if (isHighDPI && !isMobile) {
          this.ui_root.style.zoom = 2; // Apply zoom factor for high DPI non-mobile devices
          return;
        }
      
        // If it's a mobile device, do not apply any zoom adjustment
        if (isMobile) {
          return;
        }
      
        // For all other devices, apply font size scaling logic
        const testElement = document.createElement("div");
        testElement.style.fontSize = "1rem";
        testElement.style.position = "absolute";
        testElement.style.visibility = "hidden";
        document.body.appendChild(testElement);
      
        // Get the computed font size of the test element
        const fontSize = parseFloat(window.getComputedStyle(testElement).fontSize);
      
        // Adjust zoom based on the computed font size, assuming default font size is 16px
        this.ui_root.style.zoom = fontSize / 16;
      
        // Remove the test element from the DOM
        testElement.remove();
    }
    adjustDocks() {
        const slidingGroup = document.querySelector('.Hud_slidingGroup__ZaO10');
        const leftDock = this.dock_left
        const rightDock = this.dock_right; 
        const leftWindow = this.windows_left;
        const rightWindow = this.windows_right;
    
        if (!slidingGroup || !leftDock || !rightDock || !leftWindow || !rightWindow) {
            return;
        }
    
        // Get sliding group dimensions
        const groupRect = slidingGroup.getBoundingClientRect();
        const screenWidth = window.innerWidth;

        // Check if the screen is wide enough to let CSS handle everything
        const isWideEnough = screenWidth >= (groupRect.width + leftDock.offsetWidth + rightDock.offsetWidth);

        if (isWideEnough) {
            // Allow CSS to handle positioning
            [leftDock, rightDock, leftWindow, rightWindow].forEach(el => {
                el.style.position = '';
                el.style.bottom = '';
            });
            this.is_narrow_screen = false;
            return;
        }

        this.is_narrow_screen = true;

        // Calculate the bottom position for docks
        const dockBottom = window.innerHeight - groupRect.top + 11; // Distance from the bottom of the viewport
        const windowBottom = dockBottom + (leftDock.offsetHeight || 0) + 6; // Windows stack above docks with 6px spacing

        // Position docks
        leftDock.style.position = 'absolute';
        leftDock.style.bottom = `${dockBottom}px`;

        rightDock.style.position = 'absolute';
        rightDock.style.bottom = `${dockBottom}px`;

        // Position windows
        leftWindow.style.position = 'absolute';
        leftWindow.style.bottom = `${windowBottom}px`;

        rightWindow.style.position = 'absolute';
        rightWindow.style.bottom = `${windowBottom}px`;
    }
    showDock(state, dock = "both") {
        if (!dock) { return; }

        if ((dock == "left") || (dock == "both")) {
            if (!state) {
                this.dock_left.classList.add('hidden');
                this.windows_left.classList.add('hidden');
            } else {
                this.dock_left.classList.remove('hidden');
                this.windows_left.classList.remove('hidden');
            }
        }
        if ((dock == "right") || (dock == "both")) {
            if (!state) {
                this.dock_right.classList.add('hidden');
                this.windows_right.classList.add('hidden');
            } else {
                this.dock_right.classList.remove('hidden');
                this.windows_right.classList.remove('hidden');
            }
        }
    }
    draw() {
        const ctx = this.canvas.getContext('2d');

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // draw entities if necessary
        if (this.is_in_game) {
            function doOverlap(rect1, rect2) {
                const l1 = { x: rect1.x, y: rect1.y }; // Top-left corner of rect1
                const r1 = { x: rect1.x + rect1.width, y: rect1.y + rect1.height }; // Bottom-right corner of rect1
                const l2 = { x: rect2.x, y: rect2.y }; // Top-left corner of rect2
                const r2 = { x: rect2.x + rect2.width, y: rect2.y + rect2.height }; // Bottom-right corner of rect2


                // If one rectangle is to the left of the other
                if (l1.x > r2.x || l2.x > r1.x) {
                    return  false;
                }
            
                // If one rectangle is above the other
                if (r1.y < l2.y || r2.y < l1.y) {
                    return false;
                }
            
                return true;
            }

            let entities = this.scene_state?.entities;
            let players = this.scene_state?.players;

            if (this._game_modal || this._game_halfmodal || this._game_storemodal) {
                return;
            }
            if (entities) {
                // let apps draw entity specific content
                for (let i in this.entity_bounds) {
                    let bounds = this.boundsToScreenCoords(this.entity_bounds[i]);
                    const inv = this._inventory_dimensions;

                    // Check if the entity is on screen
                    const isOnScreen = 
                        bounds.x > 0 && 
                        bounds.x < this.canvas.width && 
                        bounds.y > 0 && 
                        bounds.y < this.canvas.height;

                    const overlapsInventory = doOverlap({
                        x: bounds.x - bounds.width/2,
                        y: bounds.y - bounds.height/2,
                        width: bounds.width,
                        height: bounds.height
                    }, inv);

                    // If the entity is on screen and does not overlap inventory, allow overlay
                    if (isOnScreen && !overlapsInventory) {
                        for (let j in this.apps) {
                            
                            let app = this.apps[j];
                            if (app.onDrawEntity) {
                                ctx.save();
                                try {
                                    let entity = flattenEntity(entities[i]);
                                    if (entity) {
                                        app.onDrawEntity(ctx, entity, bounds, this.camera);
                                    }
                                } catch(e) {
                                    console.log("onDrawEntity error with ", app, this.scene_state.entities[i], e);
                                }
                                ctx.restore();
                            }
                            
                        }
                    }
                }
            } else {
                console.log("NO ENTITIES TO DRAW");
            }

            if (players) {
                // let apps draw player specific content
                for (let i in this.player_bounds) {
                    let bounds = this.boundsToScreenCoords(this.player_bounds[i]);
                    const inv = this._inventory_dimensions;

                    // Check if the entity is on screen
                    const isOnScreen = 
                        bounds.x > 0 && 
                        bounds.x < this.canvas.width && 
                        bounds.y > 0 && 
                        bounds.y < this.canvas.height;

                    const overlapsInventory = doOverlap({
                        x: bounds.x - bounds.width/2,
                        y: bounds.y - bounds.height/2,
                        width: bounds.width,
                        height: bounds.height
                    }, inv);

                    // If the entity is on screen and does not overlap inventory, allow overlay
                    if (isOnScreen && !overlapsInventory) {
                        for (let j in this.apps) {
                            
                            let app = this.apps[j];
                            if (app.onDrawPlayer) {
                                ctx.save();
                                try {
                                    let player = null;
                                    for (let p in players) {
                                        if (players[p].mid == i) {
                                            player = players[p];
                                        }
                                    }
                                    if (player) {
                                        app.onDrawPlayer(ctx, player, bounds, this.camera);
                                    }
                                } catch(e) {
                                    console.log("onDrawPlayer error with ", app, this.scene_state.players[i], e);
                                }
                                ctx.restore();
                            }
                            
                        }
                    }
                }
            }
        
            // let apps draw their add-on content onto the screen
            for (let i in this.apps) {
                ctx.save();
                let app = this.apps[i];
                app.draw(ctx, this.canvas.width, this.canvas.height, this.camera);
                ctx.restore();
            }
        }

        // show loading overlay
        //if ((this._loaded_libpixels == false) || (this._loaded_apps == false)) {
        if (this.logo_state < 3) {
            let alpha = 1;

            // Easing function (cubic ease-in-out)
            function easeInOutCubic(t) {
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            }
            
            if (this.logo_state === 0) {
                if (Date.now() > this.logo_timer + 500) {
                    this.logo_state = 1;
                    this.logo_timer = Date.now();
                } else {
                    let t = (Date.now() - this.logo_timer) / 500; // Normalize time (0 to 1)
                    alpha = easeInOutCubic(Math.min(t, 1)); // Apply easing
                }
            }
            if (this.logo_state === 1) {
                if ((Date.now() > this.logo_timer + 2000) && (this._loaded_libpixels && this._loaded_apps)) {
                    this.logo_state = 2;
                    this.logo_timer = Date.now();
                }
            }
            if (this.logo_state === 2) {
                if (Date.now() >= this.logo_timer + 500) {
                    this.logo_state = 3;
                    this.logo_timer = Date.now();
                } else {
                    let t = (Date.now() - this.logo_timer) / 500; // Normalize time (0 to 1)
                    alpha = 1 - easeInOutCubic(Math.min(t, 1)); // Apply easing
                }
            }
            if (this.logo_state == 3) {
                return;
            }

            ctx.save();

            ctx.fillStyle = "#000";
            ctx.globalAlpha = alpha * 0.9;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            ctx.globalAlpha = alpha;

            let img = this.logo;
            let canvas = this.canvas;
         
            // Dimensions of the canvas
            let canvasWidth = canvas.width;
            let canvasHeight = canvas.height;

            // Dimensions of the image
            let imgWidth = img.width;
            let imgHeight = img.height;

            // Calculate the scale factor
            let scaleFactor = Math.min(canvasWidth / (2 * imgWidth), canvasHeight / (2 * imgHeight));

            // Calculate the new dimensions of the image
            let newWidth = imgWidth * scaleFactor;
            let newHeight = imgHeight * scaleFactor;

            // Calculate the top-left position to center the image
            let x = (canvasWidth - newWidth) / 2;
            let y = (canvasHeight - newHeight) / 2;

            // Define the rectangle for the image
            let rect = {
                x: x,
                y: y,
                width: newWidth,
                height: newHeight
            };

            // Draw the image onto the canvas
            try {
                ctx.drawImage(img, rect.x, rect.y-20, rect.width, rect.height);
            } catch(e) {
                console.log("Error when drawing splash screen: ", e);
            }
           
            //ctx.drawImage(img, this.canvas.width/2 - img.width/2, this.canvas.height/2 - img.height/2);

            ctx.fontSize = "150%";

            let text = "Loading apps... (" + this._app_load_state.completed + "/" + this._app_load_state.total + ")";
            if (this._loaded_libpixels == false) {
                text = "Loading libPixels...";
            }

            let dim = ctx.measureText(text);

            let tx = this.canvas.width/2 - dim.width/2;
            let ty = rect.y + rect.height;

            ctx.fillStyle = "#000";
            ctx.fillText(text, tx-1, ty);
            ctx.fillText(text, tx+1, ty);
            ctx.fillText(text, tx, ty-1);
            ctx.fillText(text, tx, ty+1);
            ctx.fillStyle = "#fff";
            ctx.fillText(text, tx, ty);

            ctx.restore();
        }
    }
    tick() {
        if (this.is_in_game) {
            this.handleMessage({
                type: "update",
                data: null
            });

            if (this._state_has_changed) {
                this.handleMessage({
                    type: 'state_change',
                    data: this.scene_state
                });
                this._state_has_changed = false;
            }
        }

        this.adjustDocks();

        // Select the first element with the class "Hud_slidingGroup__ZaO10"
        const inventory_element = document.querySelector('.Hud_slidingGroup__ZaO10');

        if (inventory_element) {
            // Get the element's onscreen dimensions
            const rect = inventory_element.getBoundingClientRect();

            // Store the dimensions in the variable
            this._inventory_dimensions = {
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
            };
        }

        if (this.data_needs_saving) {
            let save_data = {};
            this.withApps(app => {
                let d = app.onSave();
                save_data[app.name] = d;
            }, app => {
                save_data[app.name] = this._known_good_app_data[app.name] || null; 
            });
            // at least one data field aside from the timestamp needs to have a value
            if (Object.entries(save_data).some(([key, value]) => key !== 'timestamp' && value !== null)) {
                // add the current timestamp to the save data
                save_data.timestamp = Date.now();
                this._known_good_app_data = save_data;
                this.debounceSaveAppData(this.mid, save_data);
            }
            
            this.data_needs_saving = false;
        }
    }
    withApps(func, error_handler = null) {
        for (let i in this.apps) {
            try {
                func(this.apps[i]);
            } catch(e) {
                console.log("Error executing app function: ", e, this.apps[i], func);
                if (error_handler) {
                    error_handler(this.apps[i])
                }
            } 
        }
    }
    dataDirty() {
        this.data_needs_saving = true;
    }
    handleMessage(msg) {
        if (msg.type == "pixels_message") {
            console.log("PIXELS MESSAGE: ", msg.type, msg.data);
        }

        // this will kickstart the extension proper
        if (msg.type == "enter_game") {
            this.game_library = msg.data.game_library;
            this.item_name_mapping = msg.data.item_name_mapping;
            this.mid = msg.data.mid;
            this.username = msg.data.name;
            this.userguild = msg.data.guild;
            this.current_map = msg.data.map_name;
            this.enterGame();
        }

        if (msg.type == "map_changed") {
            this.current_map = msg.data.map_name;
            this.scene_state = { entities: {}, players: {}};
        }

        // if we are not yet ingame discard any other messages
        if (!this.is_in_game) { return; }

        /*if (msg.type == "state_change") {
            this.scene_state = msg.data;
        }*/

        if (msg.type == "entity_change") {
            let e = msg.data;
            this.scene_state.entities[e.mid] = e;
            this._state_has_changed = true;
        }

        if (msg.type == "player_change") {
            let e = msg.data;
            this.scene_state.players[e.mid] = e;
            this._state_has_changed = true;
        }

        if (msg.type == "camera") {
            this.camera = msg.data.camera;
            if (msg.data.entity_bounds) {
                this.entity_bounds = msg.data.entity_bounds;
            }
            if (msg.data.player_bounds) {
                this.player_bounds = msg.data.player_bounds;
            }
     
            this.updateMouse();
        }

        //console.dir(msg);
        for (let i in this.apps) {
            let app = this.apps[i];
            try {
                app.event(msg.type, msg.data);
            } catch(e) {
                console.log("Error when handling event with app: ", msg, app, e);
            }
        }
    }
    dispatchEvent(type, data) {
        this.handleMessage({
            type,
            data
        });
    }
    async loadAppData(mid, callback) {
        console.log("Loading data for mid:", mid);
        let result = await getStorage("NHN_" + mid);
        let local_result = null;

        // Check if data exists
        if (result && result["NHN_" + mid]) {
            console.log("Local data found for mid:", mid);
            local_result = result["NHN_" + mid];
        }

        let cloud_result = await this.cloudloadAppData(mid);

        if (cloud_result) {
            if (!local_result) {
                console.log("Cloud data loaded for mid: ", mid, cloud_result);
                callback(cloud_result);
                return;
            } else if ((cloud_result.timestamp > local_result.timestamp) || (!local_result.timestamp)) {
                console.log("Using newer cloud data for mid: ", mid, cloud_result);
                callback(cloud_result);
                return;
            }
        }

        console.log("Using local data for mid: ", mid, local_result);
        callback(local_result);
    }
    async cloudloadAppData(mid) {
        return new Promise((resolve, reject) => {
            // Handler for messages
            function handleMessage(event) {
                if (event.data.type === 'get_cloud_storage_result' && (event.data.data !== undefined)) {
                    window.removeEventListener('message', handleMessage); // Clean up listener
                    resolve(event.data.data?.data || null);
                }
            }
    
            // Add event listener for the response
            window.addEventListener('message', handleMessage);
    
            // Send out the message for resolving the URL
            window.postMessage({
                type: 'get_cloud_storage',
                data: {
                    mid
                }
            });
        });
    }
    async saveAppData(mid, data) {
        if (!this._initial_app_data_load_finished) {
            //console.log("ERROR: Attempted to save before initial load: ", data);
            return;
        }
        try {
            const dataToSave = {
                ["NHN_" + mid]: data
            };

            await new Promise((resolve, reject) => {
                putStorage(dataToSave).then((result) => {
                    resolve();
                }).catch(reject);
            });

            // Update the last save time
            this._lastSaveTime = Date.now();

            // now that we manage to save, schedule a cloud save to go out
            this.scheduleCloudSave(mid, data);

            return true;
        } catch (error) {
            console.error("Error saving data for mid:", mid, error);
            return false;
        }
    }
    debounceSaveAppData(mid, data) {
        const now = Date.now();

        // If enough time has passed since the last save, save immediately
        if (now - this._lastSaveTime >= this.save_interval) {
            this.saveAppData(mid, data);
            return;
        }

        // Otherwise, debounce the save
        this._latestArgs = { mid, data };

        // Clear any existing timeout
        if (this._debounceTimeout) {
            clearTimeout(this._debounceTimeout);
        }

        // Set a new timeout to save after the remaining interval
        const timeUntilNextSave = this.save_interval - (now - this._lastSaveTime);
        this._debounceTimeout = setTimeout(async () => {
            const { mid, data } = this._latestArgs;
            await this.saveAppData(mid, data);
        }, timeUntilNextSave);
    }
    async scheduleCloudSave(mid, data) {

        // Update the latest data
        this.cloudsaveLatestData = data;

        const now = Date.now();

        // If 5 minutes have passed since the last save, save immediately
        if (now - this.cloudsaveLastSaveTime >= this.cloudsaveDebounceDelay) {
            await this.performCloudSave(mid, this.cloudsaveLatestData);
            return;
        }

        // Clear any existing timer
        if (this.cloudsaveTimer) {
            clearTimeout(this.cloudsaveTimer);
        }

        // Schedule a new save after the remaining debounce delay
        const remainingTime = this.cloudsaveDebounceDelay - (now - this.cloudsaveLastSaveTime);
        this.cloudsaveTimer = setTimeout(() => this.performCloudSave(mid, this.cloudsaveLatestData), remainingTime);
    }

    async performCloudSave(mid, data) {
        window.postMessage({
            type: 'put_cloud_storage',
            data: {
                mid,
                data
            }
        })
        this.cloudsaveLastSaveTime = Date.now();

        /*try {
            const response = await fetch(`https://pixelnerds.xyz/api/hud/${mid}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(this.cloudsaveLatestData),
            });

            if (!response.ok) {
                console.error("Cloud save failed:", response.statusText);
            } else {
                console.log("Cloud save successful!");
                this.cloudsaveLastSaveTime = Date.now(); // Update last save time
            }
        } catch (error) {
            console.error("Error during cloud save:", error);
        } finally {
            // Clear the timer after execution
            this.cloudsaveTimer = null;
        }*/
    }
    clearAppData() {
        this.saveAppData(this.mid, {}).then(() => { window.location.reload(); }); 
    }
    async loadAppSettings(mid) {
        console.log("Loading data for mid:", mid);
        let result = await getStorage("NHN_SETTINGS_" + mid);

        // Check if data exists
        if (result && result["NHN_SETTINGS_" + mid]) {
            console.log("Settings found for mid:", mid);
            return result["NHN_SETTINGS_" + mid];
        }

        return null;
    }
    async saveAppSettings(mid, data) {
        if (!this._initial_app_data_load_finished) {
            return;
        }
        try {
            const dataToSave = {
                ["NHN_SETTINGS_" + mid]: data
            };

            await new Promise((resolve, reject) => {
                putStorage(dataToSave).then((result) => {
                    resolve();
                }).catch(reject);
            });

            return true;
        } catch (error) {
            console.error("Error saving settings for mid:", mid, error);
            return false;
        }
    }
    watchClass(className, interval, callback, nodeRemovedCallback = null) {
        const classNamesArray = className.split(/\s+/);
        const targetNode = document.body;
        const config = { childList: true, subtree: true };
    
        // MutationObserver for monitoring class attribute changes
        const classMutationObserver = new MutationObserver((mutationsList, observer) => {
            mutationsList.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.nodeType === Node.ELEMENT_NODE && containsAllClasses(target, classNamesArray)) {
                        callback(target);
                        checkNodeRemoval(target, callback, nodeRemovedCallback, interval);
                    }
                }
            });
        });
    
        // Observe changes to class attributes
        classMutationObserver.observe(targetNode, { attributes: true, attributeFilter: ['class'], subtree: true });
    
        // MutationObserver for monitoring node insertions and removals
        const mutationObserver = new MutationObserver((mutationsList, observer) => {
            mutationsList.forEach(mutation => {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const removedNodes = Array.from(mutation.removedNodes);
    
                    addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && containsAllClasses(node, classNamesArray)) {
                            callback(node);
                            checkNodeRemoval(node, callback, nodeRemovedCallback, interval);
                        }
                    });
    
                    removedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && containsAllClasses(node, classNamesArray)) {
                            if (nodeRemovedCallback) {
                                nodeRemovedCallback(node);
                            }
                            // Stop observing the node if classes are removed
                            classMutationObserver.disconnect();
                        }
                    });
                }
            });
        });
    
        // Observe changes in child nodes
        mutationObserver.observe(targetNode, config);
    
        function checkNodeRemoval(node, callback, nodeRemovedCallback, interval) {
            const checkInterval = setInterval(() => {
                if (!document.contains(node) || !containsAllClasses(node, classNamesArray)) {
                    clearInterval(checkInterval);
                    if (containsAllClasses(node, classNamesArray) && nodeRemovedCallback) {
                        // If classes are added back, start observing the node again
                        classMutationObserver.observe(targetNode, { attributes: true, attributeFilter: ['class'], subtree: true });
                    }
                    if (nodeRemovedCallback) {
                        nodeRemovedCallback(node);
                    }
                    return;
                }
                callback(node);
            }, interval);
        }
    
        function containsAllClasses(node, classNamesArray) {
            return classNamesArray.every(className => node.classList.contains(className));
        }
    } 
    toScreenCoords(x, y) {
        if (!this.camera) {
            return {x: 0, y: 0}
        }
        let coords = this.camera;

        let screenX = (x - coords.x) * coords.zoom;
        let screenY = (y - coords.y) * coords.zoom;

        return { x: screenX, y: screenY };
    }
    boundsToScreenCoords(bounds) {
        if (!this.camera) {
            return {x: 0, y: 0}
        }
        let coords = this.camera;

        let screenX = (bounds.x - coords.x) * coords.zoom;
        let screenY = (bounds.y - coords.y) * coords.zoom;
        
        return { 
            x: screenX, 
            y: screenY,
            width: bounds.width * coords.zoom,
            height: bounds.height * coords.zoom 
        };
    }
    createWindow(options) {
        let el = document.createElement('div');
        el.className = "nerd_hud_window";
        
        if (!options.name) {
            throw "Missing options.name for window";
        }

        let visible = false;
        let setVisible = (state) => {
            visible = state;
          
            if (visible) {
              // Make it visible immediately and apply the fade-in animation
              el.style.display = "block";
              el.classList.remove('slide-fade-out');
              el.classList.add('slide-fade-in');
            } else {
              // Apply the fade-out animation, then hide after animation ends
              el.classList.remove('slide-fade-in');
              el.classList.add('slide-fade-out');
          
              // Wait for the animation to complete before setting display to none
              el.addEventListener('animationend', function handler() {
                if (!visible) {
                  el.style.display = "none";
                }
                // Remove the event listener to prevent it from triggering multiple times
                el.removeEventListener('animationend', handler);
              });
            }
        };

        // if we need to create a dock icon...
        if (options?.docked) {
            if (!options.icon) {
                throw "Missing options.icon for window";
            }
            if (!options.title) {
                throw "Missing options.title for window";
            }
            if (!(options.docked == "left" || options.docked == "right")) {
                throw "Unsupported docking mode for window";
            }

            let icon = document.createElement('img');
            icon.className = "nerd_dock_icon";
            icon.src =  "#";
            resolveURL(options.icon).then(url => {
                icon.src = url;
            });
            icon.title = options.title;
            icon.addEventListener('click', () => {
                this.clickDockIcon(options.docked, options.name);
            });

            // create an icon for the left dock
            if (options.docked == "left") {
                el.className = "nerd_hud_window nerd_hud_docked_left";
                this.dock_left.appendChild(icon);
                this.windows_left.appendChild(el);
            }

            // create an icon for the left dock
            if (options.docked == "right") {
                el.className = "nerd_hud_window nerd_hud_docked_right";
                this.dock_right.appendChild(icon);
                this.windows_right.appendChild(el); 
            }
        } else {
            this.ui_root.appendChild(el);
        }

        el.style.display = "none";
        

        // create inner window to hand to the app for its use
        let inner_el = document.createElement('div');
        inner_el.className = "nerd_hud_window_inner";

        // if the window is a fullscreen window add the title and close button
        if (options?.fullscreen) {
            let header = document.createElement('div');
            header.className = "nerd_fullscreen_header";

            let header_title = document.createElement('div');
            header_title.className = "nerd_fullscreen_title";
            header_title.innerHTML = options?.title || "Unnamed Window";
            header.appendChild(header_title);

            let header_close_btn = document.createElement('div');
            header_close_btn.className ='hud_button';
            header_close_btn.innerHTML = "X";

            header.appendChild(header_close_btn);

            header_close_btn.addEventListener('click', () => {
                setVisible(false);
            })

            inner_el.classList.add('nerd_fullscreen_content');

            el.classList.add('nerd_hud_fullscreen_window');
            el.appendChild(header);
            el.appendChild(inner_el); 

        } else {
            el.appendChild(inner_el);
        }

        this.registered_windows.push({
            el,
            options,
            visible,
            setVisible
        });

        return inner_el;
    }
    showWindow(name, state) {
        for (let i = 0; i < this.registered_windows.length; i++) {
            let w = this.registered_windows[i];
            if (w.options.name == name) {
                w.setVisible(state);
            }
        }
    }
    clickDockIcon(dock, name) {
        for (let i=0; i<this.registered_windows.length; i++) {
            let w = this.registered_windows[i];
            if (w.options.docked == dock) {
                let v = false;
                if (w.options.name == name) {
                    // invert visibility for the clicked window icon
                    v = !w.visible;
                }
                w.setVisible(v);
                w.visible = v;
            }
        }
    }
    activateApp(name) {
        let app = null;

        // find the app we want to display
        for (let i=0; i<this.registered_windows.length; i++) {
            let w = this.registered_windows[i];   
            if (w.options.name == name) {
                app = w;
            }
        }

        // now cycle through all the apps in that dock and toggle them to invisible apart from the app we want to show
        if (app) {
            for (let i=0; i<this.registered_windows.length; i++) {
                let w = this.registered_windows[i];
                if (w.options.docked == app.options.docked) {
                    let v = false;
                    if (w.options.name == name) {
                        // invert visibility for the clicked window icon
                        v = true;
                    }
                    w.setVisible(v);
                    w.visible = v;
                }
            }
        }
    }
    getItemData(itm) {
        if (!this.game_library) { return null; }
        return this.game_library.items[itm];
    }
    getCurrencyData(cur) {
        return this.game_library.currencies[cur];
    }
    getItemName(itm) {
        return this.item_name_mapping[itm] || itm;
    }
    getEntityName(entity) {
        let name = "";
        if (ENTITY_NAME_OVERRIDES[entity]) {
            name = ENTITY_NAME_OVERRIDES[entity];
        } else {
            let entity_name = entity;
            entity_name = entity_name.replace(/^ent_/, '').replace(/_\d+$/, '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

            name = entity_name;     
        }
        return name;
    }
    findItemsByName(name) {
        if (!this.item_name_mapping) { return {}; }
        if (!(typeof name === 'string' || name instanceof String)) { return {} }



        let ret = {};
        for (let i in this.item_name_mapping) {
            let item = this.item_name_mapping[i];
            if ((item) && (item.toLowerCase().includes(name.toLowerCase()))) {
                ret[i] = item;
            }
        }
        return ret;
    }
    getCurrentMap() {
        return this.current_map || "";
    }
    getMapName(map) {
        let map_name = map;

        // Configuration object for mapping patterns to replacement rules
        const exceptions = {
            "pixelsNFTFarm-(\\d{1,4})": match => "NFT Land #" + match[1],
            "nftHouse(\\d{1,4})": match => "NFT House #" + match[1],
            "terravilla": () => "Terravilla",
            "carnival": () => "Carnival",
            "tutorialhouse": () => "Karen's house",
            "shareRent(\\d{1,6})": () => "Speck",
            "shareInterior(\\d{1,6})": () => "Speck House",
            "room(\\w+)": match => match[1].replace(/([a-z])([A-Z])/g, '$1 $2')
        };

        // Apply exceptions to map_name
        for (const pattern in exceptions) {
            const regex = new RegExp(pattern, 'i');
            if (map_name.match(regex)) {
                // Apply the corresponding replacement rule
                map_name = exceptions[pattern](map_name.match(regex));
                break;
            }
        }

        return map_name;
    }
    getCraftResult(ach) {
        return this.game_library.achievements[ach]?.craftable?.result?.items[0] || { id: "", quantity: 0 };
    }
    getGameLibrary() {
        return this.game_library;
    }
    formatRelativeTime(timestamp) {
        if (isNaN(timestamp)) { return ""; }
    
        // Convert the timestamp to milliseconds
        const timestampMs = parseInt(timestamp);
        
        // Create a Date object with the timestamp
        const futureDate = new Date(timestampMs);
        
        // Get the current time
        const now = new Date();
        
        // Calculate the difference in milliseconds
        let diffMs = futureDate - now;
      
        // Check if the timestamp is in the past
        if (diffMs <= 0) {
            return "";
        }
        
        // Calculate hours, minutes, and seconds
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        diffMs -= hours * 1000 * 60 * 60;
        const minutes = Math.floor(diffMs / (1000 * 60));
        diffMs -= minutes * 1000 * 60;
        const seconds = Math.floor(diffMs / 1000);
        
        // Format the time string with leading zeroes
        const formattedTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        return formattedTime;
    }
    formatCurrency(num, decimalPlaces = undefined) {
        const formatter = new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimalPlaces !== undefined ? decimalPlaces : 2
        });
    
        if (num >= 1000000 || num <= -1000000) {
            return formatter.format(num / 1000000) + "m";
        } else if (num >= 1000 || num <= -1000) {
            return formatter.format(num / 1000) + "k";
        } else {
            // Check if there are non-zero decimal places
            const decimalPart = Math.abs(num % 1);
            if (decimalPart > 0) {
                return formatter.format(num);
            } else {
                return formatter.format(num);
            }
        }
    }
    registerAppFunction(app, name, func) {
        this.app_funcs[app.name + "." + name] = func;
    }
    importAppFunction(func_name) {
        if (this.app_funcs[func_name]) {
            return this.app_funcs[func_name];
        }
        throw "Error importing app function " + func_name;
    }
    getSettingsDeclarations() {
        let dec = [];

        dec.push({
            title: 'General',
            app: 'hud',
            settings: [
                {
                    name: 'Global Menu Opacity',
                    var: 'opacity',
                    type: 'slider',
                    description: 'Sets the overall opacity of the Nerd HUD Next UI',
                    default: 70,
                    min: 10,
                    max: 100
                },
                {
                    name: 'Global Overlay Opacity',
                    var: 'overlay_opacity',
                    type: 'slider',
                    description: 'Sets the opacity of overlay elements on the gameplay',
                    default: 70,
                    min: 10,
                    max: 100
                }
            ]
        })

        this.withApps((app) => {
            let s = app.declareSettings();
            if (s != null) {
                s.app = app.name;

                // TO-DO: fill in current values

                dec.push(s);
            }
        })

        return dec;
    }
    getHudSettings() {
        return this._hud_settings;
    }
    getOverlayOpacity() {
        let opacity = 1;
        let hud_settings = this.getHudSettings();
        if (hud_settings?.overlay_opacity) {
            opacity = hud_settings.overlay_opacity / 100;
        }
        return opacity;
    }
    getAllSettings() {
        let settings = {
            hud: this._hud_settings
        };
        this.withApps(app => {
            let s = app.getSettings();
            if (s) {
                settings[app.name] = s;
            }
        });
        return settings;
    }
    applyHudSettings(settings) {
        this._hud_settings = settings;
        for (let i in settings) {
            let setting = settings[i];
            if (i == "opacity") {
                document.documentElement.style.setProperty('--nhud-opacity', (setting / 100));
                console.log("ROOT OPACITY SET: ", getComputedStyle(document.documentElement).getPropertyValue('--nhud-opacity'));
            }
        }
    }
    applySettings(values) {
        this.applyHudSettings(values['hud'] || {});
        this.withApps(app => {
            let settings = app.getSettings();
            if (!values[app.name]) { return; }
            for (let i in values[app.name]) {
                settings[i] = values[app.name][i];
            }
            app.onLoadSettings(settings);
        });
        let save_settings = {};
        save_settings['hud'] = values['hud'];
        this.withApps(app => {
            save_settings[app.name] = app.getSettings();
        });
        this.saveAppSettings(this.mid, save_settings);
    }
}
window.addEventListener('load', () => {
    const nerd_hud = new NerdHUD();
})
