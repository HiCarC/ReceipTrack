import { describe, it, expect } from 'vitest';
import Supercluster from 'supercluster';

const makePoints = (count) => {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const lng = -180 + Math.random() * 360;
    const lat = -85 + Math.random() * 170;
    points.push({
      type: 'Feature',
      properties: { id: `p-${i}`, cluster: false },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    });
  }
  return points;
};

describe('map clustering performance', () => {
  it('clusters 1k points within budget', () => {
    const points = makePoints(1000);
    const cluster = new Supercluster({ radius: 40, maxZoom: 16, minPoints: 2 });
    const start = performance.now();
    cluster.load(points);
    cluster.getClusters([-180, -85, 180, 85], 2);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(500);
  });
});
