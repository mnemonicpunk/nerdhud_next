const UPDATE_INTERVAL_MINUTES = 5;
const MY_LISTINGS_UPDATE_INTERVAL_MINUTES = 1;

export default class MarketApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "market";
        this.price_data = {};
        this.my_listings = null;
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
                    var: 'market_refresh_seconds',
                    type: 'number',
                    default: (5*60),
                    description: 'The number in seconds until market prices will be refreshed from the server.<br><div style="color: #faa;">WARNING: Setting this too low may get you temporarily blocked from the game.</div>'
                },
                {
                    name: 'My Listings Refresh Cooldown',
                    var: 'my_listings_refresh_seconds',
                    type: 'number',
                    default: 60,
                    description: 'The number in seconds until your market listings will be refreshed from the server.<br><div style="color: #faa;">WARNING: Setting this too low may get you temporarily blocked from the game.</div>'
                },
                {
                    name: 'Undercut Warnings',
                    var: 'undercut_warnings',
                    type: 'bool',
                    default: false,
                    description: 'Show a notification when your market listing prices get undercut.'
                }
            ]
        }
    }
    updatePrices() {
        const settings = this.getSettings();

        if (this.last_update + (1000 * settings.market_refresh_seconds) < Date.now()) {
            this.last_update = Date.now();
            fetch("https://pixels-server.pixels.xyz/cache/marketplace/listings/count").then(async (response) => {
                this.price_data = await response.json();
            }).catch(e => {
                console.log("The following error occurred when trying to get market prices: ", e);
            });
            //https://pixels-server.pixels.xyz/v1/marketplace/player/6568291f4bba74cc5516123a
            
        }
        if (this.last_my_listings_update + (1000 * settings.my_listings_refresh_seconds) < Date.now()) {
            if (this.sys.mid) {
                this.last_my_listings_update = Date.now();
                fetch("https://pixels-server.pixels.xyz/v1/marketplace/player/" + this.sys.mid).then(async (response) => {
                    const new_listings = await response.json();
                    this.updateListings(new_listings);
                    this.my_listings = new_listings;
                }).catch(e => {
                    console.log("The following error occurred when trying to get player marketplace listings: ", e);
                });

            }
        }
    }
    updateListings(new_listings) {
        if (!new_listings) { return; }

        let old_listings = this.my_listings;
        for (let i in new_listings.listings) {
            let l = new_listings.listings?.[i];
            let old = old_listings?.listings?.[i] || null;
            if (!l.marketPrice) {
                l.marketPrice = this.getPrice(l.itemId);
            }

            if (old && (l.marketPrice < l.price) && (l.marketPrice < old.marketPrice)) {
                const settings = this.getSettings();
                if (settings.undercut_warnings) {
                    const show_notification = this.importAppFunction("notification.show");
                    const title = "Listing " + this.sys.getItemName(l.itemId) + " undercut on market!";
                    const message = "Your price is " + l.price + ", current price is " + l.marketPrice + "!";
                    show_notification(title, message);
                }
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