import { Position, type Node, type NodeProps } from "@xyflow/react";
import { Handle } from "@xyflow/react";
import { ComponentNode } from "../../module/HookExtractor";

import "./ComponentStyle.css";

type ExpandedComponentMarkData = Node<
  {
    label: string;
    component: ComponentNode;
    setNode: React.Dispatch<React.SetStateAction<Node[]>>;
    size: { width: number; height: number };
    x: number;
    y: number;
  },
  "expanded"
>;

export default function ExpandedComponentMark({
  data,
}: NodeProps<ExpandedComponentMarkData>) {
  return (
    <div className="expanded">
      <div className="label">{data.label}</div>
      <div
        className="node-content"
        style={{
          width: data.size.width,
          height: data.size.height,
          borderRadius: 2,
          background: "#D9D9D9",
        }}
      ></div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#555" }}
        onConnect={(params) => console.log("handle onConnect", params)}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#555" }}
        onConnect={(params) => console.log("handle onConnect", params)}
      />
    </div>
  );
}
