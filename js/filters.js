/**
 * FotoEdit - Filtres d'image
 * Filtres et effets visuels
 */

const Filters = {
    /**
     * Appliquer un filtre niveaux de gris
     */
    grayscale(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            data[i] = avg;
            data[i + 1] = avg;
            data[i + 2] = avg;
        }
        return imageData;
    },

    /**
     * Appliquer un filtre sépia
     */
    sepia(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
            data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
            data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }
        return imageData;
    },

    /**
     * Inverser les couleurs
     */
    invert(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }
        return imageData;
    },

    /**
     * Appliquer un flou gaussien
     */
    blur(imageData, radius = 5) {
        const kernel = this.createGaussianKernel(radius);
        return Utils.applyConvolution(imageData, kernel, kernel.reduce((a, b) => a + b, 0));
    },

    /**
     * Créer un noyau gaussien
     */
    createGaussianKernel(radius) {
        const size = radius * 2 + 1;
        const kernel = [];
        const sigma = radius / 3;
        let sum = 0;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - radius;
                const dy = y - radius;
                const g = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
                kernel.push(g);
                sum += g;
            }
        }

        // Normaliser
        return kernel.map(v => v / sum);
    },

    /**
     * Appliquer une netteté (sharpen)
     */
    sharpen(imageData, amount = 1) {
        const kernel = [
            0, -amount, 0,
            -amount, 1 + 4 * amount, -amount,
            0, -amount, 0
        ];
        return Utils.applyConvolution(imageData, kernel, 1);
    },

    /**
     * Appliquer un effet vignette
     */
    vignette(imageData, intensity = 0.5, radius = 0.7) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
        const innerRadius = maxDistance * radius;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

                if (distance > innerRadius) {
                    const factor = 1 - ((distance - innerRadius) / (maxDistance - innerRadius)) * intensity;
                    data[idx] *= factor;
                    data[idx + 1] *= factor;
                    data[idx + 2] *= factor;
                }
            }
        }

        return imageData;
    },

    /**
     * Détection des contours
     */
    edgeDetect(imageData) {
        const kernel = [
            -1, -1, -1,
            -1, 8, -1,
            -1, -1, -1
        ];
        return Utils.applyConvolution(imageData, kernel, 1);
    },

    /**
     * Effet emboss (relief)
     */
    emboss(imageData) {
        const kernel = [
            -2, -1, 0,
            -1, 1, 1,
            0, 1, 2
        ];
        return Utils.applyConvolution(imageData, kernel, 1);
    },

    /**
     * Posterisation
     */
    posterize(imageData, levels = 4) {
        const data = imageData.data;
        const step = 255 / levels;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] / step) * step;
            data[i + 1] = Math.round(data[i + 1] / step) * step;
            data[i + 2] = Math.round(data[i + 2] / step) * step;
        }

        return imageData;
    },

    /**
     * Effet pixelisé
     */
    pixelate(imageData, blockSize = 10) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                let r = 0, g = 0, b = 0, count = 0;

                // Calculer la moyenne du bloc
                for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
                        const idx = ((y + dy) * width + (x + dx)) * 4;
                        r += data[idx];
                        g += data[idx + 1];
                        b += data[idx + 2];
                        count++;
                    }
                }

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                // Appliquer la couleur moyenne à tout le bloc
                for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
                        const idx = ((y + dy) * width + (x + dx)) * 4;
                        data[idx] = r;
                        data[idx + 1] = g;
                        data[idx + 2] = b;
                    }
                }
            }
        }

        return imageData;
    },

    /**
     * Ajouter du bruit
     */
    noise(imageData, amount = 30) {
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * amount * 2;
            data[i] = Utils.clamp(data[i] + noise, 0, 255);
            data[i + 1] = Utils.clamp(data[i + 1] + noise, 0, 255);
            data[i + 2] = Utils.clamp(data[i + 2] + noise, 0, 255);
        }

        return imageData;
    },

    /**
     * Appliquer un filtre de couleur
     */
    colorFilter(imageData, filterColor, intensity = 0.5) {
        const data = imageData.data;
        const rgb = Utils.hexToRgb(filterColor);

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Utils.lerp(data[i], rgb.r, intensity);
            data[i + 1] = Utils.lerp(data[i + 1], rgb.g, intensity);
            data[i + 2] = Utils.lerp(data[i + 2], rgb.b, intensity);
        }

        return imageData;
    },

    /**
     * Appliquer un flou de mouvement
     */
    motionBlur(imageData, angle = 0, distance = 10) {
        const radians = angle * Math.PI / 180;
        const dx = Math.cos(radians);
        const dy = Math.sin(radians);
        const kernel = [];
        const size = distance * 2 + 1;

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const offsetX = j - distance;
                const offsetY = i - distance;
                const projection = Math.round(offsetX * dx + offsetY * dy);
                kernel.push(projection === 0 ? 1 : 0);
            }
        }

        const sum = kernel.reduce((a, b) => a + b, 0);
        return Utils.applyConvolution(imageData, kernel, sum || 1);
    }
};

// Export pour utilisation globale
window.Filters = Filters;
