"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivateImageStore = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
class PrivateImageStore {
    root;
    constructor(root) { this.root = (0, node_path_1.resolve)(root, "images"); }
    async writeOriginal(input) {
        const relativePath = (0, node_path_1.join)(input.garmentId, input.imageId, `original${input.extension}`);
        const absolute = (0, node_path_1.resolve)(this.root, relativePath);
        if (!this.contains(absolute))
            throw new Error("image_path_escape");
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(absolute), { recursive: true });
        await (0, promises_1.writeFile)(absolute, input.bytes, { flag: "wx" });
        return relativePath.replaceAll("\\", "/");
    }
    async read(relativePath) {
        if ((0, node_path_1.isAbsolute)(relativePath) || relativePath.includes("\0"))
            throw new Error("invalid_image_path");
        const absolute = (0, node_path_1.resolve)(this.root, (0, node_path_1.normalize)(relativePath));
        if (!this.contains(absolute))
            throw new Error("invalid_image_path");
        return (0, promises_1.readFile)(absolute);
    }
    async removeOriginal(relativePath) {
        if ((0, node_path_1.isAbsolute)(relativePath) || relativePath.includes("\0"))
            throw new Error("invalid_image_path");
        const absolute = (0, node_path_1.resolve)(this.root, (0, node_path_1.normalize)(relativePath));
        if (!this.contains(absolute))
            throw new Error("invalid_image_path");
        await (0, promises_1.rm)((0, node_path_1.dirname)(absolute), { recursive: true, force: true });
    }
    async removeGarment(garmentId) {
        if (!/^[0-9a-f-]{36}$/i.test(garmentId))
            throw new Error("invalid_garment_id");
        const absolute = (0, node_path_1.resolve)(this.root, garmentId);
        if (!this.contains(absolute))
            throw new Error("image_path_escape");
        await (0, promises_1.rm)(absolute, { recursive: true, force: true });
    }
    contains(absolute) {
        const value = (0, node_path_1.relative)(this.root, absolute);
        return value !== ".." && !value.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !(0, node_path_1.isAbsolute)(value);
    }
}
exports.PrivateImageStore = PrivateImageStore;
