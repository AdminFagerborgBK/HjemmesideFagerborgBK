import { assertManifest, type SportsSeason } from './sportsSeason.ts';

export async function activateSeason(config: SportsSeason, deps: {
  publish: (config: SportsSeason) => Promise<void>;
  read: () => Promise<unknown>;
  activate: (season: number) => Promise<void>;
}) {
  await deps.publish(config);
  assertManifest(config, await deps.read());
  await deps.activate(config.season);
}