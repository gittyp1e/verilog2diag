export type SourceSpan = {
  file: string;
  startLine: number;
  endLine: number;
};

export type PortDirection = "input" | "output" | "inout" | "unknown";

export type SystemVerilogPort = {
  name: string;
  direction: PortDirection;
  line: number;
};

export type SystemVerilogSignal = {
  name: string;
  line: number;
};

export type SystemVerilogConnection = {
  portName?: string;
  expression: string;
  identifiers: string[];
};

export type SystemVerilogInstance = {
  moduleName: string;
  instanceName: string;
  connections: SystemVerilogConnection[];
  span: SourceSpan;
};

export type SystemVerilogBlock = {
  id: string;
  kind: "assign" | "always_comb" | "always_ff" | "always_latch" | "always";
  label: string;
  reads: string[];
  writes: string[];
  span: SourceSpan;
};

export type SystemVerilogModule = {
  name: string;
  ports: SystemVerilogPort[];
  signals: SystemVerilogSignal[];
  instances: SystemVerilogInstance[];
  blocks: SystemVerilogBlock[];
  span: SourceSpan;
};

export type ParsedSystemVerilogFile = {
  fileName: string;
  text: string;
  modules: SystemVerilogModule[];
  diagnostics: string[];
};

type LineMap = {
  lineAt(index: number): number;
};

type ModuleSlice = {
  name: string;
  start: number;
  headerEnd: number;
  end: number;
  bodyStart: number;
};

const identifierPattern = "[A-Za-z_$][A-Za-z0-9_$]*";
const identifierRegex = new RegExp(`\\b${identifierPattern}\\b`, "g");
const directionRegex = /\b(input|output|inout)\b/g;
const declarationStartRegex =
  /\b(?:wire|logic|reg|bit|byte|shortint|int|longint|integer|time|tri|supply0|supply1)\b/g;
const assignmentOperatorRegex = /(?:<=|=)/g;
const controlSignalRegex =
  /(?:^|_)(?:clk|clock|rst|reset|en|enable|valid|ready|stall|flush|hold|we|wen|write_enable|rd_en|wr_en)(?:$|_)/i;

const systemVerilogKeywords = new Set([
  "always",
  "always_comb",
  "always_ff",
  "always_latch",
  "and",
  "assign",
  "automatic",
  "begin",
  "bit",
  "break",
  "buf",
  "byte",
  "case",
  "casex",
  "casez",
  "cell",
  "class",
  "clocking",
  "config",
  "const",
  "continue",
  "deassign",
  "default",
  "defparam",
  "design",
  "disable",
  "do",
  "edge",
  "else",
  "end",
  "endcase",
  "endclass",
  "endclocking",
  "endconfig",
  "endfunction",
  "endgenerate",
  "endmodule",
  "endpackage",
  "endprimitive",
  "endprogram",
  "endproperty",
  "endspecify",
  "endsequence",
  "endtable",
  "endtask",
  "enum",
  "event",
  "for",
  "force",
  "forever",
  "fork",
  "function",
  "generate",
  "genvar",
  "highz0",
  "highz1",
  "if",
  "iff",
  "import",
  "inout",
  "input",
  "instance",
  "int",
  "integer",
  "join",
  "join_any",
  "join_none",
  "large",
  "liblist",
  "library",
  "localparam",
  "logic",
  "macromodule",
  "medium",
  "module",
  "nand",
  "negedge",
  "nor",
  "not",
  "or",
  "output",
  "package",
  "parameter",
  "posedge",
  "primitive",
  "program",
  "property",
  "pull0",
  "pull1",
  "pulldown",
  "pullup",
  "rcmos",
  "real",
  "realtime",
  "reg",
  "release",
  "repeat",
  "return",
  "rnmos",
  "rpmos",
  "rtran",
  "rtranif0",
  "rtranif1",
  "scalared",
  "sequence",
  "shortint",
  "signed",
  "small",
  "specify",
  "specparam",
  "static",
  "string",
  "strong0",
  "strong1",
  "supply0",
  "supply1",
  "table",
  "task",
  "time",
  "tran",
  "tranif0",
  "tranif1",
  "tri",
  "tri0",
  "tri1",
  "triand",
  "trior",
  "trireg",
  "unsigned",
  "use",
  "uwire",
  "var",
  "vectored",
  "wait",
  "wand",
  "weak0",
  "weak1",
  "while",
  "wire",
  "with",
  "wor",
  "xnor",
  "xor"
]);

export function parseSystemVerilogFile(
  text: string,
  fileName: string
): ParsedSystemVerilogFile {
  const maskedText = maskCommentsAndStrings(text);
  const lineMap = createLineMap(text);
  const diagnostics: string[] = [];
  const moduleSlices = findModuleSlices(maskedText, lineMap, fileName, diagnostics);

  return {
    fileName,
    text,
    diagnostics,
    modules: moduleSlices.map((slice) =>
      parseModuleSlice(text, maskedText, lineMap, fileName, slice)
    )
  };
}

export function isControlSignal(name: string): boolean {
  return controlSignalRegex.test(name);
}

export function extractIdentifiers(source: string): string[] {
  const identifiers = new Set<string>();
  let match: RegExpExecArray | null;

  identifierRegex.lastIndex = 0;
  while ((match = identifierRegex.exec(source)) !== null) {
    const identifier = match[0];
    const previousCharacter = source[match.index - 1];

    if (
      previousCharacter !== "'" &&
      !identifier.startsWith("$") &&
      !systemVerilogKeywords.has(identifier)
    ) {
      identifiers.add(identifier);
    }
  }

  return [...identifiers];
}

function parseModuleSlice(
  originalText: string,
  maskedText: string,
  lineMap: LineMap,
  fileName: string,
  slice: ModuleSlice
): SystemVerilogModule {
  const header = maskedText.slice(slice.start, slice.headerEnd + 1);
  const body = maskedText.slice(slice.bodyStart, slice.end);
  const span = {
    file: fileName,
    startLine: lineMap.lineAt(slice.start),
    endLine: lineMap.lineAt(slice.end)
  };
  const ports = parsePorts(header, body, slice.start, slice.bodyStart, lineMap);
  const signals = parseSignals(body, slice.bodyStart, lineMap, ports);
  const instances = parseInstances(body, slice.bodyStart, lineMap, fileName);
  const blocks = [
    ...parseContinuousAssignments(body, slice.bodyStart, lineMap, fileName),
    ...parseAlwaysBlocks(
      originalText.slice(slice.bodyStart, slice.end),
      maskedText.slice(slice.bodyStart, slice.end),
      slice.bodyStart,
      lineMap,
      fileName
    )
  ];

  return {
    name: slice.name,
    ports,
    signals,
    instances,
    blocks,
    span
  };
}

function findModuleSlices(
  maskedText: string,
  lineMap: LineMap,
  fileName: string,
  diagnostics: string[]
): ModuleSlice[] {
  const slices: ModuleSlice[] = [];
  const moduleRegex = new RegExp(
    `\\bmodule\\s+(?:(?:automatic|static)\\s+)?(${identifierPattern})\\b`,
    "g"
  );
  let match: RegExpExecArray | null;

  while ((match = moduleRegex.exec(maskedText)) !== null) {
    const start = match.index;
    const name = match[1];
    const headerEnd = findStatementEnd(maskedText, match.index);
    const endMatch = /\bendmodule\b/g;

    endMatch.lastIndex = headerEnd + 1;
    const endModule = endMatch.exec(maskedText);

    if (headerEnd < 0 || !endModule) {
      diagnostics.push(
        `${fileName}:${lineMap.lineAt(start)}: could not find a complete module declaration for ${name}.`
      );
      break;
    }

    slices.push({
      name,
      start,
      headerEnd,
      bodyStart: headerEnd + 1,
      end: endModule.index + endModule[0].length
    });
    moduleRegex.lastIndex = endModule.index + endModule[0].length;
  }

  return slices;
}

function parsePorts(
  header: string,
  body: string,
  headerOffset: number,
  bodyOffset: number,
  lineMap: LineMap
): SystemVerilogPort[] {
  const portsByName = new Map<string, SystemVerilogPort>();
  const headerPortList = getHeaderPortList(header);

  if (headerPortList) {
    const items = splitTopLevel(headerPortList.text, ",");
    let carriedDirection: PortDirection = "unknown";

    for (const item of items) {
      const port = parsePortDeclarator(item, carriedDirection);

      if (!port) {
        continue;
      }

      carriedDirection = port.direction;
      portsByName.set(port.name, {
        name: port.name,
        direction: port.direction,
        line: lineMap.lineAt(headerOffset + headerPortList.start + headerPortList.text.indexOf(item))
      });
    }
  }

  directionRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = directionRegex.exec(body)) !== null) {
    const direction = match[1] as PortDirection;
    const statementEnd = findStatementEnd(body, match.index);

    if (statementEnd < 0) {
      continue;
    }

    const declaration = body.slice(match.index, statementEnd + 1);
    for (const name of parseDeclaratorNames(declaration)) {
      portsByName.set(name, {
        name,
        direction,
        line: lineMap.lineAt(bodyOffset + match.index)
      });
    }

    directionRegex.lastIndex = statementEnd + 1;
  }

  return [...portsByName.values()];
}

function parseSignals(
  body: string,
  bodyOffset: number,
  lineMap: LineMap,
  ports: SystemVerilogPort[]
): SystemVerilogSignal[] {
  const portNames = new Set(ports.map((port) => port.name));
  const signals = new Map<string, SystemVerilogSignal>();
  let match: RegExpExecArray | null;

  declarationStartRegex.lastIndex = 0;
  while ((match = declarationStartRegex.exec(body)) !== null) {
    const previousWord = previousIdentifier(body, match.index);

    if (previousWord === "input" || previousWord === "output" || previousWord === "inout") {
      continue;
    }

    const statementEnd = findStatementEnd(body, match.index);

    if (statementEnd < 0) {
      continue;
    }

    const declaration = body.slice(match.index, statementEnd + 1);
    for (const name of parseDeclaratorNames(declaration)) {
      if (!portNames.has(name)) {
        signals.set(name, {
          name,
          line: lineMap.lineAt(bodyOffset + match.index)
        });
      }
    }

    declarationStartRegex.lastIndex = statementEnd + 1;
  }

  return [...signals.values()];
}

function parseInstances(
  body: string,
  bodyOffset: number,
  lineMap: LineMap,
  fileName: string
): SystemVerilogInstance[] {
  const instances: SystemVerilogInstance[] = [];
  const instanceRegex = new RegExp(
    `(?:^|[;\\r\\n])\\s*(${identifierPattern})\\s*(?:#\\s*\\((?:[^()]|\\([^()]*\\))*\\)\\s*)?(${identifierPattern})\\s*\\(([^;]*?)\\)\\s*;`,
    "gs"
  );
  let match: RegExpExecArray | null;

  while ((match = instanceRegex.exec(body)) !== null) {
    const moduleName = match[1];
    const instanceName = match[2];
    const connectionText = match[3];
    const moduleNameOffset = match[0].indexOf(moduleName);
    const start = bodyOffset + match.index + moduleNameOffset;
    const end = bodyOffset + instanceRegex.lastIndex;

    if (
      systemVerilogKeywords.has(moduleName) ||
      systemVerilogKeywords.has(instanceName)
    ) {
      continue;
    }

    instances.push({
      moduleName,
      instanceName,
      connections: parseConnections(connectionText),
      span: {
        file: fileName,
        startLine: lineMap.lineAt(start),
        endLine: lineMap.lineAt(end)
      }
    });
  }

  return instances;
}

function parseConnections(connectionText: string): SystemVerilogConnection[] {
  return splitTopLevel(connectionText, ",")
    .map((rawConnection) => rawConnection.trim())
    .filter(Boolean)
    .map((connection) => {
      const named = connection.match(new RegExp(`^\\.(${identifierPattern})\\s*\\((.*)\\)$`, "s"));
      const expression = named ? named[2].trim() : connection;

      return {
        portName: named?.[1],
        expression,
        identifiers: extractIdentifiers(expression)
      };
    });
}

function parseContinuousAssignments(
  body: string,
  bodyOffset: number,
  lineMap: LineMap,
  fileName: string
): SystemVerilogBlock[] {
  const blocks: SystemVerilogBlock[] = [];
  const assignRegex = /\bassign\b/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = assignRegex.exec(body)) !== null) {
    const statementEnd = findStatementEnd(body, match.index);

    if (statementEnd < 0) {
      continue;
    }

    const statement = body.slice(match.index, statementEnd + 1);
    const assignment = splitAssignment(statement.replace(/\bassign\b/, ""));
    const start = bodyOffset + match.index;
    const end = bodyOffset + statementEnd;
    const writes = assignment ? extractIdentifiers(assignment.left) : [];
    const reads = assignment ? extractIdentifiers(assignment.right) : [];

    blocks.push({
      id: `assign-${index}`,
      kind: "assign",
      label: writes.length > 0 ? `assign ${writes.join(", ")}` : `assign ${index + 1}`,
      reads,
      writes,
      span: {
        file: fileName,
        startLine: lineMap.lineAt(start),
        endLine: lineMap.lineAt(end)
      }
    });
    index += 1;
    assignRegex.lastIndex = statementEnd + 1;
  }

  return blocks;
}

function parseAlwaysBlocks(
  originalBody: string,
  maskedBody: string,
  bodyOffset: number,
  lineMap: LineMap,
  fileName: string
): SystemVerilogBlock[] {
  const blocks: SystemVerilogBlock[] = [];
  const alwaysRegex = /\balways(?:_(?:comb|ff|latch))?\b/g;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = alwaysRegex.exec(maskedBody)) !== null) {
    const kindText = match[0] as SystemVerilogBlock["kind"];
    const end = findProceduralBlockEnd(maskedBody, match.index);

    if (end <= match.index) {
      continue;
    }

    const maskedBlock = maskedBody.slice(match.index, end);
    const originalBlock = originalBody.slice(match.index, end);
    const writes = extractProceduralWrites(maskedBlock);
    const reads = extractProceduralReads(maskedBlock, writes);
    const startIndex = bodyOffset + match.index;
    const endIndex = bodyOffset + end;

    blocks.push({
      id: `${kindText}-${index}`,
      kind: kindText,
      label: makeAlwaysLabel(kindText, writes, originalBlock, index),
      reads,
      writes,
      span: {
        file: fileName,
        startLine: lineMap.lineAt(startIndex),
        endLine: lineMap.lineAt(endIndex)
      }
    });

    index += 1;
    alwaysRegex.lastIndex = end;
  }

  return blocks;
}

function extractProceduralWrites(block: string): string[] {
  const writes = new Set<string>();
  let match: RegExpExecArray | null;

  assignmentOperatorRegex.lastIndex = 0;
  while ((match = assignmentOperatorRegex.exec(block)) !== null) {
    const left = block.slice(Math.max(0, block.lastIndexOf(";", match.index) + 1), match.index);
    const identifiers = extractIdentifiers(left);
    const target = identifiers[identifiers.length - 1];

    if (target) {
      writes.add(target);
    }
  }

  return [...writes];
}

function extractProceduralReads(block: string, writes: string[]): string[] {
  const reads = new Set(extractIdentifiers(block));

  for (const write of writes) {
    reads.delete(write);
  }

  return [...reads];
}

function makeAlwaysLabel(
  kind: SystemVerilogBlock["kind"],
  writes: string[],
  originalBlock: string,
  index: number
): string {
  if (writes.length > 0) {
    return `${kind} ${writes.slice(0, 3).join(", ")}`;
  }

  const sensitivity = originalBlock.match(/@\s*\(([^)]*)\)/s)?.[1]?.trim();

  if (sensitivity) {
    return `${kind} @(${sensitivity.slice(0, 28)})`;
  }

  return `${kind} ${index + 1}`;
}

function getHeaderPortList(
  header: string
): { text: string; start: number; end: number } | null {
  const moduleMatch = header.match(
    new RegExp(`\\bmodule\\s+(?:(?:automatic|static)\\s+)?${identifierPattern}\\b`)
  );

  if (!moduleMatch || moduleMatch.index === undefined) {
    return null;
  }

  let index = moduleMatch.index + moduleMatch[0].length;
  index = skipWhitespace(header, index);

  if (header[index] === "#") {
    index = skipWhitespace(header, index + 1);

    if (header[index] === "(") {
      const parameterEnd = findMatchingDelimiter(header, index, "(", ")");
      index = parameterEnd > index ? skipWhitespace(header, parameterEnd + 1) : index;
    }
  }

  if (header[index] !== "(") {
    return null;
  }

  const end = findMatchingDelimiter(header, index, "(", ")");

  if (end <= index) {
    return null;
  }

  return {
    text: header.slice(index + 1, end),
    start: index + 1,
    end
  };
}

function parsePortDeclarator(
  rawItem: string,
  carriedDirection: PortDirection
): { name: string; direction: PortDirection } | null {
  const item = stripAttributes(rawItem)
    .replace(/\/\/.*$/g, "")
    .replace(/=.*$/s, "")
    .trim();

  if (!item) {
    return null;
  }

  const directionMatch = item.match(/\b(input|output|inout)\b/);
  const direction = (directionMatch?.[1] as PortDirection | undefined) ?? carriedDirection;
  const names = parseDeclaratorNames(item);
  const name = names[names.length - 1];

  return name ? { name, direction } : null;
}

function parseDeclaratorNames(declaration: string): string[] {
  const withoutAttributes = stripAttributes(declaration);
  const withoutPackedRanges = withoutAttributes.replace(/\[[^\]]*\]/g, " ");
  const withoutInitializers = withoutPackedRanges.replace(/=[^,;]*/g, " ");
  const items = splitTopLevel(withoutInitializers.replace(/;$/, ""), ",");
  const names: string[] = [];

  for (const item of items) {
    const identifiers = extractIdentifiers(item).filter(
      (identifier) => !isDeclarationModifier(identifier)
    );
    const name = identifiers[identifiers.length - 1];

    if (name && !names.includes(name)) {
      names.push(name);
    }
  }

  return names;
}

function isDeclarationModifier(identifier: string): boolean {
  return (
    systemVerilogKeywords.has(identifier) ||
    identifier === "signed" ||
    identifier === "unsigned"
  );
}

function splitAssignment(statement: string): { left: string; right: string } | null {
  const match = statement.match(/(.+?)(?:<=|=)(.+);?$/s);

  if (!match) {
    return null;
  }

  return {
    left: match[1],
    right: match[2]
  };
}

function splitTopLevel(source: string, delimiter: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === "(") {
      parenDepth += 1;
    } else if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (char === "[") {
      bracketDepth += 1;
    } else if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (char === "{") {
      braceDepth += 1;
    } else if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (
      char === delimiter &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(source.slice(start));

  return parts;
}

function findStatementEnd(source: string, start: number): number {
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (char === "(") {
      parenDepth += 1;
    } else if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (char === "[") {
      bracketDepth += 1;
    } else if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (char === "{") {
      braceDepth += 1;
    } else if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (
      char === ";" &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      return index;
    }
  }

  return -1;
}

function findProceduralBlockEnd(source: string, start: number): number {
  const beginMatch = /\bbegin\b/g;
  beginMatch.lastIndex = start;
  const firstBegin = beginMatch.exec(source);
  const statementEnd = findStatementEnd(source, start);

  if (!firstBegin || (statementEnd > start && statementEnd < firstBegin.index)) {
    return statementEnd > start ? statementEnd + 1 : start;
  }

  let depth = 0;
  const tokenRegex = /\b(?:begin|end)\b/g;
  tokenRegex.lastIndex = firstBegin.index;
  let token: RegExpExecArray | null;

  while ((token = tokenRegex.exec(source)) !== null) {
    if (token[0] === "begin") {
      depth += 1;
    } else {
      depth -= 1;

      if (depth === 0) {
        return tokenRegex.lastIndex;
      }
    }
  }

  return source.length;
}

function findMatchingDelimiter(
  source: string,
  start: number,
  open: string,
  close: string
): number {
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) {
      depth += 1;
    } else if (source[index] === close) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function stripAttributes(source: string): string {
  return source.replace(/\(\*[\s\S]*?\*\)/g, " ");
}

function previousIdentifier(source: string, index: number): string | null {
  const before = source.slice(0, index).trimEnd();
  const match = before.match(new RegExp(`(${identifierPattern})$`));

  return match?.[1] ?? null;
}

function skipWhitespace(source: string, index: number): number {
  let current = index;

  while (current < source.length && /\s/.test(source[current])) {
    current += 1;
  }

  return current;
}

function maskCommentsAndStrings(source: string): string {
  let result = "";
  let index = 0;
  let state: "code" | "lineComment" | "blockComment" | "string" = "code";

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "code") {
      if (char === "/" && next === "/") {
        result += "  ";
        index += 2;
        state = "lineComment";
      } else if (char === "/" && next === "*") {
        result += "  ";
        index += 2;
        state = "blockComment";
      } else if (char === "\"") {
        result += " ";
        index += 1;
        state = "string";
      } else {
        result += char;
        index += 1;
      }
    } else if (state === "lineComment") {
      if (char === "\n") {
        result += "\n";
        state = "code";
      } else {
        result += " ";
      }
      index += 1;
    } else if (state === "blockComment") {
      if (char === "*" && next === "/") {
        result += "  ";
        index += 2;
        state = "code";
      } else {
        result += char === "\n" ? "\n" : " ";
        index += 1;
      }
    } else {
      if (char === "\\" && next) {
        result += "  ";
        index += 2;
      } else if (char === "\"") {
        result += " ";
        index += 1;
        state = "code";
      } else {
        result += char === "\n" ? "\n" : " ";
        index += 1;
      }
    }
  }

  return result;
}

function createLineMap(source: string): LineMap {
  const lineStarts = [0];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      lineStarts.push(index + 1);
    }
  }

  return {
    lineAt(index: number): number {
      let low = 0;
      let high = lineStarts.length - 1;

      while (low <= high) {
        const middle = Math.floor((low + high) / 2);

        if (lineStarts[middle] <= index) {
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      return high + 1;
    }
  };
}
