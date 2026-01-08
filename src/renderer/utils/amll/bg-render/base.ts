import type { Disposable, HasElement } from "../types";

export abstract class AbstractBaseRenderer implements Disposable, HasElement {
    abstract setFlowSpeed(speed: number): void;
    abstract setRenderScale(scale: number): void;
    abstract setStaticMode(enable: boolean): void;
    abstract setFPS(fps: number): void;
    abstract pause(): void;
    abstract resume(): void;
    abstract setAlbum(
        albumSource: string | HTMLImageElement | HTMLVideoElement,
        isVideo?: boolean,
    ): Promise<void>;
    abstract setLowFreqVolume(volume: number): void;
    abstract setHasLyric(hasLyric: boolean): void;
    abstract dispose(): void;
    abstract getElement(): HTMLElement;
}

export abstract class BaseRenderer extends AbstractBaseRenderer {
    private observer: ResizeObserver;
    protected flowSpeed = 4;
    protected currerntRenderScale = 0.75;
    private resizeRafId: number | null = null;
    constructor(protected canvas: HTMLCanvasElement) {
        super();
        this.observer = new ResizeObserver(() => {
            // Use requestAnimationFrame to avoid "ResizeObserver loop" warning
            if (this.resizeRafId) cancelAnimationFrame(this.resizeRafId);
            this.resizeRafId = requestAnimationFrame(() => {
                this.resizeRafId = null;
                const width = Math.max(
                    1,
                    canvas.clientWidth * window.devicePixelRatio * this.currerntRenderScale,
                );
                const height = Math.max(
                    1,
                    canvas.clientHeight *
                    window.devicePixelRatio *
                    this.currerntRenderScale,
                );
                this.onResize(width, height);
            });
        });
        this.observer.observe(canvas);
    }
    setRenderScale(scale: number) {
        this.currerntRenderScale = scale;
        this.onResize(
            this.canvas.clientWidth *
            window.devicePixelRatio *
            this.currerntRenderScale,
            this.canvas.clientHeight *
            window.devicePixelRatio *
            this.currerntRenderScale,
        );
    }
    protected onResize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
    }
    setFlowSpeed(speed: number) {
        this.flowSpeed = speed;
    }
    abstract override setStaticMode(enable: boolean): void;
    abstract override setFPS(fps: number): void;
    abstract override pause(): void;
    abstract override resume(): void;
    abstract override setAlbum(
        albumSource: string | HTMLImageElement | HTMLVideoElement,
        isVideo?: boolean,
    ): Promise<void>;
    dispose(): void {
        this.observer.disconnect();
        if (this.resizeRafId) {
            cancelAnimationFrame(this.resizeRafId);
            this.resizeRafId = null;
        }
        this.canvas.remove();
    }
    override getElement(): HTMLElement {
        return this.canvas;
    }
}
