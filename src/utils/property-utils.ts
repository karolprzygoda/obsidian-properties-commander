import { App, TFile, TFolder } from 'obsidian';
import type { PropertyDefinition, PropertyValue, PropertyValueType } from '../types';

/**
 * Utility functions for property operations
 */
export class PropertyUtils {
  constructor(private app: App) {}

  /**
   * Get all markdown files from a folder with optional depth control
   */
  getFilesFromFolder(
    folder: TFolder,
    includeSubfolders: boolean,
    depthLevel: number,
    currentDepth: number = 0,
  ): TFile[] {
    const files: TFile[] = [];

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        files.push(child);
      } else if (child instanceof TFolder && includeSubfolders && (depthLevel === -1 || currentDepth < depthLevel)) {
        files.push(...this.getFilesFromFolder(child, includeSubfolders, depthLevel, currentDepth + 1));
      }
    }

    return files;
  }

  /**
   * Get all properties from a file's frontmatter
   */
  async getPropertiesFromFile(file: TFile): Promise<Record<string, PropertyValue>> {
    const properties: Record<string, PropertyValue> = {};

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(frontmatter)) {
          if (this.isPropertyValue(value)) {
            properties[key] = value;
          }
        }
      });
    } catch {
      // File might not have frontmatter
    }

    return properties;
  }

  /**
   * Type guard for PropertyValue
   */
  isPropertyValue(value: unknown): value is PropertyValue {
    if (typeof value === 'string') return true;
    if (typeof value === 'number') return true;
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return true;
    return false;
  }

  /**
   * Detect the type of a property value
   */
  detectValueType(value: PropertyValue): PropertyValueType {
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'list';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
    return 'text';
  }

  /**
   * Add properties to a file's frontmatter
   */
  async addPropertiesToFile(file: TFile, properties: PropertyDefinition[]): Promise<number> {
    let added = 0;

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        for (const prop of properties) {
          if (!prop.key) continue;

          // Only add if key doesn't exist
          if (!(prop.key in frontmatter)) {
            frontmatter[prop.key] = prop.value;
            added++;
          }
        }
      });
    } catch (error) {
      console.error(`Error adding properties to ${file.path}:`, error);
    }

    return added;
  }

  /**
   * Remove properties from a file's frontmatter
   */
  async removePropertiesFromFile(file: TFile, keys: string[]): Promise<number> {
    let removed = 0;

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        for (const key of keys) {
          if (key in frontmatter) {
            delete frontmatter[key];
            removed++;
          }
        }
      });
    } catch (error) {
      console.error(`Error removing properties from ${file.path}:`, error);
    }

    return removed;
  }

  /**
   * Rename a property key in a file's frontmatter
   */
  async renamePropertyKey(file: TFile, oldKey: string, newKey: string): Promise<boolean> {
    let renamed = false;

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        if (oldKey in frontmatter) {
          frontmatter[newKey] = frontmatter[oldKey];
          delete frontmatter[oldKey];
          renamed = true;
        }
      });
    } catch (error) {
      console.error(`Error renaming property in ${file.path}:`, error);
    }

    return renamed;
  }

  /**
   * Update a property value in a file's frontmatter
   */
  async updatePropertyValue(
    file: TFile,
    key: string,
    value: PropertyValue,
    addIfMissing: boolean,
  ): Promise<'updated' | 'added' | 'none'> {
    let result: 'updated' | 'added' | 'none' = 'none';

    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
        if (key in frontmatter) {
          frontmatter[key] = value;
          result = 'updated';
        } else if (addIfMissing) {
          frontmatter[key] = value;
          result = 'added';
        }
      });
    } catch (error) {
      console.error(`Error updating property in ${file.path}:`, error);
    }

    return result;
  }

  /**
   * Get default value for a property type
   */
  getDefaultValueForType(type: PropertyValueType): PropertyValue {
    switch (type) {
      case 'checkbox':
        return false;
      case 'number':
        return 0;
      case 'list':
        return [];
      case 'date':
        return '';
      default:
        return '';
    }
  }

  /**
   * Format a property value for display
   */
  formatValue(value: PropertyValue | null | undefined): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return '{...}';
    return String(value).slice(0, 20);
  }
}
