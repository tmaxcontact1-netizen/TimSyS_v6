"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const repository_cjs_1 = require("../../services/photography/repository.cjs");
function repositoryWithUsage(count) {
    const query = jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ count: String(count) }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({});
    const release = jest.fn();
    const pool = { connect: jest.fn().mockResolvedValue({ query, release }) };
    return { repository: new repository_cjs_1.PhotographyRepository(pool), query, release };
}
describe("calibration profile removal", () => {
    it("permanently deletes a card that has not calibrated any photos", async () => {
        const { repository, query, release } = repositoryWithUsage(0);
        await expect(repository.retireProfile("card-1")).resolves.toEqual({
            removed: true,
            retainedForExistingPhotos: false,
        });
        expect(query.mock.calls[2]?.[0]).toContain("DELETE FROM dressed.calibration_profiles");
        expect(release).toHaveBeenCalledTimes(1);
    });
    it("retires a used card without invalidating historical colour measurements", async () => {
        const { repository, query } = repositoryWithUsage(3);
        await expect(repository.retireProfile("card-1")).resolves.toEqual({
            removed: true,
            retainedForExistingPhotos: true,
        });
        expect(query.mock.calls[2]?.[0]).toContain("SET is_active=false");
    });
});
