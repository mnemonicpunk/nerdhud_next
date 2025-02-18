let getGO = () => {}
let getState = () => {};
let getMid = () => {};

function cprop(arr, name) {
    if ((!arr) || (!Array.isArray(arr)) ) { return "" || 0 };
    // Find the object with the matching 'name'
    const found = arr.find(item => item.name === name);
    
    // If found, return the value, properly cast if 'numeric' is true
    if (found) {
        return found.numeric ? Number(found.value) : found.value;
    }
    
    // If no match found, return undefined
    return undefined;
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

class libPixels {
    constructor() {
        const _self = this;

        this.pixelsAPIURL = 'https://pixels-server.pixels.xyz/v1';
        this.pixelsTenant = 'pixels';

        this.debug_message = false;

        this.game_instance = null;
        this.pixels_scene = null;
        this.room_state = null;
        this.player_id = null;
        this.player_guild = null;

        this.players = {};
        this._room_state_buffer = {};
        this._id_mapping = {};

        this.storages = new Map(); // Track updated storage data
        this.storage_debounce = null; // Shared debounce timeout

        this.game_library = null;
        this.game_language_data = null;

        this.debounceMap = new Map(); // Tracks debounce states for each message type
        this.last_bounds_update = 0;
        this.last_camera_update = Date.now();

        console.log("[libPixels] Initiating libPixels...");

        // install game object interception
        this.interceptPhaserObject("Phaser.Game", (game_instance) => {
            _self.game_instance = game_instance;
            console.log("libPixels ready, access to game object gained: ", _self.game_instance);
            getGO = () => {
                return _self.game_instance;
            }
            getMid = (mid) => {
                return this.getEntity(mid);
            }

            let _scene_update_tick = () => {
                let scene = _self.game_instance.scene.scenes[1];
                
                if (!scene) {
                    _self.pixels_scene = null;
                    return;
                }

                let player = scene.stateManager.selfPlayer;

                // if the logged in player changed, reload page to preserve extension data
                if (this.player_id && (this.player_id != scene.playerId)) {
                    window.location.reload();
                }

                // install message handler interception if the scene is new
                if ((_self.pixels_scene == null) || (_self.pixels_scene !== scene)) {
           
                    let room = scene.stateManager.room;
                    room.onMessage("*", (type, data) => { 
                        _self._onPixelsMessage(type, data);
                    });

                    /*room.onStateChange((data) => { 
                        _self._onRoomStateChange(data);
                    });*/
                }

                // if we switched scenes clear the prev_state tracker and post a map change event
                if (this.pixels_scene !== scene) {
                    this.onMapChange(scene)
                }

                // if we hadn't yet obtained the player name and mid, obtain them and post an event
                // also send the name mapping at this point
                if (_self.pixels_scene == null) {
                    this.onEnterGame(scene);
                    this.onMapChange(scene)
                }

                _self.pixels_scene = scene;
                
                this.updateBounds();
            }
            window.setInterval(_scene_update_tick, 1000);
        });

        // begin fetching and parsing game metadata
        this.preparePixelsMetaData();
    }
    onEnterGame(scene) {
        const player = scene.stateManager.selfPlayer;

        this.player_id = scene.playerId;
        this.player_name = scene.selfPlayer.username;
        this.player_guild = scene.selfPlayer.playerData.guild;

        window.postMessage({
            type: 'enter_game',
            data: {
                mid: this.player_id,
                name: this.player_id,
                guild: this.player_guild,
                game_library: this.game_library,
                item_name_mapping: this.item_name_mapping,
                map_name: scene.stateManager.mapId
            }
        });

        window.postMessage({
            type: 'inventory',
            data: JSON.parse(JSON.stringify(player.inventory))
        });
        window.postMessage({
            type: 'currency',
            data: JSON.parse(JSON.stringify(player.coinInventory))
        });
        window.postMessage({
            type: 'levels',
            data: JSON.parse(JSON.stringify(player.levels))
        });
    }
    onMapChange(scene) {
        this.room_state = null;
       
        console.log("MAP CHANGED!");
        window.postMessage({
            type: 'map_changed',
            data: {
                map_name: scene.stateManager.mapId
            }
        })
        this._room_state_buffer = {};
        this._id_mapping = {};

        this.attachSceneEventListeners(scene);
    }
    attachSceneEventListeners(scene) {
        const player = scene.stateManager.selfPlayer;
        const room = scene.stateManager.room.serializer.state;

        // Catch camera updates
        let camera = scene.cameras.main;
        let previousX = camera.worldView.x;
        let previousY = camera.worldView.y;
        let previousZoom = camera.zoom;

        const delay = 1000 / 60; // Configurable delay in milliseconds

        // Function to send the camera update
        const sendCameraUpdate = () => {
            window.postMessage({
                type: "camera",
                data: {
                    camera: this.cameraCoords(scene) // Assuming `cameraCoords` returns camera data
                }
            });
            this.last_camera_update = Date.now(); // Update the last update timestamp
        };

        // Listen to the camera move event
        camera.on('cameramove', () => {
            sendCameraUpdate();
        });

        // Listen to the camera zoom event
        camera.on('camerazoom', () => {
            sendCameraUpdate();
        });

        // Periodic check if neither event has been fired or if the camera is following an object
        scene.time.addEvent({
            delay, // Time between checks
            loop: true,
            callback: () => {
                const currentX = camera.worldView.x;
                const currentY = camera.worldView.y;
                const currentZoom = camera.zoom;

                // Check if the camera's position or zoom has changed
                if (
                    currentX !== previousX ||
                    currentY !== previousY ||
                    currentZoom !== previousZoom
                ) {
                    previousX = currentX;
                    previousY = currentY;
                    previousZoom = currentZoom;
                    sendCameraUpdate();
                }

                // Additional periodic update if no changes detected within delay
                if (Date.now() - this.last_camera_update >= delay) {
                    sendCameraUpdate();
                }
            }
        });

        // For room entities:
        room.entities.forEach((value, key) => {
            this.attachMapEntityEventListeners(value);
        });

        room.entities.onAdd((value, key) => {
            this.attachMapEntityEventListeners(value);
        });

        // For room limits
        room.limits.forEach((value, key) => {
            //this.attachMapEntityEventListeners(value);
            value.onChange(() => {
                window.postMessage({
                    type: "map_limits",
                    data: JSON.parse(JSON.stringify(room.limits))
                })
            });
        });
        window.postMessage({
            type: 'map_limits',
            data: JSON.parse(JSON.stringify(room.limits))
        })

        // For player entities:
        player.entities.forEach((value, key) => {
            this.attachPlayerEntityEventListeners(value);
        });

        player.entities.onAdd((value, key) => {
            this.attachPlayerEntityEventListeners(value);
        });

        // for actual players
        room.players.forEach((value, key) => {
            this.attachPlayerEventListeners(value);
        });

        room.players.onAdd((value, key) => {
            this.attachPlayerEventListeners(value);
        });

        player.levels.onChange((value, key) => {
            this.debounceMessage({
                type: 'levels',
                data: JSON.parse(JSON.stringify(player.levels))
            });
        });
        player.inventory.onChange((value, key) => {
            this.debounceMessage({
                type: 'inventory',
                data: JSON.parse(JSON.stringify(player.inventory))
            });
        });
        player.inventory.slots.onChange((value, key) => {
            this.debounceMessage({
                type: 'inventory_slot',
                data: JSON.parse(JSON.stringify({
                    value,
                    key
                }))
            });
            this.debounceMessage({
                type: 'inventory',
                data: JSON.parse(JSON.stringify(player.inventory))
            });
        });
        player.energy.onChange((value, key) => {
            this.debounceMessage({
                type: 'energy',
                data: JSON.parse(JSON.stringify(player.energy.level))
            });
        });

        for (let i=0; i < player.coinInventory.length; i++) {
            if (player.coinInventory[i].onChange) {
                player.coinInventory[i]?.onChange((value, key) => {
                    window.postMessage({
                        type: 'currency',
                        data: JSON.parse(JSON.stringify(player.coinInventory))
                    });
                });    
            }
        }
    }
    attachMapEntityEventListeners(entity) {
        if (!entity.onChange) {
            return;
        }
    
        // Listen for changes on the main entity and trigger onMapEntityChange
        entity.onChange((value, key) => {
            this.onMapEntityChange(entity);
        });
    
        // Now listen for changes to all nested properties within `generic`
        if (entity.generic) {
            // Listen for changes on `generic` and its nested properties
            entity.generic.onChange((value, key) => {
                this.onMapEntityChange(entity); // Always invoke onMapEntityChange for any change in generic
            });
    
            // Attach listeners for specific properties within `generic`
            if (entity.generic.trackers) {
                entity.generic.trackers.onChange((value, key) => {
                    this.onMapEntityChange(entity); // Always invoke onMapEntityChange for changes in trackers
                });
            }
    
            if (entity.generic.statics) {
                entity.generic.statics.onChange((value, key) => {
                    this.onMapEntityChange(entity); // Always invoke onMapEntityChange for changes in statics
                });
            }
    
            if (entity.generic) {
                entity.generic.onChange((value, key) => {
                    this.onMapEntityChange(entity); // Always invoke onMapEntityChange for changes in utcRefresh
                });
            }
    
            if (entity.generic.displayInfo) {
                entity.generic.displayInfo.onChange((value, key) => {
                    this.onMapEntityChange(entity); // Always invoke onMapEntityChange for changes in displayInfo
                });
            }
        }
    
        // Call `onMapEntityChange` for the initial entity state
        this.onMapEntityChange(entity);
    }    
    attachPlayerEntityEventListeners(entity) {
        // Check if entity has storage and listen for changes on its slots
        if (entity.storage !== undefined) {
            if (entity.entity.includes('trash')) {
                return; // Skip entities related to trash
            }
    
            entity.storage.slots.onChange((value, key) => {
                console.log("STORAGE CHANGED: ", entity);
                this.reportStorage(entity);
            });
    
            this.reportStorage(entity);
        }
    
        // Attach a change listener to the main entity
        if (!entity.onChange) {
            return;
        }
    
        entity.onChange((value, key) => {
            this.onPlayerEntityChange(entity); // Always invoke onPlayerEntityChange for changes in player entity
        });
    
        // Now listen for changes to all nested properties within `generic`
        if (entity.generic) {
            // Listen for changes on `generic` and its nested properties
            entity.generic.onChange((value, key) => {
                this.onPlayerEntityChange(entity); // Always invoke onPlayerEntityChange for any change in generic
            });
    
            // Attach listeners for specific properties within `generic`
            if (entity.generic.trackers) {
                entity.generic.trackers.onChange((value, key) => {
                    this.onPlayerEntityChange(entity); // Always invoke onPlayerEntityChange for changes in trackers
                });
            }
    
            if (entity.generic.statics) {
                entity.generic.statics.onChange((value, key) => {
                    this.onPlayerEntityChange(entity); // Always invoke onPlayerEntityChange for changes in statics
                });
            }

            if (entity.generic) {
                entity.generic.onChange((value, key) => {
                    this.onPlayerEntityChange(entity); // Always invoke onPlayerEntityChange for changes in utcRefresh
                });
            }
    
            if (entity.generic.displayInfo) {
                entity.generic.displayInfo.onChange((value, key) => {
                    this.onPlayerEntityChange(entity); // Always invoke onPlayerEntityChange for changes in displayInfo
                });
            }
        }
    
        // Call `onPlayerEntityChange` for the initial entity state
        this.onPlayerEntityChange(entity);
    }  
    attachPlayerEventListeners(player) {
        player.onChange((value, key) => {
            this.players[player.mid] = player;
            window.postMessage({
                type: 'player_change',
                data: JSON.parse(JSON.stringify(player))
            })
        })
        this.players[player.mid] = player;
        window.postMessage({
            type: 'player_change',
            data: JSON.parse(JSON.stringify(player))
        })
    }  
    onMapEntityChange(entity) {
        const player = this.getSelfPlayer();
        entity = JSON.parse(JSON.stringify(entity));
    
        let player_entity = null;
    
        if (player != null) {
            player.entities.forEach((value, key) => {
                if (value.mapEntity_id == entity.mid) {
                    player_entity = JSON.parse(JSON.stringify(value));
                    return;
                }
            });
        } 
    
        // Proceed with the merged entity, allowing player_entity to be null
        this.onEntityChange(this.mergeEntities(entity, player_entity));
    }    
    onPlayerEntityChange(entity, mid) {
        this._id_mapping[entity.mid] = entity.mapEntity_id;
        const room_entity = JSON.parse(JSON.stringify(this.getEntity(entity.mapEntity_id)));
        entity = JSON.parse(JSON.stringify(entity));

        this.onEntityChange(this.mergeEntities(room_entity, entity));
    }
    onEntityChange(entity) {
        if (entity) {
            const e_old = this._room_state_buffer[entity.mid] || null;
            this.detectEntityChanges(e_old, entity);        
            this._room_state_buffer[entity.mid] = entity;

            window.postMessage({
                type: 'entity_change',
                data: entity
            });
        }
    }
    mergeEntities(room_entity, player_entity) {
        const entity = player_entity;
        const map_entity = room_entity;

        if (!entity) { return map_entity; }
        
        if (map_entity?.generic) {
            if (entity.generic) {
                if (entity.generic.trackers) {
                    map_entity.generic.trackers = entity.generic.trackers;
                }
                if (entity.generic.utcRefresh) {
                    map_entity.generic.utcRefresh = entity.generic.utcRefresh;
                }

                if (map_entity.generic?.current != entity.generic?.current) {
                    map_entity.generic.current = entity.generic?.current;
                }
            }
            if (entity.mapEntity_id) {
                map_entity.mapEntity_id = entity.mapEntity_id;
                this._id_mapping[entity.mid] = entity.mapEntity_id;
            }
        }

        return map_entity;
    }
    debounceMessage(message) {
        const type = message.type;
        if (!type) { return; }
    
        if (!this.debounceMap.has(type)) {
            this.debounceMap.set(type, { 
                debounceTimeout: null, 
                latestMessage: null, 
                lastSent: 0 // Tracks the timestamp of the last sent message
            });
        }
    
        const state = this.debounceMap.get(type);
        state.latestMessage = message;
    
        const now = Date.now();
        const timeSinceLastSend = now - state.lastSent;
    
        // If the last message was sent more than 1 second ago, send immediately
        if (timeSinceLastSend >= 250) {
            window.postMessage(state.latestMessage);
            state.lastSent = now;
        } else {
            // Otherwise, schedule the next send to occur after the remaining time
            const delay = 250 - timeSinceLastSend;
    
            if (state.debounceTimeout) {
                clearTimeout(state.debounceTimeout);
            }
    
            state.debounceTimeout = setTimeout(() => {
                window.postMessage(state.latestMessage);
                state.lastSent = Date.now();
                state.debounceTimeout = null;
            }, delay);
        }
    }
    async preparePixelsMetaData() {
        console.log("[libPixels] Fetching Game Library...")
        this.game_library = await this.fetchRecentGameLib();
        console.log("[libPixels] Game library obtained.");
        console.log("[libPixels] Fetching language data...");
        this.game_language_data = await this.fetchLanguageData();
        console.log("[libPixels] Language data obtained.");

        this.item_name_mapping = {};
        for (let i in this.game_library.items) {
            this.item_name_mapping[i] = this.game_language_data[i+"_name"];
        }
    }
    // Method to fetch the recent game library
    async fetchRecentGameLib() {
        const versionResponse = await fetch('/version.json');
        const clientVersion = (await versionResponse.text()).trim();

        if (!clientVersion) {
            throw new Error('Version not found in the version data');
        }

        const hashVersion = (version) => {
            const versionMap = {
                "6.122": "87bbbwei20",
                "6.209": "--78DEVO+spins"
            };

            return versionMap[version] || this.generatePixelsVersionHash(version);
        };

        const headers = { 'x-client-version': hashVersion(clientVersion) };
        
        // fetch game library
        let response = await fetch(`${this.pixelsAPIURL}/game/library?tenant=${this.pixelsTenant}&ver=${clientVersion}`, { headers });
        let game_lib = await response.json();

        // fetch ugc library
        response = await fetch(`${this.pixelsAPIURL}/game/library?tenant=${this.pixelsTenant}&ugc=true&ver=${clientVersion}`, { headers });
        let ugc_lib = await response.json();

        // merge them
        for (let key in ugc_lib) {
            let obj = ugc_lib[key];
            for (let item_key in obj) {
                let item = obj[item_key];
                game_lib[key][item_key] = item;
            }
        }

        return game_lib; 
    }
    generatePixelsVersionHash(version) {
        let hash = 0;
        for (let i = 0; i < version.length; i++) {
            const charCode = version.charCodeAt(i) + i - 17;
            hash = (hash << 5) - hash + charCode;
            hash |= 0;  // Convert to 32-bit integer
        }
        return hash;
    }
    // Method to fetch the language data
    async fetchLanguageData() {
        const response = await fetch('https://pixels-server.pixels.xyz/v1/i18n/game/en');
        return await response.json();
    }
    interceptPhaserObject(pathToObject, callback) {
        const path = pathToObject.split('.');
        let targetObject = window;
        
        // Function to traverse the object hierarchy and wait for the target object to become available
        function traverseAndSetup() {
            for (const property of path) {
                if (!targetObject[property]) {
                    setTimeout(traverseAndSetup, 5); // Retry after a short delay
                    return;
                }
                targetObject = targetObject[property];
            }
        
            // Create a proxy for the target object
            const proxy = new Proxy(targetObject, {
                construct: function (target, args) {
                    function isClass(value) {
                        return typeof value === 'function' && !!value.prototype;
                    }
        
                    let instance = !isClass(target)?target:new target(...args);
                    callback(instance); // Call the provided callback with the created instance
                    return instance;
                }
            });
        
            // Replace the original target object with the proxy
            const lastProperty = path.pop();
            const parentObject = path.reduce((obj, prop) => obj[prop], window);
            parentObject[lastProperty] = proxy;
        }
        
        // Start traversing the object hierarchy and set up interception
        traverseAndSetup();
        console.log("Game object capture in place.");
    }
    _onPixelsMessage(type, data) {
        if (this.debug_message) {
            if (type != "updatePlayer") {
                window.postMessage({ 
                    type: 'pixels_message',
                    data: {
                        type,
                        data
                    } 
                });
            }
        }

        // if we have a player update, check for the various kinds of events we may need to fire
        /*if (type == "updatePlayer") {
            let player = this.pixels_scene.stateManager.selfPlayer;
            this._onPlayerStateChange(player);
        }*/

        // if we have the taskboard message update the taskboard from it
        if (type == "sellOrders" && data.str_taskBoard_01) {
            window.postMessage({
                type: 'taskboard',
                data: data.str_taskBoard_01
            })
        }

        // if we have a marketplace purchase
        if (type == "marketplace" && data?.type == "purchase-success") {
            window.postMessage({
                type: 'marketplace_purchase',
                data: data
            })
        }

        // if we have a marketplace purchase
        if (type == "playerNotification" && data?.source == "item") {
            window.postMessage({
                type: 'item_obtain',
                data: {
                    itemId: data.stacking.key,
                    quantity: data.text.count
                }
            })
        }
    }
    updateBounds() {
        let room = this.getRoomState();

        if (!room || !this.pixels_scene) { return; }

        // also update all bounding boxes from phaser here
        let entity_bounds = {};
        let player_bounds = {};

        // when checking for mid association
        // if mid exists in room_state, use that
        // if not, find matching mapEntity_id in player_state, but USE mid of the object

        if (this.last_bounds_update < Date.now() - 250) {
            this.pixels_scene.entities.forEach(e => {
                let mid = this._id_mapping[e.mid] || e.mid;
                if (mid) {
                    entity_bounds[mid] = this.objBounds(e);
                }
            });

            // capture bounds for other players
            this.pixels_scene.otherPlayers.forEach((e, index) => {
                let mid= room.players[index]?.mid;
                if (mid) {
                    player_bounds[mid] = this.playerBounds(e);
                }
            });
            // also add the selfPlayer
            let self_mid = this.pixels_scene.selfPlayer.mid;
            player_bounds[this.player_id] = this.playerBounds(this.pixels_scene.selfPlayer);

            window.postMessage({ 
                type: 'camera', 
                data: {
                    camera: this.cameraCoords(this.pixels_scene),
                    entity_bounds,
                    player_bounds
                } 
            });
            this.last_bounds_update = Date.now();
        }

    }
    detectEntityChanges(e_old, e) {
        const server_time = this.timestampToServerTime(Date.now()); 
    
        if (!e_old) {
            return;
        }
        if (!e) {
            return;
        }
    
        if (!e.entity) {
            return; // Prevent further execution
        }    

        // if it is a mine, check mine specific event conditions
        if (e.entity.startsWith("ent_mine_")) {
            if ((cprop(e_old.generic.statics, 'minestate') != 3) && (cprop(e.generic.statics, 'minestate') == 3) && cprop(e.generic.trackers, 'inUseByMe')) {
                window.postMessage({
                    type: 'mine_started',
                    data: flattenEntity(e)
                })
            }
            if ((cprop(e_old.generic.trackers, 'quantity') > 0) && (cprop(e.generic.trackers, 'quantity') == 0)) {
                window.postMessage({
                    type: 'mine_picked',
                    data: flattenEntity(e)
                })
            }
        }
        if (e.entity.startsWith("ent_allcrops")) {
            if (e_old.generic.displayInfo.utcTarget == 0 && e.generic.displayInfo.utcTarget != 0 && (cprop(e.generic.statics, 'inUseBy') == this.player_id)) {
                window.postMessage({
                    type: 'crop_planted',
                    data: flattenEntity(e)
                })
            }
            if ((cprop(e_old.generic.statics, 'inUseBy') == this.player_id) && (cprop(e.generic.statics, 'inUseBy') != this.player_id)) {
                window.postMessage({
                    type: 'crop_picked',
                    data: flattenEntity(e)
                })
            }
        }
        // if we have an industry that crafts something, fire industry started event
        if ((cprop(e_old.generic?.trackers, 'myCraftItem') == "") && (cprop(e.generic?.trackers, 'myCraftItem') != "")) {
            window.postMessage({
                type: 'industry_started',
                data: flattenEntity(e)
            })
        }
        if ((cprop(e_old.generic?.trackers, 'myCraftItem') != "") && (cprop(e.generic?.trackers, 'myCraftItem') == "")) {
            window.postMessage({
                type: 'industry_picked',
                data: flattenEntity(e)
            })
        }

        if ((cprop(e_old.generic?.trackers, 'lastTimer') < cprop(e.generic?.trackers, 'lastTimer')) && ((cprop(e.generic?.trackers, 'lastTimer') > server_time) || (e.generic?.utcRefresh > server_time) || ((e_old.generic?.state == 0) && (e.generic?.state != 0)))) {
            window.postMessage({
                type: 'entity_started',
                data: flattenEntity(e)
            })
        }

        if ((e_old.generic?.state != "feed") && (e.generic?.state == "feed")) {
            window.postMessage({
                type: 'cow_picked',
                data: flattenEntity(e)
            })
        }

        if ((e_old.generic?.state != "bald") && (e.generic?.state == "bald")) {
            window.postMessage({
                type: 'sheep_picked',
                data: flattenEntity(e)
            })
        }
    }
    reportStorage(data) {
        const delay = 250;

        // Add data to the storage map
        this.storages[data.mapEntity_id] = data;

        // Clear existing debounce timeout
        clearTimeout(this.storage_debounce);

        // Set a new debounce timeout
        this.storage_debounce = setTimeout(() => {
            // Send all collected storages in one event
            window.postMessage({
                type: 'set_storages',
                data: JSON.parse(JSON.stringify(this.storages))
            });
            this.storages.clear(); // Clear the map after firing the event
        }, delay);
    }
    getEntity(mid) {
        if (!this.pixels_scene) { return null; }
        return this.pixels_scene.stateManager?.room?.serializer?.state?.entities[mid] || null;
    }
    getRoomState(mid) {
        if (!this.pixels_scene) { return null; }
        return this.pixels_scene.stateManager?.room?.serializer?.state || null;
    }
    getSelfPlayer() {
        return this.pixels_scene?.stateManager?.selfPlayer || null;
    }
    getServerTime() {
        let serverTimeDelta = this.pixels_scene?.stateManager.serverTimeDelta;
        let time = Date.now();
        return (time + serverTimeDelta) || time;
    }
    timestampToServerTime(timestamp) {
        return (timestamp + (this.getServerTime() - Date.now())); 
    }
    cameraCoords(scene) {
        let camera = scene.cameras.main;
      
        let cameraX = camera.worldView.x;
        let cameraY = camera.worldView.y;
        let zoomFactor = camera.zoom;
      
        return { x: cameraX, y: cameraY, zoom: zoomFactor };
    }
    objBounds(obj) {
        let spr = obj.sprites;
        if (!obj.sprites) {
            spr = obj.sprite;
        }
        
        if (spr == undefined) {
            return {
            x: 0,
            y: 0,
            width: 0,
            height: 0
            }
        }
        
        return {
            x: spr.x,
            y: spr.y,
            width: spr.displayWidth, // considering the displayWidth
            height: spr.displayHeight // considering the displayHeight
        };
    }
    playerBounds(obj) {
        let spr = obj.sprites;
        if (!obj.sprites) {
            spr = obj.sprite;
        }
        
        if (spr == undefined) {
            return {
            x: 0,
            y: 0,
            width: 0,
            height: 0
            }
        }
        
        return {
            x: obj.playerData.position.x,
            y: obj.playerData.position.y,
            width: spr.displayWidth, // considering the displayWidth
            height: spr.displayHeight // considering the displayHeight
        };
    }
}

const libpixels = new libPixels();