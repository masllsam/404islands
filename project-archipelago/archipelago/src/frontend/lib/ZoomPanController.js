// ZoomPanController.js - Smooth island navigation with momentum effects
// Supports mouse, touch, and keyboard controls with cross-browser compatibility

export class ZoomPanController {
  constructor(renderer, canvas, options = {}) {
    const {
      enableMomentum = true,
      momentumDecay = 0.95,
      zoomSpeed = 0.1,
      panSpeed = 1,
      minZoom = 0.5,
      maxZoom = 10,
      smoothZoom = true,
      smoothPan = true,
      keyboardControls = true,
      touchControls = true
    } = options;

    this.renderer = renderer;
    this.canvas = canvas;

    // Zoom and pan settings
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.zoomSpeed = zoomSpeed;
    this.panSpeed = panSpeed;
    this.smoothZoom = smoothZoom;
    this.smoothPan = smoothPan;

    // Momentum settings
    this.enableMomentum = enableMomentum;
    this.momentumDecay = momentumDecay;
    this.velocityX = 0;
    this.velocityY = 0;
    this.friction = 0.9;

    // Mouse/touch state
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.startDragX = 0;
    this.startDragY = 0;
    this.startZoom = 1;

    // Touch tracking for gestures
    this.touches = [];
    this.initialPinchDistance = 0;

    // Animation state
    this.animationFrame = null;
    this.targetPanX = this.renderer.panX;
    this.targetPanY = this.renderer.panY;
    this.targetZoom = this.renderer.zoom;
    this.isAnimating = false;

    this.bindEvents();
    this.startAnimationLoop();
  }

  bindEvents() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

    // Touch events
    if (this.touchControls) {
      this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
      this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
      this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
      this.canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this));
    }

    // Keyboard events
    if (this.keyboardControls) {
      document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  handleMouseDown(e) {
    e.preventDefault();
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.startDragX = e.clientX;
    this.startDragY = e.clientY;
    this.cancelAnimation();

    this.canvas.style.cursor = 'grabbing';
  }

  handleMouseMove(e) {
    if (this.isDragging) {
      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;

      if (deltaX !== 0 || deltaY !== 0) {
        this.velocityX = deltaX * 0.3; // Initial velocity for momentum
        this.velocityY = deltaY * 0.3;
      }

      this.applyPan(deltaX, deltaY);
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }

    // Update cursor on hover
    if (!this.isDragging) {
      this.canvas.style.cursor = 'grab';
    }
  }

  handleMouseUp(e) {
    this.isDragging = false;
    this.canvas.style.cursor = 'grab';

    // Start momentum if dragging was fast enough
    if (this.enableMomentum && (Math.abs(this.velocityX) > 0.5 || Math.abs(this.velocityY) > 0.5)) {
      this.startMomentum();
    }
  }

  handleMouseLeave(e) {
    if (this.isDragging) {
      this.handleMouseUp(e);
    }
  }

  handleWheel(e) {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 1 - this.zoomSpeed : 1 + this.zoomSpeed;
    this.applyZoom(zoomFactor, mouseX, mouseY);
  }

  handleTouchStart(e) {
    e.preventDefault();

    this.touches = [...e.touches];

    if (e.touches.length === 1) {
      // Single touch - start dragging
      const touch = e.touches[0];
      this.isDragging = true;
      this.lastMouseX = touch.clientX;
      this.lastMouseY = touch.clientY;
      this.startDragX = touch.clientX;
      this.startDragY = touch.clientY;
      this.cancelAnimation();
    } else if (e.touches.length === 2) {
      // Two touches - start pinch zoom
      this.isDragging = false;
      this.initialPinchDistance = this.getTouchesDistance(e.touches);
      this.startZoom = this.renderer.zoom;
    }
  }

  handleTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 1 && this.isDragging) {
      // Single touch drag
      const touch = e.touches[0];
      const deltaX = touch.clientX - this.lastMouseX;
      const deltaY = touch.clientY - this.lastMouseY;

      this.applyPan(deltaX, deltaY);
      this.lastMouseX = touch.clientX;
      this.lastMouseY = touch.clientY;
    } else if (e.touches.length === 2) {
      // Pinch to zoom
      const currentDistance = this.getTouchesDistance(e.touches);
      const zoomFactor = currentDistance / this.initialPinchDistance;

      // Calculate center of pinch
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      this.applyZoom(zoomFactor, centerX, centerY);
    }
  }

  handleTouchEnd(e) {
    if (e.touches.length === 0) {
      this.isDragging = false;

      // Start momentum after touch end
      if (this.enableMomentum && (Math.abs(this.velocityX) > 0.5 || Math.abs(this.velocityY) > 0.5)) {
        this.startMomentum();
      }
    }

    this.touches = [...e.touches];
  }

  handleTouchCancel(e) {
    this.isDragging = false;
    this.touches = [];
  }

  handleKeyDown(e) {
    const step = 20; // pixels per movement

    switch (e.key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        e.preventDefault();
        this.applyPan(0, step);
        break;
      case 'arrowdown':
      case 's':
        e.preventDefault();
        this.applyPan(0, -step);
        break;
      case 'arrowleft':
      case 'a':
        e.preventDefault();
        this.applyPan(step, 0);
        break;
      case 'arrowright':
      case 'd':
        e.preventDefault();
        this.applyPan(-step, 0);
        break;
      case '=':
      case '+':
        e.preventDefault();
        this.applyZoom(1 + this.zoomSpeed);
        break;
      case '-':
        e.preventDefault();
        this.applyZoom(1 - this.zoomSpeed);
        break;
      case '0':
        e.preventDefault();
        this.resetView();
        break;
    }
  }

  applyPan(deltaX, deltaY) {
    const zoomFactor = this.renderer.zoom;

    if (this.smoothPan) {
      this.targetPanX -= deltaX * this.panSpeed / zoomFactor;
      this.targetPanY -= deltaY * this.panSpeed / zoomFactor;
    } else {
      this.renderer.panX -= deltaX * this.panSpeed / zoomFactor;
      this.renderer.panY -= deltaY * this.panSpeed / zoomFactor;
    }
  }

  applyZoom(factor, centerX = this.canvas.width / 2, centerY = this.canvas.height / 2) {
    const oldZoom = this.renderer.zoom;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * factor));

    if (this.smoothZoom) {
      this.targetZoom = newZoom;
    } else {
      this.setZoom(newZoom, centerX, centerY);
    }
  }

  setZoom(zoom, centerX = this.canvas.width / 2, centerY = this.canvas.height / 2) {
    const oldZoom = this.renderer.zoom;
    const zoomChange = zoom / oldZoom;

    // Adjust pan to zoom towards center point
    const rect = this.canvas.getBoundingClientRect();
    const canvasCenterX = centerX - rect.left;
    const canvasCenterY = centerY - rect.top;

    this.renderer.panX += (canvasCenterX / this.renderer.pixelRatio) * (zoomChange - 1);
    this.renderer.panY += (canvasCenterY / this.renderer.pixelRatio) * (zoomChange - 1);
    this.renderer.zoom = zoom;
  }

  resetView() {
    this.targetPanX = 0;
    this.targetPanY = 0;
    this.targetZoom = 1;
  }

  getTouchesDistance(touches) {
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  startMomentum() {
    if (!this.enableMomentum) return;

    let damping = 0.95;
    const momentumLoop = () => {
      if (Math.abs(this.velocityX) < 0.1 && Math.abs(this.velocityY) < 0.1) {
        this.velocityX = 0;
        this.velocityY = 0;
        return;
      }

      this.applyPan(this.velocityX, this.velocityY);
      this.velocityX *= damping;
      this.velocityY *= damping;

      damping *= this.momentumDecay;
      requestAnimationFrame(momentumLoop);
    };

    requestAnimationFrame(momentumLoop);
  }

  startAnimationLoop() {
    this.animationFrame = requestAnimationFrame(this.updateAnimation.bind(this));
  }

  updateAnimation() {
    // Smooth interpolation to target values
    const approachFactor = 0.05;

    if (this.smoothPan) {
      this.renderer.panX += (this.targetPanX - this.renderer.panX) * approachFactor;
      this.renderer.panY += (this.targetPanY - this.renderer.panY) * approachFactor;
    }

    if (this.smoothZoom) {
      const currentZoom = this.renderer.zoom;
      const targetZoom = this.targetZoom;
      this.setZoom(currentZoom + (targetZoom - currentZoom) * approachFactor);
    }

    this.animationFrame = requestAnimationFrame(this.updateAnimation.bind(this));
  }

  cancelAnimation() {
    this.targetPanX = this.renderer.panX;
    this.targetPanY = this.renderer.panY;
    this.targetZoom = this.renderer.zoom;
  }

  destroy() {
    // Remove event listeners
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);

    if (this.touchControls) {
      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
      this.canvas.removeEventListener('touchmove', this.handleTouchMove);
      this.canvas.removeEventListener('touchend', this.handleTouchEnd);
      this.canvas.removeEventListener('touchcancel', this.handleTouchCancel);
    }

    if (this.keyboardControls) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }

    // Cancel animations
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  // Public API methods
  getState() {
    return {
      panX: this.renderer.panX,
      panY: this.renderer.panY,
      zoom: this.renderer.zoom,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    };
  }

  setPan(x, y, smooth = true) {
    if (smooth) {
      this.targetPanX = x;
      this.targetPanY = y;
    } else {
      this.renderer.panX = x;
      this.renderer.panY = y;
      this.targetPanX = x;
      this.targetPanY = y;
    }
  }

  setZoomLevel(zoom, smooth = true, centerX, centerY) {
    if (smooth) {
      this.targetZoom = zoom;
    } else {
      this.setZoom(zoom, centerX, centerY);
      this.targetZoom = zoom;
    }
  }
}