/**
 * Skills Module - Injectable domain knowledge
 */

export {
  SkillRegistry,
  globalSkills,
  type Skill,
  type SkillCategory,
  type SkillContext,
  type SkillMatch,
  type SkillExample,
} from "./registry";

export {
  builtinSkills,
  codeStandardsSkill,
  testingSkill,
  securitySkill,
  performanceSkill,
  architectureSkill,
  documentationSkill,
  debuggingSkill,
  gitWorkflowSkill,
  apiDesignSkill,
} from "./builtins";

// Initialize global skills with builtins
import { globalSkills } from "./registry";
import { builtinSkills } from "./builtins";

globalSkills.registerAll(builtinSkills);
