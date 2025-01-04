const UPDATE_INTERVAL_MINUTES = 5;
const MY_LISTINGS_UPDATE_INTERVAL_MINUTES = 1;

export default class MarketApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "market";
        this.price_data = {};
        this.my_listings = [];
        this.last_update = 0;
        this.last_my_listings_update = 0;
        this.updatePrices();
    }
    onCreate() {
        super.onCreate();
        this.exportAppFunction("price", (item) => {
            return this.getPrice(item);
        });
        this.exportAppFunction("my_listings", (item) => {
            return this.getMyListings();
        });
    }
    event(type, data) {
        if (type == "enter_game" || type == "update") {
            this.updatePrices();
        }
    }
    declareSettings() {
        return {
            title: 'Market',
            settings: [
                {
                    name: 'Market Price Refresh Cooldown',
                    var: 'market_refresh',
                    type: 'number',
                    default: 5,
                    description: 'The number in minutes until market prices will be refreshed from the server.<br><div style="color: #faa;">WARNING: Setting this too low may get you temporarily blocked from the game.</div>'
                },
                {
                    name: 'My Listings Refresh Cooldown',
                    var: 'my_listings_refresh',
                    type: 'number',
                    default: 1,
                    description: 'The number in minutes until your market listings will be refreshed from the server.<br><div style="color: #faa;">WARNING: Setting this too low may get you temporarily blocked from the game.</div>'
                }
            ]
        }
    }
    updatePrices() {
        const settings = this.getSettings();

        if (this.last_update + (60000 * settings.market_refresh) < Date.now()) {
            this.last_update = Date.now();
            fetch("https://pixels-server.pixels.xyz/cache/marketplace/listings/count").then(async (response) => {
                this.price_data = await response.json();
            });
            //https://pixels-server.pixels.xyz/v1/marketplace/player/6568291f4bba74cc5516123a
            
        }
        if (this.last_my_listings_update + (60000 * settings.my_listings_refresh) < Date.now()) {
            if (this.sys.mid) {
                this.last_my_listings_update = Date.now();
                fetch("https://pixels-server.pixels.xyz/v1/marketplace/player/" + this.sys.mid).then(async (response) => {
                    this.my_listings = await response.json();
                });

            }
        }
    }
    decompressData(compressedData) {
        const byteArray = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0));
        const data = JSON.parse(pako.inflate(byteArray, { to: 'string' }));
        return data;
    }
    getPrice(item) {
        if (!this.price_data?.prices) { return 0; }
        return this.price_data?.prices[item] || 0;
    }
    getMyListings() {
        return this.my_listings?.listings;
    }
}