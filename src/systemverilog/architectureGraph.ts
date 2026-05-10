import type {
  ArchitectureEdge,
  ArchitectureGraph,
  ArchitectureNode
} from "../architecture/diagramTypes";
import {
  isControlSignal,
  type ParsedSystemVerilogFile,
  type PortDirection,
  type SourceSpan,
  type SystemVerilogBlock,
  type SystemVerilogConnection,
  type SystemVerilogInstance,
  type SystemVerilogModule
} from "./parser";

type NetParticipantRole = "producer" | "consumer" | "bidirectional";

type NetParticipant = {
  nodeId: string;
  role: NetParticipantRole;
};

type MutableNodeFacts = {
  reads: Set<string>;
  writes: Set<string>;
};

const nodeWidth = 245;
const columnGap = 85;
const rowGap = 76;
const leftMargin = 48;
const topMargin = 76;

export function buildArchitectureGraph(
  parsed: ParsedSystemVerilogFile
): ArchitectureGraph {
  const diagnostics = [...parsed.diagnostics];

  if (parsed.modules.length === 0) {
    diagnostics.push(`${parsed.fileName}: no SystemVerilog module declarations found.`);

    return {
      sourceName: basename(parsed.fileName),
      sourcePath: parsed.fileName,
      diagnostics,
      nodes: [],
      edges: []
    };
  }

  const modulesByName = new Map(parsed.modules.map((module) => [module.name, module]));
  const topModule = selectTopModule(parsed.modules);
  const graph =
    topModule.instances.length > 0
      ? buildInstanceGraph(parsed.fileName, topModule, modulesByName)
      : buildBehaviorGraph(parsed.fileName, topModule);

  return {
    sourceName: basename(parsed.fileName),
    sourcePath: parsed.fileName,
    topModule: topModule.name,
    diagnostics,
    nodes: layoutNodes(graph.nodes, graph.edges),
    edges: graph.edges
  };
}

function buildInstanceGraph(
  fileName: string,
  topModule: SystemVerilogModule,
  modulesByName: Map<string, SystemVerilogModule>
): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } {
  const nodes: ArchitectureNode[] = [];
  const nodeFacts = new Map<string, MutableNodeFacts>();
  const netParticipants = new Map<string, NetParticipant[]>();
  const topInputs = topModule.ports.filter(
    (port) => port.direction === "input" || port.direction === "inout"
  );
  const topOutputs = topModule.ports.filter(
    (port) => port.direction === "output" || port.direction === "inout"
  );
  const inputNodeId = topInputs.length > 0 ? "boundary-inputs" : undefined;
  const outputNodeId = topOutputs.length > 0 ? "boundary-outputs" : undefined;

  if (inputNodeId) {
    nodes.push(
      makeNode({
        id: inputNodeId,
        label: "Inputs",
        role: `Top-level inputs to ${topModule.name}.`,
        source: sourceReference(fileName, topModule.span),
        reads: [],
        writes: topInputs.map((port) => port.name),
        kind: "semantic_block"
      })
    );
    nodeFacts.set(inputNodeId, makeFacts([], topInputs.map((port) => port.name)));
  }

  if (outputNodeId) {
    nodes.push(
      makeNode({
        id: outputNodeId,
        label: "Outputs",
        role: `Top-level outputs from ${topModule.name}.`,
        source: sourceReference(fileName, topModule.span),
        reads: topOutputs.map((port) => port.name),
        writes: [],
        kind: "semantic_block"
      })
    );
    nodeFacts.set(outputNodeId, makeFacts(topOutputs.map((port) => port.name), []));
  }

  for (const port of topInputs) {
    addNetParticipant(netParticipants, port.name, {
      nodeId: inputNodeId ?? topModule.name,
      role: port.direction === "inout" ? "bidirectional" : "producer"
    });
  }

  for (const port of topOutputs) {
    addNetParticipant(netParticipants, port.name, {
      nodeId: outputNodeId ?? topModule.name,
      role: port.direction === "inout" ? "bidirectional" : "consumer"
    });
  }

  const usedNodeIds = new Set(nodes.map((node) => node.id));

  for (const instance of topModule.instances) {
    const nodeId = uniqueId(sanitizeId(instance.instanceName), usedNodeIds);
    const instanceModule = modulesByName.get(instance.moduleName);
    const reads = new Set<string>();
    const writes = new Set<string>();

    for (const [connectionIndex, connection] of instance.connections.entries()) {
      const direction = getConnectionDirection(instanceModule, connection, connectionIndex);
      const role = directionToParticipantRole(direction, connection.portName);

      for (const net of connection.identifiers) {
        if (role === "producer") {
          writes.add(net);
        } else if (role === "consumer") {
          reads.add(net);
        } else {
          reads.add(net);
          writes.add(net);
        }

        addNetParticipant(netParticipants, net, {
          nodeId,
          role
        });
      }
    }

    nodes.push(
      makeNode({
        id: nodeId,
        label: `${instance.instanceName} : ${instance.moduleName}`,
        role: instanceModule
          ? `${instance.moduleName} instance with ${instance.connections.length} connected ports.`
          : `${instance.moduleName} instance. Port directions are inferred from connection names where possible.`,
        source: sourceReference(fileName, instance.span),
        reads: [...reads],
        writes: [...writes],
        kind: "module"
      })
    );
    nodeFacts.set(nodeId, makeFacts([...reads], [...writes]));
  }

  const edges = buildEdgesFromNetParticipants(netParticipants);
  applyNodeFacts(nodes, nodeFacts);

  return {
    nodes,
    edges
  };
}

function buildBehaviorGraph(
  fileName: string,
  topModule: SystemVerilogModule
): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } {
  if (topModule.blocks.length === 0) {
    return {
      nodes: [
        makeNode({
          id: sanitizeId(topModule.name),
          label: topModule.name,
          role: `SystemVerilog module with ${topModule.ports.length} ports and ${topModule.signals.length} internal signals.`,
          source: sourceReference(fileName, topModule.span),
          reads: topModule.ports
            .filter((port) => port.direction === "input")
            .map((port) => port.name),
          writes: topModule.ports
            .filter((port) => port.direction === "output")
            .map((port) => port.name),
          kind: "module"
        })
      ],
      edges: []
    };
  }

  const nodes: ArchitectureNode[] = [];
  const nodeFacts = new Map<string, MutableNodeFacts>();
  const netParticipants = new Map<string, NetParticipant[]>();
  const topInputs = topModule.ports.filter(
    (port) => port.direction === "input" || port.direction === "inout"
  );
  const topOutputs = topModule.ports.filter(
    (port) => port.direction === "output" || port.direction === "inout"
  );
  const inputNodeId = topInputs.length > 0 ? "boundary-inputs" : undefined;
  const outputNodeId = topOutputs.length > 0 ? "boundary-outputs" : undefined;

  if (inputNodeId) {
    nodes.push(
      makeNode({
        id: inputNodeId,
        label: "Inputs",
        role: `Top-level inputs to ${topModule.name}.`,
        source: sourceReference(fileName, topModule.span),
        reads: [],
        writes: topInputs.map((port) => port.name),
        kind: "semantic_block"
      })
    );
    nodeFacts.set(inputNodeId, makeFacts([], topInputs.map((port) => port.name)));
  }

  if (outputNodeId) {
    nodes.push(
      makeNode({
        id: outputNodeId,
        label: "Outputs",
        role: `Top-level outputs from ${topModule.name}.`,
        source: sourceReference(fileName, topModule.span),
        reads: topOutputs.map((port) => port.name),
        writes: [],
        kind: "semantic_block"
      })
    );
    nodeFacts.set(outputNodeId, makeFacts(topOutputs.map((port) => port.name), []));
  }

  for (const port of topInputs) {
    addNetParticipant(netParticipants, port.name, {
      nodeId: inputNodeId ?? sanitizeId(topModule.name),
      role: port.direction === "inout" ? "bidirectional" : "producer"
    });
  }

  for (const port of topOutputs) {
    addNetParticipant(netParticipants, port.name, {
      nodeId: outputNodeId ?? sanitizeId(topModule.name),
      role: port.direction === "inout" ? "bidirectional" : "consumer"
    });
  }

  const usedNodeIds = new Set(nodes.map((node) => node.id));

  for (const block of topModule.blocks) {
    const nodeId = uniqueId(sanitizeId(block.id), usedNodeIds);

    nodes.push(
      makeNode({
        id: nodeId,
        label: block.label,
        role: describeBlock(block),
        source: sourceReference(fileName, block.span),
        reads: block.reads,
        writes: block.writes,
        kind: "semantic_block"
      })
    );
    nodeFacts.set(nodeId, makeFacts(block.reads, block.writes));

    for (const read of block.reads) {
      addNetParticipant(netParticipants, read, {
        nodeId,
        role: "consumer"
      });
    }

    for (const write of block.writes) {
      addNetParticipant(netParticipants, write, {
        nodeId,
        role: "producer"
      });
    }
  }

  const edges = buildEdgesFromNetParticipants(netParticipants);
  applyNodeFacts(nodes, nodeFacts);

  return {
    nodes,
    edges
  };
}

function selectTopModule(modules: SystemVerilogModule[]): SystemVerilogModule {
  const instantiatedModuleNames = new Set(
    modules.flatMap((module) =>
      module.instances.map((instance) => instance.moduleName)
    )
  );
  const topCandidates = modules.filter(
    (module) => !instantiatedModuleNames.has(module.name)
  );
  const candidates = topCandidates.length > 0 ? topCandidates : modules;

  return (
    candidates.find((module) => module.instances.length > 0) ??
    candidates[0]
  );
}

function getConnectionDirection(
  moduleDefinition: SystemVerilogModule | undefined,
  connection: SystemVerilogConnection,
  connectionIndex: number
): PortDirection {
  if (!moduleDefinition) {
    return "unknown";
  }

  if (connection.portName) {
    return (
      moduleDefinition.ports.find((port) => port.name === connection.portName)
        ?.direction ?? "unknown"
    );
  }

  return moduleDefinition.ports[connectionIndex]?.direction ?? "unknown";
}

function directionToParticipantRole(
  direction: PortDirection,
  portName: string | undefined
): NetParticipantRole {
  if (direction === "input") {
    return "consumer";
  }

  if (direction === "output") {
    return "producer";
  }

  if (direction === "inout") {
    return "bidirectional";
  }

  return inferUnknownPortRole(portName);
}

function inferUnknownPortRole(portName: string | undefined): NetParticipantRole {
  if (!portName) {
    return "bidirectional";
  }

  if (/(?:^o_|_o$|out|dout|result|response|resp|q$|y$)/i.test(portName)) {
    return "producer";
  }

  if (/(?:^i_|_i$|in|din|clk|clock|rst|reset|enable|valid|ready|req)/i.test(portName)) {
    return "consumer";
  }

  return "bidirectional";
}

function buildEdgesFromNetParticipants(
  participantsByNet: Map<string, NetParticipant[]>
): ArchitectureEdge[] {
  const edgeBuckets = new Map<
    string,
    {
      source: string;
      target: string;
      kind: "dataflow" | "control";
      signals: Set<string>;
    }
  >();

  for (const [net, participants] of participantsByNet) {
    const producers = participants.filter(
      (participant) =>
        participant.role === "producer" || participant.role === "bidirectional"
    );
    const consumers = participants.filter(
      (participant) =>
        participant.role === "consumer" || participant.role === "bidirectional"
    );
    const kind = isControlSignal(net) ? "control" : "dataflow";

    for (const producer of producers) {
      for (const consumer of consumers) {
        if (producer.nodeId === consumer.nodeId) {
          continue;
        }

        const key = `${producer.nodeId}->${consumer.nodeId}:${kind}`;
        const bucket =
          edgeBuckets.get(key) ??
          {
            source: producer.nodeId,
            target: consumer.nodeId,
            kind,
            signals: new Set<string>()
          };

        bucket.signals.add(net);
        edgeBuckets.set(key, bucket);
      }
    }
  }

  return [...edgeBuckets.values()]
    .sort(
      (left, right) =>
        left.source.localeCompare(right.source) ||
        left.target.localeCompare(right.target) ||
        left.kind.localeCompare(right.kind)
    )
    .map((bucket, index) => {
      const signals = [...bucket.signals].sort((left, right) =>
        left.localeCompare(right)
      );
      const label = makeSignalLabel(signals);

      return {
        id: `edge-${index}-${sanitizeId(bucket.source)}-${sanitizeId(bucket.target)}`,
        source: bucket.source,
        target: bucket.target,
        type: "architectureWire",
        label,
        data: {
          label,
          kind: bucket.kind,
          signals
        },
        className: bucket.kind === "control" ? "edge-control" : "edge-dataflow"
      };
    });
}

function layoutNodes(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
): ArchitectureNode[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const order = new Map(nodes.map((node, index) => [node.id, index]));
  const outgoing = new Map<string, ArchitectureEdge[]>();
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const layer = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue;
    }

    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue = nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
    .map((node) => node.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId) {
      continue;
    }

    visited.add(nodeId);

    for (const edge of outgoing.get(nodeId) ?? []) {
      layer.set(edge.target, Math.max(layer.get(edge.target) ?? 0, (layer.get(nodeId) ?? 0) + 1));
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) - 1);

      if ((indegree.get(edge.target) ?? 0) === 0) {
        queue.push(edge.target);
      }
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const fallbackLayer = node.id === "boundary-inputs" ? 0 : layer.get(node.id) ?? 1;
      layer.set(node.id, fallbackLayer);
    }
  }

  const maxLayer = Math.max(...nodes.map((node) => layer.get(node.id) ?? 0), 0);
  if (nodeIds.has("boundary-outputs")) {
    layer.set("boundary-outputs", Math.max(layer.get("boundary-outputs") ?? 0, maxLayer));
  }

  const layers = new Map<number, ArchitectureNode[]>();

  for (const node of nodes) {
    const nodeLayer = layer.get(node.id) ?? 0;
    layers.set(nodeLayer, [...(layers.get(nodeLayer) ?? []), node]);
  }

  for (const layerNodes of layers.values()) {
    layerNodes.sort(
      (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0)
    );
  }

  return nodes.map((node) => {
    const nodeLayer = layer.get(node.id) ?? 0;
    const layerNodes = layers.get(nodeLayer) ?? [node];
    const row = layerNodes.findIndex((candidate) => candidate.id === node.id);

    return {
      ...node,
      position: {
        x: leftMargin + nodeLayer * (nodeWidth + columnGap),
        y: topMargin + row * (126 + rowGap)
      }
    };
  });
}

function makeNode({
  id,
  label,
  role,
  source,
  reads,
  writes,
  kind
}: {
  id: string;
  label: string;
  role: string;
  source: string;
  reads: string[];
  writes: string[];
  kind: "module" | "semantic_block";
}): ArchitectureNode {
  return {
    id,
    type: "architectureNode",
    position: { x: 0, y: 0 },
    data: {
      label,
      role,
      kind,
      materialization: "real",
      source,
      reads: uniqueSorted(reads),
      writes: uniqueSorted(writes)
    }
  };
}

function makeFacts(reads: string[], writes: string[]): MutableNodeFacts {
  return {
    reads: new Set(reads),
    writes: new Set(writes)
  };
}

function applyNodeFacts(
  nodes: ArchitectureNode[],
  nodeFacts: Map<string, MutableNodeFacts>
): void {
  for (const node of nodes) {
    const facts = nodeFacts.get(node.id);

    if (!facts) {
      continue;
    }

    node.data.reads = uniqueSorted([...facts.reads]);
    node.data.writes = uniqueSorted([...facts.writes]);
  }
}

function addNetParticipant(
  participantsByNet: Map<string, NetParticipant[]>,
  net: string,
  participant: NetParticipant
): void {
  if (!net) {
    return;
  }

  const participants = participantsByNet.get(net) ?? [];
  participants.push(participant);
  participantsByNet.set(net, participants);
}

function describeBlock(block: SystemVerilogBlock): string {
  if (block.kind === "assign") {
    return "Continuous assignment represented as a source-backed logic block.";
  }

  return `${block.kind} procedural block represented as a source-backed logic block.`;
}

function makeSignalLabel(signals: string[]): string {
  if (signals.length <= 2) {
    return signals.join(", ");
  }

  return `${signals[0]}, +${signals.length - 1}`;
}

function sourceReference(fileName: string, span: SourceSpan): string {
  if (span.startLine === span.endLine) {
    return `${basename(fileName)}:${span.startLine}`;
  }

  return `${basename(fileName)}:${span.startLine}-${span.endLine}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sanitizeId(value: string): string {
  const sanitized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9_$]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return sanitized || "node";
}

function uniqueId(baseId: string, usedIds: Set<string>): string {
  let candidate = baseId;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function basename(fileName: string): string {
  return fileName.split(/[\\/]/).pop() ?? fileName;
}
