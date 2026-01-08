/**
 * @fileoverview
 * 基于 Mesh Gradient 渐变渲染的渲染器
 * 此渲染应该是 Apple Music 使用的背景渲染方式了
 * 参考内容 https://movingparts.io/gradient-meshes
 */

import type { Disposable } from "../../types";
import {
    loadResourceFromElement,
    loadResourceFromUrl,
} from "../../resource";
import { BaseRenderer } from "../base";
import {
    blurImage,
    brightnessImage,
    contrastImage,
    saturateImage,
} from "../img";
import { generateControlPoints } from "./cp-generate";
import { CONTROL_POINT_PRESETS } from "./cp-presets";

// 顶点着色器 - 内联
const meshVertShader = `precision highp float;

attribute vec2 a_pos;
attribute vec3 a_color;
attribute vec2 a_uv;
varying vec3 v_color;
varying vec2 v_uv;

uniform float u_aspect;

void main() {
    v_color = a_color;
    v_uv = a_uv;
    vec2 pos = a_pos;
    if (u_aspect > 1.0) {
        pos.y *= u_aspect;
    } else {
        pos.x /= u_aspect;
    }
    gl_Position = vec4(pos, 0.0, 1.0);
}`;

// 片段着色器 - 内联
const meshFragShader = `precision highp float;

varying vec3 v_color;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_time;
uniform float u_volume;
uniform float u_alpha;

const float INV_255 = 1.0 / 255.0;
const float HALF_INV_255 = 0.5 / 255.0;
const float GRADIENT_NOISE_A = 52.9829189;
const vec2 GRADIENT_NOISE_B = vec2(0.06711056, 0.00583715);

float gradientNoise(in vec2 uv) {
    return fract(GRADIENT_NOISE_A * fract(dot(uv, GRADIENT_NOISE_B)));
}

vec2 rot(vec2 v, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

void main() {
    float volumeEffect = u_volume * 2.0;
    float timeVolume = u_time + u_volume;
    
    float dither = INV_255 * gradientNoise(gl_FragCoord.xy) - HALF_INV_255;
    vec2 centeredUV = v_uv - vec2(0.2);
    vec2 rotatedUV = rot(centeredUV, timeVolume * 2.0);
    vec2 finalUV = rotatedUV * max(0.001, 1.0 - volumeEffect) + vec2(0.5);
    
    vec4 result = texture2D(u_texture, finalUV);
    
    float alphaVolumeFactor = u_alpha * max(0.5, 1.0 - u_volume * 0.5);
    result.rgb *= v_color * alphaVolumeFactor;
    result.a *= alphaVolumeFactor;
    
    result.rgb += vec3(dither);
    
    float dist = distance(v_uv, vec2(0.5));
    float vignette = smoothstep(0.8, 0.3, dist);
    float mask = 0.6 + vignette * 0.4;
    result.rgb *= mask;
    
    gl_FragColor = result;
}`;

type RenderingContext = WebGLRenderingContext;

// ============ 矩阵/向量工具类 ============
// 简化的矩阵和向量运算，避免依赖gl-matrix

class Vec2 {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    static fromValues(x: number, y: number) {
        return new Vec2(x, y);
    }
    static create() {
        return new Vec2();
    }
    copy(other: Vec2) {
        this.x = other.x;
        this.y = other.y;
        return this;
    }
    [Symbol.iterator]() {
        return [this.x, this.y][Symbol.iterator]();
    }
}

class Vec3 {
    r: number;
    g: number;
    b: number;
    constructor(r = 0, g = 0, b = 0) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
    static fromValues(r: number, g: number, b: number) {
        return new Vec3(r, g, b);
    }
    static create() {
        return new Vec3();
    }
    [Symbol.iterator]() {
        return [this.r, this.g, this.b][Symbol.iterator]();
    }
}

class Vec4 {
    0: number;
    1: number;
    2: number;
    3: number;
    constructor(x = 0, y = 0, z = 0, w = 0) {
        this[0] = x;
        this[1] = y;
        this[2] = z;
        this[3] = w;
    }
    static create() {
        return new Vec4();
    }
    copy(other: Vec4) {
        this[0] = other[0];
        this[1] = other[1];
        this[2] = other[2];
        this[3] = other[3];
        return this;
    }
    dot(other: Vec4): number {
        return this[0] * other[0] + this[1] * other[1] + this[2] * other[2] + this[3] * other[3];
    }
    static transformMat4(out: Vec4, a: Vec4, m: Mat4): Vec4 {
        const x = a[0], y = a[1], z = a[2], w = a[3];
        out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
        out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
        out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
        out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
        return out;
    }
}

class Mat4 extends Float32Array {
    constructor() {
        super(16);
    }
    static create() {
        return new Mat4();
    }
    static fromValues(
        m00: number, m01: number, m02: number, m03: number,
        m10: number, m11: number, m12: number, m13: number,
        m20: number, m21: number, m22: number, m23: number,
        m30: number, m31: number, m32: number, m33: number
    ): Mat4 {
        const out = new Mat4();
        out[0] = m00; out[1] = m01; out[2] = m02; out[3] = m03;
        out[4] = m10; out[5] = m11; out[6] = m12; out[7] = m13;
        out[8] = m20; out[9] = m21; out[10] = m22; out[11] = m23;
        out[12] = m30; out[13] = m31; out[14] = m32; out[15] = m33;
        return out;
    }
    static clone(a: Mat4): Mat4 {
        const out = new Mat4();
        for (let i = 0; i < 16; i++) out[i] = a[i];
        return out;
    }
    copy(a: Mat4): Mat4 {
        for (let i = 0; i < 16; i++) this[i] = a[i];
        return this;
    }
    transpose(): Mat4 {
        const a01 = this[1], a02 = this[2], a03 = this[3];
        const a12 = this[6], a13 = this[7];
        const a23 = this[11];
        this[1] = this[4]; this[2] = this[8]; this[3] = this[12];
        this[4] = a01; this[6] = this[9]; this[7] = this[13];
        this[8] = a02; this[9] = a12; this[11] = this[14];
        this[12] = a03; this[13] = a13; this[14] = a23;
        return this;
    }
    static mul(out: Mat4, a: Mat4, b: Mat4): Mat4 {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

        let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
        out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
        out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
        out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
        out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        return out;
    }
}

// ============ WebGL工具类 ============

class GLProgram implements Disposable {
    private gl: RenderingContext;
    program: WebGLProgram;
    private vertexShader: WebGLShader;
    private fragmentShader: WebGLShader;
    readonly attrs: { [name: string]: number };
    constructor(
        gl: RenderingContext,
        vertexShaderSource: string,
        fragmentShaderSource: string,
        private readonly label = "unknown",
    ) {
        this.gl = gl;
        this.vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        this.fragmentShader = this.createShader(
            gl.FRAGMENT_SHADER,
            fragmentShaderSource,
        );
        this.program = this.createProgram();

        const num = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
        const attrs: { [name: string]: number } = {};
        for (let i = 0; i < num; i++) {
            const info = gl.getActiveAttrib(this.program, i);
            if (!info) continue;
            const location = gl.getAttribLocation(this.program, info.name);
            if (location === -1) continue;
            attrs[info.name] = location;
        }
        this.attrs = attrs;
    }
    private createShader(type: number, source: string) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Failed to create shader");
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(
                `Failed to compile shader for type ${type} "${this.label
                }": ${gl.getShaderInfoLog(shader)}`,
            );
        }
        return shader;
    }
    private createProgram() {
        const gl = this.gl;
        const program = gl.createProgram();
        if (!program) throw new Error("Failed to create program");
        gl.attachShader(program, this.vertexShader);
        gl.attachShader(program, this.fragmentShader);
        gl.linkProgram(program);
        gl.validateProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const errLog = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Failed to link program "${this.label}": ${errLog}`);
        }
        return program;
    }
    use() {
        const gl = this.gl;
        gl.useProgram(this.program);
    }
    private notFoundUniforms: Set<string> = new Set();
    private warnUniformNotFound(name: string) {
        if (this.notFoundUniforms.has(name)) return;
        this.notFoundUniforms.add(name);
        console.warn(
            `Failed to get uniform location for program "${this.label}": ${name}`,
        );
    }
    setUniform1f(name: string, value: number) {
        const gl = this.gl;
        const location = gl.getUniformLocation(this.program, name);
        if (!location) this.warnUniformNotFound(name);
        else gl.uniform1f(location, value);
    }
    setUniform1i(name: string, value: number) {
        const gl = this.gl;
        const location = gl.getUniformLocation(this.program, name);
        if (!location) this.warnUniformNotFound(name);
        else gl.uniform1i(location, value);
    }
    dispose() {
        const gl = this.gl;
        gl.deleteShader(this.vertexShader);
        gl.deleteShader(this.fragmentShader);
        gl.deleteProgram(this.program);
    }
}

class Mesh implements Disposable {
    protected vertexWidth = 0;
    protected vertexHeight = 0;
    private vertexBuffer: WebGLBuffer;
    private indexBuffer: WebGLBuffer;
    private vertexData: Float32Array;
    private indexData: Uint16Array;
    private vertexIndexLength = 0;
    private wireFrame = false;
    constructor(
        private readonly gl: RenderingContext,
        private readonly attrPos: number | undefined,
        private readonly attrColor: number | undefined,
        private readonly attrUV: number | undefined,
    ) {
        const vertexBuf = gl.createBuffer();
        if (!vertexBuf) throw new Error("Failed to create vertex buffer");
        this.vertexBuffer = vertexBuf;
        const indexBuf = gl.createBuffer();
        if (!indexBuf) throw new Error("Failed to create index buffer");
        this.indexBuffer = indexBuf;

        this.bind();

        this.vertexData = new Float32Array(0);
        this.indexData = new Uint16Array(0);

        this.resize(2, 2);
        this.update();
    }

    setWireFrame(enable: boolean) {
        this.wireFrame = enable;
        this.resize(this.vertexWidth, this.vertexHeight);
    }

    setVertexPos(vx: number, vy: number, x: number, y: number): void {
        const idx = (vx + vy * this.vertexWidth) * 7;
        if (idx >= this.vertexData.length - 1) {
            return;
        }
        this.vertexData[idx] = x;
        this.vertexData[idx + 1] = y;
    }

    setVertexColor(
        vx: number,
        vy: number,
        r: number,
        g: number,
        b: number,
    ): void {
        const idx = (vx + vy * this.vertexWidth) * 7 + 2;
        if (idx >= this.vertexData.length - 2) {
            return;
        }
        this.vertexData[idx] = r;
        this.vertexData[idx + 1] = g;
        this.vertexData[idx + 2] = b;
    }

    setVertexUV(vx: number, vy: number, x: number, y: number): void {
        const idx = (vx + vy * this.vertexWidth) * 7 + 5;
        if (idx >= this.vertexData.length - 1) {
            return;
        }
        this.vertexData[idx] = x;
        this.vertexData[idx + 1] = y;
    }

    setVertexData(
        vx: number,
        vy: number,
        x: number,
        y: number,
        r: number,
        g: number,
        b: number,
        u: number,
        v: number,
    ): void {
        const idx = (vx + vy * this.vertexWidth) * 7;
        if (idx >= this.vertexData.length - 6) {
            return;
        }
        const data = this.vertexData;
        data[idx] = x;
        data[idx + 1] = y;
        data[idx + 2] = r;
        data[idx + 3] = g;
        data[idx + 4] = b;
        data[idx + 5] = u;
        data[idx + 6] = v;
    }

    getVertexIndexLength(): number {
        return this.vertexIndexLength;
    }

    draw() {
        const gl = this.gl;

        if (this.wireFrame) {
            gl.drawElements(gl.LINES, this.vertexIndexLength, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawElements(
                gl.TRIANGLES,
                this.vertexIndexLength,
                gl.UNSIGNED_SHORT,
                0,
            );
        }
    }

    resize(vertexWidth: number, vertexHeight: number): void {
        this.vertexWidth = vertexWidth;
        this.vertexHeight = vertexHeight;
        this.vertexIndexLength = vertexWidth * vertexHeight * 6;
        if (this.wireFrame) {
            this.vertexIndexLength = vertexWidth * vertexHeight * 10;
        }
        const vertexData = new Float32Array(
            vertexWidth * vertexHeight * (2 + 3 + 2),
        );
        const indexData = new Uint16Array(this.vertexIndexLength);
        this.vertexData = vertexData;
        this.indexData = indexData;
        for (let y = 0; y < vertexHeight; y++) {
            for (let x = 0; x < vertexWidth; x++) {
                const px = (x / (vertexWidth - 1)) * 2 - 1;
                const py = (y / (vertexHeight - 1)) * 2 - 1;
                this.setVertexPos(x, y, px || 0, py || 0);
                this.setVertexColor(x, y, 1, 1, 1);
                this.setVertexUV(x, y, x / (vertexWidth - 1), y / (vertexHeight - 1));
            }
        }
        for (let y = 0; y < vertexHeight - 1; y++) {
            for (let x = 0; x < vertexWidth - 1; x++) {
                if (this.wireFrame) {
                    const idx = (y * vertexWidth + x) * 10;

                    indexData[idx] = y * vertexWidth + x;
                    indexData[idx + 1] = y * vertexWidth + x + 1;

                    indexData[idx + 2] = y * vertexWidth + x + 1;
                    indexData[idx + 3] = (y + 1) * vertexWidth + x;

                    indexData[idx + 4] = (y + 1) * vertexWidth + x;
                    indexData[idx + 5] = (y + 1) * vertexWidth + x + 1;

                    indexData[idx + 6] = (y + 1) * vertexWidth + x + 1;
                    indexData[idx + 7] = y * vertexWidth + x + 1;

                    indexData[idx + 8] = y * vertexWidth + x;
                    indexData[idx + 9] = (y + 1) * vertexWidth + x;
                } else {
                    const idx = (y * vertexWidth + x) * 6;
                    indexData[idx] = y * vertexWidth + x;
                    indexData[idx + 1] = y * vertexWidth + x + 1;
                    indexData[idx + 2] = (y + 1) * vertexWidth + x;
                    indexData[idx + 3] = y * vertexWidth + x + 1;
                    indexData[idx + 4] = (y + 1) * vertexWidth + x + 1;
                    indexData[idx + 5] = (y + 1) * vertexWidth + x;
                }
            }
        }
        const gl = this.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexData, gl.STATIC_DRAW);
    }

    bind() {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        if (this.attrPos !== undefined) {
            gl.vertexAttribPointer(this.attrPos, 2, gl.FLOAT, false, 4 * 7, 0);
            gl.enableVertexAttribArray(this.attrPos);
        }
        if (this.attrColor !== undefined) {
            gl.vertexAttribPointer(this.attrColor, 3, gl.FLOAT, false, 4 * 7, 4 * 2);
            gl.enableVertexAttribArray(this.attrColor);
        }
        if (this.attrUV !== undefined) {
            gl.vertexAttribPointer(this.attrUV, 2, gl.FLOAT, false, 4 * 7, 4 * 5);
            gl.enableVertexAttribArray(this.attrUV);
        }
    }

    update() {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.DYNAMIC_DRAW);
    }

    dispose(): void {
        this.gl.deleteBuffer(this.vertexBuffer);
        this.gl.deleteBuffer(this.indexBuffer);
    }
}

class ControlPoint {
    color = Vec3.fromValues(1, 1, 1);
    location = Vec2.fromValues(0, 0);
    uTangent = Vec2.fromValues(0, 0);
    vTangent = Vec2.fromValues(0, 0);
    private _uRot = 0;
    private _vRot = 0;
    private _uScale = 1;
    private _vScale = 1;

    constructor() {
        Object.seal(this);
    }

    get uRot() {
        return this._uRot;
    }

    get vRot() {
        return this._vRot;
    }

    set uRot(value: number) {
        this._uRot = value;
        this.updateUTangent();
    }

    set vRot(value: number) {
        this._vRot = value;
        this.updateVTangent();
    }

    get uScale() {
        return this._uScale;
    }

    get vScale() {
        return this._vScale;
    }

    set uScale(value: number) {
        this._uScale = value;
        this.updateUTangent();
    }

    set vScale(value: number) {
        this._vScale = value;
        this.updateVTangent();
    }

    private updateUTangent() {
        this.uTangent.x = Math.cos(this._uRot) * this._uScale;
        this.uTangent.y = Math.sin(this._uRot) * this._uScale;
    }

    private updateVTangent() {
        this.vTangent.x = -Math.sin(this._vRot) * this._vScale;
        this.vTangent.y = Math.cos(this._vRot) * this._vScale;
    }
}

const H = Mat4.fromValues(2, -2, 1, 1, -3, 3, -2, -1, 0, 0, 1, 0, 1, 0, 0, 0);
const H_T = Mat4.clone(H).transpose();

const spUx = Vec4.create();
const spUy = Vec4.create();
const spV = Vec4.create();

const spxAcc = Mat4.create();
const spyAcc = Mat4.create();
function surfacePoint(
    u: number,
    v: number,
    X: Mat4,
    Y: Mat4,
    output = Vec2.create(),
): Vec2 {
    spUx[0] = u ** 3;
    spUx[1] = u ** 2;
    spUx[2] = u;
    spUx[3] = 1;

    spUy.copy(spUx);

    spV[0] = v ** 3;
    spV[1] = v ** 2;
    spV[2] = v;
    spV[3] = 1;

    spxAcc.copy(X).transpose();
    Mat4.mul(spxAcc, spxAcc, H);
    Mat4.mul(spxAcc, H_T, spxAcc);
    Vec4.transformMat4(spUx, spUx, spxAcc);
    const x = spV.dot(spUx);

    spyAcc.copy(Y).transpose();
    Mat4.mul(spyAcc, spyAcc, H);
    Mat4.mul(spyAcc, H_T, spyAcc);
    Vec4.transformMat4(spUy, spUy, spyAcc);
    const y = spV.dot(spUy);

    output.x = x;
    output.y = y;
    return output;
}

function meshCoefficients(
    p00: ControlPoint,
    p01: ControlPoint,
    p10: ControlPoint,
    p11: ControlPoint,
    axis: "x" | "y",
    output = Mat4.create(),
): Mat4 {
    const l = (p: ControlPoint) => p.location[axis];
    const u = (p: ControlPoint) => p.uTangent[axis];
    const v = (p: ControlPoint) => p.vTangent[axis];

    output[0] = l(p00);
    output[1] = l(p01);
    output[2] = v(p00);
    output[3] = v(p01);
    output[4] = l(p10);
    output[5] = l(p11);
    output[6] = v(p10);
    output[7] = v(p11);
    output[8] = u(p00);
    output[9] = u(p01);
    output[10] = 0;
    output[11] = 0;
    output[12] = u(p10);
    output[13] = u(p11);
    output[14] = 0;
    output[15] = 0;

    return output;
}

function colorCoefficients(
    p00: ControlPoint,
    p01: ControlPoint,
    p10: ControlPoint,
    p11: ControlPoint,
    axis: "r" | "g" | "b",
    output = Mat4.create(),
): Mat4 {
    const c = (p: ControlPoint) => p.color[axis];
    output.fill(0);
    output[0] = c(p00);
    output[1] = c(p01);
    output[4] = c(p10);
    output[5] = c(p11);
    return output;
}

const cpUx = Vec4.create();
const cpUy = Vec4.create();
const cpUz = Vec4.create();

const cpV = Vec4.create();

const cprAcc = Mat4.create();
const cpgAcc = Mat4.create();
const cpbAcc = Mat4.create();
const cpResult = Vec3.create();
function colorPoint(u: number, v: number, R: Mat4, G: Mat4, B: Mat4): Vec3 {
    cpUx[0] = u ** 3;
    cpUx[1] = u ** 2;
    cpUx[2] = u;
    cpUx[3] = 1;
    cpUy.copy(cpUx);
    cpUz.copy(cpUx);

    cpV[0] = v ** 3;
    cpV[1] = v ** 2;
    cpV[2] = v;
    cpV[3] = 1;

    cprAcc.copy(R).transpose();
    Mat4.mul(cprAcc, cprAcc, H);
    Mat4.mul(cprAcc, H_T, cprAcc);
    Vec4.transformMat4(cpUx, cpUx, cprAcc);
    cpResult.r = cpV.dot(cpUx);

    cpgAcc.copy(G).transpose();
    Mat4.mul(cpgAcc, cpgAcc, H);
    Mat4.mul(cpgAcc, H_T, cpgAcc);
    Vec4.transformMat4(cpUy, cpUy, cpgAcc);
    cpResult.g = cpV.dot(cpUy);

    cpbAcc.copy(B).transpose();
    Mat4.mul(cpbAcc, cpbAcc, H);
    Mat4.mul(cpbAcc, H_T, cpbAcc);
    Vec4.transformMat4(cpUz, cpUz, cpbAcc);
    cpResult.b = cpV.dot(cpUz);

    return cpResult;
}

class Map2D<T> {
    private _width = 0;
    private _height = 0;
    private _data: T[] = [];
    constructor(width: number, height: number) {
        this.resize(width, height);
        Object.seal(this);
    }
    resize(width: number, height: number) {
        this._width = width;
        this._height = height;
        this._data = new Array(width * height).fill(0);
    }
    set(x: number, y: number, value: T) {
        this._data[x + y * this._width] = value;
    }
    get(x: number, y: number) {
        return this._data[x + y * this._width];
    }
    get width() {
        return this._width;
    }
    get height() {
        return this._height;
    }
}

// Bicubic Hermite Patch Mesh
class BHPMesh extends Mesh {
    private _subDivisions = 10;
    private _controlPoints: Map2D<ControlPoint> = new Map2D(3, 3);

    constructor(
        gl: RenderingContext,
        attrPos: number,
        attrColor: number,
        attrUV: number,
    ) {
        super(gl, attrPos, attrColor, attrUV);
        this.resizeControlPoints(3, 3);
        Object.seal(this);
    }
    override setWireFrame(enable: boolean) {
        super.setWireFrame(enable);
        this.updateMesh();
    }
    resetSubdivition(subDivisions: number) {
        this._subDivisions = subDivisions;
        super.resize(
            (this._controlPoints.width - 1) * subDivisions,
            (this._controlPoints.height - 1) * subDivisions,
        );
    }
    resizeControlPoints(width: number, height: number) {
        if (!(width >= 2 && height >= 2)) {
            throw new Error("Control points must be larger than 3x3 or equal");
        }
        this._controlPoints.resize(width, height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const point = new ControlPoint();
                point.location.x = (x / (width - 1)) * 2 - 1;
                point.location.y = (y / (height - 1)) * 2 - 1;
                point.uTangent.x = 2 / (width - 1);
                point.vTangent.y = 2 / (height - 1);
                this._controlPoints.set(x, y, point);
            }
        }
        this.resetSubdivition(this._subDivisions);
    }
    getControlPoint(x: number, y: number) {
        return this._controlPoints.get(x, y);
    }
    private tmpV2 = Vec2.create();
    private tempX = Mat4.create();
    private tempY = Mat4.create();
    private tempR = Mat4.create();
    private tempG = Mat4.create();
    private tempB = Mat4.create();
    updateMesh() {
        const subDivM1 = this._subDivisions - 1;
        const tW = subDivM1 * (this._controlPoints.height - 1);
        const tH = subDivM1 * (this._controlPoints.width - 1);
        const controlPointsWidth = this._controlPoints.width;
        const controlPointsHeight = this._controlPoints.height;
        const subDivisions = this._subDivisions;

        const invSubDivM1 = 1 / subDivM1;
        const invTH = 1 / tH;
        const invTW = 1 / tW;

        for (let x = 0; x < controlPointsWidth - 1; x++) {
            for (let y = 0; y < controlPointsHeight - 1; y++) {
                const p00 = this._controlPoints.get(x, y);
                const p01 = this._controlPoints.get(x, y + 1);
                const p10 = this._controlPoints.get(x + 1, y);
                const p11 = this._controlPoints.get(x + 1, y + 1);

                meshCoefficients(p00, p01, p10, p11, "x", this.tempX);
                meshCoefficients(p00, p01, p10, p11, "y", this.tempY);
                colorCoefficients(p00, p01, p10, p11, "r", this.tempR);
                colorCoefficients(p00, p01, p10, p11, "g", this.tempG);
                colorCoefficients(p00, p01, p10, p11, "b", this.tempB);

                const sX = x / (controlPointsWidth - 1);
                const sY = y / (controlPointsHeight - 1);
                const baseVx = y * subDivisions;
                const baseVy = x * subDivisions;

                for (let u = 0; u < subDivisions; u++) {
                    const uNorm = u * invSubDivM1;
                    const vxOffset = baseVx + u;

                    for (let v = 0; v < subDivisions; v++) {
                        const vNorm = v * invSubDivM1;
                        const vy = baseVy + v;

                        const [px, py] = surfacePoint(
                            uNorm,
                            vNorm,
                            this.tempX,
                            this.tempY,
                            this.tmpV2,
                        );
                        const [pr, pg, pb] = colorPoint(
                            uNorm,
                            vNorm,
                            this.tempR,
                            this.tempG,
                            this.tempB,
                        );
                        const uvX = sX + v * invTH;
                        const uvY = 1 - sY - u * invTW;

                        this.setVertexData(vxOffset, vy, px, py, pr, pg, pb, uvX, uvY);
                    }
                }
            }
        }
        this.update();
    }
}

class GLTexture implements Disposable {
    readonly tex: WebGLTexture;

    constructor(
        private gl: WebGLRenderingContext,
        albumImageData: ImageData,
    ) {
        const albumTexture = gl.createTexture();
        if (!albumTexture) throw new Error("Failed to create texture");
        this.tex = albumTexture;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, albumTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            albumImageData,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    }

    bind() {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
    }

    dispose(): void {
        this.gl.deleteTexture(this.tex);
    }
}

function createOffscreenCanvas(width: number, height: number) {
    if ("OffscreenCanvas" in window) return new OffscreenCanvas(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

interface MeshState {
    mesh: BHPMesh;
    texture: GLTexture;
    alpha: number;
}

export class MeshGradientRenderer extends BaseRenderer {
    private gl!: RenderingContext;
    private lastFrameTime = 0;
    private frameTime = 0;
    private lastTickTime = 0;
    private smoothedVolume = 0;
    private volume = 0;
    private tickHandle = 0;
    private maxFPS = 60;
    private paused = false;
    private staticMode = false;
    private mainProgram: GLProgram;
    private manualControl = false;
    private reduceImageSizeCanvas = createOffscreenCanvas(
        32,
        32,
    ) as HTMLCanvasElement;
    private targetSize = Vec2.fromValues(0, 0);
    private currentSize = Vec2.fromValues(0, 0);
    private isNoCover = true;
    private meshStates: MeshState[] = [];
    private _disposed = false;
    private frameCount = 0;
    private lastFPSUpdate = 0;
    private currentFPS = 0;
    private enablePerformanceMonitoring = false;

    setManualControl(enable: boolean) {
        this.manualControl = enable;
    }

    setWireFrame(enable: boolean) {
        for (const state of this.meshStates) {
            state.mesh.setWireFrame(enable);
        }
    }

    getControlPoint(x: number, y: number): ControlPoint | undefined {
        return this.meshStates[this.meshStates.length - 1]?.mesh?.getControlPoint(
            x,
            y,
        );
    }

    resizeControlPoints(width: number, height: number) {
        return this.meshStates[
            this.meshStates.length - 1
        ]?.mesh?.resizeControlPoints(width, height);
    }

    resetSubdivition(subDivisions: number) {
        return this.meshStates[this.meshStates.length - 1]?.mesh?.resetSubdivition(
            subDivisions,
        );
    }

    private onTick(tickTime: number) {
        this.tickHandle = 0;
        if (this.paused) return;
        if (this._disposed) return;
        if (!this.gl) return; // 防止构造失败后的tick错误

        this.updatePerformanceStats(tickTime);

        if (Number.isNaN(this.lastFrameTime)) {
            this.lastFrameTime = tickTime;
        }
        const delta = tickTime - this.lastTickTime;
        const frameDelta = tickTime - this.lastFrameTime;
        this.lastFrameTime = tickTime;
        if (delta < 1000 / this.maxFPS) {
            this.requestTick();
            return;
        }

        this.frameTime += frameDelta * this.flowSpeed;

        if (!(this.onRedraw(this.frameTime, frameDelta) && this.staticMode)) {
            this.requestTick();
        } else if (this.staticMode) {
            this.lastFrameTime = Number.NaN;
        }

        this.lastTickTime = tickTime;
    }

    private checkIfResize() {
        const [tW, tH] = [this.targetSize.x, this.targetSize.y];
        const [cW, cH] = [this.currentSize.x, this.currentSize.y];
        if (tW !== cW || tH !== cH) {
            super.onResize(tW, tH);
            const gl = this.gl;
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, tW, tH);
            this.currentSize.x = tW;
            this.currentSize.y = tH;
        }
    }

    private onRedraw(tickTime: number, delta: number) {
        const latestMeshState = this.meshStates[this.meshStates.length - 1];
        let canBeStatic = false;

        const deltaFactor = delta / 500;

        if (latestMeshState) {
            latestMeshState.mesh.bind();
            if (this.manualControl) latestMeshState.mesh.updateMesh();

            if (this.isNoCover) {
                let hasActiveStates = false;
                for (let i = this.meshStates.length - 1; i >= 0; i--) {
                    const state = this.meshStates[i];
                    state.alpha = Math.max(0, state.alpha - deltaFactor);
                    if (state.alpha > 0) {
                        hasActiveStates = true;
                    } else {
                        state.mesh.dispose();
                        state.texture.dispose();
                        this.meshStates.splice(i, 1);
                    }
                }
                canBeStatic = !hasActiveStates;
            } else {
                latestMeshState.alpha = Math.min(
                    1,
                    latestMeshState.alpha + deltaFactor,
                );
                if (latestMeshState.alpha >= 1) {
                    const deleted = this.meshStates.splice(0, this.meshStates.length - 1);
                    for (const state of deleted) {
                        state.mesh.dispose();
                        state.texture.dispose();
                    }
                }
                canBeStatic =
                    this.meshStates.length === 1 && latestMeshState.alpha >= 1;
            }
        }

        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.checkIfResize();

        const lerpFactor = Math.min(1.0, delta / 100.0);
        this.smoothedVolume += (this.volume - this.smoothedVolume) * lerpFactor;

        this.mainProgram.use();

        gl.activeTexture(gl.TEXTURE0);
        this.mainProgram.setUniform1f("u_time", tickTime / 10000);
        this.mainProgram.setUniform1f(
            "u_aspect",
            this.manualControl ? 1 : this.canvas.width / this.canvas.height,
        );
        this.mainProgram.setUniform1i("u_texture", 0);
        this.mainProgram.setUniform1f("u_volume", this.volume);

        for (const state of this.meshStates) {
            this.mainProgram.setUniform1f("u_alpha", state.alpha);
            state.texture.bind();
            state.mesh.bind();
            state.mesh.draw();
        }

        gl.flush();

        return canBeStatic;
    }

    private onTickBinded = this.onTick.bind(this);

    private requestTick() {
        if (this._disposed) return;
        if (this.tickHandle === 0)
            this.tickHandle = requestAnimationFrame(this.onTickBinded);
    }

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);

        // 尝试获取WebGL context，先尝试webgl，再尝试experimental-webgl
        let gl = canvas.getContext("webgl", {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            powerPreference: "low-power",
        }) as WebGLRenderingContext | null;

        if (!gl) {
            gl = canvas.getContext("experimental-webgl", {
                alpha: true,
                antialias: false,
                depth: false,
                stencil: false,
                premultipliedAlpha: true,
                preserveDrawingBuffer: false,
                powerPreference: "low-power",
            }) as WebGLRenderingContext | null;
        }

        if (!gl) {
            throw new Error("WebGL not supported");
        }

        // 尝试获取扩展，忽略失败
        try { gl.getExtension("EXT_color_buffer_float"); } catch (_) { }
        try { gl.getExtension("EXT_float_blend"); } catch (_) { }
        try { gl.getExtension("OES_texture_float_linear"); } catch (_) { }
        try { gl.getExtension("OES_texture_float"); } catch (_) { }

        this.gl = gl;
        gl.enable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.ALWAYS);

        this.mainProgram = new GLProgram(
            gl,
            meshVertShader,
            meshFragShader,
            "main-program-mg",
        );

        this.requestTick();
    }

    protected override onResize(width: number, height: number): void {
        this.targetSize.x = Math.ceil(width);
        this.targetSize.y = Math.ceil(height);
        this.requestTick();
    }

    override setStaticMode(enable: boolean): void {
        this.staticMode = enable;
        this.lastFrameTime = performance.now();
        this.requestTick();
    }
    override setFPS(fps: number): void {
        this.maxFPS = fps;
    }
    override pause(): void {
        if (this.tickHandle) {
            cancelAnimationFrame(this.tickHandle);
            this.tickHandle = 0;
        }
        this.paused = true;
    }
    override resume(): void {
        this.paused = false;
        this.requestTick();
    }
    override async setAlbum(
        albumSource?: string | HTMLImageElement | HTMLVideoElement,
        isVideo?: boolean,
    ): Promise<void> {
        if (
            albumSource === undefined ||
            (typeof albumSource === "string" && albumSource.trim().length === 0)
        ) {
            this.isNoCover = true;
            return;
        }
        let res: HTMLImageElement | HTMLVideoElement | null = null;
        let remainRetryTimes = 5;
        while (!res && remainRetryTimes > 0) {
            try {
                if (typeof albumSource === "string") {
                    res = await loadResourceFromUrl(albumSource, isVideo);
                } else {
                    res = await loadResourceFromElement(albumSource);
                }
            } catch (error) {
                console.warn(
                    `failed on loading album resource, retrying (${remainRetryTimes})`,
                    {
                        albumSource,
                        error,
                    },
                );
                remainRetryTimes--;
            }
        }
        if (!res) {
            console.error("Failed to load album resource", albumSource);
            this.isNoCover = true;
            return;
        }
        this.isNoCover = false;
        // resize image
        const c = this.reduceImageSizeCanvas;
        const ctx = c.getContext("2d", {
            willReadFrequently: true,
        });
        if (!ctx) throw new Error("Failed to create canvas context");
        ctx.clearRect(0, 0, c.width, c.height);
        const imgw =
            res instanceof HTMLVideoElement ? res.videoWidth : res.naturalWidth;
        const imgh =
            res instanceof HTMLVideoElement ? res.videoHeight : res.naturalHeight;
        if (imgw * imgh === 0) throw new Error("Invalid image size");
        ctx.drawImage(res, 0, 0, imgw, imgh, 0, 0, c.width, c.height);

        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        contrastImage(imageData, 0.4);
        saturateImage(imageData, 3.0);
        contrastImage(imageData, 1.7);
        brightnessImage(imageData, 0.75);
        blurImage(imageData, 2, 4);

        if (this.manualControl && this.meshStates.length > 0) {
            this.meshStates[0].texture.dispose();
            this.meshStates[0].texture = new GLTexture(this.gl, imageData);
        } else {
            const newMesh = new BHPMesh(
                this.gl,
                this.mainProgram.attrs.a_pos,
                this.mainProgram.attrs.a_color,
                this.mainProgram.attrs.a_uv,
            );
            newMesh.resetSubdivition(15);

            const chosenPreset =
                Math.random() > 0.8
                    ? generateControlPoints(6, 6)
                    : CONTROL_POINT_PRESETS[
                    Math.floor(Math.random() * CONTROL_POINT_PRESETS.length)
                    ];

            newMesh.resizeControlPoints(chosenPreset.width, chosenPreset.height);
            const uPower = 2 / (chosenPreset.width - 1);
            const vPower = 2 / (chosenPreset.height - 1);
            for (const cp of chosenPreset.conf) {
                const p = newMesh.getControlPoint(cp.cx, cp.cy);
                p.location.x = cp.x;
                p.location.y = cp.y;
                p.uRot = (cp.ur * Math.PI) / 180;
                p.vRot = (cp.vr * Math.PI) / 180;
                p.uScale = uPower * cp.up;
                p.vScale = vPower * cp.vp;
            }

            newMesh.updateMesh();

            const albumTexture = new GLTexture(this.gl, imageData);
            const newState: MeshState = {
                mesh: newMesh,
                texture: albumTexture,
                alpha: 0,
            };
            this.meshStates.push(newState);
        }

        this.requestTick();
    }
    override setLowFreqVolume(volume: number): void {
        this.volume = volume / 10;
    }
    override setHasLyric(_hasLyric: boolean): void {
        // 不再考虑实现
    }

    override dispose(): void {
        super.dispose();
        if (this.tickHandle) {
            cancelAnimationFrame(this.tickHandle);
            this.tickHandle = 0;
        }
        this._disposed = true;
        this.mainProgram.dispose();
        for (const state of this.meshStates) {
            state.mesh.dispose();
            state.texture.dispose();
        }
    }

    enablePerformanceMonitor(enable: boolean) {
        this.enablePerformanceMonitoring = enable;
        if (enable) {
            this.frameCount = 0;
            this.lastFPSUpdate = performance.now();
        }
    }

    getCurrentFPS(): number {
        return this.currentFPS;
    }

    private updatePerformanceStats(tickTime: number) {
        if (!this.enablePerformanceMonitoring) return;

        this.frameCount++;
        if (tickTime - this.lastFPSUpdate > 1000) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.lastFPSUpdate = tickTime;
        }
    }
}
