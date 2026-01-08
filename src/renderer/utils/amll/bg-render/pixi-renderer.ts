import { Application, Texture, Sprite, Container, ColorMatrixFilter, BlurFilter, WebGLRenderer } from "pixi.js";
import { BulgePinchFilter } from "pixi-filters";
import {
    loadResourceFromElement,
    loadResourceFromUrl,
} from "../resource";
import { BaseRenderer } from "./base";

class TimedContainer extends Container {
    public time = 0;
}

export class PixiRenderer extends BaseRenderer {
    private app: Application;
    private curContainer?: TimedContainer;
    private staticMode = false;
    private lastContainer: Set<TimedContainer> = new Set();

    private onTick = (): void => {
        if (!this.app.ticker) return;
        const delta = this.app.ticker.deltaTime;
        // Iterate using Array.from to avoid needing downlevelIteration flag
        Array.from(this.lastContainer).forEach(lastContainer => {
            lastContainer.alpha = Math.max(0, lastContainer.alpha - delta / 60);
            if (lastContainer.alpha <= 0) {
                this.app.stage.removeChild(lastContainer);
                this.lastContainer.delete(lastContainer);
                lastContainer.destroy({ children: true });
            }
        });

        if (this.curContainer) {
            this.curContainer.alpha = Math.min(
                1,
                this.curContainer.alpha + delta / 60,
            );
            const sprites = this.curContainer.children as Sprite[];
            if (sprites.length >= 4) {
                const [s1, s2, s3, s4] = sprites;
                const maxSize = Math.max(this.app.screen.width, this.app.screen.height);
                s1.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
                s2.position.set(
                    this.app.screen.width / 2.5,
                    this.app.screen.height / 2.5,
                );
                s3.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
                s4.position.set(this.app.screen.width / 2, this.app.screen.height / 2);
                s1.width = maxSize * Math.sqrt(2);
                s1.height = s1.width;
                s2.width = maxSize * 0.8;
                s2.height = s2.width;
                s3.width = maxSize * 0.5;
                s3.height = s3.width;
                s4.width = maxSize * 0.25;
                s4.height = s4.width;

                this.curContainer.time += delta * this.flowSpeed;

                s1.rotation += (delta / 1000) * this.flowSpeed;
                s2.rotation -= (delta / 500) * this.flowSpeed;
                s3.rotation += (delta / 1000) * this.flowSpeed;
                s4.rotation -= (delta / 750) * this.flowSpeed;

                s3.x =
                    this.app.screen.width / 2 +
                    (this.app.screen.width / 4) *
                    Math.cos((this.curContainer.time / 1000) * 0.75);
                s3.y =
                    this.app.screen.height / 2 +
                    (this.app.screen.width / 4) *
                    Math.cos((this.curContainer.time / 1000) * 0.75);

                s4.x =
                    this.app.screen.width / 2 +
                    (this.app.screen.width / 4) * 0.1 +
                    Math.cos(this.curContainer.time * 0.006 * 0.75);
                s4.y =
                    this.app.screen.height / 2 +
                    (this.app.screen.width / 4) * 0.1 +
                    Math.cos(this.curContainer.time * 0.006 * 0.75);
            }

            if (
                this.curContainer.alpha >= 1 &&
                this.lastContainer.size === 0 &&
                this.staticMode
            ) {
                this.app.ticker.stop();
            }
        }
    };

    private initPromise: Promise<void>;
    private initSuccess = false;

    constructor(protected override canvas: HTMLCanvasElement) {
        super(canvas);
        this.app = new Application();
        const app = this.app;
        // 直接使用WebGLRenderer，完全绕过autoDetect逻辑
        this.initPromise = (async () => {
            try {
                // 直接创建WebGL渲染器
                const renderer = new WebGLRenderer();
                await renderer.init({
                    canvas: canvas,
                    powerPreference: "low-power",
                    backgroundAlpha: 1,
                    antialias: false,
                    width: canvas.clientWidth || 1,
                    height: canvas.clientHeight || 1,
                });
                // 初始化Application并传入渲染器
                await app.init({
                    resizeTo: canvas,
                    sharedTicker: false,
                    renderer: renderer,
                } as any);
                this.initSuccess = true;
                this.rebuildFilters();
                app.ticker.maxFPS = 30;
                app.ticker.add(this.onTick);
                app.ticker.start();
            } catch (err) {
                console.error("PixiJS init failed", err);
                this.initSuccess = false;
            }
        })();
    }



    protected override onResize(width: number, height: number): void {
        super.onResize(width, height);
        if (this.app.renderer) {
            this.app.resize();
            this.rebuildFilters();
        }
    }

    override setRenderScale(scale: number) {
        super.setRenderScale(scale);
        this.rebuildFilters();
    }
    private rebuildFilters() {
        if (!this.app.stage) return;
        const minBorder = Math.min(this.canvas.width, this.canvas.height);
        const maxBorder = Math.max(this.canvas.width, this.canvas.height);
        const c0 = new ColorMatrixFilter();
        c0.saturate(1.2, false);
        const c1 = new ColorMatrixFilter();
        c1.brightness(0.6, false);
        const c2 = new ColorMatrixFilter();
        c2.contrast(0.3, true);

        const filters: any[] = [];
        filters.push(new BlurFilter({ strength: 5, quality: 1 }));
        filters.push(new BlurFilter({ strength: 10, quality: 1 }));
        filters.push(new BlurFilter({ strength: 20, quality: 2 }));
        filters.push(new BlurFilter({ strength: 40, quality: 2 }));
        filters.push(new BlurFilter({ strength: 80, quality: 2 }));
        if (minBorder > 768) filters.push(new BlurFilter({ strength: 160, quality: 4 }));

        filters.push(c0, c1, c2);
        filters.push(new BlurFilter({ strength: 5, quality: 1 }));

        filters.push(
            new BulgePinchFilter({
                radius: (maxBorder + minBorder) / 2,
                strength: 1,
                center: { x: 0.25, y: 1 },
            }),
        );
        this.app.stage.filters = filters;
    }

    override setStaticMode(enable = false) {
        this.staticMode = enable;
        if (this.app.ticker) this.app.ticker.start();
    }

    override setFPS(fps: number) {
        if (this.app.ticker) this.app.ticker.maxFPS = fps;
    }

    override pause() {
        if (this.app.ticker) {
            this.app.ticker.stop();
            this.app.render();
        }
    }

    override resume() {
        if (this.app.ticker) this.app.ticker.start();
    }

    override setLowFreqVolume(_volume: number): void { }

    override setHasLyric(_hasLyric: boolean): void { }

    override async setAlbum(
        albumSource?: string | HTMLImageElement | HTMLVideoElement,
        isVideo?: boolean,
    ): Promise<void> {
        await this.initPromise;
        if (!this.initSuccess) return;
        if (
            !albumSource ||
            (typeof albumSource === "string" && albumSource.trim().length === 0)
        )
            return;
        let res: HTMLImageElement | HTMLVideoElement | null = null;
        let remainRetryTimes = 5;
        let tex: Texture | null = null;
        while (!tex && remainRetryTimes > 0) {
            try {
                if (typeof albumSource === "string") {
                    res = await loadResourceFromUrl(albumSource, isVideo);
                } else {
                    res = await loadResourceFromElement(albumSource);
                }
                tex = Texture.from(res);
            } catch (error) {
                remainRetryTimes--;
            }
        }
        if (!tex) return;
        const container = new TimedContainer();
        const s1 = new Sprite(tex);
        const s2 = new Sprite(tex);
        const s3 = new Sprite(tex);
        const s4 = new Sprite(tex);
        s1.anchor.set(0.5, 0.5);
        s2.anchor.set(0.5, 0.5);
        s3.anchor.set(0.5, 0.5);
        s4.anchor.set(0.5, 0.5);
        s1.rotation = Math.random() * Math.PI * 2;
        s2.rotation = Math.random() * Math.PI * 2;
        s3.rotation = Math.random() * Math.PI * 2;
        s4.rotation = Math.random() * Math.PI * 2;
        container.addChild(s1, s2, s3, s4);
        if (this.curContainer) this.lastContainer.add(this.curContainer);
        this.curContainer = container;
        this.app.stage.addChild(container);
        this.curContainer.alpha = 0;
        if (this.app.ticker) this.app.ticker.start();
    }

    override dispose() {
        super.dispose();
        if (this.app.ticker) {
            this.app.ticker.remove(this.onTick);
        }
        if (this.app.stage) {
            this.app.stage.destroy({ children: true });
        }
        this.app.destroy();
    }

    override getElement(): HTMLElement {
        return this.canvas;
    }
}
