import { MarkerType } from "@xyflow/react";
import type { ArchitectureEdge, ArchitectureNode } from "./types";

export const sampleNodes: ArchitectureNode[] = [
  {
    id: "fetch",
    type: "architectureNode",
    position: { x: 40, y: 180 },
    data: {
      label: "Fetch",
      role: "Selects the next PC and reads the instruction memory interface.",
      kind: "module",
      materialization: "real",
      source: "riscv_core.sv:70-118",
      reads: ["pc_next", "branch_taken", "branch_target"],
      writes: ["pc", "instruction"]
    }
  },
  {
    id: "decode",
    type: "architectureNode",
    position: { x: 290, y: 80 },
    data: {
      label: "Decode / Control",
      role: "Decodes instruction fields and emits datapath control signals.",
      kind: "module",
      materialization: "real",
      source: "riscv_core.sv:120-210",
      reads: ["instruction"],
      writes: ["opcode", "funct3", "alu_op", "reg_write"]
    }
  },
  {
    id: "register-file",
    type: "architectureNode",
    position: { x: 290, y: 300 },
    data: {
      label: "Register File",
      role: "Reads source operands and writes completed results.",
      kind: "module",
      materialization: "real",
      source: "register_file.sv:1-88",
      reads: ["rs1", "rs2", "rd", "writeback_data"],
      writes: ["rs1_value", "rs2_value"]
    }
  },
  {
    id: "execute",
    type: "architectureNode",
    position: { x: 565, y: 190 },
    data: {
      label: "Execute / ALU",
      role: "Runs arithmetic, logical, and address-generation operations.",
      kind: "module",
      materialization: "real",
      source: "riscv_core.sv:212-285",
      reads: ["alu_op", "rs1_value", "rs2_value", "imm"],
      writes: ["alu_result"]
    }
  },
  {
    id: "branch-decision",
    type: "architectureNode",
    position: { x: 565, y: 405 },
    data: {
      label: "Branch Decision",
      role: "Compares operands and determines whether the PC should branch.",
      kind: "semantic_block",
      materialization: "virtual",
      source: "riscv_core.sv:286-335",
      reads: ["opcode", "funct3", "rs1_value", "rs2_value", "branch_imm"],
      writes: ["branch_taken", "branch_target"]
    }
  },
  {
    id: "memory",
    type: "architectureNode",
    position: { x: 850, y: 190 },
    data: {
      label: "Memory",
      role: "Handles load/store address and data memory interaction.",
      kind: "module",
      materialization: "real",
      source: "riscv_core.sv:337-390",
      reads: ["alu_result", "rs2_value", "mem_write"],
      writes: ["load_data"]
    }
  },
  {
    id: "writeback",
    type: "architectureNode",
    position: { x: 1125, y: 190 },
    data: {
      label: "Writeback",
      role: "Chooses the value written back to the destination register.",
      kind: "module",
      materialization: "real",
      source: "riscv_core.sv:392-430",
      reads: ["alu_result", "load_data"],
      writes: ["writeback_data"]
    }
  }
];

export const sampleEdges: ArchitectureEdge[] = [
  makeEdge("fetch-to-decode", "fetch", "decode", "instruction", "dataflow"),
  makeEdge("decode-to-execute", "decode", "execute", "control", "control"),
  makeEdge("decode-to-branch", "decode", "branch-decision", "branch ctrl", "control"),
  makeEdge("regfile-to-execute", "register-file", "execute", "operands", "dataflow"),
  makeEdge("regfile-to-branch", "register-file", "branch-decision", "compare operands", "dataflow"),
  makeEdge("execute-to-memory", "execute", "memory", "alu_result", "dataflow"),
  makeEdge("execute-to-writeback", "execute", "writeback", "alu_result", "dataflow"),
  makeEdge("memory-to-writeback", "memory", "writeback", "load_data", "dataflow"),
  makeEdge("writeback-to-regfile", "writeback", "register-file", "writeback_data", "dataflow"),
  makeEdge("branch-to-fetch", "branch-decision", "fetch", "next pc", "control")
];

function makeEdge(
  id: string,
  source: string,
  target: string,
  label: string,
  kind: "dataflow" | "control"
): ArchitectureEdge {
  return {
    id,
    source,
    target,
    type: "architectureWire",
    label,
    data: {
      label,
      kind,
      signals: [label]
    },
    markerEnd: {
      type: MarkerType.ArrowClosed
    },
    className: kind === "control" ? "edge-control" : "edge-dataflow"
  };
}
