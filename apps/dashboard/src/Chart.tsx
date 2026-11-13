import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import type { EChartsOption } from "echarts";
import { LineChart, BarChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  SVGRenderer,
]);
export function Chart({
  option,
  label,
}: {
  option: EChartsOption;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "svg" });
    chart.setOption({ ...option, animation: false });
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(ref.current);
    return () => {
      resize.disconnect();
      chart.dispose();
    };
  }, [option]);
  return <div ref={ref} className="chart" role="img" aria-label={label} />;
}
