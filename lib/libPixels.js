let getGO = () => {}
let getState = () => {};
let getMid = () => {};

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

        this.game_instance = null;
        this.pixels_scene = null;
        this.room_state = null;
        this.player_id = null;

        this.storages = {};

        this.game_library = null;
        this.game_language_data = null;

        this.debounceMap = new Map(); // Tracks debounce states for each message type

        console.log("[libPixels] Initiating libPixels...");

        // install game object interception
        this.interceptPhaserObject("Phaser.Game", (game_instance) => {
            _self.game_instance = game_instance;
            console.log("libPixels ready, access to game object gained: ", _self.game_instance);
            getGO = () => {
                return _self.game_instance;
            }
            getMid = (mid) => {
                if (!_self.room_state) { return {} };
                return _self.room_state.entities[mid] || _self.room_state;
            }

            let _scene_update_tick = () => {
                let scene = _self.game_instance.scene.scenes[1];
                
                if (!scene) {
                    _self.pixels_scene = null;
                    return;
                }

                let player = scene.stateManager.selfPlayer;

                // install message handler interception if the scene is new
                if ((_self.pixels_scene == null) || (_self.pixels_scene !== scene)) {
           
                    let room = scene.stateManager.room;
                    room.onMessage("*", (type, data) => { 
                        _self._onPixelsMessage(type, data);
                    });
                    room.onStateChange((data) => { 
                        _self._onRoomStateChange(data);
                    });
                }

                // if we switched scenes clear the prev_state tracker and post a map change event
                if (this.pixels_scene !== scene) {
                    this.room_state = null;
                    window.postMessage({
                        type: 'map_changed',
                        data: {
                            map_name: scene.stateManager.mapId
                        }
                    })

                    // catch camera updates
                    let camera = scene.cameras.main;
                    let previousX = camera.worldView.x;
                    let previousY = camera.worldView.y;
                    let previousZoom = camera.zoom;

                    scene.events.on('update', () => {
                        const currentX = camera.worldView.x;
                        const currentY = camera.worldView.y;
                        const currentZoom = camera.zoom;

                        const tolerance = 0.1;

                        // Check if there is a significant change using the tolerance value
                        if (Math.abs(currentX - previousX) > tolerance || 
                            Math.abs(currentY - previousY) > tolerance || 
                                Math.abs(currentZoom - previousZoom) > tolerance) {
                            // Camera properties have changed, let's let the HUD know
                            window.postMessage({
                                type: "camera",
                                data: {
                                    camera: this.cameraCoords(scene)
                                }
                            })
                        }

                        // Update previous values to the current state
                        previousX = currentX;
                        previousY = currentY;
                        previousZoom = currentZoom;
                    });

                    player.entities.onAdd((value, key) => {
                        let ent = value;
                        if (ent.storage !== undefined) {
                            if (ent.entity.includes('trash')) { return; }
                            _self.setTrackedStorage(ent);
                            window.postMessage({
                                type: 'set_storage',
                                data: JSON.parse(JSON.stringify(ent))
                            });

                            ent.storage.slots.onChange((value, key) => {
                                window.postMessage({
                                    type: 'set_storage',
                                    data: JSON.parse(JSON.stringify(ent))
                                });
                            });    
                        }
                    });

                    player.inventory.onChange((value, key) => {
                        
                        window.postMessage({
                            type: 'inventory',
                            data: JSON.parse(JSON.stringify(player.inventory))
                        });
                    });
                    player.inventory.slots.onChange((value, key) => {
                        window.postMessage({
                            type: 'inventory_slot',
                            data: JSON.parse(JSON.stringify({
                                value,
                                key
                            }))
                        });
                        window.postMessage({
                            type: 'inventory',
                            data: JSON.parse(JSON.stringify(player.inventory))
                        });
                    });
                    player.coinInventory[0]?.onChange((value, key) => {
                        window.postMessage({
                            type: 'currency',
                            data: JSON.parse(JSON.stringify(player.coinInventory))
                        });
                    });
                    player.coinInventory[1]?.onChange((value, key) => {
                        window.postMessage({
                            type: 'currency',
                            data: JSON.parse(JSON.stringify(player.coinInventory))
                        });
                    });
                }

                // if we hadn't yet obtained the player name and mid, obtain them and post an event
                // also send the name mapping at this point
                if (_self.pixels_scene == null) {
                    _self.player_id = scene.playerId;
                    _self.player_name = scene.selfPlayer.username;

                    window.postMessage({
                        type: 'enter_game',
                        data: {
                            mid: this.player_id,
                            name: this.player_id,
                            game_library: this.game_library,
                            item_name_mapping: this.item_name_mapping,
                            map_name: scene.stateManager.mapId
                        }
                    });

                    // if we have storages on the initial map, send them right after the enter_game message
                    for (let i in this.storages) {
                        let s = this.storages[i];
                        window.postMessage({
                            type: 'set_storage',
                            data: JSON.parse(JSON.stringify(s))
                        });
                    }

                    window.postMessage({
                        type: 'inventory',
                        data: JSON.parse(JSON.stringify(player.inventory))
                    });
                    window.postMessage({
                        type: 'currency',
                        data: JSON.parse(JSON.stringify(player.coinInventory))
                    });
                }

                _self.pixels_scene = scene;
                
            }
            window.setInterval(_scene_update_tick, 100);
        });

        // begin fetching and parsing game metadata
        this.preparePixelsMetaData();
    }
    debounceMessage(message) {
        const type = message.type;
        if (!type) { return; }

        if (!this.debounceMap.has(type)) {
            this.debounceMap.set(type, { debounceTimeout: null, latestMessage: null });
        }

        const state = this.debounceMap.get(type);
        state.latestMessage = message;

        if (state.debounceTimeout) {
            clearTimeout(state.debounceTimeout);
        }

        state.debounceTimeout = setTimeout(() => {
            window.postMessage(state.latestMessage);
            state.debounceTimeout = null;
        }, 1000); // 1000ms = 1 second
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
        const versionResponse = await fetch('https://play.pixels.xyz/version.json');
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
        /*if (type == "updatePlayer") {
            window.postMessage({ 
                type: 'playerUpdate', 
                data 
            });
        }*/

        // if we have a player update, check for the various kinds of events we may need to fire
        if (type == "updatePlayer") {
            let player = this.pixels_scene.stateManager.selfPlayer;
            this._onPlayerStateChange(player);
        }

        // if we have the taskboard message update the taskboard from it
        if (type == "sellOrders" && data.str_taskBoard_01) {
            window.postMessage({
                type: 'taskboard',
                data: data.str_taskBoard_01
            })
        }
    }
    _onRoomStateChange(input_data) {
        const room_state = JSON.parse(JSON.stringify(input_data));
        const player_state = JSON.parse(JSON.stringify(this.getSelfPlayer()));
        this._onStateChange(room_state, player_state);
    }
    _onPlayerStateChange(input_data) {
        const room_state = JSON.parse(JSON.stringify(this.pixels_scene.stateManager.room.serializer.state));
        const player_state = JSON.parse(JSON.stringify(input_data));
        this._onStateChange(room_state, player_state);
    }
    _onStateChange (room_state, player_state) {
        let time = this.getServerTime();

        // merge statics and trackers
        for (let i in player_state.entities) {
            const entity = player_state.entities[i];
            const map_entity = room_state.entities[entity.mapEntity_id];
            //map_entity.mapEntity_id = entity.mapEntity_id;
            
            if (map_entity?.generic) {
                map_entity.generic.trackers = entity.generic.trackers;
                if (entity.generic.utcRefresh) {
                    map_entity.generic.utcRefresh = entity.generic.utcRefresh;
                }

                // if the two entities have different states use map entity state
                if (map_entity.generic?.state != entity.generic?.state) {
                    map_entity.generic.state = entity.generic?.state;
                }

                if (map_entity.generic?.current != entity.generic?.current) {
                    map_entity.generic.current = entity.generic?.current;
                }
            }

            /*if (!map_entity) {
                room_state.entities[entity.mapEntity_id] = entity;
            }*/
        }

        getState = () => { return [room_state, player_state]; }

        if (this.room_state) {
            // fire events related to state changes if necessary
            const entities = room_state.entities;
            for (let i in entities) {
                // assemble complete en
                const e = flattenEntity(entities[i]);
                const e_old = flattenEntity(this.room_state.entities[e.mid]) || null;
                
                // continue if no previous state for entity is available
                if (!e_old) { 
                    console.log("Skipping unavailable entity ", e.mid);
                    continue; 
                }
                
                // if it is a mine, check mine specific event conditions
                if (e.entity.startsWith("ent_mine_")) {
                    //console.log("Mine: ", e, e_old);
                    if ((e_old.generic.statics.minestate != 3) && (e.generic.statics.minestate == 3) && (e.generic.trackers.inUseByMe)) {
                        window.postMessage({
                            type: 'mine_started',
                            data: e
                        })
                    }
                    if ((e_old.generic.trackers.quantity > 0) && (e.generic.trackers.quantity == 0)) {
                        window.postMessage({
                            type: 'mine_picked',
                            data: e
                        })
                    }
                }
                if (e.entity.startsWith("ent_allcrops")) {
                    if ((e_old.generic.displayInfo.utcTarget == 0) && (e.generic.displayInfo.utcTarget != 0) && (e.generic.statics.inUseBy == this.player_id)) {
                        window.postMessage({
                            type: 'crop_planted',
                            data: e
                        })
                    }
                    if ((e_old.generic.statics.inUseBy == this.player_id) && (e.generic.statics.inUseBy != this.player_id)) {
                        window.postMessage({
                            type: 'crop_picked',
                            data: e
                        })
                    }
                }
                // if we have an industry that crafts something, fire industry started event
                if ((e_old.generic?.trackers.myCraftItem == "") && (e.generic?.trackers.myCraftItem != "")) {
                    window.postMessage({
                        type: 'industry_started',
                        data: e
                    })
                }
                if ((e_old.generic?.trackers.myCraftItem != "") && (e.generic?.trackers.myCraftItem == "")) {
                    window.postMessage({
                        type: 'industry_picked',
                        data: e
                    })
                }

                if ((e_old.generic?.trackers.lastTimer < e.generic?.trackers.lastTimer) && ((e.generic?.trackers.lastTimer > time) || (e.generic?.utcRefresh > time) || ((e_old.generic?.state == 0) && (e.generic?.state != 0)) )) {
                    window.postMessage({
                        type: 'entity_started',
                        data: e
                    })
                }

                if ((e_old.generic?.state != "feed") && (e.generic?.state == "feed")) {
                    window.postMessage({
                        type: 'cow_picked',
                        data: e
                    })
                }

                if ((e_old.generic?.state != "bald") && (e.generic?.state == "bald")) {
                    window.postMessage({
                        type: 'sheep_picked',
                        data: e
                    })
                }
            }
        }
        this.room_state = room_state;

        this.debounceMessage({ 
            type: 'state_change', 
            data: room_state 
        });

        // also update all bounding boxes from phaser here
        let entity_bounds = {};
        let player_bounds = {};

        // when checking for mid association
        // if mid exists in room_state, use that
        // if not, find matching mapEntity_id in player_state, but USE mid of the object

        this.pixels_scene.entities.forEach(e => {
            let mid= room_state.entities[e.mid]?.mid || player_state.entities[e.mid]?.mapEntity_id;
            if (mid) {
                entity_bounds[mid] = this.objBounds(e);
            }
        });

        // capture bounds for other players
        this.pixels_scene.otherPlayers.forEach((e, index) => {
            let mid= room_state.players[index]?.mid;
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

    }
    getEntity(mid) {
        if (!this.pixels_scene) { return null; }
        return this.pixels_scene.stateManager.room.serializer.state.entities[mid];
    }
    getSelfPlayer() {
        return this.pixels_scene.stateManager.selfPlayer;
    }
    getServerTime() {
        let serverTimeDelta = this.pixels_scene?.stateManager.serverTimeDelta;
        let time = Date.now();
        return (time - serverTimeDelta) || time;
    }
    setTrackedStorage(entity) {
        this.storages[entity.mapEntity_id] = entity;

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