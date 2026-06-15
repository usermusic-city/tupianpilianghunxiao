// 加密解密逻辑保持不变，仅用于Web Worker
class Obfuscator {
    constructor(w, h) {
        this.w = w; this.h = h; this.total = w * h;
        this.curveX = new Int32Array(this.total);
        this.curveY = new Int32Array(this.total);
        this.currentIndex = 0;
    }
    generate2d(x, y, ax, ay, bx, by) {
        let w = Math.abs(ax + ay), h = Math.abs(bx + by);
        let dax = Math.sign(ax), day = Math.sign(ay);
        let dbx = Math.sign(bx), dby = Math.sign(by);
        if (h === 1) { for (let i = 0; i < w; i++) { this.curveX[this.currentIndex] = x; this.curveY[this.currentIndex] = y; this.currentIndex++; x += dax; y += day; } return; }
        if (w === 1) { for (let i = 0; i < h; i++) { this.curveX[this.currentIndex] = x; this.curveY[this.currentIndex] = y; this.currentIndex++; x += dbx; y += dby; } return; }
        let ax2 = Math.trunc(ax / 2), ay2 = Math.trunc(ay / 2), bx2 = Math.trunc(bx / 2), by2 = Math.trunc(by / 2);
        if (2 * w > 3 * h) {
            if ((Math.abs(ax2 + ay2) % 2 !== 0) && (w > 2)) { ax2 += dax; ay2 += day; }
            this.generate2d(x, y, ax2, ay2, bx, by);
            this.generate2d(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by);
        } else {
            if ((Math.abs(bx2 + by2) % 2 !== 0) && (h > 2)) { bx2 += dbx; by2 += dby; }
            this.generate2d(x, y, bx2, by2, ax2, ay2);
            this.generate2d(x + bx2, y + by2, ax, ay, bx - bx2, by - by2);
            this.generate2d(x + (ax - dax) + (bx2 - dbx), y + (ay - day) + (by2 - dby), -bx2, -by2, -(ax - ax2), -(ay - ay2));
        }
    }
}

self.onmessage = async function(e) {
    const { file, isEncrypt, width, height } = e.data;
    try {
        const img = await createImageBitmap(file);
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = new Uint32Array(imageData.data.buffer);
        const res = new Uint32Array(pixels.length);
        
        const obs = new Obfuscator(width, height);
        if (width >= height) obs.generate2d(0, 0, width, 0, 0, height);
        else obs.generate2d(0, 0, 0, height, width, 0);

        const offset = Math.round(((Math.sqrt(5) - 1) / 2) * obs.total);
        for (let i = 0; i < obs.total; i++) {
            const targetIdx = (i + offset) % obs.total;
            const x1 = obs.curveX[i], y1 = obs.curveY[i];
            const x2 = obs.curveX[targetIdx], y2 = obs.curveY[targetIdx];
            if (isEncrypt) res[y2 * width + x2] = pixels[y1 * width + x1];
            else res[y1 * width + x1] = pixels[y2 * width + x2];
        }

        imageData.data.set(new Uint8ClampedArray(res.buffer));
        ctx.putImageData(imageData, 0, 0);
        const blob = await new Promise(resolve => canvas.convertToBlob(resolve, 'image/png'));
        self.postMessage({ success: true, blob });
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
};