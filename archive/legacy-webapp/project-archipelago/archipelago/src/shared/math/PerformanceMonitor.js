// PerformanceMonitor.js - Real-time 60fps tracking and optimization monitoring
// Tracks render times, FPS, memory usage, and provides performance alerts

export class PerformanceMonitor {
  constructor(options = {}) {
    const {
      targetFPS = 60,
      budgetMS = 16, // 16.67ms for 60fps
      memoryBudgetMB = 32,
      rollingWindowFrames = 60, // Measure over last 60 frames
      alertThreshold = 0.8 // Alert when 80% of budget is exceeded
    } = options;

    this.targetFPS = targetFPS;
    this.budgetMS = budgetMS;
    this.memoryBudgetMB = memoryBudgetMB;
    this.rollingWindowFrames = rollingWindowFrames;
    this.alertThreshold = alertThreshold;

    // Frame timing data
    this.frameTimes = [];
    this.lastFrameTime = 0;
    this.startTime = 0;

    // Performance metrics
    this.currentFPS = 0;
    this.averageRenderTime = 0;
    this.longestFrame = 0;
    this.frameDrops = 0;

    // Memory tracking
    this.currentMemoryMB = 0;
    this.peakMemoryMB = 0;

    // Callbacks
    this.onPerformanceWarning = options.onPerformanceWarning || (() => {});
    this.onPerformanceCritical = options.onPerformanceCritical || (() => {});

    // Running state
    this.isMonitoring = false;
    this.hasWarned = false;
    this.hasCriticized = false;

    // Bind to animation loop
    this.start();
  }

  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.hasWarned = false;
    this.hasCriticized = false;

    this.monitorLoop = this.monitorFrame.bind(this);
    requestAnimationFrame(this.monitorLoop);
  }

  stop() {
    this.isMonitoring = false;
    if (this.monitorLoop) {
      cancelAnimationFrame(this.monitorLoop);
    }
  }

  monitorFrame(now) {
    if (!this.isMonitoring) return;

    // Calculate frame delta
    const deltaMS = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Track frame time
    this.frameTimes.push(deltaMS);
    if (this.frameTimes.length > this.rollingWindowFrames) {
      this.frameTimes.shift();
    }

    // Update metrics
    this.updateMetrics();
    this.checkPerformanceThresholds();

    // Continue monitoring
    requestAnimationFrame(this.monitorLoop);
  }

  updateMetrics() {
    if (this.frameTimes.length === 0) return;

    const totalTime = this.frameTimes.reduce((sum, time) => sum + time, 0);
    this.averageRenderTime = totalTime / this.frameTimes.length;
    this.currentFPS = 1000 / this.averageRenderTime;

    this.longestFrame = Math.max(...this.frameTimes);
    this.frameDrops = this.frameTimes.filter(time => time > this.budgetMS).length;
  }

  recordRenderTime(renderTimeMS) {
    // Update last frame time data
    if (this.frameTimes.length > 0) {
      this.frameTimes[this.frameTimes.length - 1] = renderTimeMS;
      this.updateMetrics();
    }
  }

  updateMemoryUsage(memoryMB) {
    this.currentMemoryMB = memoryMB;
    this.peakMemoryMB = Math.max(this.peakMemoryMB, memoryMB);
  }

  checkPerformanceThresholds() {
    const warningThreshold = this.budgetMS * this.alertThreshold;
    const criticalThreshold = this.budgetMS;

    // FPS warning
    if (this.averageRenderTime > warningThreshold && !this.hasWarned) {
      this.hasWarned = true;
      this.onPerformanceWarning({
        type: 'fps',
        averageRenderTime: this.averageRenderTime,
        targetBudget: this.budgetMS,
        currentFPS: this.currentFPS,
        message: `Render time ${this.averageRenderTime.toFixed(2)}ms exceeds ${warningThreshold.toFixed(1)}ms budget (${this.currentFPS.toFixed(1)}fps)`
      });
    }

    // Memory warning
    if (this.currentMemoryMB > (this.memoryBudgetMB * this.alertThreshold) && !this.hasCriticized) {
      this.hasCriticized = true;
      this.onPerformanceCritical({
        type: 'memory',
        currentMemory: this.currentMemoryMB,
        memoryBudget: this.memoryBudgetMB,
        message: `Memory usage ${this.currentMemoryMB.toFixed(1)}MB exceeds ${(this.memoryBudgetMB * this.alertThreshold)}MB threshold`
      });
    }

    // Reset warnings if performance improves
    if (this.averageRenderTime < warningThreshold * 0.9) {
      this.hasWarned = false;
    }
    if (this.currentMemoryMB < this.memoryBudgetMB * 0.9) {
      this.hasCriticized = false;
    }
  }

  // Public API methods
  getMetrics() {
    this.updateMemoryUsage((performance.memory?.usedJSHeapSize || 0) / 1024 / 1024);

    return {
      currentFPS: Math.round(this.currentFPS * 10) / 10,
      averageRenderTime: Math.round(this.averageRenderTime * 100) / 100,
      longestFrame: Math.round(this.longestFrame * 100) / 100,
      frameDrops: this.frameDrops,
      currentMemoryMB: Math.round(this.currentMemoryMB * 10) / 10,
      peakMemoryMB: Math.round(this.peakMemoryMB * 10) / 10,
      memoryBudgetMB: this.memoryBudgetMB,
      targetFPS: this.targetFPS,
      budgetMS: this.budgetMS,
      isWithinBudget: this.averageRenderTime <= this.budgetMS,
      isMemoryOK: this.currentMemoryMB <= this.memoryBudgetMB
    };
  }

  getPerformanceStatus() {
    const metrics = this.getMetrics();

    if (!metrics.isWithinBudget) {
      return 'critical';
    } else if (metrics.averageRenderTime > this.budgetMS * this.alertThreshold) {
      return 'warning';
    } else {
      return 'good';
    }
  }

  // Benchmark specific operation
  benchmark(operationName, operationFunction) {
    const startTime = performance.now();
    const result = operationFunction();
    const timeMS = performance.now() - startTime;

    console.log(`Benchmark ${operationName}: ${timeMS.toFixed(3)}ms`);

    if (timeMS > this.budgetMS) {
      this.onPerformanceWarning({
        type: 'benchmark',
        operation: operationName,
        timeMS: timeMS,
        budgetMS: this.budgetMS,
        message: `Benchmark ${operationName} took ${timeMS.toFixed(2)}ms, exceeding ${(this.budgetMS).toFixed(1)}ms budget`
      });
    }

    return result;
  }

  // Export performance log data
  exportLog() {
    return {
      startTime: this.startTime,
      frameTimes: [...this.frameTimes],
      peakMemoryMB: this.peakMemoryMB,
      averageFPS: (this.frameTimes.length / ((this.lastFrameTime - this.startTime) / 1000)),
      uptimeMS: this.lastFrameTime - this.startTime
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();