/**
 * FotoEdit - Application principale
 * Éditeur d'images professionnel
 */

class FotoEditApp {
    constructor() {
        // Références aux éléments DOM
        this.mainCanvas = document.getElementById('main-canvas');
        this.canvasContainer = document.getElementById('canvas-container');
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.workspace = document.querySelector('.workspace');

        // Managers
        this.layerManager = null;
        this.historyManager = new HistoryManager(50);
        this.toolManager = new ToolManager(this);

        // État de l'application
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isProjectOpen = false;
        this.selection = null;
        this.selectionMask = null;
        this.selectionPath = null;

        // Presse-papiers interne
        this.clipboard = null;

        // Données d'aperçu pour les ajustements
        this.previewData = null;

        // Animation marching ants
        this._selectionAnimFrame = null;

        // Initialiser l'application
        this.init();
    }

    /**
     * Initialiser l'application
     */
    init() {
        this.setupEventListeners();
        this.setupMenus();
        this.setupToolbar();
        this.setupPanels();
        this.setupModals();
        this.setupDragAndDrop();
        this.setupKeyboardShortcuts();
        this.updateUI();
    }

    /**
     * Configurer les écouteurs d'événements du canvas
     */
    setupEventListeners() {
        // Événements souris du canvas
        this.mainCanvas.addEventListener('mousedown', (e) => this.toolManager.onMouseDown(e));
        this.mainCanvas.addEventListener('mousemove', (e) => this.toolManager.onMouseMove(e));
        this.mainCanvas.addEventListener('mouseup', (e) => this.toolManager.onMouseUp(e));
        this.mainCanvas.addEventListener('mouseleave', (e) => this.toolManager.onMouseUp(e));

        // Événements tactiles du canvas
        this.mainCanvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.mainCanvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.mainCanvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.mainCanvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

        // Événements de zoom avec la molette
        this.canvasContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        });

        // Historique
        this.historyManager.addListener(() => this.updateHistoryPanel());

        // Mobile - Menu toggle
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
        const menu = document.querySelector('.menu');

        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => {
                menu.classList.toggle('visible');
                mobileMenuOverlay.classList.toggle('visible');
            });
        }

        if (mobileMenuOverlay) {
            mobileMenuOverlay.addEventListener('click', () => {
                menu.classList.remove('visible');
                mobileMenuOverlay.classList.remove('visible');
            });
        }

        // Mobile - Menu items expand/collapse
        document.querySelectorAll('.menu .menu-item > span').forEach(span => {
            span.addEventListener('click', (e) => {
                if (window.innerWidth <= 600) {
                    e.stopPropagation();
                    const menuItem = span.closest('.menu-item');
                    menuItem.classList.toggle('expanded');
                }
            });
        });

        // Mobile - Panel toggle
        const mobilePanelToggle = document.getElementById('mobile-panel-toggle');
        const panelRight = document.querySelector('.panel-right');

        if (mobilePanelToggle && panelRight) {
            mobilePanelToggle.addEventListener('click', () => {
                panelRight.classList.toggle('visible');
            });
        }

        // Mobile - Toolbar toggle
        const mobileToolbarToggle = document.getElementById('mobile-toolbar-toggle');
        const toolbarLeft = document.getElementById('toolbar-left');
        const mobileToolbarOverlay = document.getElementById('mobile-toolbar-overlay');

        if (mobileToolbarToggle && toolbarLeft) {
            mobileToolbarToggle.addEventListener('click', () => {
                toolbarLeft.classList.toggle('visible');
                mobileToolbarOverlay.classList.toggle('visible');
                mobileToolbarToggle.classList.toggle('toolbar-open');
            });
        }

        if (mobileToolbarOverlay) {
            mobileToolbarOverlay.addEventListener('click', () => {
                toolbarLeft.classList.remove('visible');
                mobileToolbarOverlay.classList.remove('visible');
                mobileToolbarToggle.classList.remove('toolbar-open');
            });
        }

        // Mobile - Bottom toolbar
        document.querySelectorAll('.mobile-tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.toolManager.setTool(tool);
                // Mettre à jour l'état actif
                document.querySelectorAll('.mobile-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Mettre à jour aussi la toolbar principale
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                const mainBtn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
                if (mainBtn) mainBtn.classList.add('active');
            });
        });

        // Mobile - Undo button
        const mobileUndo = document.getElementById('mobile-undo');
        if (mobileUndo) {
            mobileUndo.addEventListener('click', () => this.undo());
        }

        // Fermer les menus quand on clique sur un bouton du dropdown (mobile)
        document.querySelectorAll('.menu .dropdown button').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 600) {
                    menu.classList.remove('visible');
                    mobileMenuOverlay.classList.remove('visible');
                    document.querySelectorAll('.menu .menu-item').forEach(item => {
                        item.classList.remove('expanded');
                    });
                }
            });
        });
    }

    /**
     * Gestion des événements tactiles
     */
    handleTouchStart(e) {
        e.preventDefault();

        // Gestion du zoom avec deux doigts
        if (e.touches.length === 2) {
            this.initialPinchDistance = this.getPinchDistance(e.touches);
            this.initialZoom = this.zoom;
            return;
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0];

            // Long press pour définir la source du clone stamp
            if (this.toolManager.currentTool === 'clone') {
                this.longPressTimer = setTimeout(() => {
                    const rect = this.mainCanvas.getBoundingClientRect();
                    const scaleX = this.layerManager ? this.layerManager.width / rect.width : 1;
                    const scaleY = this.layerManager ? this.layerManager.height / rect.height : 1;
                    const x = (touch.clientX - rect.left) * scaleX;
                    const y = (touch.clientY - rect.top) * scaleY;
                    this.toolManager.setCloneSource(x, y);
                    // Feedback visuel
                    this.showToast('Source de clonage définie');
                }, 500);
            }

            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0
            });
            this.toolManager.onMouseDown(mouseEvent);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();

        // Annuler le long press si on bouge
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        // Gestion du zoom avec deux doigts
        if (e.touches.length === 2 && this.initialPinchDistance) {
            const currentDistance = this.getPinchDistance(e.touches);
            const scale = currentDistance / this.initialPinchDistance;
            this.zoom = Math.max(0.1, Math.min(10, this.initialZoom * scale));
            this.applyZoom();
            return;
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0
            });
            this.toolManager.onMouseMove(mouseEvent);
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();

        // Annuler le long press
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        // Reset pinch zoom
        this.initialPinchDistance = null;

        const mouseEvent = new MouseEvent('mouseup', {
            button: 0
        });
        this.toolManager.onMouseUp(mouseEvent);
    }

    /**
     * Calculer la distance entre deux touches (pinch zoom)
     */
    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Afficher un message toast
     */
    showToast(message) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:10px 20px;border-radius:5px;z-index:9999;font-size:14px;transition:opacity 0.3s;';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    }

    /**
     * Configurer les menus
     */
    setupMenus() {
        // Menu Fichier
        document.getElementById('new-project').addEventListener('click', () => this.openNewProjectModal());
        document.getElementById('open-image').addEventListener('click', () => this.openFile());
        document.getElementById('export-png').addEventListener('click', () => this.exportImage('png'));
        document.getElementById('export-jpeg').addEventListener('click', () => this.exportImage('jpeg'));
        document.getElementById('export-webp').addEventListener('click', () => this.exportImage('webp'));

        // Menu Édition
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());
        document.getElementById('copy-btn').addEventListener('click', () => this.copySelection());
        document.getElementById('paste-btn').addEventListener('click', () => this.pasteClipboard());
        document.getElementById('cut-btn').addEventListener('click', () => this.cutSelection());

        // Menu Image
        document.getElementById('resize-image').addEventListener('click', () => this.openResizeModal());
        document.getElementById('crop-image').addEventListener('click', () => this.activateCropTool());
        document.getElementById('rotate-left').addEventListener('click', () => this.rotateLeft());
        document.getElementById('rotate-right').addEventListener('click', () => this.rotateRight());
        document.getElementById('flip-h').addEventListener('click', () => this.flipHorizontal());
        document.getElementById('flip-v').addEventListener('click', () => this.flipVertical());

        // Menu Filtres
        document.getElementById('filter-grayscale').addEventListener('click', () => this.applyFilter('grayscale'));
        document.getElementById('filter-sepia').addEventListener('click', () => this.applyFilter('sepia'));
        document.getElementById('filter-invert').addEventListener('click', () => this.applyFilter('invert'));
        document.getElementById('filter-blur').addEventListener('click', () => this.openBlurModal());
        document.getElementById('filter-sharpen').addEventListener('click', () => this.applyFilter('sharpen'));
        document.getElementById('filter-vignette').addEventListener('click', () => this.openVignetteModal());

        // Menu Réglages
        document.getElementById('adj-brightness').addEventListener('click', () => this.openBrightnessModal());
        document.getElementById('adj-hue-saturation').addEventListener('click', () => this.openHueSaturationModal());
        document.getElementById('adj-white-balance').addEventListener('click', () => this.openWhiteBalanceModal());
        document.getElementById('adj-shadows-highlights').addEventListener('click', () => this.openShadowsHighlightsModal());

        // Menu Aide
        document.getElementById('show-help').addEventListener('click', () => this.openHelpModal());

        // Boutons d'accueil
        document.getElementById('welcome-new').addEventListener('click', () => this.openNewProjectModal());
        document.getElementById('welcome-open').addEventListener('click', () => this.openFile());

        // Zoom
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoom-fit').addEventListener('click', () => this.zoomToFit());
    }

    /**
     * Configurer la barre d'outils
     */
    setupToolbar() {
        // Sélection des outils
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.toolManager.setTool(btn.dataset.tool);
                this.updateCurrentTool(btn.dataset.tool);

                // Synchroniser avec la toolbar mobile
                document.querySelectorAll('.mobile-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                const mobileBtn = document.querySelector(`.mobile-tool-btn[data-tool="${btn.dataset.tool}"]`);
                if (mobileBtn) mobileBtn.classList.add('active');

                // Fermer la sidebar outils sur mobile après sélection
                const toolbarLeft = document.getElementById('toolbar-left');
                const mobileToolbarOverlay = document.getElementById('mobile-toolbar-overlay');
                const mobileToolbarToggle = document.getElementById('mobile-toolbar-toggle');
                if (toolbarLeft && window.innerWidth <= 768) {
                    toolbarLeft.classList.remove('visible');
                    if (mobileToolbarOverlay) mobileToolbarOverlay.classList.remove('visible');
                    if (mobileToolbarToggle) mobileToolbarToggle.classList.remove('toolbar-open');
                }
            });
        });

        // Options des outils
        document.getElementById('brush-size').addEventListener('input', (e) => {
            this.toolManager.options.brushSize = parseInt(e.target.value);
            document.getElementById('brush-size-value').textContent = e.target.value + 'px';
        });

        document.getElementById('brush-hardness').addEventListener('input', (e) => {
            this.toolManager.options.brushHardness = parseInt(e.target.value);
            document.getElementById('brush-hardness-value').textContent = e.target.value + '%';
        });

        document.getElementById('brush-opacity').addEventListener('input', (e) => {
            this.toolManager.options.brushOpacity = parseInt(e.target.value);
            document.getElementById('brush-opacity-value').textContent = e.target.value + '%';
        });

        document.getElementById('shape-fill').addEventListener('change', (e) => {
            this.toolManager.options.shapeFill = e.target.checked;
        });

        document.getElementById('shape-stroke-width').addEventListener('input', (e) => {
            this.toolManager.options.shapeStrokeWidth = parseInt(e.target.value);
            document.getElementById('shape-stroke-value').textContent = e.target.value + 'px';
        });

        // Couleurs
        document.getElementById('foreground-color').addEventListener('input', (e) => {
            this.toolManager.options.foregroundColor = e.target.value;
            this.updateSelectedColor(e.target.value);
        });

        document.getElementById('background-color').addEventListener('input', (e) => {
            this.toolManager.options.backgroundColor = e.target.value;
        });

        document.getElementById('swap-colors').addEventListener('click', () => {
            const fg = this.toolManager.options.foregroundColor;
            const bg = this.toolManager.options.backgroundColor;
            this.toolManager.options.foregroundColor = bg;
            this.toolManager.options.backgroundColor = fg;
            document.getElementById('foreground-color').value = bg;
            document.getElementById('background-color').value = fg;
            this.updateSelectedColor(bg);
        });

        document.getElementById('reset-colors').addEventListener('click', () => {
            this.toolManager.options.foregroundColor = '#000000';
            this.toolManager.options.backgroundColor = '#ffffff';
            document.getElementById('foreground-color').value = '#000000';
            document.getElementById('background-color').value = '#ffffff';
            this.updateSelectedColor('#000000');
        });

        // Options texte
        document.getElementById('text-font').addEventListener('change', (e) => {
            this.toolManager.options.textFont = e.target.value;
        });

        document.getElementById('text-size').addEventListener('input', (e) => {
            this.toolManager.options.textSize = parseInt(e.target.value);
        });

        document.getElementById('text-bold').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            this.toolManager.options.textBold = e.target.classList.contains('active');
        });

        document.getElementById('text-italic').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            this.toolManager.options.textItalic = e.target.classList.contains('active');
        });

        document.getElementById('gradient-type').addEventListener('change', (e) => {
            this.toolManager.options.gradientType = e.target.value;
        });

        // Tolérance (baguette magique)
        document.getElementById('wand-tolerance').addEventListener('input', (e) => {
            this.toolManager.options.tolerance = parseInt(e.target.value);
            document.getElementById('tolerance-value').textContent = e.target.value;
        });

        // Contour progressif (feather)
        document.getElementById('selection-feather').addEventListener('input', (e) => {
            this.toolManager.options.feather = parseInt(e.target.value);
            document.getElementById('feather-value').textContent = e.target.value + 'px';
        });
    }

    /**
     * Configurer les panneaux
     */
    setupPanels() {
        // Toggle des panneaux
        document.querySelectorAll('.panel-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });

        // Contrôles des calques
        document.getElementById('add-layer').addEventListener('click', () => this.addLayer());
        document.getElementById('delete-layer').addEventListener('click', () => this.deleteLayer());
        document.getElementById('duplicate-layer').addEventListener('click', () => this.duplicateLayer());
        document.getElementById('merge-layers').addEventListener('click', () => this.mergeLayers());
        document.getElementById('move-layer-up').addEventListener('click', () => this.moveLayerUp());
        document.getElementById('move-layer-down').addEventListener('click', () => this.moveLayerDown());

        // Contrôles des masques
        document.getElementById('add-mask').addEventListener('click', () => this.addLayerMask());
        document.getElementById('add-mask-from-selection').addEventListener('click', () => this.addMaskFromSelection());
        document.getElementById('remove-mask').addEventListener('click', () => this.removeLayerMask());
        document.getElementById('apply-mask').addEventListener('click', () => this.applyLayerMask());

        // Opacité et mode de fusion des calques
        document.getElementById('layer-opacity').addEventListener('input', (e) => {
            const opacity = parseInt(e.target.value);
            document.getElementById('layer-opacity-value').textContent = opacity + '%';
            if (this.layerManager) {
                this.layerManager.setLayerOpacity(this.layerManager.activeLayerIndex, opacity);
                this.render();
            }
        });

        document.getElementById('blend-mode').addEventListener('change', (e) => {
            if (this.layerManager) {
                this.layerManager.setLayerBlendMode(this.layerManager.activeLayerIndex, e.target.value);
                this.render();
            }
        });
    }

    /**
     * Configurer les modales
     */
    setupModals() {
        // Fermeture des modales
        document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
                this.restorePreview();
            });
        });

        // Clic à l'extérieur pour fermer
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    this.restorePreview();
                }
            });
        });

        // Modal Nouveau projet
        document.querySelectorAll('#new-project-modal .presets button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('new-width').value = btn.dataset.width;
                document.getElementById('new-height').value = btn.dataset.height;
            });
        });

        document.getElementById('create-project').addEventListener('click', (e) => {
            e.stopPropagation();
            const width = parseInt(document.getElementById('new-width').value) || 800;
            const height = parseInt(document.getElementById('new-height').value) || 600;
            const bgTypeEl = document.querySelector('input[name="bg-type"]:checked');
            const bgType = bgTypeEl ? bgTypeEl.value : 'white';
            let bgColor = 'transparent';
            if (bgType === 'white') bgColor = '#ffffff';
            else if (bgType === 'color') bgColor = document.getElementById('new-bg-color').value;

            document.getElementById('new-project-modal').classList.remove('active');
            // Petit délai pour que la modale se ferme avant la création
            requestAnimationFrame(() => {
                this.createNewProject(width, height, bgColor);
            });
        });

        // Modal Redimensionner
        document.getElementById('apply-resize').addEventListener('click', () => this.applyResize());

        // Maintenir les proportions
        const resizeWidth = document.getElementById('resize-width');
        const resizeHeight = document.getElementById('resize-height');
        let aspectRatio = 1;

        resizeWidth.addEventListener('input', () => {
            if (document.getElementById('maintain-aspect').checked && this.layerManager) {
                resizeHeight.value = Math.round(resizeWidth.value / aspectRatio);
            }
        });

        resizeHeight.addEventListener('input', () => {
            if (document.getElementById('maintain-aspect').checked && this.layerManager) {
                resizeWidth.value = Math.round(resizeHeight.value * aspectRatio);
            }
        });

        // Modal Luminosité/Contraste
        this.setupAdjustmentSliders('brightness-modal', ['adj-brightness-slider', 'adj-contrast-slider'],
            ['brightness-value', 'contrast-value'], 'preview-brightness', () => {
                return {
                    brightness: parseInt(document.getElementById('adj-brightness-slider').value),
                    contrast: parseInt(document.getElementById('adj-contrast-slider').value)
                };
            }, (values) => {
                return Adjustments.brightnessContrast(this.previewData, values.brightness, values.contrast);
            });

        document.getElementById('apply-brightness').addEventListener('click', () => {
            this.applyCurrentPreview();
            document.getElementById('brightness-modal').classList.remove('active');
            this.saveHistory('Luminosité/Contraste');
        });

        // Modal Teinte/Saturation
        this.setupAdjustmentSliders('hue-saturation-modal',
            ['adj-hue-slider', 'adj-saturation-slider', 'adj-lightness-slider'],
            ['hue-value', 'saturation-value', 'lightness-value'], 'preview-hue', () => {
                return {
                    hue: parseInt(document.getElementById('adj-hue-slider').value),
                    saturation: parseInt(document.getElementById('adj-saturation-slider').value),
                    lightness: parseInt(document.getElementById('adj-lightness-slider').value)
                };
            }, (values) => {
                return Adjustments.hueSaturationLightness(this.previewData, values.hue, values.saturation, values.lightness);
            });

        document.getElementById('apply-hue-saturation').addEventListener('click', () => {
            this.applyCurrentPreview();
            document.getElementById('hue-saturation-modal').classList.remove('active');
            this.saveHistory('Teinte/Saturation');
        });

        // Modal Balance des blancs
        this.setupAdjustmentSliders('white-balance-modal',
            ['adj-temperature-slider', 'adj-tint-slider'],
            ['temperature-value', 'tint-value'], 'preview-wb', () => {
                return {
                    temperature: parseInt(document.getElementById('adj-temperature-slider').value),
                    tint: parseInt(document.getElementById('adj-tint-slider').value)
                };
            }, (values) => {
                return Adjustments.whiteBalance(this.previewData, values.temperature, values.tint);
            });

        document.getElementById('apply-white-balance').addEventListener('click', () => {
            this.applyCurrentPreview();
            document.getElementById('white-balance-modal').classList.remove('active');
            this.saveHistory('Balance des blancs');
        });

        // Modal Ombres/Hautes lumières
        this.setupAdjustmentSliders('shadows-highlights-modal',
            ['adj-shadows-slider', 'adj-highlights-slider'],
            ['shadows-value', 'highlights-value'], 'preview-sh', () => {
                return {
                    shadows: parseInt(document.getElementById('adj-shadows-slider').value),
                    highlights: parseInt(document.getElementById('adj-highlights-slider').value)
                };
            }, (values) => {
                return Adjustments.shadowsHighlights(this.previewData, values.shadows, values.highlights);
            });

        document.getElementById('apply-shadows-highlights').addEventListener('click', () => {
            this.applyCurrentPreview();
            document.getElementById('shadows-highlights-modal').classList.remove('active');
            this.saveHistory('Ombres/Hautes lumières');
        });

        // Modal Flou
        document.getElementById('blur-radius').addEventListener('input', (e) => {
            document.getElementById('blur-radius-value').textContent = e.target.value + 'px';
            if (document.getElementById('preview-blur').checked) {
                this.previewBlur();
            }
        });

        document.getElementById('preview-blur').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.previewBlur();
            } else {
                this.restorePreview();
            }
        });

        document.getElementById('apply-blur').addEventListener('click', () => {
            this.applyBlur();
            document.getElementById('blur-modal').classList.remove('active');
        });

        // Modal Vignette
        document.getElementById('vignette-intensity').addEventListener('input', (e) => {
            document.getElementById('vignette-intensity-value').textContent = e.target.value + '%';
            if (document.getElementById('preview-vignette').checked) {
                this.previewVignette();
            }
        });

        document.getElementById('vignette-radius').addEventListener('input', (e) => {
            document.getElementById('vignette-radius-value').textContent = e.target.value + '%';
            if (document.getElementById('preview-vignette').checked) {
                this.previewVignette();
            }
        });

        document.getElementById('preview-vignette').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.previewVignette();
            } else {
                this.restorePreview();
            }
        });

        document.getElementById('apply-vignette').addEventListener('click', () => {
            this.applyVignette();
            document.getElementById('vignette-modal').classList.remove('active');
        });

        // Modal Texte
        document.getElementById('apply-text').addEventListener('click', () => {
            const text = document.getElementById('text-input').value;
            this.toolManager.addText(text);
            document.getElementById('text-modal').classList.remove('active');
            document.getElementById('text-input').value = '';
            this.render();
        });
    }

    /**
     * Configuration des sliders d'ajustement avec aperçu
     */
    setupAdjustmentSliders(modalId, sliderIds, valueIds, previewCheckboxId, getValues, applyAdjustment) {
        const updatePreview = Utils.debounce(() => {
            const previewCheckbox = document.getElementById(previewCheckboxId);
            if (previewCheckbox && previewCheckbox.checked && this.previewData) {
                const values = getValues();
                const layer = this.layerManager.getActiveLayer();
                if (layer) {
                    const adjusted = applyAdjustment(values);
                    layer.ctx.putImageData(adjusted, 0, 0);
                    this.render();
                    // Recréer previewData pour le prochain ajustement
                    this.previewData = new ImageData(
                        new Uint8ClampedArray(this.originalImageData.data),
                        this.originalImageData.width,
                        this.originalImageData.height
                    );
                }
            }
        }, 50);

        sliderIds.forEach((sliderId, index) => {
            const slider = document.getElementById(sliderId);
            const valueSpan = document.getElementById(valueIds[index]);

            slider.addEventListener('input', () => {
                let suffix = '';
                if (sliderId.includes('hue')) suffix = '°';
                valueSpan.textContent = slider.value + suffix;
                updatePreview();
            });
        });

        const previewCheckbox = document.getElementById(previewCheckboxId);
        if (previewCheckbox) {
            previewCheckbox.addEventListener('change', (e) => {
                if (!e.target.checked) {
                    this.restorePreview();
                } else {
                    updatePreview();
                }
            });
        }
    }

    /**
     * Configurer le drag and drop
     */
    setupDragAndDrop() {
        this.workspace.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.workspace.classList.add('drag-over');
        });

        this.workspace.addEventListener('dragleave', () => {
            this.workspace.classList.remove('drag-over');
        });

        this.workspace.addEventListener('drop', (e) => {
            e.preventDefault();
            this.workspace.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.loadImageFile(files[0]);
            }
        });
    }

    /**
     * Configurer les raccourcis clavier
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ne pas traiter si on est dans un input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const key = e.key.toLowerCase();

            // Raccourcis avec Ctrl
            if (e.ctrlKey || e.metaKey) {
                switch (key) {
                    // Fichier
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                    case 'c':
                        e.preventDefault();
                        this.copySelection();
                        break;
                    case 'x':
                        e.preventDefault();
                        this.cutSelection();
                        break;
                    case 'v':
                        e.preventDefault();
                        if (this.clipboard) {
                            this.pasteClipboard();
                        } else {
                            this.selectTool('move');
                        }
                        break;
                    case 's':
                        e.preventDefault();
                        this.exportImage('png');
                        break;
                    case 'o':
                        e.preventDefault();
                        this.openFile();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.openNewProjectModal();
                        break;
                    // Zoom
                    case '=':
                    case '+':
                        e.preventDefault();
                        this.zoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        this.zoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        this.zoomToFit();
                        break;
                    // Outils (Ctrl + lettre)
                    case 'm':
                        e.preventDefault();
                        this.selectTool('select');
                        break;
                    case 'b':
                        e.preventDefault();
                        this.selectTool('brush');
                        break;
                    case 'e':
                        e.preventDefault();
                        this.selectTool('eraser');
                        break;
                    case 'g':
                        e.preventDefault();
                        this.selectTool('bucket');
                        break;
                    case 't':
                        e.preventDefault();
                        this.selectTool('text');
                        break;
                    case 'l':
                        e.preventDefault();
                        this.selectTool('line');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.selectTool('rectangle');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.selectTool('eyedropper');
                        break;
                    case 'j':
                        e.preventDefault();
                        this.selectTool('clone');
                        break;
                    case 'k':
                        e.preventDefault();
                        this.selectTool('crop');
                        break;
                    case 'h':
                        e.preventDefault();
                        this.selectTool('hand');
                        break;
                    case 'r':
                        e.preventDefault();
                        this.selectTool('rectangle');
                        break;
                    case 'p':
                        e.preventDefault();
                        this.selectTool('ellipse');
                        break;
                    case 'd':
                        e.preventDefault();
                        this.selectTool('gradient');
                        break;
                }
                return;
            }

            // Raccourcis sans Ctrl
            switch (key) {
                case 'l':
                    this.selectTool('lasso');
                    break;
                case 'w':
                    this.selectTool('magic-wand');
                    break;
                case 'x':
                    // Permuter les couleurs
                    document.getElementById('swap-colors').click();
                    break;
                case '[':
                    // Réduire la taille du pinceau
                    this.adjustBrushSize(-5);
                    break;
                case ']':
                    // Augmenter la taille du pinceau
                    this.adjustBrushSize(5);
                    break;
                case 'escape':
                    // Annuler l'opération en cours
                    this.toolManager.cancelCrop();
                    this.clearSelection();
                    break;
                case 'enter':
                    // Appliquer le recadrage
                    if (this.toolManager.cropRect) {
                        this.toolManager.applyCrop();
                    }
                    break;
                case 'delete':
                case 'backspace':
                    // Supprimer la sélection
                    if (this.selection) {
                        e.preventDefault();
                        this.deleteSelection();
                    }
                    break;
            }
        });
    }

    /**
     * Créer un nouveau projet
     */
    createNewProject(width, height, bgColor = '#ffffff') {
        this.layerManager = new LayerManager(width, height);
        this.layerManager.addListener(() => {
            this.updateLayersPanel();
            this.render();
        });

        // Créer le calque de fond
        this.layerManager.createBackgroundLayer(bgColor);

        // Configurer le canvas principal
        this.mainCanvas.width = width;
        this.mainCanvas.height = height;

        // Sauvegarder l'état initial
        this.saveHistory('Nouveau projet');

        // Afficher le canvas
        this.showCanvas();
        this.render();
        this.zoomToFit();
        this.updateUI();
    }

    /**
     * Ouvrir un fichier
     */
    openFile() {
        const input = document.getElementById('file-input');
        input.click();

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                this.loadImageFile(file);
            }
            input.value = '';
        };
    }

    /**
     * Charger un fichier image
     */
    async loadImageFile(file) {
        try {
            const image = await Utils.loadImageFromFile(file);

            // Si aucun projet n'est ouvert, en créer un
            if (!this.isProjectOpen) {
                this.layerManager = new LayerManager(image.width, image.height);
                this.layerManager.addListener(() => {
                    this.updateLayersPanel();
                    this.render();
                });
                this.mainCanvas.width = image.width;
                this.mainCanvas.height = image.height;
            }

            // Créer un calque avec l'image
            this.layerManager.createLayerFromImage(image, file.name.replace(/\.[^/.]+$/, ''));

            this.saveHistory('Import image');
            this.showCanvas();
            this.render();
            this.zoomToFit();
            this.updateUI();
        } catch (error) {
            console.error('Erreur lors du chargement de l\'image:', error);
            alert('Erreur lors du chargement de l\'image.');
        }
    }

    /**
     * Afficher le canvas
     */
    showCanvas() {
        this.welcomeScreen.classList.add('hidden');
        this.canvasContainer.style.display = 'block';
        this.isProjectOpen = true;
    }

    /**
     * Exporter l'image
     */
    exportImage(format) {
        if (!this.layerManager) return;

        const composited = this.layerManager.composite();
        const quality = format === 'jpeg' ? 0.92 : undefined;
        const dataURL = Utils.canvasToDataURL(composited, format, quality);
        const filename = `fotoedit_export_${Date.now()}.${format}`;

        Utils.downloadFile(dataURL, filename);
    }

    /**
     * Rendre le canvas
     */
    render() {
        if (!this.layerManager) return;

        const composited = this.layerManager.composite();
        const ctx = this.mainCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        ctx.drawImage(composited, 0, 0);

        // Dessiner le canvas temporaire de l'outil si présent
        if (this.toolManager.tempCanvas) {
            ctx.globalAlpha = this.toolManager.options.brushOpacity / 100;
            ctx.drawImage(this.toolManager.tempCanvas, 0, 0);
            ctx.globalAlpha = 1;
        }

        // Dessiner la sélection en pointillés
        if (this.selection) {
            this.renderSelection();
            // Dessiner les poignées de déplacement si l'outil move est actif
            if (this.toolManager.currentTool === 'move') {
                this.renderMoveHandles();
            }
        }

        // Dessiner l'overlay de recadrage
        if (this.toolManager.cropRect && this.toolManager.currentTool === 'crop') {
            this.renderCropOverlay();
        }
    }

    /**
     * Dessiner l'overlay de recadrage sur le canvas
     */
    renderCropOverlay() {
        const rect = this.toolManager.cropRect;
        if (!rect || rect.width === 0 || rect.height === 0) return;

        const ctx = this.mainCanvas.getContext('2d');
        const w = this.mainCanvas.width;
        const h = this.mainCanvas.height;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Zone assombrie en dehors du recadrage
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, w, rect.y);
        ctx.fillRect(0, rect.y, rect.x, rect.height);
        ctx.fillRect(rect.x + rect.width, rect.y, w - rect.x - rect.width, rect.height);
        ctx.fillRect(0, rect.y + rect.height, w, h - rect.y - rect.height);

        // Bordure du recadrage
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        // Grille des tiers
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        const thirdW = rect.width / 3;
        const thirdH = rect.height / 3;
        for (let i = 1; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(rect.x + thirdW * i, rect.y);
            ctx.lineTo(rect.x + thirdW * i, rect.y + rect.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(rect.x, rect.y + thirdH * i);
            ctx.lineTo(rect.x + rect.width, rect.y + thirdH * i);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Sauvegarder dans l'historique
     */
    saveHistory(actionName) {
        if (!this.layerManager) return;
        this.historyManager.saveState(this.layerManager.getLayers(), actionName);
    }

    /**
     * Annuler
     */
    async undo() {
        const layers = await this.historyManager.undo();
        if (layers) {
            this.layerManager.setLayers(layers);
            this.updateCanvasSize();
            this.render();
        }
    }

    /**
     * Rétablir
     */
    async redo() {
        const layers = await this.historyManager.redo();
        if (layers) {
            this.layerManager.setLayers(layers);
            this.updateCanvasSize();
            this.render();
        }
    }

    /**
     * Mettre à jour la taille du canvas
     */
    updateCanvasSize() {
        if (!this.layerManager) return;
        this.mainCanvas.width = this.layerManager.width;
        this.mainCanvas.height = this.layerManager.height;
        document.getElementById('canvas-size').textContent =
            `${this.layerManager.width} × ${this.layerManager.height} px`;
        this.render();
    }

    // ==========================================
    // Gestion des calques
    // ==========================================

    addLayer() {
        if (!this.layerManager) return;
        this.layerManager.createLayer();
        this.saveHistory('Nouveau calque');
        this.render();
    }

    deleteLayer() {
        if (!this.layerManager) return;
        if (this.layerManager.deleteLayer()) {
            this.saveHistory('Supprimer calque');
            this.render();
        }
    }

    duplicateLayer() {
        if (!this.layerManager) return;
        this.layerManager.duplicateLayer();
        this.saveHistory('Dupliquer calque');
        this.render();
    }

    mergeLayers() {
        if (!this.layerManager) return;
        if (this.layerManager.mergeDown()) {
            this.saveHistory('Fusionner calques');
            this.render();
        }
    }

    moveLayerUp() {
        if (!this.layerManager) return;
        if (this.layerManager.moveLayerUp()) {
            this.render();
        }
    }

    moveLayerDown() {
        if (!this.layerManager) return;
        if (this.layerManager.moveLayerDown()) {
            this.render();
        }
    }

    updateLayersPanel() {
        const list = document.getElementById('layers-list');
        list.innerHTML = '';

        if (!this.layerManager) return;

        // Afficher les calques dans l'ordre inverse (le plus haut en premier)
        const layers = this.layerManager.getLayers();
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const item = document.createElement('div');
            item.className = 'layer-item' + (i === this.layerManager.activeLayerIndex ? ' active' : '');
            item.dataset.index = i;

            item.innerHTML = `
                <button class="layer-visibility ${layer.visible ? '' : 'hidden'}" title="Visibilité">
                    <i class="fas fa-${layer.visible ? 'eye' : 'eye-slash'}"></i>
                </button>
                <div class="layer-thumbnail">
                    <canvas></canvas>
                </div>
                <span class="layer-name">${layer.name}</span>
                ${layer.mask ? `<span class="layer-mask-indicator ${layer.maskEnabled ? 'active' : 'disabled'}" title="Masque${layer.maskEnabled ? ' (actif)' : ' (désactivé)'}"><i class="fas fa-mask"></i></span>` : ''}
            `;

            // Mettre à jour la miniature
            const thumbCanvas = item.querySelector('.layer-thumbnail canvas');
            thumbCanvas.width = 32;
            thumbCanvas.height = 32;
            const thumbCtx = thumbCanvas.getContext('2d');
            const scale = Math.min(32 / layer.canvas.width, 32 / layer.canvas.height);
            const w = layer.canvas.width * scale;
            const h = layer.canvas.height * scale;
            thumbCtx.drawImage(layer.canvas, (32 - w) / 2, (32 - h) / 2, w, h);

            // Événements
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.layer-visibility')) {
                    this.layerManager.setActiveLayer(i);
                    this.updateLayerProperties();
                }
            });

            item.querySelector('.layer-visibility').addEventListener('click', (e) => {
                e.stopPropagation();
                this.layerManager.setLayerVisibility(i, !layer.visible);
                this.render();
            });

            const maskIndicator = item.querySelector('.layer-mask-indicator');
            if (maskIndicator) {
                maskIndicator.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.layerManager.toggleMask(i);
                    this.render();
                });
            }

            // Double-clic pour renommer
            item.querySelector('.layer-name').addEventListener('dblclick', (e) => {
                const span = e.target;
                const input = document.createElement('input');
                input.type = 'text';
                input.value = layer.name;
                input.className = 'layer-name';

                span.replaceWith(input);
                input.focus();
                input.select();

                input.addEventListener('blur', () => {
                    this.layerManager.renameLayer(i, input.value);
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    }
                });
            });

            list.appendChild(item);
        }

        this.updateLayerProperties();
    }

    updateLayerProperties() {
        if (!this.layerManager) return;
        const layer = this.layerManager.getActiveLayer();
        if (layer) {
            document.getElementById('layer-opacity').value = layer.opacity;
            document.getElementById('layer-opacity-value').textContent = layer.opacity + '%';
            document.getElementById('blend-mode').value = layer.blendMode;
        }
    }

    // ==========================================
    // Zoom et navigation
    // ==========================================

    zoomIn() {
        this.zoom = Math.min(this.zoom * 1.25, 10);
        this.applyZoom();
    }

    zoomOut() {
        this.zoom = Math.max(this.zoom / 1.25, 0.1);
        this.applyZoom();
    }

    zoomToFit() {
        if (!this.layerManager) return;

        const container = this.workspace;
        const padding = 40;
        const availWidth = container.clientWidth - padding * 2;
        const availHeight = container.clientHeight - padding * 2;

        const scaleX = availWidth / this.layerManager.width;
        const scaleY = availHeight / this.layerManager.height;

        this.zoom = Math.min(scaleX, scaleY, 1);
        this.panX = 0;
        this.panY = 0;
        this.applyZoom();
    }

    applyZoom() {
        this.canvasContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
    }

    // ==========================================
    // Transformations
    // ==========================================

    rotateLeft() {
        if (!this.layerManager) return;
        this.layerManager.rotate90(false);
        this.updateCanvasSize();
        this.saveHistory('Rotation gauche');
    }

    rotateRight() {
        if (!this.layerManager) return;
        this.layerManager.rotate90(true);
        this.updateCanvasSize();
        this.saveHistory('Rotation droite');
    }

    flipHorizontal() {
        if (!this.layerManager) return;
        this.layerManager.flipHorizontal();
        this.render();
        this.saveHistory('Retournement horizontal');
    }

    flipVertical() {
        if (!this.layerManager) return;
        this.layerManager.flipVertical();
        this.render();
        this.saveHistory('Retournement vertical');
    }

    activateCropTool() {
        this.selectTool('crop');
    }

    openResizeModal() {
        if (!this.layerManager) return;
        document.getElementById('resize-width').value = this.layerManager.width;
        document.getElementById('resize-height').value = this.layerManager.height;
        document.getElementById('resize-modal').classList.add('active');
    }

    applyResize() {
        if (!this.layerManager) return;
        const width = parseInt(document.getElementById('resize-width').value);
        const height = parseInt(document.getElementById('resize-height').value);
        const method = document.getElementById('resize-method').value;

        this.layerManager.resize(width, height, method);
        this.updateCanvasSize();
        this.saveHistory('Redimensionnement');

        document.getElementById('resize-modal').classList.remove('active');
    }

    // ==========================================
    // Filtres
    // ==========================================

    applyFilter(filterName) {
        if (!this.layerManager) return;
        const layer = this.layerManager.getActiveLayer();
        if (!layer) return;

        const imageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);

        let filtered;
        switch (filterName) {
            case 'grayscale':
                filtered = Filters.grayscale(imageData);
                break;
            case 'sepia':
                filtered = Filters.sepia(imageData);
                break;
            case 'invert':
                filtered = Filters.invert(imageData);
                break;
            case 'sharpen':
                filtered = Filters.sharpen(imageData);
                break;
        }

        if (filtered) {
            layer.ctx.putImageData(filtered, 0, 0);
            this.render();
            this.saveHistory(filterName.charAt(0).toUpperCase() + filterName.slice(1));
        }
    }

    openBlurModal() {
        if (!this.layerManager) return;
        this.storePreviewData();
        document.getElementById('blur-radius').value = 5;
        document.getElementById('blur-radius-value').textContent = '5px';
        document.getElementById('blur-modal').classList.add('active');
    }

    previewBlur() {
        if (!this.previewData) return;
        const radius = parseInt(document.getElementById('blur-radius').value);
        const layer = this.layerManager.getActiveLayer();
        if (layer) {
            const blurred = Filters.blur(new ImageData(
                new Uint8ClampedArray(this.originalImageData.data),
                this.originalImageData.width,
                this.originalImageData.height
            ), radius);
            layer.ctx.putImageData(blurred, 0, 0);
            this.render();
        }
    }

    applyBlur() {
        const radius = parseInt(document.getElementById('blur-radius').value);
        const layer = this.layerManager.getActiveLayer();
        if (layer && this.originalImageData) {
            const blurred = Filters.blur(new ImageData(
                new Uint8ClampedArray(this.originalImageData.data),
                this.originalImageData.width,
                this.originalImageData.height
            ), radius);
            layer.ctx.putImageData(blurred, 0, 0);
            this.render();
            this.saveHistory('Flou');
        }
        this.previewData = null;
        this.originalImageData = null;
    }

    openVignetteModal() {
        if (!this.layerManager) return;
        this.storePreviewData();
        document.getElementById('vignette-intensity').value = 50;
        document.getElementById('vignette-radius').value = 70;
        document.getElementById('vignette-intensity-value').textContent = '50%';
        document.getElementById('vignette-radius-value').textContent = '70%';
        document.getElementById('vignette-modal').classList.add('active');
    }

    previewVignette() {
        if (!this.previewData) return;
        const intensity = parseInt(document.getElementById('vignette-intensity').value) / 100;
        const radius = parseInt(document.getElementById('vignette-radius').value) / 100;
        const layer = this.layerManager.getActiveLayer();
        if (layer) {
            const vignetted = Filters.vignette(new ImageData(
                new Uint8ClampedArray(this.originalImageData.data),
                this.originalImageData.width,
                this.originalImageData.height
            ), intensity, radius);
            layer.ctx.putImageData(vignetted, 0, 0);
            this.render();
        }
    }

    applyVignette() {
        const intensity = parseInt(document.getElementById('vignette-intensity').value) / 100;
        const radius = parseInt(document.getElementById('vignette-radius').value) / 100;
        const layer = this.layerManager.getActiveLayer();
        if (layer && this.originalImageData) {
            const vignetted = Filters.vignette(new ImageData(
                new Uint8ClampedArray(this.originalImageData.data),
                this.originalImageData.width,
                this.originalImageData.height
            ), intensity, radius);
            layer.ctx.putImageData(vignetted, 0, 0);
            this.render();
            this.saveHistory('Vignette');
        }
        this.previewData = null;
        this.originalImageData = null;
    }

    // ==========================================
    // Ajustements
    // ==========================================

    storePreviewData() {
        const layer = this.layerManager.getActiveLayer();
        if (layer) {
            this.originalImageData = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
            this.previewData = new ImageData(
                new Uint8ClampedArray(this.originalImageData.data),
                this.originalImageData.width,
                this.originalImageData.height
            );
        }
    }

    restorePreview() {
        if (this.originalImageData) {
            const layer = this.layerManager.getActiveLayer();
            if (layer) {
                layer.ctx.putImageData(this.originalImageData, 0, 0);
                this.render();
            }
        }
        this.previewData = null;
        this.originalImageData = null;
    }

    applyCurrentPreview() {
        // L'aperçu est déjà appliqué au calque, on ne fait que nettoyer
        this.previewData = null;
        this.originalImageData = null;
    }

    openBrightnessModal() {
        if (!this.layerManager) return;
        this.storePreviewData();
        document.getElementById('adj-brightness-slider').value = 0;
        document.getElementById('adj-contrast-slider').value = 0;
        document.getElementById('brightness-value').textContent = '0';
        document.getElementById('contrast-value').textContent = '0';
        document.getElementById('brightness-modal').classList.add('active');
    }

    openHueSaturationModal() {
        if (!this.layerManager) return;
        this.storePreviewData();
        document.getElementById('adj-hue-slider').value = 0;
        document.getElementById('adj-saturation-slider').value = 0;
        document.getElementById('adj-lightness-slider').value = 0;
        document.getElementById('hue-value').textContent = '0°';
        document.getElementById('saturation-value').textContent = '0';
        document.getElementById('lightness-value').textContent = '0';
        document.getElementById('hue-saturation-modal').classList.add('active');
    }

    openWhiteBalanceModal() {
        if (!this.layerManager) return;
        this.storePreviewData();
        document.getElementById('adj-temperature-slider').value = 0;
        document.getElementById('adj-tint-slider').value = 0;
        document.getElementById('temperature-value').textContent = '0';
        document.getElementById('tint-value').textContent = '0';
        document.getElementById('white-balance-modal').classList.add('active');
    }

    openShadowsHighlightsModal() {
        if (!this.layerManager) return;
        this.storePreviewData();
        document.getElementById('adj-shadows-slider').value = 0;
        document.getElementById('adj-highlights-slider').value = 0;
        document.getElementById('shadows-value').textContent = '0';
        document.getElementById('highlights-value').textContent = '0';
        document.getElementById('shadows-highlights-modal').classList.add('active');
    }

    openHelpModal() {
        document.getElementById('help-modal').classList.add('active');
    }

    // ==========================================
    // Sélection
    // ==========================================

    setSelection(rect) {
        this.selection = rect;
        this.render();
        this.startSelectionAnimation();
    }

    /**
     * Démarrer l'animation de la sélection (marching ants)
     */
    startSelectionAnimation() {
        if (this._selectionAnimFrame) return;
        const animate = () => {
            if (!this.selection) {
                this._selectionAnimFrame = null;
                return;
            }
            this.render();
            this._selectionAnimFrame = requestAnimationFrame(animate);
        };
        this._selectionAnimFrame = requestAnimationFrame(animate);
    }

    /**
     * Arrêter l'animation de la sélection
     */
    stopSelectionAnimation() {
        if (this._selectionAnimFrame) {
            cancelAnimationFrame(this._selectionAnimFrame);
            this._selectionAnimFrame = null;
        }
    }

    clearSelection() {
        this.selection = null;
        this.selectionMask = null;
        this.selectionPath = null;
        this.stopSelectionAnimation();
        this.render();
    }

    drawSelection(rect) {
        // Le rendu de la sélection se fait dans render()
        this.selection = {
            x: Math.min(rect.x, rect.x + rect.width),
            y: Math.min(rect.y, rect.y + rect.height),
            width: Math.abs(rect.width),
            height: Math.abs(rect.height),
            type: rect.type || 'rectangle'  // Préserver le type (rectangle ou ellipse)
        };
    }

    /**
     * Dessiner la sélection en pointillés sur le canvas principal
     */
    renderSelection() {
        if (!this.selection || this.selection.width === 0 || this.selection.height === 0) return;

        const ctx = this.mainCanvas.getContext('2d');
        const sel = this.selection;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Si on a un chemin de lasso, dessiner le chemin
        if (this.selectionPath && this.selectionPath.length > 2) {
            // Bordure blanche en dessous
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(this.selectionPath[0].x, this.selectionPath[0].y);
            for (let i = 1; i < this.selectionPath.length; i++) {
                ctx.lineTo(this.selectionPath[i].x, this.selectionPath[i].y);
            }
            ctx.closePath();
            ctx.stroke();

            // Bordure noire en pointillés par-dessus (marching ants)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.lineDashOffset = -(Date.now() / 80) % 10;
            ctx.beginPath();
            ctx.moveTo(this.selectionPath[0].x, this.selectionPath[0].y);
            for (let i = 1; i < this.selectionPath.length; i++) {
                ctx.lineTo(this.selectionPath[i].x, this.selectionPath[i].y);
            }
            ctx.closePath();
            ctx.stroke();
        } else if (sel.type === 'ellipse') {
            // Sélection elliptique
            const centerX = sel.x + sel.width / 2;
            const centerY = sel.y + sel.height / 2;
            const radiusX = sel.width / 2;
            const radiusY = sel.height / 2;

            // Bordure blanche en dessous
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Bordure noire en pointillés par-dessus (marching ants)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.lineDashOffset = -(Date.now() / 80) % 10;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Sélection rectangulaire standard
            // Bordure blanche en dessous
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);

            // Bordure noire en pointillés par-dessus (marching ants)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.lineDashOffset = -(Date.now() / 80) % 10;
            ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);
        }

        ctx.restore();
    }

    /**
     * Dessiner l'aperçu du lasso en cours de tracé
     */
    renderLassoPreview(points) {
        if (!points || points.length < 2) return;

        this.render();
        const ctx = this.mainCanvas.getContext('2d');

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Dessiner le chemin du lasso
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -(Date.now() / 80) % 8;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // Ligne de retour au point de départ
        ctx.strokeStyle = 'rgba(0, 120, 212, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.lineTo(points[0].x, points[0].y);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Dessiner l'aperçu du lasso polygonal
     */
    renderPolygonLassoPreview(points, cursorX, cursorY) {
        if (!points || points.length < 1) return;

        this.render();
        const ctx = this.mainCanvas.getContext('2d');

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Dessiner les lignes existantes du polygone (blanc)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // Dessiner les lignes existantes (pointillés noirs par dessus)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -(Date.now() / 80) % 8;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // Ligne du dernier point vers le curseur (preview)
        ctx.strokeStyle = 'rgba(0, 120, 212, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.lineTo(cursorX, cursorY);
        ctx.stroke();

        // Ligne du curseur vers le point de départ (fermeture preview)
        ctx.strokeStyle = 'rgba(0, 120, 212, 0.4)';
        ctx.beginPath();
        ctx.moveTo(cursorX, cursorY);
        ctx.lineTo(points[0].x, points[0].y);
        ctx.stroke();

        // Dessiner les points du polygone
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        for (const point of points) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Indicateur au premier point (pour fermer)
        if (points.length >= 3) {
            ctx.fillStyle = 'rgba(0, 120, 212, 0.3)';
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Dessiner les poignées de déplacement/redimensionnement
     */
    renderMoveHandles() {
        if (!this.selection) return;

        const ctx = this.mainCanvas.getContext('2d');
        const sel = this.selection;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const handleSize = 8;
        const half = handleSize / 2;

        // Positions des 8 poignées
        const handles = [
            { x: sel.x, y: sel.y },                                    // NW
            { x: sel.x + sel.width / 2, y: sel.y },                    // N
            { x: sel.x + sel.width, y: sel.y },                        // NE
            { x: sel.x + sel.width, y: sel.y + sel.height / 2 },      // E
            { x: sel.x + sel.width, y: sel.y + sel.height },          // SE
            { x: sel.x + sel.width / 2, y: sel.y + sel.height },      // S
            { x: sel.x, y: sel.y + sel.height },                      // SW
            { x: sel.x, y: sel.y + sel.height / 2 }                   // W
        ];

        for (const h of handles) {
            // Fond blanc
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(h.x - half, h.y - half, handleSize, handleSize);
            // Bordure bleue
            ctx.strokeStyle = '#0078d4';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.strokeRect(h.x - half, h.y - half, handleSize, handleSize);
        }

        ctx.restore();
    }

    deleteSelection() {
        if (!this.selection || !this.layerManager) return;
        const layer = this.layerManager.getActiveLayer();
        if (layer) {
            if (this.selectionMask) {
                // Supprimer uniquement les pixels dans le masque
                this.clearWithMask(layer, this.selectionMask);
            } else {
                layer.ctx.clearRect(
                    this.selection.x,
                    this.selection.y,
                    this.selection.width,
                    this.selection.height
                );
            }
            this.render();
            this.saveHistory('Supprimer sélection');
        }
        this.clearSelection();
    }

    /**
     * Effacer les pixels d'un calque en utilisant un masque
     */
    clearWithMask(layer, mask) {
        const w = layer.canvas.width;
        const h = layer.canvas.height;
        const layerData = layer.ctx.getImageData(0, 0, w, h);
        const maskCtx = mask.getContext('2d');
        const maskData = maskCtx.getImageData(0, 0, w, h);

        for (let i = 0; i < layerData.data.length; i += 4) {
            if (maskData.data[i + 3] > 0) {
                const maskAlpha = maskData.data[i + 3] / 255;
                layerData.data[i + 3] = Math.round(layerData.data[i + 3] * (1 - maskAlpha));
            }
        }

        layer.ctx.putImageData(layerData, 0, 0);
    }

    /**
     * Copier la sélection dans le presse-papiers interne
     */
    copySelection() {
        if (!this.selection || !this.layerManager) return;
        const layer = this.layerManager.getActiveLayer();
        if (!layer) return;

        const sel = this.selection;
        const clipCanvas = document.createElement('canvas');
        clipCanvas.width = sel.width;
        clipCanvas.height = sel.height;
        const clipCtx = clipCanvas.getContext('2d');

        if (this.selectionMask) {
            // Copier avec masque
            const w = layer.canvas.width;
            const h = layer.canvas.height;
            const srcData = layer.ctx.getImageData(sel.x, sel.y, sel.width, sel.height);
            const maskCtx = this.selectionMask.getContext('2d');
            const maskData = maskCtx.getImageData(sel.x, sel.y, sel.width, sel.height);

            for (let i = 0; i < srcData.data.length; i += 4) {
                const maskAlpha = maskData.data[i + 3] / 255;
                srcData.data[i + 3] = Math.round(srcData.data[i + 3] * maskAlpha);
            }

            clipCtx.putImageData(srcData, 0, 0);
        } else {
            // Copier rectangle
            clipCtx.drawImage(
                layer.canvas,
                sel.x, sel.y, sel.width, sel.height,
                0, 0, sel.width, sel.height
            );
        }

        this.clipboard = {
            canvas: clipCanvas,
            width: sel.width,
            height: sel.height
        };

        this.showToast('Sélection copiée');
    }

    /**
     * Couper la sélection
     */
    cutSelection() {
        if (!this.selection || !this.layerManager) return;
        this.copySelection();

        const layer = this.layerManager.getActiveLayer();
        if (layer) {
            if (this.selectionMask) {
                this.clearWithMask(layer, this.selectionMask);
            } else {
                layer.ctx.clearRect(
                    this.selection.x,
                    this.selection.y,
                    this.selection.width,
                    this.selection.height
                );
            }
            this.render();
            this.saveHistory('Couper');
        }
        this.clearSelection();
    }

    /**
     * Coller le presse-papiers en tant que nouveau calque
     */
    pasteClipboard() {
        if (!this.clipboard || !this.layerManager) return;

        const newLayer = this.layerManager.createLayer('Collé');

        // Centrer le contenu collé
        const x = Math.round((this.layerManager.width - this.clipboard.width) / 2);
        const y = Math.round((this.layerManager.height - this.clipboard.height) / 2);

        newLayer.ctx.drawImage(this.clipboard.canvas, Math.max(0, x), Math.max(0, y));

        this.saveHistory('Coller');
        this.render();
        this.showToast('Collé en tant que nouveau calque');
    }

    // ==========================================
    // Masques de calque
    // ==========================================

    addLayerMask() {
        if (!this.layerManager) return;
        this.layerManager.addMask();
        this.saveHistory('Ajouter masque');
        this.render();
        this.showToast('Masque ajouté');
    }

    addMaskFromSelection() {
        if (!this.layerManager || !this.selection) return;

        if (this.selectionMask) {
            this.layerManager.addMaskFromSelection(
                this.layerManager.activeLayerIndex,
                this.selectionMask
            );
        } else {
            // Créer un masque rectangulaire
            const sel = this.selection;
            const mask = document.createElement('canvas');
            mask.width = this.layerManager.width;
            mask.height = this.layerManager.height;
            const maskCtx = mask.getContext('2d');
            maskCtx.fillStyle = 'white';
            maskCtx.fillRect(sel.x, sel.y, sel.width, sel.height);

            this.layerManager.addMaskFromSelection(
                this.layerManager.activeLayerIndex,
                mask
            );
        }

        this.saveHistory('Masque depuis sélection');
        this.clearSelection();
        this.render();
        this.showToast('Masque créé depuis la sélection');
    }

    removeLayerMask() {
        if (!this.layerManager) return;
        this.layerManager.removeMask(this.layerManager.activeLayerIndex, false);
        this.saveHistory('Supprimer masque');
        this.render();
        this.showToast('Masque supprimé');
    }

    applyLayerMask() {
        if (!this.layerManager) return;
        this.layerManager.removeMask(this.layerManager.activeLayerIndex, true);
        this.saveHistory('Appliquer masque');
        this.render();
        this.showToast('Masque appliqué');
    }

    // ==========================================
    // Recadrage
    // ==========================================

    drawCropOverlay(rect) {
        // Le rendu se fait dans render() via renderCropOverlay
        this.toolManager.cropRect = {
            x: Math.min(rect.x, rect.x + rect.width),
            y: Math.min(rect.y, rect.y + rect.height),
            width: Math.abs(rect.width),
            height: Math.abs(rect.height)
        };
    }

    showCropOverlay(rect) {
        const overlay = document.getElementById('crop-overlay');
        if (!rect) {
            overlay.style.display = 'none';
            return;
        }

        const scale = this.zoom;
        overlay.style.display = 'block';
        overlay.style.left = rect.x * scale + 'px';
        overlay.style.top = rect.y * scale + 'px';
        overlay.style.width = rect.width * scale + 'px';
        overlay.style.height = rect.height * scale + 'px';
    }

    hideCropOverlay() {
        document.getElementById('crop-overlay').style.display = 'none';
    }

    // ==========================================
    // Utilitaires UI
    // ==========================================

    selectTool(toolName) {
        const btn = document.querySelector(`.tool-btn[data-tool="${toolName}"]`);
        if (btn) {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.toolManager.setTool(toolName);
            this.updateCurrentTool(toolName);
        }
    }

    adjustBrushSize(delta) {
        const slider = document.getElementById('brush-size');
        const newValue = Math.max(1, Math.min(200, parseInt(slider.value) + delta));
        slider.value = newValue;
        this.toolManager.options.brushSize = newValue;
        document.getElementById('brush-size-value').textContent = newValue + 'px';
    }

    updateCursorPosition(x, y) {
        document.getElementById('cursor-position').textContent =
            `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
    }

    updateSelectedColor(color) {
        document.getElementById('selected-color').textContent = `Couleur: ${color}`;
    }

    updateCurrentTool(tool) {
        const toolNames = {
            move: 'Déplacer',
            select: 'Sélection',
            lasso: 'Lasso',
            'magic-wand': 'Baguette magique',
            brush: 'Pinceau',
            eraser: 'Gomme',
            bucket: 'Remplissage',
            gradient: 'Dégradé',
            text: 'Texte',
            line: 'Ligne',
            rectangle: 'Rectangle',
            ellipse: 'Ellipse',
            eyedropper: 'Pipette',
            clone: 'Tampon',
            crop: 'Recadrage',
            hand: 'Main',
            zoom: 'Zoom'
        };
        document.getElementById('current-tool').textContent = `Outil: ${toolNames[tool] || tool}`;
    }

    updateHistoryPanel() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';

        const states = this.historyManager.getStatesList();
        const icons = {
            'Nouveau projet': 'file',
            'Import image': 'image',
            'Pinceau': 'paint-brush',
            'Gomme': 'eraser',
            'Remplissage': 'fill-drip',
            'Texte': 'font',
            'Ligne': 'minus',
            'Rectangle': 'square',
            'Ellipse': 'circle',
            'Dégradé': 'fill',
            'Nouveau calque': 'plus',
            'Supprimer calque': 'trash',
            'Dupliquer calque': 'copy',
            'Fusionner calques': 'compress-alt',
            'Luminosité/Contraste': 'sun',
            'Teinte/Saturation': 'palette',
            'Balance des blancs': 'thermometer-half',
            'Ombres/Hautes lumières': 'adjust',
            'Rotation gauche': 'undo',
            'Rotation droite': 'redo',
            'Retournement horizontal': 'arrows-alt-h',
            'Retournement vertical': 'arrows-alt-v',
            'Recadrage': 'crop-alt',
            'Redimensionnement': 'expand-arrows-alt',
            'Flou': 'water',
            'Netteté': 'bolt',
            'Vignette': 'circle',
            'Niveaux de gris': 'adjust',
            'Sépia': 'sun',
            'Inverser': 'exchange-alt',
            'Déplacer': 'arrows-alt',
            'Tampon': 'stamp',
            'Couper': 'cut',
            'Coller': 'paste',
            'Supprimer sélection': 'trash-alt'
        };

        states.forEach((state, index) => {
            const item = document.createElement('div');
            item.className = 'history-item' +
                (state.isCurrent ? ' active' : '') +
                (state.isFuture ? ' future' : '');

            const icon = icons[state.name] || 'history';
            item.innerHTML = `<i class="fas fa-${icon}"></i> ${state.name}`;

            item.addEventListener('click', async () => {
                const layers = await this.historyManager.goToState(index);
                if (layers) {
                    this.layerManager.setLayers(layers);
                    this.updateCanvasSize();
                    this.render();
                }
            });

            list.appendChild(item);
        });

        // Scroll vers l'élément actif
        const active = list.querySelector('.active');
        if (active) {
            active.scrollIntoView({ block: 'nearest' });
        }
    }

    openNewProjectModal() {
        // Adapter les valeurs par défaut selon la taille d'écran
        const isMobile = window.innerWidth <= 768;
        const defaultWidth = isMobile ? Math.min(800, window.innerWidth - 100) : 1920;
        const defaultHeight = isMobile ? Math.min(600, window.innerHeight - 200) : 1080;

        document.getElementById('new-width').value = defaultWidth;
        document.getElementById('new-height').value = defaultHeight;
        document.getElementById('new-project-modal').classList.add('active');
    }

    updateUI() {
        this.updateLayersPanel();
        this.updateHistoryPanel();
        if (this.layerManager) {
            document.getElementById('canvas-size').textContent =
                `${this.layerManager.width} × ${this.layerManager.height} px`;
        }
    }
}

// Initialiser l'application au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FotoEditApp();
});
