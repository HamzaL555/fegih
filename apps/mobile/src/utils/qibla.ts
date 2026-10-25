const KAABA_LATITUDE = 21.4225;
const KAABA_LONGITUDE = 39.8262;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function calculateQiblaBearing(latitude: number, longitude: number): number {
  const userLatitude = toRadians(latitude);
  const userLongitude = toRadians(longitude);
  const kaabaLatitude = toRadians(KAABA_LATITUDE);
  const kaabaLongitude = toRadians(KAABA_LONGITUDE);
  const deltaLongitude = kaabaLongitude - userLongitude;
  const y = Math.sin(deltaLongitude);
  const x =
    Math.cos(userLatitude) * Math.sin(kaabaLatitude) -
    Math.sin(userLatitude) * Math.cos(kaabaLatitude) * Math.cos(deltaLongitude);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function normalizeDegrees(value: number): number {
  return (value + 360) % 360;
}
