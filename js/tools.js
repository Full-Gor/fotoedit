/**
 * FotoEdit - Outils de dessin
 * Gestion des outils de l'éditeur
 */

class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'move';
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.startX = 0;
        this.startY = 0;

        // Options des outils
        this.options = {
            brushSize: 10,
            brushHardness: 100,
            brushOpacity: 100,
            foregroundColor: '#000000',
            backgroundColor: '#ffffff',
            shapeFill: false,
            shapeStrokeWidth: 2,
            textFont: 'Arial',
            textSize: 32,
            textBold: false,
            textItalic: false,
            gradientType: 'linear'
        };

        // Pour l'outil tampon de clonage
        this.cloneSource = null;
        this.cloneOffset = { x: 0, y: 0 };

        // Pour l'outil de sélection
        this.selection = null;

        // Pour l'outil de recadrage
        this.cropRect = null;

        // Canvas temporaire pour le dessin en cours
        this.tempCanvas = null;
        this.tempCtx = null;
    }

    /**
     * Définir l'outil actif
     */
    setTool(tool) {
        this.currentTool = tool;
        this.isDrawing = false;
        this.cloneSource = null;

        // Mettre à jour le curseur
        this.updateCursor();

        // Afficher/masquer les options appropriées
        this.updateToolOptions();
    }

    /**
     * Mettre à jour le curseur selon l'outil
     */
    updateCursor() {
        const canvas = this.app.mainCanvas;
        const cursors = {
            move: 'move',
            select: 'crosshair',
            brush: 'crosshair',
            eraser: 'crosshair',
            bucket: 'crosshair',
            gradient: 'crosshair',
            text: 'text',
            line: 'crosshair',
            rectangle: 'crosshair',
            ellipse: 'crosshair',
            eyedropper: 'crosshair',
            clone: 'crosshair',
            crop: 'crosshair',
            hand: 'grab',
            zoom: 'zoom-in'
        };
        canvas.style.cursor = cursors[this.currentTool] || 'default';
    }

    /**
     * Mettre à jour les options de l'outil
     */
    updateToolOptions() {
        // Masquer toutes les options
        document.querySelectorAll('#tool-options .option-group').forEach(el => {
            el.style.display = 'none';
        });

        // Afficher les options pertinentes
        const brushTools = ['brush', 'eraser', 'clone'];
        const shapeTools = ['line', 'rectangle', 'ellipse'];

        if (brushTools.includes(this.currentTool)) {
            document.getElementById('brush-options').style.display = 'block';
            document.getElementById('brush-hardness-option').style.display = 'block';
            document.getElementById('brush-opacity-option').style.display = 'block';
        }

        if (shapeTools.includes(this.currentTool)) {
            document.getElementById('brush-options').style.display = 'block';
            document.getElementById('shape-fill-option').style.display = 'block';
            document.getElementById('shape-stroke-option').style.display = 'block';
        }

        if (this.currentTool === 'text') {
            document.getElementById('text-options').style.display = 'block';
        }

        if (this.currentTool === 'gradient') {
            document.getElementById('gradient-options').style.display = 'block';
        }

        if (this.currentTool === 'bucket') {
            document.getElementById('brush-opacity-option').style.display = 'block';
        }
    }

    /**
     * Créer un canvas temporaire pour le dessin en cours
     */
    createTempCanvas() {
        const layer = this.app.layerManager.getActiveLayer();
        if (!layer) return;

        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = layer.canvas.width;
        this.tempCanvas.height = layer.canvas.height;
        this.tempCtx = this.tempCanvas.getContext('2d');
    }

    /**
     * Appliquer le canvas temporaire au calque actif
     */
    applyTempCanvas() {
        if (!this.tempCanvas) return;

        const layer = this.app.layerManager.getActiveLayer();
        if (!layer) return;

        layer.ctx.globalAlpha = this.options.brushOpacity / 100;
        layer.ctx.drawImage(this.tempCanvas, 0, 0);
        layer.ctx.globalAlpha = 1;

        this.tempCanvas = null;
        this.tempCtx = null;
    }

    /**
     * Gestionnaire d'événement mousedown
     */
    onMouseDown(e) {
        const pos = this.getCanvasPosition(e);
        this.startX = pos.x;
        this.startY = pos.y;
        this.lastX = pos.x;
        this.lastY = pos.y;
        this.isDrawing = true;

        const layer = this.app.layerManager.getActiveLayer();
        if (!layer && !['hand', 'zoom', 'move'].includes(this.currentTool)) {
            return;
        }

        switch (this.currentTool) {
            case 'brush':
                this.createTempCanvas();
                this.drawBrushStroke(pos.x, pos.y, pos.x, pos.y);
                break;
            case 'eraser':
                this.erase(pos.x, pos.y, pos.x, pos.y);
                break;
            case 'bucket':
                this.floodFill(pos.x, pos.y);
                this.isDrawing = false;
                break;
            case 'eyedropper':
                this.pickColor(pos.x, pos.y);
                this.isDrawing = false;
                break;
            case 'clone':
                if (e.altKey) {
                    this.setCloneSource(pos.x, pos.y);
                    this.isDrawing = false;
                } else if (this.cloneSource) {
                    this.createTempCanvas();
                }
                break;
            case 'text':
                this.openTextDialog(pos.x, pos.y);
                this.isDrawing = false;
                break;
            case 'line':
            case 'rectangle':
            case 'ellipse':
            case 'gradient':
                this.createTempCanvas();
                break;
            case 'select':
                this.selection = { x: pos.x, y: pos.y, width: 0, height: 0 };
                break;
            case 'crop':
                this.cropRect = { x: pos.x, y: pos.y, width: 0, height: 0 };
                break;
            case 'hand':
                this.app.mainCanvas.style.cursor = 'grabbing';
                break;
            case 'zoom':
                if (e.altKey) {
                    this.app.zoomOut();
                } else {
                    this.app.zoomIn();
                }
                this.isDrawing = false;
                break;
        }

        this.app.render();
    }

    /**
     * Gestionnaire d'événement mousemove
     */
    onMouseMove(e) {
        const pos = this.getCanvasPosition(e);

        // Mettre à jour la position du curseur dans la barre d'état
        this.app.updateCursorPosition(pos.x, pos.y);

        if (!this.isDrawing) return;

        const layer = this.app.layerManager.getActiveLayer();

        switch (this.currentTool) {
            case 'brush':
                this.drawBrushStroke(this.lastX, this.lastY, pos.x, pos.y);
                break;
            case 'eraser':
                this.erase(this.lastX, this.lastY, pos.x, pos.y);
                break;
            case 'clone':
                if (this.cloneSource) {
                    this.cloneStamp(this.lastX, this.lastY, pos.x, pos.y);
                }
                break;
            case 'line':
                this.drawLine(this.startX, this.startY, pos.x, pos.y);
                break;
            case 'rectangle':
                this.drawRectangle(this.startX, this.startY, pos.x, pos.y);
                break;
            case 'ellipse':
                this.drawEllipse(this.startX, this.startY, pos.x, pos.y);
                break;
            case 'gradient':
                this.drawGradient(this.startX, this.startY, pos.x, pos.y);
                break;
            case 'select':
                this.updateSelection(pos.x, pos.y);
                break;
            case 'crop':
                this.updateCropRect(pos.x, pos.y);
                break;
            case 'hand':
                this.pan(pos.x - this.lastX, pos.y - this.lastY);
                break;
            case 'move':
                if (layer) {
                    // Déplacer le contenu du calque
                    const dx = pos.x - this.lastX;
                    const dy = pos.y - this.lastY;
                    this.moveLayerContent(dx, dy);
                }
                break;
        }

        this.lastX = pos.x;
        this.lastY = pos.y;
        this.app.render();
    }

    /**
     * Gestionnaire d'événement mouseup
     */
    onMouseUp(e) {
        if (!this.isDrawing) return;

        const pos = this.getCanvasPosition(e);
        const layer = this.app.layerManager.getActiveLayer();

        switch (this.currentTool) {
            case 'brush':
            case 'clone':
                this.applyTempCanvas();
                this.app.saveHistory('Pinceau');
                break;
            case 'eraser':
                this.app.saveHistory('Gomme');
                break;
            case 'line':
                this.drawLine(this.startX, this.startY, pos.x, pos.y, true);
                this.applyTempCanvas();
                this.app.saveHistory('Ligne');
                break;
            case 'rectangle':
                this.drawRectangle(this.startX, this.startY, pos.x, pos.y, true);
                this.applyTempCanvas();
                this.app.saveHistory('Rectangle');
                break;
            case 'ellipse':
                this.drawEllipse(this.startX, this.startY, pos.x, pos.y, true);
                this.applyTempCanvas();
                this.app.saveHistory('Ellipse');
                break;
            case 'gradient':
                this.drawGradient(this.startX, this.startY, pos.x, pos.y, true);
                this.applyTempCanvas();
                this.app.saveHistory('Dégradé');
                break;
            case 'select':
                this.finalizeSelection();
                break;
            case 'crop':
                this.showCropOverlay();
                break;
            case 'hand':
                this.app.mainCanvas.style.cursor = 'grab';
                break;
            case 'move':
                if (layer) {
                    this.app.saveHistory('Déplacer');
                }
                break;
        }

        this.isDrawing = false;
        this.app.render();
    }

    /**
     * Obtenir la position sur le canvas
     */
    getCanvasPosition(e) {
        const rect = this.app.mainCanvas.getBoundingClientRect();

        // Vérifier que layerManager existe
        if (!this.app.layerManager) {
            return { x: 0, y: 0 };
        }

        const scaleX = this.app.layerManager.width / rect.width;
        const scaleY = this.app.layerManager.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    /**
     * Dessiner un trait de pinceau
     */
    drawBrushStroke(x1, y1, x2, y2) {
        if (!this.tempCtx) return;

        const ctx = this.tempCtx;
        const size = this.options.brushSize;
        const hardness = this.options.brushHardness;
        const color = this.options.foregroundColor;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = size;

        // Pour un pinceau doux, utiliser un dégradé radial
        if (hardness < 100) {
            const points = Utils.getLinePoints(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));
            const rgb = Utils.hexToRgb(color);

            for (const point of points) {
                const gradient = ctx.createRadialGradient(
                    point.x, point.y, 0,
                    point.x, point.y, size / 2
                );
                gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
                gradient.addColorStop(hardness / 100, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
                gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    /**
     * Effacer (gomme)
     */
    erase(x1, y1, x2, y2) {
        const layer = this.app.layerManager.getActiveLayer();
        if (!layer) return;

        const ctx = layer.ctx;
        const size = this.options.brushSize;
        const hardness = this.options.brushHardness;

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';

        // Pour une gomme douce, utiliser des cercles avec dégradé
        if (hardness < 100) {
            const points = Utils.getLinePoints(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));

            for (const point of points) {
                const gradient = ctx.createRadialGradient(
                    point.x, point.y, 0,
                    point.x, point.y, size / 2
                );
                gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
                gradient.addColorStop(hardness / 100, 'rgba(0, 0, 0, 1)');
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Gomme dure - trait simple
            ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = size;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Remplissage (pot de peinture)
     */
    floodFill(x, y) {
        const layer = this.app.layerManager.getActiveLayer();
        if (!layer) return;

        const ctx = layer.ctx;
        const imageData = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
        const fillColor = Utils.hexToRgb(this.options.foregroundColor);
        fillColor.a = Math.round(this.options.brushOpacity * 2.55);

        Utils.floodFill(imageData, x, y, fillColor, 30);
        ctx.putImageData(imageData, 0, 0);

        this.app.saveHistory('Remplissage');
    }

    /**
     * Pipette (sélecteur de couleur)
     */
    pickColor(x, y) {
        const composited = this.app.layerManager.composite();
        const ctx = composited.getContext('2d');
        const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;

        const color = Utils.rgbToHex(pixel[0], pixel[1], pixel[2]);
        this.options.foregroundColor = color;
        document.getElementById('foreground-color').value = color;
        this.app.updateSelectedColor(color);
    }

    /**
     * Définir la source pour le tampon de clonage
     */
    setCloneSource(x, y) {
        this.cloneSource = { x, y };
        this.cloneOffset = { x: 0, y: 0 };
    }

    /**
     * Tampon de clonage
     */
    cloneStamp(x1, y1, x2, y2) {
        if (!this.cloneSource || !this.tempCtx) return;

        const layer = this.app.layerManager.getActiveLayer();
        if (!layer) return;

        const ctx = this.tempCtx;
        const size = this.options.brushSize;

        // Calculer l'offset si c'est le premier trait
        if (this.cloneOffset.x === 0 && this.cloneOffset.y === 0) {
            this.cloneOffset.x = this.cloneSource.x - x1;
            this.cloneOffset.y = this.cloneSource.y - y1;
        }

        const points = Utils.getLinePoints(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));

        for (const point of points) {
            const srcX = point.x + this.cloneOffset.x;
            const srcY = point.y + this.cloneOffset.y;

            // Copier un cercle de la source vers la destination
            ctx.save();
            ctx.beginPath();
            ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(
                layer.canvas,
                srcX - size / 2, srcY - size / 2, size, size,
                point.x - size / 2, point.y - size / 2, size, size
            );
            ctx.restore();
        }
    }

    /**
     * Dessiner une ligne
     */
    drawLine(x1, y1, x2, y2, final = false) {
        if (!this.tempCtx) return;

        const ctx = this.tempCtx;
        ctx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

        ctx.strokeStyle = this.options.foregroundColor;
        ctx.lineWidth = this.options.shapeStrokeWidth;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    /**
     * Dessiner un rectangle
     */
    drawRectangle(x1, y1, x2, y2, final = false) {
        if (!this.tempCtx) return;

        const ctx = this.tempCtx;
        ctx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        if (this.options.shapeFill) {
            ctx.fillStyle = this.options.foregroundColor;
            ctx.fillRect(x, y, width, height);
        } else {
            ctx.strokeStyle = this.options.foregroundColor;
            ctx.lineWidth = this.options.shapeStrokeWidth;
            ctx.strokeRect(x, y, width, height);
        }
    }

    /**
     * Dessiner une ellipse
     */
    drawEllipse(x1, y1, x2, y2, final = false) {
        if (!this.tempCtx) return;

        const ctx = this.tempCtx;
        ctx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const radiusX = Math.abs(x2 - x1) / 2;
        const radiusY = Math.abs(y2 - y1) / 2;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);

        if (this.options.shapeFill) {
            ctx.fillStyle = this.options.foregroundColor;
            ctx.fill();
        } else {
            ctx.strokeStyle = this.options.foregroundColor;
            ctx.lineWidth = this.options.shapeStrokeWidth;
            ctx.stroke();
        }
    }

    /**
     * Dessiner un dégradé
     */
    drawGradient(x1, y1, x2, y2, final = false) {
        if (!this.tempCtx) return;

        const ctx = this.tempCtx;
        ctx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

        let gradient;

        if (this.options.gradientType === 'radial') {
            const radius = Utils.distance(x1, y1, x2, y2);
            gradient = ctx.createRadialGradient(x1, y1, 0, x1, y1, radius);
        } else {
            gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        }

        gradient.addColorStop(0, this.options.foregroundColor);
        gradient.addColorStop(1, this.options.backgroundColor);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    }

    /**
     * Mettre à jour la sélection
     */
    updateSelection(x, y) {
        if (!this.selection) return;

        this.selection.width = x - this.selection.x;
        this.selection.height = y - this.selection.y;

        this.app.drawSelection(this.selection);
    }

    /**
     * Finaliser la sélection
     */
    finalizeSelection() {
        if (!this.selection) return;

        // Normaliser la sélection
        if (this.selection.width < 0) {
            this.selection.x += this.selection.width;
            this.selection.width = Math.abs(this.selection.width);
        }
        if (this.selection.height < 0) {
            this.selection.y += this.selection.height;
            this.selection.height = Math.abs(this.selection.height);
        }

        this.app.setSelection(this.selection);
    }

    /**
     * Mettre à jour le rectangle de recadrage
     */
    updateCropRect(x, y) {
        if (!this.cropRect) return;

        this.cropRect.width = x - this.cropRect.x;
        this.cropRect.height = y - this.cropRect.y;

        this.app.drawCropOverlay(this.cropRect);
    }

    /**
     * Afficher l'overlay de recadrage
     */
    showCropOverlay() {
        if (!this.cropRect) return;

        // Normaliser
        if (this.cropRect.width < 0) {
            this.cropRect.x += this.cropRect.width;
            this.cropRect.width = Math.abs(this.cropRect.width);
        }
        if (this.cropRect.height < 0) {
            this.cropRect.y += this.cropRect.height;
            this.cropRect.height = Math.abs(this.cropRect.height);
        }

        this.app.showCropOverlay(this.cropRect);
    }

    /**
     * Appliquer le recadrage
     */
    applyCrop() {
        if (!this.cropRect) return;

        this.app.layerManager.crop(
            Math.round(this.cropRect.x),
            Math.round(this.cropRect.y),
            Math.round(this.cropRect.width),
            Math.round(this.cropRect.height)
        );

        this.cropRect = null;
        this.app.hideCropOverlay();
        this.app.saveHistory('Recadrage');
        this.app.updateCanvasSize();
    }

    /**
     * Annuler le recadrage
     */
    cancelCrop() {
        this.cropRect = null;
        this.app.hideCropOverlay();
    }

    /**
     * Pan (déplacement de la vue)
     */
    pan(dx, dy) {
        // Implémenté dans l'app principale via CSS transform
    }

    /**
     * Déplacer le contenu du calque
     */
    moveLayerContent(dx, dy) {
        const layer = this.app.layerManager.getActiveLayer();
        if (!layer) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = layer.canvas.width;
        tempCanvas.height = layer.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(layer.canvas, 0, 0);

        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        layer.ctx.drawImage(tempCanvas, dx, dy);
    }

    /**
     * Ouvrir la boîte de dialogue de texte
     */
    openTextDialog(x, y) {
        this.textPosition = { x, y };
        document.getElementById('text-modal').classList.add('active');
        document.getElementById('text-input').focus();
    }

    /**
     * Ajouter du texte au calque
     */
    addText(text) {
        const layer = this.app.layerManager.getActiveLayer();
        if (!layer || !text || !this.textPosition) return;

        const ctx = layer.ctx;
        const font = this.options.textFont;
        const size = this.options.textSize;
        const bold = this.options.textBold ? 'bold ' : '';
        const italic = this.options.textItalic ? 'italic ' : '';

        ctx.font = `${italic}${bold}${size}px ${font}`;
        ctx.fillStyle = this.options.foregroundColor;
        ctx.textBaseline = 'top';

        // Gérer le texte multiligne
        const lines = text.split('\n');
        let y = this.textPosition.y;

        for (const line of lines) {
            ctx.fillText(line, this.textPosition.x, y);
            y += size * 1.2;
        }

        this.app.saveHistory('Texte');
        this.textPosition = null;
    }
}

// Export pour utilisation globale
window.ToolManager = ToolManager;
