export declare function isRouteTemplate(value: unknown): boolean
export interface MetricsWindow {
  eventLoopWindow: Record<string, number>
  poolPeaks: Record<string, number>
  waitEventsMax: Map<string, { wait_event_type: string; wait_event: string; count: number }>
}
export declare function mergeWindow(previous: MetricsWindow | undefined, data: unknown): MetricsWindow
export declare function renderMetrics(snapshots: Record<string, unknown>, windows?: Record<string, MetricsWindow>): string
export declare function startExporter(): Promise<void>
