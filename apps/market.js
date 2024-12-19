const UPDATE_INTERVAL_MINUTES = 5;

export default class MarketApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "market";
        this.price_data = {};
        this.last_update = 0;
        this.updatePrices();
    }
    onCreate() {
        this.exportAppFunction("price", (item) => {
            return this.getPrice(item);
        });


    }
    event(type, data) {
        if (type == "enter_game" || type == "update") {
            this.updatePrices();
        }
    }
    updatePrices() {
        if (this.last_update + (60000 * UPDATE_INTERVAL_MINUTES) < Date.now()) {
            this.last_update = Date.now();
            fetch("https://pixels-server.pixels.xyz/cache/marketplace/listings/count").then(async (response) => {
                this.price_data = await response.json();
            });
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
}