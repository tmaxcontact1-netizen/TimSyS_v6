import { describe, expect, it, vi } from "vitest";
import { PhotographyRepository } from "../../src/infrastructure/database/photography-repository.js";

function repositoryWithUsage(count: number) {
  const query = vi.fn()
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({ rows: [{ count: String(count) }] })
    .mockResolvedValueOnce({ rowCount: 1 })
    .mockResolvedValueOnce({});
  const release = vi.fn();
  const pool = { connect: vi.fn().mockResolvedValue({ query, release }) };
  return { repository: new PhotographyRepository(pool as never), query, release };
}

describe("calibration profile removal", () => {
  it("permanently deletes a card that has not calibrated any photos", async () => {
    const { repository, query, release } = repositoryWithUsage(0);

    await expect(repository.retireProfile("card-1")).resolves.toEqual({
      removed: true,
      retainedForExistingPhotos: false,
    });
    expect(query.mock.calls[2]?.[0]).toContain("DELETE FROM dressed.calibration_profiles");
    expect(release).toHaveBeenCalledOnce();
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
