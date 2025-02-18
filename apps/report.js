export default class ReportApp extends NerdHudApp {
    constructor(sys) {
        super(sys);
        this.name = "report";
    }
    event(type, data) {
        super.event(type, data);
        if (type == "report_order") {
            this.fileReport('https://pixelnerds.xyz/api/hud/save/taskboard/' + this.sys.mid, data);
        }

        // mining reports deactivated for the time being
        /*if (type == "mine_started") {
            this.fileReport('https://pixelnerds.xyz/api/hud/save/mine/' + this.sys.mid, data);
        }*/
    }
    fileReport(url, data) {
        //console.log("FILING REPORT: ", url, data);
        return new Promise((resolve, reject) => {
            try {
                if (typeof url !== "string" || typeof data !== "object" || data === null) {
                    console.error("Invalid arguments: URL must be a string and data must be a non-null object.");
                    return resolve(); // Continue execution without rejecting.
                }
    
                window.postMessage({ type: "report", url, report_data: data });
                /*(response) => {
                    if (response && response.success) {
                        resolve(response.data);
                    } else {
                        console.log(response);
                        console.warn("Error in response:", response?.error || "Unknown error occurred.");
                        resolve(); // Continue execution without rejecting.
                    }
                });*/
            } catch (error) {
                console.warn("An error occurred during the report filing:", error);
                resolve(); // Continue execution without rejecting.
            }
        });
    }
    
}
