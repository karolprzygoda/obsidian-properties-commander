import { ButtonComponent, Notice, Setting, TextComponent, TFile, TFolder, ToggleComponent } from 'obsidian';
import type { PropertyRename } from '../types';
import { PropertyUtils } from '../utils/property-utils';
import { BasePropertiesModal } from './base-properties-modal';

/**
 * Modal for renaming property names (keys) in files
 */
export class RenamePropertiesModal extends BasePropertiesModal {
  private propertyRenames: Map<string, PropertyRename> = new Map();
  private addToFilesWithoutProperty: boolean = false;
  private listContainer: HTMLElement | null = null;

  constructor(propertyUtils: PropertyUtils, files: TFile[], folder: TFolder | null = null) {
    super(propertyUtils, files, folder);
  }

  renderContent(container: HTMLElement) {
    container.createEl('h2', { text: 'Rename properties' });
    container.createEl('p', {
      text: `Renaming property names in ${this.files.length} file(s)`,
      cls: 'properties-commander-subtitle',
    });

    if (this.existingProperties.size === 0) {
      container.createEl('p', {
        text: 'No properties found in selected files.',
        cls: 'properties-commander-no-items',
      });
      return;
    }

    // Properties list
    this.listContainer = container.createDiv({
      cls: 'properties-commander-rename-list',
    });

    // Initialize renames from existing properties
    this.initializePropertyRenames();
    this.renderPropertyRows();

    // Option to add renamed properties to files that don't have them
    new Setting(container)
      .setName('Add to files without property')
      .setDesc("If enabled, files that don't have the original property will receive the new property (with empty value)")
      .addToggle((toggle) =>
        toggle.setValue(this.addToFilesWithoutProperty).onChange((value) => {
          this.addToFilesWithoutProperty = value;
        }),
      )
      .setClass('properties-setting-item-toggle-container');

    // Action buttons
    const buttonContainer = container.createDiv({
      cls: 'properties-commander-button-row',
    });

    new ButtonComponent(buttonContainer).setButtonText('Cancel').onClick(() => this.close());

    new ButtonComponent(buttonContainer)
      .setButtonText('Rename properties')
      .setCta()
      .onClick(() => this.handleSubmit());
  }

  private initializePropertyRenames() {
    this.propertyRenames.clear();

    Array.from(this.existingProperties.keys())
      .sort((a, b) => a.localeCompare(b))
      .forEach((key) => {
        this.propertyRenames.set(key, {
          originalKey: key,
          newKey: key,
          enabled: false,
        });
      });
  }

  private renderPropertyRows() {
    if (!this.listContainer) return;
    this.listContainer.empty();

    // Header row
    const headerEl = this.listContainer.createDiv({ cls: 'properties-commander-rename-header' });
    headerEl.createEl('span', { text: '', cls: 'properties-commander-rename-header-toggle' });
    headerEl.createEl('span', { text: 'Current name', cls: 'properties-commander-rename-header-current' });
    headerEl.createEl('span', { text: 'New name', cls: 'properties-commander-rename-header-new' });

    this.propertyRenames.forEach((rename) => {
      this.renderPropertyRow(rename);
    });
  }

  private renderPropertyRow(rename: PropertyRename) {
    if (!this.listContainer) return;

    const rowEl = this.listContainer.createDiv({
      cls: 'properties-commander-rename-row',
    });

    // Enable toggle
    const toggleContainer = rowEl.createDiv({ cls: 'properties-commander-rename-cell-toggle' });

    // Current property name (read-only)
    const currentContainer = rowEl.createDiv({ cls: 'properties-commander-rename-cell-current' });
    currentContainer.createEl('span', {
      text: rename.originalKey,
      cls: 'properties-commander-rename-key',
    });

    // New property name (editable)
    const newContainer = rowEl.createDiv({ cls: 'properties-commander-rename-cell-new' });
    const newKeyInput = new TextComponent(newContainer)
      .setValue(rename.newKey)
      .setPlaceholder('New property name')
      .onChange((value) => {
        rename.newKey = value.trim();
      });

    // Set initial disabled state
    newKeyInput.setDisabled(!rename.enabled);
    newContainer.toggleClass('properties-commander-disabled', !rename.enabled);

    // Toggle component (created after inputs so we can reference them)
    new ToggleComponent(toggleContainer).setValue(rename.enabled).onChange((value) => {
      rename.enabled = value;
      rowEl.toggleClass('properties-commander-rename-row-enabled', value);
      newKeyInput.setDisabled(!value);
      newContainer.toggleClass('properties-commander-disabled', !value);
    });
  }

  protected onPropertiesReloaded() {
    this.initializePropertyRenames();
    this.renderPropertyRows();
  }

  private async handleSubmit() {
    const enabledRenames = Array.from(this.propertyRenames.values()).filter(
      (r) => r.enabled && r.originalKey !== r.newKey && r.newKey.length > 0,
    );

    if (enabledRenames.length === 0) {
      new Notice('Please select at least one property and change its name');
      return;
    }

    let totalRenamed = 0;
    let totalAdded = 0;

    for (const file of this.files) {
      for (const rename of enabledRenames) {
        const renamed = await this.propertyUtils.renamePropertyKey(file, rename.originalKey, rename.newKey);
        if (renamed) {
          totalRenamed++;
        } else if (this.addToFilesWithoutProperty) {
          // File doesn't have the original property, add the new one with empty value
          const added = await this.propertyUtils.addPropertiesToFile(file, [
            { key: rename.newKey, value: '', type: 'text' },
          ]);
          if (added > 0) totalAdded++;
        }
      }
    }

    const messageParts: string[] = [];
    if (totalRenamed > 0) messageParts.push(`renamed ${totalRenamed}`);
    if (totalAdded > 0) messageParts.push(`added ${totalAdded}`);

    const message = messageParts.length > 0 ? `Properties: ${messageParts.join(', ')}` : 'No changes made';
    new Notice(message);
    this.close();
  }
}
