"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspectCalibrationCard = inspectCalibrationCard;
exports.analyseCalibrationCard = analyseCalibrationCard;
exports.measureImage = measureImage;
exports.combineFingerprint = combineFingerprint;
exports.suggestFields = suggestFields;
const sharp_1 = __importDefault(require("sharp"));
const fingerprint_domain_cjs_1 = require("./fingerprint-domain.cjs");
const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const rounded = (value, digits = 4) => Number(value.toFixed(digits));
function lab(r, g, b) { const linear = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; const R = linear(r), G = linear(g), B = linear(b); const x = (R * .4124 + G * .3576 + B * .1805) / .95047, y = (R * .2126 + G * .7152 + B * .0722), z = (R * .0193 + G * .1192 + B * .9505) / 1.08883; const f = (v) => v > .008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116; return [rounded(116 * f(y) - 16, 2), rounded(500 * (f(x) - f(y)), 2), rounded(200 * (f(y) - f(z)), 2)]; }
function rgbFromLab(L, a, b) { const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200; const inv = (v) => { const c = v ** 3; return c > .008856 ? c : (v - 16 / 116) / 7.787; }; const x = .95047 * inv(fx), y = inv(fy), z = 1.08883 * inv(fz); let r = x * 3.2406 + y * -1.5372 + z * -.4986, g = x * -.9689 + y * 1.8758 + z * .0415, bb = x * .0557 + y * -.204 + z * 1.057; const gamma = (v) => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055); return [clamp(Math.round(gamma(r)), 0, 255), clamp(Math.round(gamma(g)), 0, 255), clamp(Math.round(gamma(bb)), 0, 255)]; }
const cardPatchLabels = ["Black", "Red", "Green", "Blue", "Cyan", "Magenta", "Yellow", "Grey"];
function cardColour(r, g, b) { const max = Math.max(r, g, b), min = Math.min(r, g, b); if (max < 80 || max - min < 38)
    return null; if (r > g * 1.28 && r > b * 1.28)
    return "red"; if (g > r * 1.18 && g > b * 1.18)
    return "green"; if (b > r * 1.18 && b > g * 1.18)
    return "blue"; return null; }
function cardRegions(data, width, height, channels) { const labels = new Int8Array(width * height); for (let p = 0; p < labels.length; p++) {
    const i = p * channels;
    labels[p] = cardColour(data[i], data[i + 1], data[i + 2]) === "red" ? 1 : cardColour(data[i], data[i + 1], data[i + 2]) === "green" ? 2 : cardColour(data[i], data[i + 1], data[i + 2]) === "blue" ? 3 : 0;
} const seen = new Uint8Array(labels.length), regions = []; const minimum = Math.max(60, Math.round(width * height * .00025)), maximum = Math.round(width * height * .08); for (let seed = 0; seed < labels.length; seed++) {
    if (!labels[seed] || seen[seed])
        continue;
    const target = labels[seed], stack = [seed], pixels = [];
    seen[seed] = 1;
    let minX = width, maxX = 0, minY = height, maxY = 0, sumX = 0, sumY = 0;
    while (stack.length) {
        const p = stack.pop(), x = p % width, y = Math.floor(p / width);
        pixels.push(p);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        sumX += x;
        sumY += y;
        for (const next of [p - 1, p + 1, p - width, p + width]) {
            if (next < 0 || next >= labels.length || seen[next] || labels[next] !== target)
                continue;
            const nx = next % width;
            if (Math.abs(nx - x) > 1)
                continue;
            seen[next] = 1;
            stack.push(next);
        }
    }
    const area = pixels.length;
    if (area < minimum || area > maximum)
        continue;
    const boxWidth = maxX - minX + 1, boxHeight = maxY - minY + 1, fill = area / (boxWidth * boxHeight);
    if (fill < .42)
        continue;
    regions.push({ colour: target === 1 ? "red" : target === 2 ? "green" : "blue", pixels, area, cx: sumX / area, cy: sumY / area, width: boxWidth, height: boxHeight, fill });
} return regions; }
function locateCard(regions) { const by = (colour) => regions.filter(region => region.colour === colour).sort((a, b) => b.area - a.area).slice(0, 12); const reds = by("red"), greens = by("green"), blues = by("blue"); if (!reds.length)
    throw new Error("calibration_red_not_found"); if (!greens.length)
    throw new Error("calibration_green_not_found"); if (!blues.length)
    throw new Error("calibration_blue_not_found"); let best = null; for (const red of reds)
    for (const green of greens)
        for (const blue of blues) {
            const rg = Math.hypot(red.cx - green.cx, red.cy - green.cy), gb = Math.hypot(green.cx - blue.cx, green.cy - blue.cy), rb = Math.hypot(red.cx - blue.cx, red.cy - blue.cy);
            if (rg < 4 || gb < 4 || rb < 8)
                continue;
            const straightness = Math.abs((green.cx - red.cx) * (blue.cy - red.cy) - (green.cy - red.cy) * (blue.cx - red.cx)) / (rb * rb);
            const between = Math.abs((rg + gb) - rb) / rb;
            const spacing = Math.max(rg, gb) / Math.min(rg, gb);
            const areas = [red.area, green.area, blue.area], areaRatio = Math.max(...areas) / Math.min(...areas);
            const shapes = [red.width / red.height, green.width / green.height, blue.width / blue.height], shapeRatio = Math.max(...shapes) / Math.min(...shapes);
            if (straightness > .24 || between > .28 || spacing > 2.4 || areaRatio > 3 || shapeRatio > 2.5)
                continue;
            const score = straightness * 5 + between * 4 + (spacing - 1) + (areaRatio - 1) * .6 + (shapeRatio - 1) * .35 - (red.fill + green.fill + blue.fill) * .08;
            if (!best || score < best.score)
                best = { score, red, green, blue };
        } if (!best)
    throw new Error("calibration_card_geometry_invalid"); return { red: best.red, green: best.green, blue: best.blue }; }
function medianPatch(data, width, height, channels, cx, cy, radius, label) { const values = []; for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(height - 1, Math.ceil(cy + radius)); y++)
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(width - 1, Math.ceil(cx + radius)); x++) {
        if (Math.hypot(x - cx, y - cy) > radius)
            continue;
        const i = (y * width + x) * channels, r = data[i], g = data[i + 1], b = data[i + 2];
        if (Math.max(r, g, b) >= 250 || Math.min(r, g, b) <= 2)
            continue;
        values.push([r, g, b]);
    } if (values.length < 30)
    return null; const median = (channel) => { const sorted = values.map(value => value[channel]).sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; }; const [L, a, b] = lab(median(0), median(1), median(2)); return { label, labL: L, labA: a, labB: b }; }
async function inspectCalibrationCard(bytes) { const { data, info } = await (0, sharp_1.default)(bytes).rotate().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); if (info.width < 240 || info.height < 240 || info.channels < 3)
    throw new Error("calibration_photo_too_small"); const located = locateCard(cardRegions(data, info.width, info.height, info.channels)); const direct = (colour) => { const region = located[colour], values = region.pixels.map(p => { const i = p * info.channels; return [data[i], data[i + 1], data[i + 2]]; }).filter(([r, g, b]) => Math.max(r, g, b) < 248 && Math.min(r, g, b) > 4); if (values.length < Math.max(30, region.area * .55))
    throw new Error("calibration_card_glare"); const median = (channel) => { const sorted = values.map(value => value[channel]).sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; }; const [L, a, b] = lab(median(0), median(1), median(2)); return { label: colour[0].toUpperCase() + colour.slice(1), labL: L, labA: a, labB: b }; }; const rgb = [direct("red"), direct("green"), direct("blue")]; const red = located.red, green = located.green, blue = located.blue; const vx = ((green.cx - red.cx) + (blue.cx - green.cx)) / 2, vy = ((green.cy - red.cy) + (blue.cy - green.cy)) / 2, spacing = Math.hypot(vx, vy), radius = Math.max(5, Math.min(spacing * .22, Math.min(red.width, red.height, green.width, green.height, blue.width, blue.height) * .34)); const expanded = cardPatchLabels.map((label, index) => medianPatch(data, info.width, info.height, info.channels, red.cx + vx * (index - 1), red.cy + vy * (index - 1), radius, label)); if (expanded.every(Boolean)) {
    return Object.freeze({ patches: Object.freeze(expanded), layout: "timsys-8", confidence: .92, message: "All eight colour-card patches were located and measured." });
} return Object.freeze({ patches: Object.freeze(rgb), layout: "rgb-3", confidence: .68, message: "Red, green and blue were measured. An eight-patch Dress’Ed card will provide stronger correction." }); }
async function analyseCalibrationCard(bytes) { return (await inspectCalibrationCard(bytes)).patches; }
function solve4(matrix, values) { const a = matrix.map((row, index) => [...row, values[index]]); for (let column = 0; column < 4; column++) {
    let pivot = column;
    for (let row = column + 1; row < 4; row++)
        if (Math.abs(a[row][column]) > Math.abs(a[pivot][column]))
            pivot = row;
    [a[column], a[pivot]] = [a[pivot], a[column]];
    const divisor = a[column][column];
    if (Math.abs(divisor) < 1e-8)
        throw new Error("calibration_matrix_singular");
    for (let j = column; j <= 4; j++)
        a[column][j] /= divisor;
    for (let row = 0; row < 4; row++) {
        if (row === column)
            continue;
        const factor = a[row][column];
        for (let j = column; j <= 4; j++)
            a[row][j] -= factor * a[column][j];
    }
} return a.map(row => row[4]); }
function colourTransform(observed, reference) { const target = new Map(reference.map(p => [p.label.toLowerCase(), rgbFromLab(p.labL, p.labA, p.labB)])); const pairs = observed.flatMap(p => { const expected = target.get(p.label.toLowerCase()); return expected ? [{ input: rgbFromLab(p.labL, p.labA, p.labB), output: expected }] : []; }); if (pairs.length < 4) {
    const by = new Map(pairs.map(p => [cardColour(...p.input), p]));
    return Object.freeze([0, 1, 2].map(channel => { const key = ['red', 'green', 'blue'][channel], pair = by.get(key); const gain = pair ? clamp(pair.output[channel] / Math.max(pair.input[channel], 1), .55, 1.8) : 1; return Object.freeze(channel === 0 ? [gain, 0, 0, 0] : channel === 1 ? [0, gain, 0, 0] : [0, 0, gain, 0]); }));
} const normal = Array.from({ length: 4 }, () => Array(4).fill(0)); for (const pair of pairs) {
    const row = [...pair.input, 1];
    for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++)
            normal[i][j] += row[i] * row[j];
} return Object.freeze([0, 1, 2].map(channel => { const rhs = [0, 0, 0, 0]; for (const pair of pairs) {
    const row = [...pair.input, 1];
    for (let i = 0; i < 4; i++)
        rhs[i] += row[i] * pair.output[channel];
} return Object.freeze(solve4(normal, rhs)); })); }
function calibrationMask(data, width, height, channels) { try {
    const located = locateCard(cardRegions(data, width, height, channels)), red = located.red, green = located.green, blue = located.blue, vx = ((green.cx - red.cx) + (blue.cx - green.cx)) / 2, vy = ((green.cy - red.cy) + (blue.cy - green.cy)) / 2, spacing = Math.hypot(vx, vy), ux = vx / spacing, uy = vy / spacing, px = -uy, py = ux, halfAcross = Math.max(red.width, red.height, green.width, green.height, blue.width, blue.height) * .85;
    return (x, y) => { const dx = x - red.cx, dy = y - red.cy, along = dx * ux + dy * uy, across = Math.abs(dx * px + dy * py); return along >= -1.45 * spacing && along <= 6.45 * spacing && across <= halfAcross; };
}
catch {
    return null;
} }
const colourNames = [{ n: "black", v: [20, 20, 20] }, { n: "white", v: [235, 235, 235] }, { n: "grey", v: [128, 128, 128] }, { n: "navy", v: [25, 40, 80] }, { n: "blue", v: [50, 105, 180] }, { n: "brown", v: [105, 70, 45] }, { n: "beige", v: [205, 185, 145] }, { n: "red", v: [175, 45, 45] }, { n: "burgundy", v: [95, 25, 40] }, { n: "green", v: [55, 110, 65] }, { n: "yellow", v: [220, 190, 55] }, { n: "orange", v: [210, 115, 40] }, { n: "purple", v: [105, 65, 135] }, { n: "pink", v: [215, 135, 155] }];
function label(r, g, b) { return colourNames.reduce((best, current) => { const d = (r - current.v[0]) ** 2 + (g - current.v[1]) ** 2 + (b - current.v[2]) ** 2; return d < best.d ? { n: current.n, d } : best; }, { n: "unknown", d: Infinity }).n; }
async function measureImage(bytes, reference) {
    let transform = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
    if (reference?.length) {
        const observed = await analyseCalibrationCard(bytes);
        transform = colourTransform(observed, reference);
    }
    const raw = await (0, sharp_1.default)(bytes).rotate().resize({ width: 256, height: 256, fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const data = Buffer.from(raw.data);
    const info = raw.info;
    for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        data[i] = clamp(Math.round(transform[0][0] * r + transform[0][1] * g + transform[0][2] * b + transform[0][3]), 0, 255);
        data[i + 1] = clamp(Math.round(transform[1][0] * r + transform[1][1] * g + transform[1][2] * b + transform[1][3]), 0, 255);
        data[i + 2] = clamp(Math.round(transform[2][0] * r + transform[2][1] * g + transform[2][2] * b + transform[2][3]), 0, 255);
    }
    const { width, height, channels } = info;
    if (channels < 3)
        throw new Error("image_channels_unsupported");
    const pixels = width * height;
    const lum = new Float64Array(pixels);
    const bins = new Map();
    let sumL = 0, sumC = 0;
    const cornerPoints = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
    const corners = cornerPoints.map(([x, y]) => { const i = (y * width + x) * channels; return [data[i], data[i + 1], data[i + 2]]; });
    const bg = [0, 1, 2].map((c) => corners.reduce((s, p) => s + p[c], 0) / 4), isCalibration = reference?.length ? calibrationMask(data, width, height, channels) : null;
    let minX = width, minY = height, maxX = -1, maxY = -1, foreground = 0;
    for (let p = 0; p < pixels; p++) {
        const i = p * channels, r = data[i], g = data[i + 1], b = data[i + 2], y = .2126 * r + .7152 * g + .0722 * b, x = p % width, yy = Math.floor(p / width), isForeground = Math.hypot(r - bg[0], g - bg[1], b - bg[2]) > 35 && !isCalibration?.(x, yy);
        lum[p] = y;
        const [L, a, bb] = lab(r, g, b);
        if (isForeground) {
            sumL += L;
            sumC += Math.hypot(a, bb);
            const key = `${r >> 5}-${g >> 5}-${b >> 5}`, bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
            bin.count++;
            bin.r += r;
            bin.g += g;
            bin.b += b;
            bins.set(key, bin);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, yy);
            maxY = Math.max(maxY, yy);
            foreground++;
        }
    }
    const mean = lum.reduce((s, v) => s + v, 0) / pixels;
    let variance = 0, edges = 0, horizontal = 0, vertical = 0, neighborDifference = 0, neighbors = 0;
    for (let y = 1; y < height - 1; y++)
        for (let x = 1; x < width - 1; x++) {
            const p = y * width + x, gx = lum[p + 1] - lum[p - 1], gy = lum[p + width] - lum[p - width], m = Math.hypot(gx, gy);
            if (m > 36)
                edges++;
            horizontal += Math.abs(gy);
            vertical += Math.abs(gx);
            neighborDifference += Math.abs(lum[p] - lum[p - 1]) + Math.abs(lum[p] - lum[p - width]);
            neighbors += 2;
        }
    for (const value of lum)
        variance += (value - mean) ** 2;
    const palette = [...bins.values()].sort((a, b) => b.count - a.count).slice(0, 5).map((bin) => { const r = Math.round(bin.r / bin.count), g = Math.round(bin.g / bin.count), b = Math.round(bin.b / bin.count); return { rgb: [r, g, b], lab: lab(r, g, b), proportion: rounded(bin.count / Math.max(foreground, 1)), label: label(r, g, b) }; });
    if (!palette.length)
        palette.push({ rgb: [Math.round(bg[0]), Math.round(bg[1]), Math.round(bg[2])], lab: lab(Math.round(bg[0]), Math.round(bg[1]), Math.round(bg[2])), proportion: 1, label: label(Math.round(bg[0]), Math.round(bg[1]), Math.round(bg[2])) });
    const edgeDensity = edges / Math.max((width - 2) * (height - 2), 1), contrast = Math.sqrt(variance / pixels) / 64, texture = (neighborDifference / Math.max(neighbors, 1)) / 32, paletteComplexity = clamp((bins.size - 1) / 40), complexity = clamp(.2 * paletteComplexity + .4 * edgeDensity * 4 + .15 * contrast + .15 * texture + .1 * (1 - palette[0].proportion));
    const boxWidth = maxX >= 0 ? maxX - minX + 1 : width, boxHeight = maxY >= 0 ? maxY - minY + 1 : height;
    return Object.freeze({ width, height, foregroundCoverage: rounded(foreground / pixels), foregroundAspectRatio: rounded(boxWidth / boxHeight), palette: Object.freeze(palette), averageLightness: rounded(sumL / Math.max(foreground, 1)), averageChroma: rounded(sumC / Math.max(foreground, 1)), luminanceContrast: rounded(clamp(contrast)), edgeDensity: rounded(edgeDensity), horizontalEdgeEnergy: rounded(clamp(horizontal / Math.max(neighbors, 1) / 32)), verticalEdgeEnergy: rounded(clamp(vertical / Math.max(neighbors, 1) / 32)), textureStrength: rounded(clamp(texture)), paletteComplexity: rounded(paletteComplexity), visualComplexity: rounded(complexity), solidConfidence: rounded(clamp(1 - edgeDensity * 3 - paletteComplexity * .45)) });
}
function combineFingerprint(whole, detail) { if (!whole && !detail)
    throw new Error("fingerprint_requires_image"); const w = whole ? 0.65 : 0, d = detail ? (whole ? 0.35 : 1) : 0, total = w + d; const weighted = (key) => rounded(((whole ? Number(whole[key]) * w : 0) + (detail ? Number(detail[key]) * d : 0)) / total); const palette = (whole ?? detail).palette; const confidence = rounded(clamp((whole && detail?.width ? 0.9 : 0.62) * ((whole ?? detail).foregroundCoverage > .1 ? 1 : .75))); return Object.freeze({ schemaVersion: fingerprint_domain_cjs_1.FINGERPRINT_SCHEMA_VERSION, algorithmVersion: fingerprint_domain_cjs_1.FINGERPRINT_ALGORITHM_VERSION, whole, detail, combined: { palette, averageLightness: weighted("averageLightness"), averageChroma: weighted("averageChroma"), contrast: weighted("luminanceContrast"), patternDensity: weighted("edgeDensity"), textureStrength: weighted("textureStrength"), visualComplexity: weighted("visualComplexity"), solidConfidence: weighted("solidConfidence") }, confidence }); }
function suggestFields(fingerprint) { const m = fingerprint.combined, shape = (fingerprint.whole ?? fingerprint.detail), suggestions = []; const ratio = shape.foregroundAspectRatio; let categories; if (ratio < .32)
    categories = [{ slug: "ties", confidence: .66, reason: "very narrow vertical foreground" }, { slug: "scarves", confidence: .38, reason: "narrow foreground" }];
else if (ratio > 3)
    categories = [{ slug: "belts", confidence: .62, reason: "very wide narrow foreground" }, { slug: "scarves", confidence: .35, reason: "wide foreground" }];
else if (ratio < .72)
    categories = [{ slug: "formal-shirts", confidence: .37, reason: "vertical garment silhouette" }, { slug: "formal-trousers", confidence: .35, reason: "vertical garment silhouette" }, { slug: "coats", confidence: .31, reason: "vertical garment silhouette" }];
else
    categories = [{ slug: "casual-shirts", confidence: .3, reason: "broad garment silhouette" }, { slug: "sweaters", confidence: .28, reason: "broad garment silhouette" }, { slug: "pocket-squares", confidence: .24, reason: "near-square foreground" }]; suggestions.push({ field: "category", value: categories, confidence: categories[0].confidence * fingerprint.confidence, evidence: { foregroundAspectRatio: ratio, foregroundCoverage: shape.foregroundCoverage, limitation: "shape-only semantic estimate" } }); const formality = clamp(5 - (m.visualComplexity * 2.4 + m.averageChroma / 60)); suggestions.push({ field: "formality", value: Math.max(1, Math.min(5, Math.round(formality))), confidence: rounded(.34 * fingerprint.confidence), evidence: { visualComplexity: m.visualComplexity, averageChroma: m.averageChroma } }); const seasons = m.averageLightness < 45 ? ["autumn", "winter"] : m.averageLightness > 70 ? ["spring", "summer"] : ["all-season"]; suggestions.push({ field: "seasons", value: seasons, confidence: rounded(.4 * fingerprint.confidence), evidence: { averageLightness: m.averageLightness } }); return Object.freeze(suggestions); }
