import Table from "cli-table3";
import { defaultSkillSearchRoots, inventorySkills } from "../lib/skills.js";

export function inventorySkillsCommand(
  roots: string[],
  opts: { json?: boolean },
): void {
  const searchRoots = roots.length > 0 ? roots : defaultSkillSearchRoots();
  if (searchRoots.length === 0) {
    throw new Error("No skill roots found. Pass paths or set MCP_BUILDER_SKILL_ROOTS.");
  }
  const inventory = inventorySkills(searchRoots);
  if (opts.json) {
    console.log(JSON.stringify({ roots: searchRoots, skills: inventory }, null, 2));
    return;
  }
  const table = new Table({
    head: ["Skill", "Compliance", "Digest", "Source"],
    colWidths: [34, 22, 24, 64],
    wordWrap: true,
  });
  for (const skill of inventory) {
    table.push([
      skill.name,
      skill.compliance,
      skill.digest.slice(0, 22),
      skill.source
        ? `${skill.source.repository}@${skill.source.revision.slice(0, 12)}:${skill.source.relativePath}`
        : "unknown",
    ]);
  }
  console.log(table.toString());
  console.log(`\n${inventory.length} discovered; 0 treated as approved without cryptographic receipts`);
}
