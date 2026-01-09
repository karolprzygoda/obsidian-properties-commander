/**
 * Types and interfaces for Properties Commander plugin
 */

// Property action types for modal operations
export type PropertyAction = 'add' | 'remove' | 'edit';

// Supported property value types in Obsidian frontmatter
export type PropertyValueType = 'text' | 'number' | 'checkbox' | 'date' | 'list';

// Union type for all possible property values
export type PropertyValue = string | number | boolean | string[];

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

// Edit state for a single property in the edit modal
export interface PropertyEdit {
  originalKey: string;
  newKey: string;
  enabled: boolean;
  updateValue: boolean; // Whether to update the value (vs just rename)
  type: PropertyValueType;
  value: PropertyValue;
  originalValue: PropertyValue;
}
