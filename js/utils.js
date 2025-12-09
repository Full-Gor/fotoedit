/**
 * FotoEdit - Utilitaires
 * Fonctions utilitaires pour l'éditeur d'images
 */

const Utils = {
    /**
     * Convertir une couleur hexadécimale en RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    /**
     * Convertir RGB en hexadécimal
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    },

    /**
     * Convertir RGB en HSL
     */
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return { h: h * 360, s: s * 100, l: l * 100 };
    },

    /**
     * Convertir HSL en RGB
     */
    hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    },

    /**
     * Clamper une valeur entre min et max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Interpolation linéaire
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Distance entre deux points
     */
    distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },

    /**
     * Angle entre deux points (en radians)
     */
    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    /**
     * Générer un ID unique
     */
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Débounce une fonction
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle une fonction
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Créer un canvas temporaire
     */
    createTempCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    },

    /**
     * Copier le contenu d'un canvas vers un autre
     */
    copyCanvas(source, target) {
        target.width = source.width;
        target.height = source.height;
        const ctx = target.getContext('2d');
        ctx.drawImage(source, 0, 0);
    },

    /**
     * Obtenir les données d'image d'un canvas
     */
    getImageData(canvas) {
        const ctx = canvas.getContext('2d');
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    },

    /**
     * Appliquer les données d'image à un canvas
     */
    putImageData(canvas, imageData) {
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
    },

    /**
     * Charger une image depuis une URL ou un fichier
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    /**
     * Charger une image depuis un fichier
     */
    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.loadImage(e.target.result)
                    .then(resolve)
                    .catch(reject);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Exporter un canvas en data URL
     */
    canvasToDataURL(canvas, format = 'png', quality = 0.92) {
        const mimeType = format === 'jpeg' ? 'image/jpeg' :
                        format === 'webp' ? 'image/webp' : 'image/png';
        return canvas.toDataURL(mimeType, quality);
    },

    /**
     * Télécharger un fichier
     */
    downloadFile(dataURL, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Appliquer une convolution à une image
     */
    applyConvolution(imageData, kernel, divisor = 1) {
        const src = imageData.data;
        const sw = imageData.width;
        const sh = imageData.height;
        const kSize = Math.sqrt(kernel.length);
        const half = Math.floor(kSize / 2);

        const output = new Uint8ClampedArray(src.length);

        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                let r = 0, g = 0, b = 0;

                for (let ky = 0; ky < kSize; ky++) {
                    for (let kx = 0; kx < kSize; kx++) {
                        const px = this.clamp(x + kx - half, 0, sw - 1);
                        const py = this.clamp(y + ky - half, 0, sh - 1);
                        const idx = (py * sw + px) * 4;
                        const kVal = kernel[ky * kSize + kx];

                        r += src[idx] * kVal;
                        g += src[idx + 1] * kVal;
                        b += src[idx + 2] * kVal;
                    }
                }

                const dstIdx = (y * sw + x) * 4;
                output[dstIdx] = this.clamp(r / divisor, 0, 255);
                output[dstIdx + 1] = this.clamp(g / divisor, 0, 255);
                output[dstIdx + 2] = this.clamp(b / divisor, 0, 255);
                output[dstIdx + 3] = src[dstIdx + 3];
            }
        }

        return new ImageData(output, sw, sh);
    },

    /**
     * Flood fill algorithm (bucket tool)
     */
    floodFill(imageData, startX, startY, fillColor, tolerance = 0) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        startX = Math.floor(startX);
        startY = Math.floor(startY);

        const startIdx = (startY * width + startX) * 4;
        const startR = data[startIdx];
        const startG = data[startIdx + 1];
        const startB = data[startIdx + 2];
        const startA = data[startIdx + 3];

        const fillR = fillColor.r;
        const fillG = fillColor.g;
        const fillB = fillColor.b;
        const fillA = fillColor.a !== undefined ? fillColor.a : 255;

        // Si la couleur de départ est la même que la couleur de remplissage, ne rien faire
        if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) {
            return imageData;
        }

        const colorMatch = (idx) => {
            const dr = Math.abs(data[idx] - startR);
            const dg = Math.abs(data[idx + 1] - startG);
            const db = Math.abs(data[idx + 2] - startB);
            const da = Math.abs(data[idx + 3] - startA);
            return dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance;
        };

        const stack = [[startX, startY]];
        const visited = new Set();

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;

            if (x < 0 || x >= width || y < 0 || y >= height || visited.has(key)) {
                continue;
            }

            const idx = (y * width + x) * 4;

            if (!colorMatch(idx)) {
                continue;
            }

            visited.add(key);

            data[idx] = fillR;
            data[idx + 1] = fillG;
            data[idx + 2] = fillB;
            data[idx + 3] = fillA;

            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }

        return imageData;
    },

    /**
     * Bresenham's line algorithm
     */
    getLinePoints(x0, y0, x1, y1) {
        const points = [];
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            points.push({ x: x0, y: y0 });

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }

        return points;
    },

    /**
     * Dessiner un cercle rempli
     */
    fillCircle(ctx, x, y, radius) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    },

    /**
     * Créer un pinceau avec douceur
     */
    createBrushPattern(size, hardness) {
        const canvas = document.createElement('canvas');
        canvas.width = size * 2;
        canvas.height = size * 2;
        const ctx = canvas.getContext('2d');

        const center = size;
        const innerRadius = size * (hardness / 100);
        const outerRadius = size;

        const gradient = ctx.createRadialGradient(
            center, center, innerRadius,
            center, center, outerRadius
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size * 2, size * 2);

        return canvas;
    }
};

// Export pour utilisation globale
window.Utils = Utils;
