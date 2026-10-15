import { parse } from "npm:acorn@8.17.0";
import { httpError } from "./backend.ts";

// Parse the generated literal; never execute uploaded JavaScript on the server.
export function validateGeneratedSource(source: string, verifier: Record<string, any>) {
  const fail = () => { throw httpError(400, "Generated source does not match its verifier. Regenerate the export before publishing."); };
  const object = (node: any): Map<string, any> => {
    if (node?.type !== "ObjectExpression") return fail();
    const result = new Map<string, any>();
    for (const property of node.properties) {
      if (property.type !== "Property" || property.computed || property.method || property.kind !== "init" || property.shorthand) return fail();
      const key = property.key.type === "Identifier" ? property.key.name : property.key.value;
      if (typeof key !== "string" || result.has(key)) return fail();
      result.set(key, property.value);
    }
    return result;
  };
  const literal = (node: any): any => {
    if (node?.type !== "Literal" || node.regex || node.bigint !== undefined) return fail();
    return node.value;
  };
  const staticValue = (node: any): void => {
    if (node?.type === "ObjectExpression") for (const value of object(node).values()) staticValue(value);
    else if (node?.type === "ArrayExpression") for (const value of node.elements) staticValue(value);
    else literal(node);
  };
  let ast: any;
  try { ast = parse(source, { ecmaVersion: 2022, sourceType: "script" }); }
  catch { return fail(); }
  const statement = ast.body.length === 1 && ast.body[0];
  const assignment = statement?.type === "ExpressionStatement" && statement.expression;
  const target = assignment?.left;
  if (assignment?.type !== "AssignmentExpression" || assignment.operator !== "=" || target?.type !== "MemberExpression" || target.computed || target.object?.name !== "window" || target.property?.name !== "FPL_DAILY_CHALLENGE") return fail();
  const challenge = object(assignment.right);
  if (literal(challenge.get("id")) !== verifier.challengeId || literal(challenge.get("releaseDate")) !== verifier.releaseDate || literal(challenge.get("perfectScore")) !== verifier.perfectScore) return fail();
  const prompts = challenge.get("prompts");
  if (prompts?.type !== "ArrayExpression" || prompts.elements.length !== verifier.prompts.length) return fail();
  const expected = new Map(verifier.prompts.map((prompt: any) => [prompt.promptId, prompt]));
  for (const entry of prompts.elements) {
    const properties = object(entry);
    const id = literal(properties.get("id"));
    const prompt: any = expected.get(id);
    if (!prompt || literal(properties.get("position")) !== prompt.position) return fail();
    expected.delete(id);
    const test = properties.get("test");
    if (!["ArrowFunctionExpression", "FunctionExpression"].includes(test?.type) || test.async || test.generator) return fail();
    for (const [key, value] of properties) if (key !== "test") staticValue(value);
  }
  if (expected.size) return fail();
  for (const [key, value] of challenge) if (key !== "prompts") staticValue(value);
}
