// vim:set ts=4 sw=4 et:

const OpenDTUDisplays = [
        { name: "None", image: "",
        },
        { name: "PCD8544", image: "PCD8544.svg", // 84 x 48 pixels
            OFFSET_X: 154, OFFSET_Y: 418,
            pixel_size_x: 12.1, pixel_size_y: 14.1,
            pixel_space_x: 2, pixel_space_y: 3,
            color_background: "#99ab90", color_pixel_on: "#3f3e64", color_pixel_off: "#788463"
        },
        { name: "SSD1306", image: "SH1106.svg", // 128 x 64 pixels
            OFFSET_X: 116, OFFSET_Y: 362,
            pixel_size_x: 8.76, pixel_size_y: 7.64,
            pixel_space_x: 1, pixel_space_y: 2,
            color_background: "#121212", color_pixel_on: "#cfe2ff", color_pixel_off: "#1f1f1f"
        },
        { name: "SH1106", image: "SH1106.svg", // 128 x 64 pixels
            OFFSET_X: 116, OFFSET_Y: 362,
            pixel_size_x: 8.76, pixel_size_y: 7.64,
            pixel_space_x: 1, pixel_space_y: 2,
            color_background: "#121212", color_pixel_on: "#cfe2ff", color_pixel_off: "#1f1f1f"
        },
        { name: "SSD1309", image: "SH1106.svg", // 128 x 64 pixels
            OFFSET_X: 116, OFFSET_Y: 362,
            pixel_size_x: 8.76, pixel_size_y: 7.64,
            pixel_space_x: 1, pixel_space_y: 2,
            color_background: "#121212", color_pixel_on: "#cfe2ff", color_pixel_off: "#1f1f1f"
        },
        { name: "ST7567_GM12864I_59N", image: "SH1106.svg", // 128 x 64 pixels
            OFFSET_X: 116, OFFSET_Y: 362,
            pixel_size_x: 8.76, pixel_size_y: 7.64,
            pixel_space_x: 1, pixel_space_y: 2,
            color_background: "#121212", color_pixel_on: "#cfe2ff", color_pixel_off: "#1f1f1f"
        },
    ];


// small helper functions
function unhexlifyToInt(str) {
    const ret = [];
    for (let i=0, l=str.length; i<l; i+=2) {
      ret.push(parseInt(str.substr(i, 2), 16));
    }
    return ret;
}

function heatMapColorForValue(value) {
    /*
     expect:    0 <= value <= 1.0
     retrun: a "heatmap" color where 0 is cold and 1 is hot

     */
    const h = (1.0 - value) * 240
    return "hsl(" + h + ", 100%, 50%)";
}


// The WebDisplay
class OpenDTUWebDisplay {
    #_lineBufferyHistory = [];
    #_lineBufferyHistoryMax = 1;

    #_displayType = -1;
    #_displayHeight = 64;
    #_displayWidth = 128;
    #_bufferTileHeight = 8;
    #_bufferTileWidth = 16;
    //#_bufferContent = "";

    #_canvas=null;
    #_timer=null;
    #_dataUrl = "";
    #_refreshRate = -1;
    #_pictureGetsLoaded = 0;

    constructor(canvas, dataUrl, refreshRate) {
        this.#_canvas = canvas;
        this.#_dataUrl = dataUrl;
        this.refreshRate = refreshRate;
    }

    loadDataPeriodic() {
        fetch(this.#_dataUrl, {
                        "method": "GET",
                        "headers": {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*"
                        }
            })
        .then((response) => response.json())
        .then((json) => this.processDisplayJson(json));
    }

    processDisplayJson(json) {
        this.displayType = json.DisplayType;
        if (this.#_pictureGetsLoaded > 0) {
            return;
        }
        if (!this.isValidDisplay(json.DisplayType)) {
            return;
        }

        this.#_displayHeight = json.DisplayHeight;
        this.#_displayWidth = json.DisplayWidth;
        this.#_bufferTileHeight = json.BufferTileHeight;
        this.#_bufferTileWidth = json.BufferTileWidth;

        this.drawDisplayPixels(this.#_canvas, json.BufferContent);
    }

    set lineBufferHistoryMax(maxEntries) {
        this.#_lineBufferyHistoryMax = maxEntries;
    }

    set refreshRate(rate) {
        if (this.#_refreshRate == rate) {
            return;
        }
        if (this.#_timer !== null) {
            clearInterval(this.#_timer);
        }
        if (rate <= 0) {
            // Freeze the display
            return;
        }
        this.#_refreshRate = rate;
        const self = this;
        const callback = function() { self.loadDataPeriodic(); };
        this.#_timer = setInterval( callback, rate );
    }

    lineBufferHeatMapColors() {
        /* transform the history of linebuffers into an array of colors for a heat map */
        const rows = this.#_bufferTileHeight * 8;
        const columns = this.#_bufferTileWidth * 8;
        const linbuffers_length = this.#_lineBufferyHistory.length;

        const heatmapLineBuffer = Array(rows).fill().map(() => Array(columns).fill(0));

        for(let y=0; y < rows; y++) {
            for(let x=0; x < columns; x++) {
                let v = 0;
                for(let lb_history=0; lb_history < linbuffers_length; lb_history++) {
                    v += this.#_lineBufferyHistory[lb_history][y][x];
                }
                heatmapLineBuffer[y][x] = heatMapColorForValue((1.0 * v) / linbuffers_length);
            }
        }
        return heatmapLineBuffer;
    }

    set displayType(type) {
        if (this.#_displayType == type) {
            return;
        }

        if (this.#_pictureGetsLoaded > 0) {
            return;
        }

        if (!this.isValidDisplay(type)) {
            this.#_displayType = type;
            return;
        }

        const display = OpenDTUDisplays[type];
        if (display.image.length == 0) {
            this.#_displayType = type;
            return;
        }

        const self = this;
        this.#_pictureGetsLoaded++;
        this.#_lineBufferyHistory = []; // clear "history"

        let img = new Image();
        img.onload = function () { // picture was loaded
            /* clear the whole canvas */
            self.#_canvas.beginPath();
            self.#_canvas.rect(0, 0, canvas.width, canvas.height);
            self.#_canvas.fillStyle = "#FFFFFF";
            self.#_canvas.fill();
            self.#_canvas.closePath();

            // keep aspekt ratio
            let r = Math.min(canvas.width / img.width, canvas.height / img.height);
            //console.log(r);
            self.#_canvas.drawImage(img, 0, 0, img.width * r, img.height * r);
            self.#_displayType = type;
            self.#_pictureGetsLoaded--;
        }
        img.onerror = function() {
            self.#_pictureGetsLoaded--;
        }
        img.crossOrigin = 'anonymous';
        img.src = display.image;
    }

    isValidDisplay(type) {
        return (type >= 1 && type < OpenDTUDisplays.length);
    }


    displayBufferToLineBuffer(displayBuffer) {
        const rows = this.#_bufferTileHeight * 8;
        const columns = this.#_bufferTileWidth * 8;

        // Initalize the returning line buffer array with 0
        let lineBuffer = Array(rows).fill().map(() => Array(columns).fill(0));
        let bufferContentAsInts = unhexlifyToInt(displayBuffer);

        let offset = 0;
        for (let y = 0; y < rows; y+=8) {
            for (let x = 0; x < columns; x++) {
                for (let yy = 0, bitMask = 0x01; yy < 8; yy++, bitMask<<=1) {
                    if ((bufferContentAsInts[offset] & bitMask) != 0) {
                        lineBuffer[y+yy][x] = 1;
                    }
                }
                offset++;
            }
        }
        return lineBuffer;
    }


    drawDisplayPixels(canvas, displayBuffer) {
        const rows = this.#_displayHeight;
        const columns = this.#_displayWidth;

        let lineBuffer = this.displayBufferToLineBuffer(displayBuffer);

        this.#_lineBufferyHistory.push(lineBuffer);
        while (this.#_lineBufferyHistory.length > this.#_lineBufferyHistoryMax) {
            this.#_lineBufferyHistory.shift();
        }

        const display = OpenDTUDisplays[this.#_displayType];
        const offset_x = display.OFFSET_X;
        const offset_y = display.OFFSET_Y;
        const pixel_size_x = display.pixel_size_x;
        const pixel_size_y = display.pixel_size_y;
        const pixel_space_x = display.pixel_space_x;
        const pixel_space_y = display.pixel_space_y;
        const color_background = display.color_background;
        const color_pixel_on = display.color_pixel_on;
        const color_pixel_off = display.color_pixel_off;

        const useHeadmap = this.#_lineBufferyHistoryMax > 1;
        if (useHeadmap) {
            lineBuffer = this.lineBufferHeatMapColors();
        }

        // draw the dots of the display
        let ypos = offset_y;
        for (let y=0; y < rows; y++) {
            let xpos = offset_x;
            for (let x=0; x < columns; x++) {

                canvas.beginPath();
                canvas.rect(xpos, ypos, pixel_size_x, pixel_size_y);
                if (useHeadmap) {
                    canvas.fillStyle = lineBuffer[y][x];
                } else {
                    if (lineBuffer[y][x]) {
                        canvas.fillStyle = color_pixel_on;
                    } else {
                        canvas.fillStyle = color_pixel_off;
                    }
                }
                canvas.fill();
                canvas.closePath();
                xpos += pixel_size_x + pixel_space_x;
            }
            ypos += pixel_size_y + pixel_space_y;
        }

        // draw the pixels between the dots (from top to bottom)
        if (pixel_space_x != 0) {
            let xpos = offset_x;
            for (let x=0; x < columns-1; x++) {
                xpos += pixel_size_x;

                canvas.beginPath();
                canvas.rect(xpos, offset_y, pixel_space_x, rows * (pixel_size_y + pixel_space_y) - pixel_space_y);
                canvas.fillStyle = color_background;
                canvas.fill();
                canvas.closePath();

                xpos += pixel_space_x;
            }
        }

        // draw the pixels between the dots (from left to right)
        if (pixel_space_y != 0) {
            let ypos = offset_y;
            for (let y=0; y < rows-1; y++) {
                ypos += pixel_size_y;

                canvas.beginPath();
                canvas.rect(offset_x, ypos, columns * (pixel_size_x + pixel_space_x) - pixel_space_x, pixel_space_y);
                canvas.fillStyle = color_background;
                canvas.fill();
                canvas.closePath();

                ypos += pixel_space_y;
            }
        }
    }
} // End of Class
