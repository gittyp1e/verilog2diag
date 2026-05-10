import type { ReactElement } from "react";
import { useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  type EdgeProps,
  type EdgeTypes,
  type NodeProps,
  useNodes,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import type {
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureNodeWirePort,
  SelectionState
} from "./types";
import { sampleEdges, sampleNodes } from "./sampleGraph";

type DiagramCanvasProps = {
  onSelectionChange: (selection: SelectionState) => void;
};

type Point = {
  x: number;
  y: number;
};

type WireObstacle = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type RouteDirection = "horizontal" | "vertical" | "none";

const nodeFallbackWidth = 205;
const nodeFallbackHeight = 126;
const wireObstaclePadding = 22;
const wireExitOffset = wireObstaclePadding + 14;
const wireRoutingMargin = 80;
const wireBendRadius = 6;
const wireBendPenalty = 28;

const nodeTypes = {
  architectureNode: ArchitectureNodeView
};

const edgeTypes = {
  architectureWire: ArchitectureWireEdge
} satisfies EdgeTypes;

export function DiagramCanvas({
  onSelectionChange
}: DiagramCanvasProps): ReactElement {
  const [nodes, setNodes, onNodesChange] = useNodesState(sampleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(sampleEdges);

  const defaultViewport = useMemo(() => ({ x: 24, y: 42, zoom: 0.78 }), []);
  const wirePortLayout = useMemo(
    () => spreadWirePorts(nodes, edges),
    [nodes, edges]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: {
      nodes: ArchitectureNode[];
      edges: ArchitectureEdge[];
    }) => {
      onSelectionChange({
        nodeIds: selectedNodes.map((node) => node.id),
        edgeIds: selectedEdges.map((edge) => edge.id)
      });
    },
    [onSelectionChange]
  );

  return (
    <section className="diagram-region" aria-label="Architecture diagram">
      <ReactFlow
        nodes={wirePortLayout.nodes}
        edges={wirePortLayout.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.7}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={24}
          color="var(--blueprint-grid-line)"
        />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor={(node) =>
            node.data.materialization === "virtual"
              ? "var(--blueprint-virtual)"
              : "var(--blueprint-real)"
          }
        />
        <Controls showInteractive={false} />
        <Panel className="diagram-badge" position="top-left">
          Static sample graph
        </Panel>
      </ReactFlow>
    </section>
  );
}

function ArchitectureWireEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  style,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  markerEnd,
  markerStart,
  pathOptions,
  interactionWidth
}: EdgeProps<ArchitectureEdge>): ReactElement {
  const nodes = useNodes<ArchitectureNode>();
  const offset = getWireOffset(pathOptions);
  const routePoints = routeWireAroundBlocks({
    source: { x: sourceX, y: sourceY },
    target: { x: targetX, y: targetY },
    sourcePosition,
    targetPosition,
    offset,
    obstacles: getWireObstacles(nodes)
  });
  const path = getWirePath(routePoints);
  const { x: labelX, y: labelY } = getWireLabelPosition(routePoints);

  return (
    <BaseEdge
      id={id}
      path={path}
      labelX={labelX}
      labelY={labelY}
      label={label}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
      interactionWidth={interactionWidth}
    />
  );
}

function ArchitectureNodeView({
  data,
  selected
}: NodeProps<ArchitectureNode>): ReactElement {
  const isVirtual = data.materialization === "virtual";
  const targetPorts = getPortsForType(data.wirePorts, "target");
  const sourcePorts = getPortsForType(data.wirePorts, "source");

  return (
    <article
      className={[
        "architecture-node",
        isVirtual ? "architecture-node-virtual" : "architecture-node-real",
        selected ? "architecture-node-selected" : ""
      ].join(" ")}
    >
      {targetPorts.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          className="wire-port"
          style={{ top: `${port.offsetPercent}%` }}
        />
      ))}
      <div className="node-header">
        <span className="node-title">{data.label}</span>
      </div>
      <p>{data.role}</p>
      <div className="node-source">{data.source}</div>
      {sourcePorts.map((port) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          className="wire-port"
          style={{ top: `${port.offsetPercent}%` }}
        />
      ))}
    </article>
  );
}

function spreadWirePorts(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const portsByNode = new Map<string, ArchitectureNodeWirePort[]>();
  const sourceHandles = assignWirePorts(edges, nodesById, "source", portsByNode);
  const targetHandles = assignWirePorts(edges, nodesById, "target", portsByNode);

  return {
    nodes: nodes.map((node) => {
      const wirePorts = portsByNode.get(node.id) ?? [];
      const { wirePorts: _oldWirePorts, ...dataWithoutPorts } = node.data;

      return {
        ...node,
        data: {
          ...dataWithoutPorts,
          wirePorts
        }
      };
    }),
    edges: edges.map((edge) => ({
      ...edge,
      sourceHandle: sourceHandles.get(edge.id),
      targetHandle: targetHandles.get(edge.id)
    }))
  };
}

function assignWirePorts(
  edges: ArchitectureEdge[],
  nodesById: Map<string, ArchitectureNode>,
  type: ArchitectureNodeWirePort["type"],
  portsByNode: Map<string, ArchitectureNodeWirePort[]>
): Map<string, string> {
  const edgesByNode = new Map<string, ArchitectureEdge[]>();

  for (const edge of edges) {
    const nodeId = type === "source" ? edge.source : edge.target;
    const nodeEdges = edgesByNode.get(nodeId) ?? [];

    nodeEdges.push(edge);
    edgesByNode.set(nodeId, nodeEdges);
  }

  const handlesByEdge = new Map<string, string>();

  for (const [nodeId, nodeEdges] of edgesByNode) {
    const sortedEdges = [...nodeEdges].sort((leftEdge, rightEdge) =>
      compareEdgesByOppositeNode(leftEdge, rightEdge, type, nodesById)
    );
    const offsets = getWirePortOffsets(sortedEdges.length);

    sortedEdges.forEach((edge, index) => {
      const handleId = `${type}:${edge.id}`;
      const nodePorts = portsByNode.get(nodeId) ?? [];

      nodePorts.push({
        id: handleId,
        type,
        offsetPercent: offsets[index]
      });
      portsByNode.set(nodeId, nodePorts);
      handlesByEdge.set(edge.id, handleId);
    });
  }

  return handlesByEdge;
}

function getPortsForType(
  ports: ArchitectureNodeWirePort[] | undefined,
  type: ArchitectureNodeWirePort["type"]
): ArchitectureNodeWirePort[] {
  const typedPorts = ports?.filter((port) => port.type === type) ?? [];

  if (typedPorts.length > 0) {
    return typedPorts;
  }

  return [
    {
      id: `${type}:default`,
      type,
      offsetPercent: 50
    }
  ];
}

function compareEdgesByOppositeNode(
  leftEdge: ArchitectureEdge,
  rightEdge: ArchitectureEdge,
  type: ArchitectureNodeWirePort["type"],
  nodesById: Map<string, ArchitectureNode>
): number {
  const leftPosition = getOppositeNodePosition(leftEdge, type, nodesById);
  const rightPosition = getOppositeNodePosition(rightEdge, type, nodesById);

  return (
    leftPosition.y - rightPosition.y ||
    leftPosition.x - rightPosition.x ||
    leftEdge.id.localeCompare(rightEdge.id)
  );
}

function getOppositeNodePosition(
  edge: ArchitectureEdge,
  type: ArchitectureNodeWirePort["type"],
  nodesById: Map<string, ArchitectureNode>
): { x: number; y: number } {
  const oppositeNode = nodesById.get(
    type === "source" ? edge.target : edge.source
  );

  return oppositeNode?.position ?? { x: 0, y: 0 };
}

function getWirePortOffsets(count: number): number[] {
  if (count <= 1) {
    return [50];
  }

  const topOffset = count === 2 ? 35 : 24;
  const bottomOffset = count === 2 ? 65 : 76;
  const step = (bottomOffset - topOffset) / (count - 1);

  return Array.from(
    { length: count },
    (_unused, index) => topOffset + step * index
  );
}

function getWireObstacles(nodes: ArchitectureNode[]): WireObstacle[] {
  return nodes
    .filter((node) => !node.hidden)
    .map((node) => {
      const width = node.measured?.width ?? node.width ?? nodeFallbackWidth;
      const height = node.measured?.height ?? node.height ?? nodeFallbackHeight;

      return {
        left: node.position.x - wireObstaclePadding,
        right: node.position.x + width + wireObstaclePadding,
        top: node.position.y - wireObstaclePadding,
        bottom: node.position.y + height + wireObstaclePadding
      };
    });
}

function routeWireAroundBlocks({
  source,
  target,
  sourcePosition,
  targetPosition,
  offset,
  obstacles
}: {
  source: Point;
  target: Point;
  sourcePosition: Position;
  targetPosition: Position;
  offset: number;
  obstacles: WireObstacle[];
}): Point[] {
  const sourceExit = movePoint(source, sourcePosition, offset);
  const targetExit = movePoint(target, targetPosition, offset);
  const route = findOrthogonalRoute(sourceExit, targetExit, obstacles);

  return simplifyRoute([source, ...route, target]);
}

function findOrthogonalRoute(
  start: Point,
  end: Point,
  obstacles: WireObstacle[]
): Point[] {
  const roundedStart = roundPoint(start);
  const roundedEnd = roundPoint(end);
  const xCoordinates = getRoutingCoordinates(
    roundedStart.x,
    roundedEnd.x,
    obstacles,
    "x"
  );
  const yCoordinates = getRoutingCoordinates(
    roundedStart.y,
    roundedEnd.y,
    obstacles,
    "y"
  );
  const points: Point[] = [];
  const pointIndexes = new Map<string, number>();

  for (const y of yCoordinates) {
    for (const x of xCoordinates) {
      const point = { x, y };

      if (
        isSamePoint(point, roundedStart) ||
        isSamePoint(point, roundedEnd) ||
        !isPointInsideObstacle(point, obstacles)
      ) {
        pointIndexes.set(pointKey(point), points.length);
        points.push(point);
      }
    }
  }

  const startIndex = pointIndexes.get(pointKey(roundedStart));
  const endIndex = pointIndexes.get(pointKey(roundedEnd));

  if (startIndex === undefined || endIndex === undefined) {
    return [start, end];
  }

  const adjacency = getRoutingAdjacency(points, obstacles);
  const route = shortestRoute(points, adjacency, startIndex, endIndex);

  return route ?? [start, end];
}

function getRoutingCoordinates(
  start: number,
  end: number,
  obstacles: WireObstacle[],
  axis: "x" | "y"
): number[] {
  const values = [start, end];
  const lowKey = axis === "x" ? "left" : "top";
  const highKey = axis === "x" ? "right" : "bottom";

  for (const obstacle of obstacles) {
    values.push(obstacle[lowKey], obstacle[highKey]);
  }

  const minimum = Math.min(...values) - wireRoutingMargin;
  const maximum = Math.max(...values) + wireRoutingMargin;

  values.push(minimum, maximum);

  return uniqueSortedCoordinates(values);
}

function getRoutingAdjacency(
  points: Point[],
  obstacles: WireObstacle[]
): Map<number, Array<{ to: number; direction: Exclude<RouteDirection, "none"> }>> {
  const adjacency = new Map<
    number,
    Array<{ to: number; direction: Exclude<RouteDirection, "none"> }>
  >();
  const rows = new Map<number, number[]>();
  const columns = new Map<number, number[]>();

  points.forEach((point, index) => {
    const row = rows.get(point.y) ?? [];
    const column = columns.get(point.x) ?? [];

    row.push(index);
    column.push(index);
    rows.set(point.y, row);
    columns.set(point.x, column);
  });

  for (const row of rows.values()) {
    const sortedRow = row.sort((left, right) => points[left].x - points[right].x);

    for (let index = 1; index < sortedRow.length; index += 1) {
      addRoutingConnection(
        adjacency,
        points,
        sortedRow[index - 1],
        sortedRow[index],
        "horizontal",
        obstacles
      );
    }
  }

  for (const column of columns.values()) {
    const sortedColumn = column.sort(
      (left, right) => points[left].y - points[right].y
    );

    for (let index = 1; index < sortedColumn.length; index += 1) {
      addRoutingConnection(
        adjacency,
        points,
        sortedColumn[index - 1],
        sortedColumn[index],
        "vertical",
        obstacles
      );
    }
  }

  return adjacency;
}

function addRoutingConnection(
  adjacency: Map<
    number,
    Array<{ to: number; direction: Exclude<RouteDirection, "none"> }>
  >,
  points: Point[],
  leftIndex: number,
  rightIndex: number,
  direction: Exclude<RouteDirection, "none">,
  obstacles: WireObstacle[]
): void {
  if (!isSegmentClear(points[leftIndex], points[rightIndex], obstacles)) {
    return;
  }

  const leftConnections = adjacency.get(leftIndex) ?? [];
  const rightConnections = adjacency.get(rightIndex) ?? [];

  leftConnections.push({ to: rightIndex, direction });
  rightConnections.push({ to: leftIndex, direction });
  adjacency.set(leftIndex, leftConnections);
  adjacency.set(rightIndex, rightConnections);
}

function shortestRoute(
  points: Point[],
  adjacency: Map<
    number,
    Array<{ to: number; direction: Exclude<RouteDirection, "none"> }>
  >,
  startIndex: number,
  endIndex: number
): Point[] | null {
  const startState = routeStateKey(startIndex, "none");
  const distances = new Map([[startState, 0]]);
  const previous = new Map<string, string>();
  const queue: Array<{
    key: string;
    index: number;
    direction: RouteDirection;
  }> = [{ key: startState, index: startIndex, direction: "none" }];
  let endState: string | null = null;

  while (queue.length > 0) {
    const currentQueueIndex = getLowestCostQueueIndex(queue, distances);
    const current = queue.splice(currentQueueIndex, 1)[0];
    const currentDistance = distances.get(current.key) ?? Infinity;

    if (current.index === endIndex) {
      endState = current.key;
      break;
    }

    for (const connection of adjacency.get(current.index) ?? []) {
      const nextDistance =
        currentDistance +
        getPointDistance(points[current.index], points[connection.to]) +
        getTurnCost(current.direction, connection.direction);
      const nextState = routeStateKey(connection.to, connection.direction);

      if (nextDistance < (distances.get(nextState) ?? Infinity)) {
        distances.set(nextState, nextDistance);
        previous.set(nextState, current.key);
        queue.push({
          key: nextState,
          index: connection.to,
          direction: connection.direction
        });
      }
    }
  }

  if (!endState) {
    return null;
  }

  const indexes: number[] = [];
  let currentState: string | undefined = endState;

  while (currentState) {
    indexes.push(getRouteStateIndex(currentState));
    currentState = previous.get(currentState);
  }

  return simplifyRoute(indexes.reverse().map((index) => points[index]));
}

function getLowestCostQueueIndex(
  queue: Array<{ key: string }>,
  distances: Map<string, number>
): number {
  let bestIndex = 0;
  let bestDistance = Infinity;

  queue.forEach((entry, index) => {
    const distance = distances.get(entry.key) ?? Infinity;

    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });

  return bestIndex;
}

function getWirePath(points: Point[]): string {
  const route = simplifyRoute(points);

  if (route.length === 0) {
    return "";
  }

  let path = `M ${route[0].x} ${route[0].y}`;

  for (let index = 1; index < route.length - 1; index += 1) {
    path += getRoundedBend(route[index - 1], route[index], route[index + 1]);
  }

  const lastPoint = route[route.length - 1];

  return `${path} L ${lastPoint.x} ${lastPoint.y}`;
}

function getRoundedBend(previous: Point, bend: Point, next: Point): string {
  const incomingDistance = getPointDistance(previous, bend);
  const outgoingDistance = getPointDistance(bend, next);
  const radius = Math.min(wireBendRadius, incomingDistance / 2, outgoingDistance / 2);

  if (radius <= 0 || isStraightSegment(previous, bend, next)) {
    return ` L ${bend.x} ${bend.y}`;
  }

  const incomingDirection = getUnitDirection(previous, bend);
  const outgoingDirection = getUnitDirection(bend, next);
  const beforeBend = {
    x: bend.x - incomingDirection.x * radius,
    y: bend.y - incomingDirection.y * radius
  };
  const afterBend = {
    x: bend.x + outgoingDirection.x * radius,
    y: bend.y + outgoingDirection.y * radius
  };

  return ` L ${beforeBend.x} ${beforeBend.y} Q ${bend.x} ${bend.y} ${afterBend.x} ${afterBend.y}`;
}

function getWireLabelPosition(points: Point[]): Point {
  const route = simplifyRoute(points);
  const totalDistance = getRouteDistance(route);

  if (route.length === 0 || totalDistance === 0) {
    return { x: 0, y: 0 };
  }

  let traversedDistance = 0;

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const next = route[index];
    const segmentDistance = getPointDistance(previous, next);

    if (traversedDistance + segmentDistance >= totalDistance / 2) {
      const progress = (totalDistance / 2 - traversedDistance) / segmentDistance;

      return {
        x: previous.x + (next.x - previous.x) * progress,
        y: previous.y + (next.y - previous.y) * progress
      };
    }

    traversedDistance += segmentDistance;
  }

  return route[route.length - 1];
}

function movePoint(point: Point, position: Position, distance: number): Point {
  const direction = getPositionDirection(position);

  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance
  };
}

function isPointInsideObstacle(point: Point, obstacles: WireObstacle[]): boolean {
  return obstacles.some(
    (obstacle) =>
      point.x > obstacle.left &&
      point.x < obstacle.right &&
      point.y > obstacle.top &&
      point.y < obstacle.bottom
  );
}

function isSegmentClear(
  start: Point,
  end: Point,
  obstacles: WireObstacle[]
): boolean {
  if (start.x === end.x) {
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);

    return !obstacles.some(
      (obstacle) =>
        start.x > obstacle.left &&
        start.x < obstacle.right &&
        bottom > obstacle.top &&
        top < obstacle.bottom
    );
  }

  if (start.y === end.y) {
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);

    return !obstacles.some(
      (obstacle) =>
        start.y > obstacle.top &&
        start.y < obstacle.bottom &&
        right > obstacle.left &&
        left < obstacle.right
    );
  }

  return false;
}

function simplifyRoute(points: Point[]): Point[] {
  const route = points.map(roundPoint).filter((point, index, allPoints) => {
    const previous = allPoints[index - 1];

    return !previous || !isSamePoint(previous, point);
  });

  return route.filter((point, index, allPoints) => {
    const previous = allPoints[index - 1];
    const next = allPoints[index + 1];

    return !previous || !next || !isStraightSegment(previous, point, next);
  });
}

function getRouteDistance(points: Point[]): number {
  return points.reduce(
    (distance, point, index) =>
      index === 0 ? 0 : distance + getPointDistance(points[index - 1], point),
    0
  );
}

function getPointDistance(start: Point, end: Point): number {
  return Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
}

function getTurnCost(
  currentDirection: RouteDirection,
  nextDirection: RouteDirection
): number {
  return currentDirection !== "none" && currentDirection !== nextDirection
    ? wireBendPenalty
    : 0;
}

function getUnitDirection(start: Point, end: Point): Point {
  return {
    x: Math.sign(end.x - start.x),
    y: Math.sign(end.y - start.y)
  };
}

function isStraightSegment(previous: Point, current: Point, next: Point): boolean {
  return (
    (previous.x === current.x && current.x === next.x) ||
    (previous.y === current.y && current.y === next.y)
  );
}

function roundPoint(point: Point): Point {
  return {
    x: roundCoordinate(point.x),
    y: roundCoordinate(point.y)
  };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function uniqueSortedCoordinates(values: number[]): number[] {
  return [...new Set(values.map(roundCoordinate))].sort((left, right) => left - right);
}

function pointKey(point: Point): string {
  return `${point.x}:${point.y}`;
}

function isSamePoint(left: Point, right: Point): boolean {
  return left.x === right.x && left.y === right.y;
}

function routeStateKey(index: number, direction: RouteDirection): string {
  return `${index}:${direction}`;
}

function getRouteStateIndex(key: string): number {
  return Number(key.split(":")[0]);
}

function getWireOffset(pathOptions: EdgeProps<ArchitectureEdge>["pathOptions"]) {
  return Math.max(
    typeof pathOptions?.offset === "number" ? pathOptions.offset : wireExitOffset,
    wireExitOffset
  );
}

function getPositionDirection(position: Position): { x: number; y: number } {
  switch (position) {
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Right:
      return { x: 1, y: 0 };
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Bottom:
      return { x: 0, y: 1 };
  }
}
