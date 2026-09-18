/** Explicit interaction also covers clicking the already selected hour. */
export const FORECAST_TIMELINE_EVENT='stormprint:forecast-timeline';
export function activateForecastTimeline(){window.dispatchEvent(new Event(FORECAST_TIMELINE_EVENT));}
