/**
 * FotoEdit - Ajustements d'image
 * Réglages de luminosité, contraste, teinte, saturation, etc.
 */

const Adjustments = {
    /**
     * Ajuster la luminosité
     * @param {ImageData} imageData - Les données d'image
     * @param {number} value - Valeur de -100 à 100
     */
    brightness(imageData, value) {
        const data = imageData.data;
        const factor = (value / 100) * 255;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Utils.clamp(data[i] + factor, 0, 255);
            data[i + 1] = Utils.clamp(data[i + 1] + factor, 0, 255);
            data[i + 2] = Utils.clamp(data[i + 2] + factor, 0, 255);
        }

        return imageData;
    },

    /**
     * Ajuster le contraste
     * @param {ImageData} imageData - Les données d'image
     * @param {number} value - Valeur de -100 à 100
     */
    contrast(imageData, value) {
        const data = imageData.data;
        const factor = (259 * (value + 255)) / (255 * (259 - value));

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Utils.clamp(factor * (data[i] - 128) + 128, 0, 255);
            data[i + 1] = Utils.clamp(factor * (data[i + 1] - 128) + 128, 0, 255);
            data[i + 2] = Utils.clamp(factor * (data[i + 2] - 128) + 128, 0, 255);
        }

        return imageData;
    },

    /**
     * Ajuster la luminosité et le contraste en une seule passe
     */
    brightnessContrast(imageData, brightness, contrast) {
        const data = imageData.data;
        const brightFactor = (brightness / 100) * 255;
        const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
            // Appliquer d'abord le contraste, puis la luminosité
            data[i] = Utils.clamp(contrastFactor * (data[i] - 128) + 128 + brightFactor, 0, 255);
            data[i + 1] = Utils.clamp(contrastFactor * (data[i + 1] - 128) + 128 + brightFactor, 0, 255);
            data[i + 2] = Utils.clamp(contrastFactor * (data[i + 2] - 128) + 128 + brightFactor, 0, 255);
        }

        return imageData;
    },

    /**
     * Ajuster la teinte (hue)
     * @param {ImageData} imageData - Les données d'image
     * @param {number} value - Valeur de -180 à 180 degrés
     */
    hue(imageData, value) {
        const data = imageData.data;
        const shift = value;

        for (let i = 0; i < data.length; i += 4) {
            const hsl = Utils.rgbToHsl(data[i], data[i + 1], data[i + 2]);
            hsl.h = (hsl.h + shift + 360) % 360;
            const rgb = Utils.hslToRgb(hsl.h, hsl.s, hsl.l);

            data[i] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
        }

        return imageData;
    },

    /**
     * Ajuster la saturation
     * @param {ImageData} imageData - Les données d'image
     * @param {number} value - Valeur de -100 à 100
     */
    saturation(imageData, value) {
        const data = imageData.data;
        const factor = 1 + value / 100;

        for (let i = 0; i < data.length; i += 4) {
            const hsl = Utils.rgbToHsl(data[i], data[i + 1], data[i + 2]);
            hsl.s = Utils.clamp(hsl.s * factor, 0, 100);
            const rgb = Utils.hslToRgb(hsl.h, hsl.s, hsl.l);

            data[i] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
        }

        return imageData;
    },

    /**
     * Ajuster la luminance (lightness)
     * @param {ImageData} imageData - Les données d'image
     * @param {number} value - Valeur de -100 à 100
     */
    lightness(imageData, value) {
        const data = imageData.data;
        const factor = value / 100;

        for (let i = 0; i < data.length; i += 4) {
            const hsl = Utils.rgbToHsl(data[i], data[i + 1], data[i + 2]);

            if (factor > 0) {
                hsl.l = hsl.l + (100 - hsl.l) * factor;
            } else {
                hsl.l = hsl.l + hsl.l * factor;
            }

            const rgb = Utils.hslToRgb(hsl.h, hsl.s, hsl.l);

            data[i] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
        }

        return imageData;
    },

    /**
     * Ajuster teinte, saturation et luminance en une seule passe
     */
    hueSaturationLightness(imageData, hueShift, saturationFactor, lightnessFactor) {
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const hsl = Utils.rgbToHsl(data[i], data[i + 1], data[i + 2]);

            // Teinte
            hsl.h = (hsl.h + hueShift + 360) % 360;

            // Saturation
            hsl.s = Utils.clamp(hsl.s * (1 + saturationFactor / 100), 0, 100);

            // Luminance
            if (lightnessFactor > 0) {
                hsl.l = hsl.l + (100 - hsl.l) * (lightnessFactor / 100);
            } else {
                hsl.l = hsl.l + hsl.l * (lightnessFactor / 100);
            }

            const rgb = Utils.hslToRgb(hsl.h, hsl.s, hsl.l);

            data[i] = rgb.r;
            data[i + 1] = rgb.g;
            data[i + 2] = rgb.b;
        }

        return imageData;
    },

    /**
     * Ajuster la balance des blancs (température et teinte)
     * @param {ImageData} imageData - Les données d'image
     * @param {number} temperature - Valeur de -100 (froid) à 100 (chaud)
     * @param {number} tint - Valeur de -100 (vert) à 100 (magenta)
     */
    whiteBalance(imageData, temperature, tint) {
        const data = imageData.data;

        // Température : ajuste le rouge et le bleu
        const tempFactor = temperature / 100;
        // Teinte : ajuste le vert et le magenta
        const tintFactor = tint / 100;

        for (let i = 0; i < data.length; i += 4) {
            // Température
            if (tempFactor > 0) {
                // Plus chaud (ajouter du rouge, réduire le bleu)
                data[i] = Utils.clamp(data[i] + tempFactor * 50, 0, 255);
                data[i + 2] = Utils.clamp(data[i + 2] - tempFactor * 50, 0, 255);
            } else {
                // Plus froid (réduire le rouge, ajouter du bleu)
                data[i] = Utils.clamp(data[i] + tempFactor * 50, 0, 255);
                data[i + 2] = Utils.clamp(data[i + 2] - tempFactor * 50, 0, 255);
            }

            // Teinte
            if (tintFactor > 0) {
                // Plus magenta (réduire le vert)
                data[i + 1] = Utils.clamp(data[i + 1] - tintFactor * 30, 0, 255);
            } else {
                // Plus vert (ajouter du vert)
                data[i + 1] = Utils.clamp(data[i + 1] - tintFactor * 30, 0, 255);
            }
        }

        return imageData;
    },

    /**
     * Ajuster les ombres et les hautes lumières
     * @param {ImageData} imageData - Les données d'image
     * @param {number} shadows - Valeur de -100 à 100
     * @param {number} highlights - Valeur de -100 à 100
     */
    shadowsHighlights(imageData, shadows, highlights) {
        const data = imageData.data;
        const shadowFactor = shadows / 100;
        const highlightFactor = highlights / 100;

        for (let i = 0; i < data.length; i += 4) {
            const luminance = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;

            // Calculer le facteur d'ajustement basé sur la luminance
            let adjustment = 0;

            if (luminance < 0.5) {
                // Ombres
                const shadowWeight = 1 - luminance * 2;
                adjustment = shadowFactor * shadowWeight * 50;
            } else {
                // Hautes lumières
                const highlightWeight = (luminance - 0.5) * 2;
                adjustment = highlightFactor * highlightWeight * 50;
            }

            data[i] = Utils.clamp(data[i] + adjustment, 0, 255);
            data[i + 1] = Utils.clamp(data[i + 1] + adjustment, 0, 255);
            data[i + 2] = Utils.clamp(data[i + 2] + adjustment, 0, 255);
        }

        return imageData;
    },

    /**
     * Ajuster l'exposition
     * @param {ImageData} imageData - Les données d'image
     * @param {number} value - Valeur de -100 à 100
     */
    exposure(imageData, value) {
        const data = imageData.data;
        const factor = Math.pow(2, value / 100);

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Utils.clamp(data[i] * factor, 0, 255);
            data[i + 1] = Utils.clamp(data[i + 1] * factor, 0, 255);
            data[i + 2] = Utils.clamp(data[i + 2] * factor, 0, 255);
        }

        return imageData;
    },

    /**
     * Ajuster le gamma
     * @param {ImageData} imageData - Les données d'image
     * @param {number} value - Valeur de 0.1 à 4
     */
    gamma(imageData, value) {
        const data = imageData.data;
        const correction = 1 / value;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 * Math.pow(data[i] / 255, correction);
            data[i + 1] = 255 * Math.pow(data[i + 1] / 255, correction);
            data[i + 2] = 255 * Math.pow(data[i + 2] / 255, correction);
        }

        return imageData;
    },

    /**
     * Ajuster la vibrance (saturation intelligente)
     * @param {ImageData} imageData - Les données d'image
     * @param {number} value - Valeur de -100 à 100
     */
    vibrance(imageData, value) {
        const data = imageData.data;
        const factor = value / 100;

        for (let i = 0; i < data.length; i += 4) {
            const max = Math.max(data[i], data[i + 1], data[i + 2]);
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const saturation = (max - avg) / 255;

            // Appliquer moins d'ajustement aux couleurs déjà saturées
            const adjustment = factor * (1 - saturation);

            data[i] = Utils.clamp(data[i] + (data[i] - avg) * adjustment, 0, 255);
            data[i + 1] = Utils.clamp(data[i + 1] + (data[i + 1] - avg) * adjustment, 0, 255);
            data[i + 2] = Utils.clamp(data[i + 2] + (data[i + 2] - avg) * adjustment, 0, 255);
        }

        return imageData;
    },

    /**
     * Ajuster les niveaux (levels)
     * @param {ImageData} imageData - Les données d'image
     * @param {number} inputMin - Niveau d'entrée minimum (0-255)
     * @param {number} inputMax - Niveau d'entrée maximum (0-255)
     * @param {number} outputMin - Niveau de sortie minimum (0-255)
     * @param {number} outputMax - Niveau de sortie maximum (0-255)
     */
    levels(imageData, inputMin = 0, inputMax = 255, outputMin = 0, outputMax = 255) {
        const data = imageData.data;
        const inputRange = inputMax - inputMin;
        const outputRange = outputMax - outputMin;

        for (let i = 0; i < data.length; i += 4) {
            for (let j = 0; j < 3; j++) {
                const value = data[i + j];
                const normalized = Utils.clamp((value - inputMin) / inputRange, 0, 1);
                data[i + j] = Utils.clamp(normalized * outputRange + outputMin, 0, 255);
            }
        }

        return imageData;
    },

    /**
     * Auto-niveaux (auto-levels)
     * Étire automatiquement l'histogramme pour utiliser toute la plage
     */
    autoLevels(imageData) {
        const data = imageData.data;
        let minR = 255, maxR = 0;
        let minG = 255, maxG = 0;
        let minB = 255, maxB = 0;

        // Trouver les valeurs min et max pour chaque canal
        for (let i = 0; i < data.length; i += 4) {
            minR = Math.min(minR, data[i]);
            maxR = Math.max(maxR, data[i]);
            minG = Math.min(minG, data[i + 1]);
            maxG = Math.max(maxG, data[i + 1]);
            minB = Math.min(minB, data[i + 2]);
            maxB = Math.max(maxB, data[i + 2]);
        }

        // Appliquer l'étirement
        const rangeR = maxR - minR || 1;
        const rangeG = maxG - minG || 1;
        const rangeB = maxB - minB || 1;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = ((data[i] - minR) / rangeR) * 255;
            data[i + 1] = ((data[i + 1] - minG) / rangeG) * 255;
            data[i + 2] = ((data[i + 2] - minB) / rangeB) * 255;
        }

        return imageData;
    },

    /**
     * Courbe de tonalité simple (S-curve pour plus de contraste)
     */
    curves(imageData, strength = 0.5) {
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            for (let j = 0; j < 3; j++) {
                const x = data[i + j] / 255;
                // Courbe en S
                const y = x < 0.5
                    ? 0.5 * Math.pow(2 * x, 1 + strength)
                    : 1 - 0.5 * Math.pow(2 * (1 - x), 1 + strength);
                data[i + j] = Utils.clamp(y * 255, 0, 255);
            }
        }

        return imageData;
    }
};

// Export pour utilisation globale
window.Adjustments = Adjustments;
