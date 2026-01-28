/**
 * FotoEdit - Gestionnaire de calques
 * Gestion des calques (layers) de l'éditeur
 */

class LayerManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [];
        this.activeLayerIndex = -1;
        this.listeners = [];
    }

    /**
     * Ajouter un écouteur de changements
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notifier les écouteurs
     */
    notify() {
        this.listeners.forEach(callback => callback());
    }

    /**
     * Créer un nouveau calque
     */
    createLayer(name = null, index = null) {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');

        const layer = {
            id: Utils.generateId(),
            name: name || `Calque ${this.layers.length + 1}`,
            canvas: canvas,
            ctx: ctx,
            visible: true,
            opacity: 100,
            blendMode: 'normal',
            mask: null,
            maskEnabled: false
        };

        if (index !== null && index >= 0 && index <= this.layers.length) {
            this.layers.splice(index, 0, layer);
            this.activeLayerIndex = index;
        } else {
            this.layers.push(layer);
            this.activeLayerIndex = this.layers.length - 1;
        }

        this.notify();
        return layer;
    }

    /**
     * Créer un calque avec un fond
     */
    createBackgroundLayer(color = '#ffffff') {
        const layer = this.createLayer('Arrière-plan');
        if (color !== 'transparent') {
            layer.ctx.fillStyle = color;
            layer.ctx.fillRect(0, 0, this.width, this.height);
        }
        return layer;
    }

    /**
     * Créer un calque à partir d'une image
     */
    createLayerFromImage(image, name = 'Image') {
        const layer = this.createLayer(name);

        // Centrer l'image si elle est plus petite que le canvas
        const x = (this.width - image.width) / 2;
        const y = (this.height - image.height) / 2;

        layer.ctx.drawImage(image, Math.max(0, x), Math.max(0, y));

        this.notify();
        return layer;
    }

    /**
     * Supprimer un calque
     */
    deleteLayer(index = this.activeLayerIndex) {
        if (this.layers.length <= 1) return false;
        if (index < 0 || index >= this.layers.length) return false;

        this.layers.splice(index, 1);

        if (this.activeLayerIndex >= this.layers.length) {
            this.activeLayerIndex = this.layers.length - 1;
        } else if (this.activeLayerIndex > index) {
            this.activeLayerIndex--;
        }

        this.notify();
        return true;
    }

    /**
     * Dupliquer un calque
     */
    duplicateLayer(index = this.activeLayerIndex) {
        if (index < 0 || index >= this.layers.length) return null;

        const source = this.layers[index];
        const newLayer = this.createLayer(`${source.name} copie`, index + 1);

        newLayer.ctx.drawImage(source.canvas, 0, 0);
        newLayer.opacity = source.opacity;
        newLayer.blendMode = source.blendMode;
        newLayer.visible = source.visible;

        // Copier le masque si présent
        if (source.mask) {
            const maskCopy = document.createElement('canvas');
            maskCopy.width = this.width;
            maskCopy.height = this.height;
            maskCopy.getContext('2d').drawImage(source.mask, 0, 0);
            newLayer.mask = maskCopy;
            newLayer.maskEnabled = source.maskEnabled;
        }

        this.notify();
        return newLayer;
    }

    /**
     * Fusionner un calque avec celui du dessous
     */
    mergeDown(index = this.activeLayerIndex) {
        if (index <= 0 || index >= this.layers.length) return false;

        const upper = this.layers[index];
        const lower = this.layers[index - 1];

        // Dessiner le calque supérieur sur le calque inférieur
        lower.ctx.globalAlpha = upper.opacity / 100;
        lower.ctx.globalCompositeOperation = this.getCompositeOperation(upper.blendMode);
        lower.ctx.drawImage(upper.canvas, 0, 0);
        lower.ctx.globalAlpha = 1;
        lower.ctx.globalCompositeOperation = 'source-over';

        // Supprimer le calque supérieur
        this.layers.splice(index, 1);
        this.activeLayerIndex = index - 1;

        this.notify();
        return true;
    }

    /**
     * Aplatir tous les calques
     */
    flattenAll() {
        if (this.layers.length <= 1) return;

        const result = document.createElement('canvas');
        result.width = this.width;
        result.height = this.height;
        const ctx = result.getContext('2d');

        // Composer tous les calques
        for (const layer of this.layers) {
            if (!layer.visible) continue;
            ctx.globalAlpha = layer.opacity / 100;
            ctx.globalCompositeOperation = this.getCompositeOperation(layer.blendMode);
            ctx.drawImage(layer.canvas, 0, 0);
        }

        // Remplacer par un seul calque
        this.layers = [];
        this.activeLayerIndex = -1;

        const newLayer = this.createLayer('Aplati');
        newLayer.ctx.drawImage(result, 0, 0);

        this.notify();
    }

    /**
     * Déplacer un calque vers le haut
     */
    moveLayerUp(index = this.activeLayerIndex) {
        if (index >= this.layers.length - 1) return false;

        [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]];
        this.activeLayerIndex = index + 1;

        this.notify();
        return true;
    }

    /**
     * Déplacer un calque vers le bas
     */
    moveLayerDown(index = this.activeLayerIndex) {
        if (index <= 0) return false;

        [this.layers[index], this.layers[index - 1]] = [this.layers[index - 1], this.layers[index]];
        this.activeLayerIndex = index - 1;

        this.notify();
        return true;
    }

    /**
     * Obtenir le calque actif
     */
    getActiveLayer() {
        if (this.activeLayerIndex < 0 || this.activeLayerIndex >= this.layers.length) {
            return null;
        }
        return this.layers[this.activeLayerIndex];
    }

    /**
     * Définir le calque actif
     */
    setActiveLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
            this.notify();
        }
    }

    /**
     * Obtenir le calque actif par ID
     */
    setActiveLayerById(id) {
        const index = this.layers.findIndex(l => l.id === id);
        if (index !== -1) {
            this.activeLayerIndex = index;
            this.notify();
        }
    }

    /**
     * Définir la visibilité d'un calque
     */
    setLayerVisibility(index, visible) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].visible = visible;
            this.notify();
        }
    }

    /**
     * Définir l'opacité d'un calque
     */
    setLayerOpacity(index, opacity) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].opacity = Utils.clamp(opacity, 0, 100);
            this.notify();
        }
    }

    /**
     * Définir le mode de fusion d'un calque
     */
    setLayerBlendMode(index, blendMode) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].blendMode = blendMode;
            this.notify();
        }
    }

    /**
     * Renommer un calque
     */
    renameLayer(index, name) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].name = name;
            this.notify();
        }
    }

    /**
     * Obtenir l'opération de composition correspondant au mode de fusion
     */
    getCompositeOperation(blendMode) {
        const operations = {
            'normal': 'source-over',
            'multiply': 'multiply',
            'screen': 'screen',
            'overlay': 'overlay',
            'darken': 'darken',
            'lighten': 'lighten',
            'color-dodge': 'color-dodge',
            'color-burn': 'color-burn',
            'hard-light': 'hard-light',
            'soft-light': 'soft-light',
            'difference': 'difference',
            'exclusion': 'exclusion',
            'hue': 'hue',
            'saturation': 'saturation',
            'color': 'color',
            'luminosity': 'luminosity'
        };
        return operations[blendMode] || 'source-over';
    }

    /**
     * Composer tous les calques visibles
     */
    composite() {
        const result = document.createElement('canvas');
        result.width = this.width;
        result.height = this.height;
        const ctx = result.getContext('2d');

        for (const layer of this.layers) {
            if (!layer.visible) continue;
            ctx.globalAlpha = layer.opacity / 100;
            ctx.globalCompositeOperation = this.getCompositeOperation(layer.blendMode);

            if (layer.mask && layer.maskEnabled) {
                // Appliquer le masque de calque
                const masked = document.createElement('canvas');
                masked.width = this.width;
                masked.height = this.height;
                const mCtx = masked.getContext('2d');

                mCtx.drawImage(layer.canvas, 0, 0);
                mCtx.globalCompositeOperation = 'destination-in';
                mCtx.drawImage(layer.mask, 0, 0);

                ctx.drawImage(masked, 0, 0);
            } else {
                ctx.drawImage(layer.canvas, 0, 0);
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        return result;
    }

    /**
     * Ajouter un masque au calque actif
     */
    addMask(index = this.activeLayerIndex, fillWhite = true) {
        if (index < 0 || index >= this.layers.length) return null;

        const layer = this.layers[index];
        const mask = document.createElement('canvas');
        mask.width = this.width;
        mask.height = this.height;
        const maskCtx = mask.getContext('2d');

        if (fillWhite) {
            maskCtx.fillStyle = 'white';
            maskCtx.fillRect(0, 0, this.width, this.height);
        }

        layer.mask = mask;
        layer.maskEnabled = true;
        this.notify();
        return mask;
    }

    /**
     * Ajouter un masque à partir d'une sélection
     */
    addMaskFromSelection(index, selectionMask) {
        if (index < 0 || index >= this.layers.length) return null;

        const layer = this.layers[index];
        const mask = document.createElement('canvas');
        mask.width = this.width;
        mask.height = this.height;
        const maskCtx = mask.getContext('2d');

        if (selectionMask) {
            maskCtx.drawImage(selectionMask, 0, 0);
        }

        layer.mask = mask;
        layer.maskEnabled = true;
        this.notify();
        return mask;
    }

    /**
     * Supprimer le masque d'un calque
     */
    removeMask(index = this.activeLayerIndex, apply = false) {
        if (index < 0 || index >= this.layers.length) return;

        const layer = this.layers[index];
        if (!layer.mask) return;

        if (apply) {
            // Appliquer le masque de façon destructive
            const temp = document.createElement('canvas');
            temp.width = this.width;
            temp.height = this.height;
            const tempCtx = temp.getContext('2d');

            tempCtx.drawImage(layer.canvas, 0, 0);
            tempCtx.globalCompositeOperation = 'destination-in';
            tempCtx.drawImage(layer.mask, 0, 0);

            layer.ctx.clearRect(0, 0, this.width, this.height);
            layer.ctx.drawImage(temp, 0, 0);
        }

        layer.mask = null;
        layer.maskEnabled = false;
        this.notify();
    }

    /**
     * Activer/désactiver le masque d'un calque
     */
    toggleMask(index = this.activeLayerIndex) {
        if (index < 0 || index >= this.layers.length) return;

        const layer = this.layers[index];
        if (layer.mask) {
            layer.maskEnabled = !layer.maskEnabled;
            this.notify();
        }
    }

    /**
     * Redimensionner tous les calques
     */
    resize(newWidth, newHeight, method = 'smooth') {
        const oldWidth = this.width;
        const oldHeight = this.height;

        this.width = newWidth;
        this.height = newHeight;

        for (const layer of this.layers) {
            const oldCanvas = layer.canvas;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = newWidth;
            newCanvas.height = newHeight;
            const ctx = newCanvas.getContext('2d');

            ctx.imageSmoothingEnabled = method === 'smooth';
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(oldCanvas, 0, 0, oldWidth, oldHeight, 0, 0, newWidth, newHeight);

            layer.canvas = newCanvas;
            layer.ctx = ctx;
        }

        this.notify();
    }

    /**
     * Faire pivoter tous les calques
     */
    rotate(angle) {
        const radians = angle * Math.PI / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));

        const newWidth = Math.round(this.width * cos + this.height * sin);
        const newHeight = Math.round(this.width * sin + this.height * cos);

        for (const layer of this.layers) {
            const oldCanvas = layer.canvas;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = newWidth;
            newCanvas.height = newHeight;
            const ctx = newCanvas.getContext('2d');

            ctx.translate(newWidth / 2, newHeight / 2);
            ctx.rotate(radians);
            ctx.drawImage(oldCanvas, -this.width / 2, -this.height / 2);

            ctx.setTransform(1, 0, 0, 1, 0, 0);

            layer.canvas = newCanvas;
            layer.ctx = ctx;
        }

        this.width = newWidth;
        this.height = newHeight;
        this.notify();
    }

    /**
     * Faire pivoter de 90 degrés
     */
    rotate90(clockwise = true) {
        const newWidth = this.height;
        const newHeight = this.width;

        for (const layer of this.layers) {
            const oldCanvas = layer.canvas;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = newWidth;
            newCanvas.height = newHeight;
            const ctx = newCanvas.getContext('2d');

            ctx.translate(newWidth / 2, newHeight / 2);
            ctx.rotate((clockwise ? 90 : -90) * Math.PI / 180);
            ctx.drawImage(oldCanvas, -this.width / 2, -this.height / 2);

            // Reset transform pour éviter les bugs d'outils
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            layer.canvas = newCanvas;
            layer.ctx = ctx;
        }

        this.width = newWidth;
        this.height = newHeight;
        this.notify();
    }

    /**
     * Retourner horizontalement
     */
    flipHorizontal() {
        for (const layer of this.layers) {
            const oldCanvas = layer.canvas;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = this.width;
            newCanvas.height = this.height;
            const ctx = newCanvas.getContext('2d');

            ctx.translate(this.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(oldCanvas, 0, 0);

            ctx.setTransform(1, 0, 0, 1, 0, 0);

            layer.canvas = newCanvas;
            layer.ctx = ctx;
        }
        this.notify();
    }

    /**
     * Retourner verticalement
     */
    flipVertical() {
        for (const layer of this.layers) {
            const oldCanvas = layer.canvas;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = this.width;
            newCanvas.height = this.height;
            const ctx = newCanvas.getContext('2d');

            ctx.translate(0, this.height);
            ctx.scale(1, -1);
            ctx.drawImage(oldCanvas, 0, 0);

            ctx.setTransform(1, 0, 0, 1, 0, 0);

            layer.canvas = newCanvas;
            layer.ctx = ctx;
        }
        this.notify();
    }

    /**
     * Recadrer tous les calques
     */
    crop(x, y, width, height) {
        for (const layer of this.layers) {
            const oldCanvas = layer.canvas;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = width;
            newCanvas.height = height;
            const ctx = newCanvas.getContext('2d');

            ctx.drawImage(oldCanvas, x, y, width, height, 0, 0, width, height);

            layer.canvas = newCanvas;
            layer.ctx = ctx;
        }

        this.width = width;
        this.height = height;
        this.notify();
    }

    /**
     * Effacer un calque
     */
    clearLayer(index = this.activeLayerIndex) {
        if (index >= 0 && index < this.layers.length) {
            const layer = this.layers[index];
            layer.ctx.clearRect(0, 0, this.width, this.height);
            this.notify();
        }
    }

    /**
     * Obtenir tous les calques
     */
    getLayers() {
        return this.layers;
    }

    /**
     * Définir les calques (pour restauration d'historique)
     */
    setLayers(layers) {
        this.layers = layers;
        if (this.activeLayerIndex >= layers.length) {
            this.activeLayerIndex = layers.length - 1;
        }
        if (layers.length > 0) {
            this.width = layers[0].canvas.width;
            this.height = layers[0].canvas.height;
        }
        this.notify();
    }
}

// Export pour utilisation globale
window.LayerManager = LayerManager;
