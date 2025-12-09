/**
 * FotoEdit - Système d'historique
 * Gestion de l'historique pour undo/redo
 */

class HistoryManager {
    constructor(maxStates = 50) {
        this.states = [];
        this.currentIndex = -1;
        this.maxStates = maxStates;
        this.listeners = [];
    }

    /**
     * Ajouter un écouteur de changements
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notifier les écouteurs d'un changement
     */
    notify() {
        this.listeners.forEach(callback => callback());
    }

    /**
     * Sauvegarder l'état actuel
     */
    saveState(layers, actionName = 'Action') {
        // Supprimer les états après l'index actuel (si on a fait des undo)
        if (this.currentIndex < this.states.length - 1) {
            this.states = this.states.slice(0, this.currentIndex + 1);
        }

        // Créer une copie profonde des calques
        const state = {
            name: actionName,
            timestamp: Date.now(),
            layers: this.serializeLayers(layers)
        };

        this.states.push(state);
        this.currentIndex = this.states.length - 1;

        // Limiter le nombre d'états
        if (this.states.length > this.maxStates) {
            this.states.shift();
            this.currentIndex--;
        }

        this.notify();
    }

    /**
     * Sérialiser les calques pour la sauvegarde
     */
    serializeLayers(layers) {
        return layers.map(layer => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            imageData: layer.canvas.toDataURL()
        }));
    }

    /**
     * Désérialiser les calques
     */
    async deserializeLayers(serializedLayers) {
        const layers = [];

        for (const data of serializedLayers) {
            const canvas = document.createElement('canvas');
            const img = await Utils.loadImage(data.imageData);
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            layers.push({
                id: data.id,
                name: data.name,
                visible: data.visible,
                opacity: data.opacity,
                blendMode: data.blendMode,
                canvas: canvas,
                ctx: ctx
            });
        }

        return layers;
    }

    /**
     * Annuler (Undo)
     */
    async undo() {
        if (!this.canUndo()) return null;
        this.currentIndex--;
        this.notify();
        return await this.deserializeLayers(this.states[this.currentIndex].layers);
    }

    /**
     * Rétablir (Redo)
     */
    async redo() {
        if (!this.canRedo()) return null;
        this.currentIndex++;
        this.notify();
        return await this.deserializeLayers(this.states[this.currentIndex].layers);
    }

    /**
     * Vérifier si on peut annuler
     */
    canUndo() {
        return this.currentIndex > 0;
    }

    /**
     * Vérifier si on peut rétablir
     */
    canRedo() {
        return this.currentIndex < this.states.length - 1;
    }

    /**
     * Obtenir l'état à un index donné
     */
    async goToState(index) {
        if (index < 0 || index >= this.states.length) return null;
        this.currentIndex = index;
        this.notify();
        return await this.deserializeLayers(this.states[index].layers);
    }

    /**
     * Obtenir la liste des états pour l'affichage
     */
    getStatesList() {
        return this.states.map((state, index) => ({
            index,
            name: state.name,
            isCurrent: index === this.currentIndex,
            isFuture: index > this.currentIndex
        }));
    }

    /**
     * Effacer tout l'historique
     */
    clear() {
        this.states = [];
        this.currentIndex = -1;
        this.notify();
    }

    /**
     * Obtenir l'index actuel
     */
    getCurrentIndex() {
        return this.currentIndex;
    }

    /**
     * Obtenir le nombre total d'états
     */
    getStatesCount() {
        return this.states.length;
    }
}

// Export pour utilisation globale
window.HistoryManager = HistoryManager;
