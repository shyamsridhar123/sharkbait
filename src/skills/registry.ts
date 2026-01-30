/**
 * Skills System - Injectable domain knowledge modules
 * Skills provide context-specific knowledge to agents
 */

import { log } from "../utils/logger";

/**
 * Skill category types
 */
export type SkillCategory =
  | "code-standards"
  | "testing"
  | "security"
  | "performance"
  | "architecture"
  | "documentation"
  | "debugging"
  | "git-workflow"
  | "api-design"
  | "codebase-knowledge";

/**
 * Skill definition
 */
export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  languages?: string[];           // Language-specific (e.g., ["typescript", "javascript"])
  frameworks?: string[];          // Framework-specific (e.g., ["react", "express"])
  content: string;                // The actual knowledge/instructions
  examples?: SkillExample[];      // Usage examples
  priority?: number;              // Higher = more important (default 100)
}

/**
 * Skill example for context
 */
export interface SkillExample {
  scenario: string;
  input: string;
  output: string;
}

/**
 * Skill match result
 */
export interface SkillMatch {
  skill: Skill;
  relevance: number;  // 0-100
  reason: string;
}

/**
 * Skill Registry - Manages and matches skills
 */
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  /**
   * Register a skill
   */
  register(skill: Skill): void {
    if (this.skills.has(skill.id)) {
      log.warn(`Skill ${skill.id} already registered, overwriting`);
    }
    this.skills.set(skill.id, skill);
    log.debug(`Registered skill: ${skill.id}`);
  }

  /**
   * Register multiple skills
   */
  registerAll(skills: Skill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Get a skill by ID
   */
  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  /**
   * Get all skills in a category
   */
  getByCategory(category: SkillCategory): Skill[] {
    return Array.from(this.skills.values()).filter(s => s.category === category);
  }

  /**
   * Get skills for a specific language
   */
  getByLanguage(language: string): Skill[] {
    return Array.from(this.skills.values()).filter(s => 
      !s.languages || s.languages.includes(language.toLowerCase())
    );
  }

  /**
   * Get skills for a specific framework
   */
  getByFramework(framework: string): Skill[] {
    return Array.from(this.skills.values()).filter(s =>
      s.frameworks?.includes(framework.toLowerCase())
    );
  }

  /**
   * Find relevant skills based on context
   */
  findRelevant(context: SkillContext): SkillMatch[] {
    const matches: SkillMatch[] = [];

    for (const skill of this.skills.values()) {
      const relevance = this.calculateRelevance(skill, context);
      if (relevance > 0) {
        matches.push({
          skill,
          relevance,
          reason: this.getRelevanceReason(skill, context),
        });
      }
    }

    // Sort by relevance (descending) then priority
    return matches.sort((a, b) => {
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      return (b.skill.priority || 100) - (a.skill.priority || 100);
    });
  }

  /**
   * Calculate relevance score for a skill
   */
  private calculateRelevance(skill: Skill, context: SkillContext): number {
    let score = 0;

    // Category match
    if (context.categories?.includes(skill.category)) {
      score += 50;
    }

    // Language match
    if (context.language && skill.languages?.includes(context.language.toLowerCase())) {
      score += 30;
    }

    // Framework match
    if (context.frameworks) {
      for (const framework of context.frameworks) {
        if (skill.frameworks?.includes(framework.toLowerCase())) {
          score += 20;
          break;
        }
      }
    }

    // Keyword match in description
    if (context.keywords) {
      const descLower = skill.description.toLowerCase();
      const contentLower = skill.content.toLowerCase();
      for (const keyword of context.keywords) {
        if (descLower.includes(keyword.toLowerCase()) || 
            contentLower.includes(keyword.toLowerCase())) {
          score += 10;
        }
      }
    }

    return Math.min(100, score);
  }

  /**
   * Get reason for relevance
   */
  private getRelevanceReason(skill: Skill, context: SkillContext): string {
    const reasons: string[] = [];

    if (context.categories?.includes(skill.category)) {
      reasons.push(`category: ${skill.category}`);
    }
    if (context.language && skill.languages?.includes(context.language.toLowerCase())) {
      reasons.push(`language: ${context.language}`);
    }
    if (context.frameworks) {
      for (const framework of context.frameworks) {
        if (skill.frameworks?.includes(framework.toLowerCase())) {
          reasons.push(`framework: ${framework}`);
        }
      }
    }

    return reasons.join(", ") || "general relevance";
  }

  /**
   * Build skill prompt for injection into agent context
   */
  buildSkillPrompt(skills: Skill[], maxTokens: number = 4000): string {
    const parts: string[] = ["## Relevant Skills & Knowledge\n"];
    let currentTokens = 50; // Approximate header tokens

    for (const skill of skills) {
      const skillText = this.formatSkillForPrompt(skill);
      const skillTokens = Math.ceil(skillText.length / 4);

      if (currentTokens + skillTokens > maxTokens) {
        parts.push("\n[Additional skills truncated for token limit]");
        break;
      }

      parts.push(skillText);
      currentTokens += skillTokens;
    }

    return parts.join("\n");
  }

  /**
   * Format a skill for prompt injection
   */
  private formatSkillForPrompt(skill: Skill): string {
    let text = `### ${skill.name}\n`;
    text += `*${skill.description}*\n\n`;
    text += skill.content;

    if (skill.examples && skill.examples.length > 0) {
      text += "\n\n**Examples:**\n";
      for (const example of skill.examples.slice(0, 2)) {
        text += `- ${example.scenario}\n`;
      }
    }

    return text + "\n";
  }

  /**
   * Get all registered skills
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill count
   */
  get size(): number {
    return this.skills.size;
  }
}

/**
 * Context for skill matching
 */
export interface SkillContext {
  categories?: SkillCategory[];
  language?: string;
  frameworks?: string[];
  keywords?: string[];
  agentRole?: string;
  taskType?: string;
}

/**
 * Global skill registry instance
 */
export const globalSkills = new SkillRegistry();
