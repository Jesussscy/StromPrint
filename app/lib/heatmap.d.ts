declare module "heatmap.js" {
  export interface HeatmapDataPoint {
    x: number;
    y: number;
    value: number;
    radius?: number;
  }

  export interface HeatmapConfiguration {
    container: HTMLElement;
    radius?: number;
    maxOpacity?: number;
    minOpacity?: number;
    blur?: number;
    opacity?: number;
    gradient?: Record<string, string>;
    backgroundColor?: string;
    xField?: string;
    yField?: string;
    valueField?: string;
  }

  export interface Heatmap {
    addData(
      point: HeatmapDataPoint | ReadonlyArray<HeatmapDataPoint>
    ): this;
    setData(data: { max: number; min: number; data: HeatmapDataPoint[] }): this;
    setDataMax(max: number): this;
    setDataMin(min: number): this;
    configure(config: HeatmapConfiguration): this;
    getValueAt(point: { x: number; y: number }): number;
    getData(): { max: number; min: number; data: HeatmapDataPoint[] };
    getDataURL(): string;
    repaint(): this;
  }

  const h337: {
    create(config: HeatmapConfiguration): Heatmap;
  };

  export default h337;
}
