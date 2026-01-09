import {
  ButtonComponent,
  DropdownComponent,
  Notice,
  Setting,
  TextComponent,
  TFile,
  TFolder,
  ToggleComponent,
} from 'obsidian';
import type { PropertyEdit, PropertyValue, PropertyValueType } from '../types';
import { PropertyUtils } from '../utils/property-utils';
import { BasePropertiesModal } from './base-properties-modal';

/**
 * Modal for editing existing properties in files
 */
export class EditPropertiesModal extends BasePropertiesModal {
  private propertyEdits: Map<string, PropertyEdit> = new Map();
  private addToFilesWithoutProperty: boolean = false;
  private listContainer: HTMLElement | null = null;

  constructor(propertyUtils: PropertyUtils, files: TFile[], folder: TFolder | null = null) {
    super(propertyUtils, files, folder);
  }

  renderContent(container: HTMLElement) {
    container.createEl('h2', { text: 'Edit properties' });
    container.createEl('p', {
      text: `Editing properties in ${this.files.length} file(s)`,
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
      cls: 'properties-commander-edit-list',
    });

    // Initialize edits from existing properties
    this.initializePropertyEdits();
    this.renderPropertyRows();

    // Global option for adding to files without the property
    new Setting(container)
      .setName('Add to files without property')
      .setDesc("If enabled, files that don't have an edited property will receive it")
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
      .setButtonText('Apply changes')
      .setCta()
      .onClick(() => this.handleSubmit());
  }

  private initializePropertyEdits() {
    this.propertyEdits.clear();

    Array.from(this.existingProperties.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, prop]) => {
        // Get the most common value as default
        const valuesArray = Array.from(prop.values);
        const firstValue = valuesArray[0];
        const defaultValue: PropertyValue = firstValue !== undefined ? firstValue : '';
        const detectedType = this.propertyUtils.detectValueType(defaultValue);

        this.propertyEdits.set(key, {
          originalKey: key,
          newKey: key,
          enabled: false,
          updateValue: false, // By default, don't update value (only rename if key changes)
          type: detectedType,
          value: defaultValue,
          originalValue: defaultValue,
        });
      });
  }

  private renderPropertyRows() {
    if (!this.listContainer) return;
    this.listContainer.empty();

    // Header row
    const headerEl = this.listContainer.createDiv({ cls: 'properties-commander-edit-header' });
    headerEl.createEl('span', { text: '', cls: 'properties-commander-edit-header-toggle' });
    headerEl.createEl('span', { text: 'Property name', cls: 'properties-commander-edit-header-key' });
    headerEl.createEl('span', { text: '', cls: 'properties-commander-edit-header-update' });
    headerEl.createEl('span', { text: 'Type', cls: 'properties-commander-edit-header-type' });
    headerEl.createEl('span', { text: 'Value', cls: 'properties-commander-edit-header-value' });

    this.propertyEdits.forEach((edit) => {
      this.renderPropertyRow(edit);
    });
  }

  private renderPropertyRow(edit: PropertyEdit) {
    if (!this.listContainer) return;

    const rowEl = this.listContainer.createDiv({
      cls: 'properties-commander-edit-row',
    });

    // Enable toggle (select this property for editing)
    const toggleContainer = rowEl.createDiv({ cls: 'properties-commander-edit-cell-toggle' });
    new ToggleComponent(toggleContainer).setValue(edit.enabled).onChange((value) => {
      edit.enabled = value;
      rowEl.toggleClass('properties-commander-edit-row-enabled', value);
    });

    // Property key (editable input for renaming)
    const keyContainer = rowEl.createDiv({ cls: 'properties-commander-edit-cell-key' });
    new TextComponent(keyContainer)
      .setValue(edit.newKey)
      .setPlaceholder('Property name')
      .onChange((value) => {
        edit.newKey = value.trim();
      });

    // Update value toggle (whether to change the value or just rename)
    const updateContainer = rowEl.createDiv({ cls: 'properties-commander-edit-cell-update' });
    new ToggleComponent(updateContainer)
      .setValue(edit.updateValue)
      .setTooltip('Enable to update the value')
      .onChange((value) => {
        edit.updateValue = value;
        // Enable/disable type and value inputs based on toggle
        typeContainer.toggleClass('properties-commander-disabled', !value);
        valueContainer.toggleClass('properties-commander-disabled', !value);
      });

    // Type dropdown
    const typeContainer = rowEl.createDiv({ cls: 'properties-commander-edit-cell-type' });
    typeContainer.toggleClass('properties-commander-disabled', !edit.updateValue);
    new DropdownComponent(typeContainer)
      .addOption('text', 'Text')
      .addOption('number', 'Number')
      .addOption('checkbox', 'Checkbox')
      .addOption('date', 'Date')
      .addOption('list', 'List')
      .setValue(edit.type)
      .onChange((value) => {
        edit.type = value as PropertyValueType;
        // Reset value when type changes
        edit.value = this.propertyUtils.getDefaultValueForType(value as PropertyValueType);
        this.updateValueCell(valueContainer, edit);
      });

    // Value input
    const valueContainer = rowEl.createDiv({ cls: 'properties-commander-edit-cell-value' });
    valueContainer.toggleClass('properties-commander-disabled', !edit.updateValue);
    this.updateValueCell(valueContainer, edit);
  }

  private updateValueCell(container: HTMLElement, edit: PropertyEdit) {
    container.empty();

    switch (edit.type) {
      case 'checkbox':
        new ToggleComponent(container)
          .setValue(typeof edit.value === 'boolean' ? edit.value : false)
          .onChange((value) => {
            edit.value = value;
          });
        break;
      case 'number': {
        const numInput = container.createEl('input', {
          type: 'number',
          cls: 'properties-commander-input',
          value: String(typeof edit.value === 'number' ? edit.value : 0),
        });
        numInput.addEventListener('input', () => {
          edit.value = parseFloat(numInput.value) || 0;
        });
        break;
      }
      case 'date': {
        const dateInput = container.createEl('input', {
          type: 'date',
          cls: 'properties-commander-input',
          value: typeof edit.value === 'string' ? edit.value : '',
        });
        dateInput.addEventListener('input', () => {
          edit.value = dateInput.value;
        });
        break;
      }
      case 'list': {
        const listValue = Array.isArray(edit.value) ? edit.value.join(', ') : '';
        new TextComponent(container)
          .setValue(listValue)
          .setPlaceholder('Item 1, item 2, item 3')
          .onChange((value) => {
            edit.value = value
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s);
          });
        break;
      }
      default: // text
        new TextComponent(container)
          .setValue(typeof edit.value === 'string' ? edit.value : String(edit.value ?? ''))
          .setPlaceholder('Value')
          .onChange((value) => {
            edit.value = value;
          });
    }
  }

  protected onPropertiesReloaded() {
    this.initializePropertyEdits();
    this.renderPropertyRows();
  }

  private async handleSubmit() {
    const enabledEdits = Array.from(this.propertyEdits.values()).filter((e) => e.enabled);

    if (enabledEdits.length === 0) {
      new Notice('Please enable at least one property to edit');
      return;
    }

    // Validate: at least one action must be performed per enabled property
    const hasValidEdit = enabledEdits.some(
      (edit) => edit.updateValue || (edit.originalKey !== edit.newKey && edit.newKey.length > 0),
    );

    if (!hasValidEdit) {
      new Notice('Please rename a property or enable "Update" to change values');
      return;
    }

    let totalRenamed = 0;
    let totalUpdated = 0;
    let totalAdded = 0;

    for (const file of this.files) {
      for (const edit of enabledEdits) {
        // Check if key was renamed
        const keyRenamed = edit.originalKey !== edit.newKey && edit.newKey.length > 0;
        const targetKey = keyRenamed ? edit.newKey : edit.originalKey;

        // Rename the key if needed
        if (keyRenamed) {
          const renamed = await this.propertyUtils.renamePropertyKey(file, edit.originalKey, edit.newKey);
          if (renamed) totalRenamed++;
        }

        // Update the value only if updateValue is enabled
        if (edit.updateValue) {
          const result = await this.propertyUtils.updatePropertyValue(
            file,
            targetKey,
            edit.value,
            this.addToFilesWithoutProperty,
          );
          if (result === 'updated') totalUpdated++;
          else if (result === 'added') totalAdded++;
        }
      }
    }

    const messageParts: string[] = [];
    if (totalRenamed > 0) messageParts.push(`renamed ${totalRenamed}`);
    if (totalUpdated > 0) messageParts.push(`updated ${totalUpdated}`);
    if (totalAdded > 0) messageParts.push(`added ${totalAdded}`);

    const message = messageParts.length > 0 ? `Properties: ${messageParts.join(', ')}` : 'No changes made';
    new Notice(message);
    this.close();
  }
}
