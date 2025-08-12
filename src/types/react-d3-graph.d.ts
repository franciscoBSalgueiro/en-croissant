declare module "react-d3-graph" {
  import type { ComponentType } from "react";

  export interface GraphData {
    nodes: Array<{ id: string; [key: string]: any }>;
    links: Array<{ source: string; target: string; [key: string]: any }>;
  }

  export interface GraphConfig {
    directed?: boolean;
    collapsible?: boolean;
    height?: number;
    width?: number;
    panAndZoom?: boolean;
    nodeHighlightBehavior?: boolean;
    linkHighlightBehavior?: boolean;
    staticGraph?: boolean;
    d3?: Record<string, any>;
    node?: Record<string, any>;
    link?: Record<string, any>;
  }

  export interface GraphProps {
    id: string;
    data: GraphData;
    config?: GraphConfig;
    onClickNode?: (id: string) => void;
    onClickLink?: (source: string, target: string) => void;
  }

  export const Graph: ComponentType<GraphProps>;
} 