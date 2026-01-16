/**
 * Types and interfaces for Properties Commander plugin
 */

// Property action types for modal operations
export type PropertyAction = 'add' | 'remove' | 'rename' | 'edit-values';

// Supported property value types in Obsidian frontmatter
export type PropertyValueType = 'text' | 'number' | 'checkbox' | 'date' | 'list';

// Union type for all possible property values (including null for empty properties)
export type PropertyValue = string | number | boolean | string[] | null;

// Definition for a property to be added/edited
export interface PropertyDefinition {
  key: string;
  value: PropertyValue;
  type: PropertyValueType;
}

// Options for folder traversal
export interface FolderOptions {
  includeSubfolders: boolean;
  depthLevel: number; // -1 for infinity
}

// Represents an existing property found in files
export interface ExistingProperty {
  key: string;
  values: Set<PropertyValue>;
  types: Set<PropertyValueType>;
}

// Rename state for a single property
export interface PropertyRename {
  originalKey: string;
  newKey: string;
  enabled: boolean;
}

// Edit value state for a single property
export interface PropertyValueEdit {
  key: string;
  enabled: boolean;
  type: PropertyValueType;
  value: PropertyValue;
  originalValue: PropertyValue;
}
